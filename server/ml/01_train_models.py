"""Train the EMPULSE burnout and attrition models and write the accuracy report.

Run:   python server/ml/01_train_models.py

Outputs:
  ml/models/burnout_model.pkl, ml/models/attrition_model.pkl
  ml/reports/model_report.md, ml/reports/metrics.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, brier_score_loss, f1_score, precision_recall_curve,
                             roc_auc_score)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import empulse_ml as E  # noqa: E402
import gen_core as G  # noqa: E402

SEED = 20261010
N_POOL = 6000
BURNOUT_PREVALENCE = 0.22
ATTRITION_PREVALENCE = 0.13


def fit_bundle(name, features, X, y, rng_seed):
    """60% train / 15% calibration / 25% test. Platt scaling on the calibration split."""
    Xtr, Xtmp, ytr, ytmp = train_test_split(X, y, test_size=0.40, stratify=y, random_state=rng_seed)
    Xcal, Xte, ycal, yte = train_test_split(Xtmp, ytmp, test_size=0.625, stratify=ytmp, random_state=rng_seed)
    model = HistGradientBoostingClassifier(
        max_iter=250, learning_rate=0.05, max_depth=3, min_samples_leaf=30,
        l2_regularization=1.0, random_state=rng_seed,
    )
    model.fit(Xtr[features], ytr)
    f_cal = model.decision_function(Xcal[features]).reshape(-1, 1)
    platt = LogisticRegression(C=1e6).fit(f_cal, ycal)
    a, b = float(platt.coef_[0][0]), float(platt.intercept_[0])

    bundle = {
        "model": model, "a": a, "b": b, "features": features,
        "baseline": {f: float(Xtr[f].mean()) for f in features},
        "meta": {"name": name, "trained_on": "synthetic pool", "n_pool": int(len(X)), "seed": rng_seed,
                 "note": "Decision support, not a diagnosis."},
    }
    p = E.predict_proba(bundle, Xte)
    auc = float(roc_auc_score(yte, p))
    prec, rec, thr = precision_recall_curve(yte, p)
    f1s = 2 * prec * rec / np.clip(prec + rec, 1e-9, None)
    k = int(np.argmax(f1s[:-1]))
    best_thr = float(thr[k])
    order = np.argsort(-p)
    top = order[: max(1, len(p) // 10)]
    lift = float(yte.to_numpy()[top].mean() / yte.mean())
    cal = pd.DataFrame({"p": p, "y": yte.to_numpy()})
    cal["decile"] = pd.qcut(cal["p"].rank(method="first"), 10, labels=False) + 1
    cal_tbl = cal.groupby("decile").agg(predicted=("p", "mean"), observed=("y", "mean"), n=("y", "size")).round(3)
    pi = permutation_importance(
        model, Xte[features], yte, n_repeats=8, random_state=rng_seed, scoring="roc_auc")
    imp = pd.Series(pi.importances_mean, index=features).sort_values(ascending=False)
    metrics = {
        "n_train": int(len(Xtr)), "n_calibration": int(len(Xcal)), "n_test": int(len(Xte)),
        "prevalence_test": round(float(yte.mean()), 3),
        "auc": round(auc, 3),
        "accuracy_at_0.5": round(float(accuracy_score(yte, p >= 0.5)), 3),
        "best_f1_threshold": round(best_thr, 3),
        "precision_at_best_f1": round(float(prec[k]), 3),
        "recall_at_best_f1": round(float(rec[k]), 3),
        "f1_at_best": round(float(f1s[k]), 3),
        "brier": round(float(brier_score_loss(yte, p)), 4),
        "top_decile_lift": round(lift, 2),
    }
    bundle["meta"]["metrics"] = metrics
    return bundle, metrics, cal_tbl, imp


def ibm_benchmark():
    """Same kind of model on the real IBM HR dataset, as an external sanity check."""
    path = HERE / "data" / "raw" / "IBM_HR_Attrition.csv"
    if not path.exists():
        return None
    d = pd.read_csv(path)
    y = (d["Attrition"] == "Yes").astype(int)
    X = pd.DataFrame({
        "OverTime": (d["OverTime"] == "Yes").astype(int),
        "JobSatisfaction": d["JobSatisfaction"], "WorkLifeBalance": d["WorkLifeBalance"],
        "EnvironmentSatisfaction": d["EnvironmentSatisfaction"], "JobInvolvement": d["JobInvolvement"],
        "MonthlyIncome": d["MonthlyIncome"], "YearsAtCompany": d["YearsAtCompany"],
        "YearsSinceLastPromotion": d["YearsSinceLastPromotion"], "Age": d["Age"], "JobLevel": d["JobLevel"],
        "DistanceFromHome": d["DistanceFromHome"], "TotalWorkingYears": d["TotalWorkingYears"],
        "NumCompaniesWorked": d["NumCompaniesWorked"], "StockOptionLevel": d["StockOptionLevel"],
        "TrainingTimesLastYear": d["TrainingTimesLastYear"], "YearsWithCurrManager": d["YearsWithCurrManager"],
    })
    m = HistGradientBoostingClassifier(max_iter=200, learning_rate=0.05, max_depth=3,
                                       min_samples_leaf=20, l2_regularization=1.0, random_state=SEED)
    cv = StratifiedKFold(5, shuffle=True, random_state=SEED)
    auc = cross_val_score(m, X, y, cv=cv, scoring="roc_auc")
    return {"rows": int(len(d)), "leavers": int(y.sum()), "cv_auc_mean": round(float(auc.mean()), 3),
            "cv_auc_std": round(float(auc.std()), 3)}


def main():
    rng = np.random.default_rng(SEED)
    pool = G.sample_features(N_POOL, rng)
    b_burn = G.calibrate_intercept(G.burnout_logit(pool), 0.6, BURNOUT_PREVALENCE, rng)
    b_att = G.calibrate_intercept(G.attrition_logit(pool), 0.6, ATTRITION_PREVALENCE, rng)
    y_burn, y_att = G.make_labels(pool, rng, b_burn, b_att)
    pool["burnout_event_90d"] = y_burn
    pool["left_within_12m"] = y_att

    (HERE / "models").mkdir(exist_ok=True)
    (HERE / "reports").mkdir(exist_ok=True)
    pool.to_csv(HERE / "reports" / "training_pool_sample.csv", index=False)  # for the notebook

    results = {}
    for name, feats, ycol in [("burnout", E.BURNOUT_FEATURES, "burnout_event_90d"),
                              ("attrition", E.ATTRITION_FEATURES, "left_within_12m")]:
        bundle, metrics, cal_tbl, imp = fit_bundle(name, feats, pool, pool[ycol], SEED)
        joblib.dump(bundle, HERE / "models" / f"{name}_model.pkl")
        results[name] = {"metrics": metrics, "calibration": cal_tbl, "importance": imp}
        print(name, metrics)

    ibm = ibm_benchmark()
    (HERE / "reports" / "metrics.json").write_text(json.dumps(
        {"burnout": results["burnout"]["metrics"], "attrition": results["attrition"]["metrics"], "ibm_benchmark": ibm},
        indent=2))

    lines = ["# EMPULSE model report", "",
             "Both models are trained on a **synthetic** historical pool of "
             f"{N_POOL:,} employee snapshots generated by `ml/gen_core.py`. The numbers below show that the "
             "pipeline learns the patterns it was given; they are NOT evidence about real employees. "
             "Burnout risk is decision support, not a medical or psychological diagnosis.", "",
             "Method: HistGradientBoosting classifier, Platt-scaled probabilities, 60% train / 15% calibration / "
             "25% held-out test. Explanations are exact Shapley values against the average employee "
             "(`empulse_ml.drivers`).", ""]
    for name, title in [("burnout", "Burnout model (probability of a burnout event in the next 90 days)"),
                        ("attrition", "Attrition model (probability of leaving within 12 months)")]:
        m = results[name]["metrics"]
        lines += [f"## {title}", "", "| Metric | Value |", "|---|---|"]
        lines += [f"| {k} | {v} |" for k, v in m.items()]
        lines += ["", "Top features (permutation importance, drop in AUC):", "", "| Feature | Importance |", "|---|---|"]
        lines += [f"| {E.FEATURE_LABELS.get(k, k)} | {v:.3f} |" for k, v in results[name]["importance"].head(6).items()]
        lines += ["", "Calibration by decile of predicted risk (test set):", "",
                  "| Decile | Predicted | Observed | n |", "|---|---|---|---|"]
        lines += [f"| {i} | {r.predicted:.3f} | {r.observed:.3f} | {int(r.n)} |"
                  for i, r in results[name]["calibration"].iterrows()]
        lines.append("")
    if ibm:
        lines += ["## External sanity check on the real IBM HR dataset", "",
                  f"Same model family on `data/raw/IBM_HR_Attrition.csv` ({ibm['rows']:,} rows, "
                  f"{ibm['leavers']} leavers): 5-fold cross-validated AUC = **{ibm['cv_auc_mean']} "
                  f"± {ibm['cv_auc_std']}**.", ""]
    (HERE / "reports" / "model_report.md").write_text("\n".join(lines), encoding="utf-8")
    print("IBM", ibm)


if __name__ == "__main__":
    main()
