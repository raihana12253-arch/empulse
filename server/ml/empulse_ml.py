"""EMPULSE ML runtime helpers.

Used by the training and data scripts and, later, by the Python ML service that PHP calls
(load the saved bundles with joblib and call predict_proba / drivers / simulate). Only needs numpy, pandas,
scikit-learn and joblib. No retraining happens in web requests.

Burnout risk and attrition risk are DECISION SUPPORT, not diagnoses.
"""
from __future__ import annotations

from math import factorial
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

MODELS_DIR = Path(__file__).resolve().parent / "models"

BURNOUT_FEATURES = [
    "workload_index",
    "overtime_hours_monthly",
    "work_life_balance",
    "job_satisfaction",
    "mood_score",
    "engagement_score",
    "absence_days_annual",
    "recognition_90d",
    "tenure_years",
    "job_level",
    "training_times_last_year",
]

ATTRITION_FEATURES = [
    "job_satisfaction",
    "engagement_score",
    "overtime_hours_monthly",
    "work_life_balance",
    "workload_index",
    "mood_score",
    "income_ratio",
    "tenure_years",
    "years_since_promotion",
    "recognition_90d",
    "training_times_last_year",
    "job_level",
]

FEATURE_LABELS = {
    "workload_index": "Workload",
    "overtime_hours_monthly": "Overtime hours",
    "work_life_balance": "Work-life balance",
    "job_satisfaction": "Job satisfaction",
    "mood_score": "Mood",
    "engagement_score": "Engagement",
    "absence_days_annual": "Absence days",
    "recognition_90d": "Recent recognition",
    "tenure_years": "Tenure",
    "job_level": "Job level",
    "training_times_last_year": "Training",
    "income_ratio": "Pay vs level median",
    "years_since_promotion": "Time since promotion",
}

# Risk bands (percent). Matches the design: Khalid 72 High, Maha 35 Low.
HIGH_RISK_PCT = 60.0
MODERATE_RISK_PCT = 40.0

# Economic assumption used by simulate() and the economic tables: cost of replacing a
# person = this multiple of annual salary. Documented in docs/DATA_SCHEMA.md.
REPLACEMENT_COST_MULTIPLIER = 1.0


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def risk_level(pct: float) -> str:
    if pct >= HIGH_RISK_PCT:
        return "High"
    if pct >= MODERATE_RISK_PCT:
        return "Moderate"
    return "Low"


def load_bundle(name: str) -> dict:
    """name: 'burnout' or 'attrition'."""
    return joblib.load(MODELS_DIR / f"{name}_model.pkl")


def predict_proba(bundle: dict, df: pd.DataFrame) -> np.ndarray:
    """Calibrated probability (0..1) for each row of df.

    Passes a DataFrame with the training feature names so sklearn does not warn
    about missing feature names when the HistGradientBoosting model was fitted
    on a named frame.
    """
    feats = bundle["features"]
    X = df.loc[:, feats].astype(float)
    f = bundle["model"].decision_function(X)
    return sigmoid(bundle["a"] * f + bundle["b"])


def _predict_matrix(bundle: dict, X: np.ndarray) -> np.ndarray:
    """decision_function on a matrix, preserving training feature names."""
    feats = bundle["features"]
    X_df = pd.DataFrame(X, columns=feats)
    f = bundle["model"].decision_function(X_df)
    return sigmoid(bundle["a"] * f + bundle["b"])


def shapley_values(bundle: dict, x: np.ndarray, baseline: np.ndarray | None = None):
    """Exact Shapley values of one row against a baseline row (probability points).

    Same idea as SHAP with a single reference row, computed exactly by enumerating all
    2^d feature coalitions (d <= 12 here). Returns (phi, p_baseline, p_x) with
    sum(phi) == p_x - p_baseline.
    """
    d = len(x)
    if baseline is None:
        baseline = np.array([bundle["baseline"][f] for f in bundle["features"]], dtype=float)
    masks = np.arange(2**d)
    bits = ((masks[:, None] >> np.arange(d)) & 1).astype(bool)
    X = np.where(bits, x[None, :], baseline[None, :])
    v = _predict_matrix(bundle, X)
    sizes = bits.sum(axis=1)
    w = np.array([factorial(k) * factorial(d - k - 1) / factorial(d) for k in range(d)])
    phi = np.zeros(d)
    for i in range(d):
        without = masks[~bits[:, i]]
        phi[i] = np.sum(w[sizes[without]] * (v[without | (1 << i)] - v[without]))
    return phi, float(v[0]), float(v[-1])


def drivers(bundle: dict, row: dict | pd.Series, top_k: int = 4) -> dict:
    """Explain one person's risk. Impacts are in percentage points of risk.

    Returns {"risk_pct", "baseline_pct", "increasing": [...], "protective": [...]}.
    Each item: {feature, label, value, baseline_value, impact_pts}.
    """
    feats = bundle["features"]
    x = np.array([float(row[f]) for f in feats])
    base = np.array([bundle["baseline"][f] for f in feats], dtype=float)
    phi, p0, p1 = shapley_values(bundle, x, base)
    items = [
        {
            "feature": f,
            "label": FEATURE_LABELS.get(f, f),
            "value": round(float(x[i]), 2),
            "baseline_value": round(float(base[i]), 2),
            "impact_pts": round(float(phi[i] * 100), 1),
        }
        for i, f in enumerate(feats)
    ]
    up = sorted([it for it in items if it["impact_pts"] > 0.05], key=lambda t: -t["impact_pts"])
    down = sorted([it for it in items if it["impact_pts"] < -0.05], key=lambda t: t["impact_pts"])
    return {
        "risk_pct": round(p1 * 100, 1),
        "baseline_pct": round(p0 * 100, 1),
        "increasing": up[:top_k],
        "protective": down[:top_k],
    }


# ---------------------------------------------------------------- What-if simulator

DEFAULT_LEVERS = {
    "workload_change_pct": 0.0,       # e.g. -10 = workload index 10% lower
    "overtime_change_pct": 0.0,       # e.g. -25 = 25% fewer overtime hours
    "work_life_balance_plus": 0.0,    # points on the 1-4 scale
    "job_satisfaction_plus": 0.0,     # points on the 1-4 scale
    "mood_plus": 0.0,                 # points on the 1-5 scale
    "engagement_plus": 0.0,           # points on 0-100
    "recognition_plus": 0.0,          # extra recognitions per 90 days
    "training_plus": 0.0,             # extra training events per year
}


def apply_levers(df: pd.DataFrame, levers: dict) -> pd.DataFrame:
    lv = {**DEFAULT_LEVERS, **(levers or {})}
    out = df.copy()
    out["workload_index"] = (out["workload_index"] * (1 + lv["workload_change_pct"] / 100)).clip(0, 100)
    out["overtime_hours_monthly"] = (out["overtime_hours_monthly"] * (1 + lv["overtime_change_pct"] / 100)).clip(0, 60)
    out["work_life_balance"] = (out["work_life_balance"] + lv["work_life_balance_plus"]).clip(1, 4)
    out["job_satisfaction"] = (out["job_satisfaction"] + lv["job_satisfaction_plus"]).clip(1, 4)
    out["mood_score"] = (out["mood_score"] + lv["mood_plus"]).clip(1, 5)
    out["engagement_score"] = (out["engagement_score"] + lv["engagement_plus"]).clip(0, 100)
    out["recognition_90d"] = (out["recognition_90d"] + lv["recognition_plus"]).clip(0, 20)
    out["training_times_last_year"] = (out["training_times_last_year"] + lv["training_plus"]).clip(0, 12)
    return out


def simulate(df: pd.DataFrame, levers: dict, burnout=None, attrition=None) -> dict:
    """What-if: re-run both models on adjusted inputs for a group of employees.

    df needs the feature columns of both models plus monthly_income_sar.
    Privacy: callers must pass an aggregate group of at least 5 people.
    """
    burnout = burnout or load_bundle("burnout")
    attrition = attrition or load_bundle("attrition")
    if len(df) < 5:
        raise ValueError("Group smaller than 5 people: simulation suppressed.")
    after = apply_levers(df, levers)
    b0, b1 = predict_proba(burnout, df), predict_proba(burnout, after)
    a0, a1 = predict_proba(attrition, df), predict_proba(attrition, after)
    annual = df["monthly_income_sar"].to_numpy(float) * 12
    cost0 = float(np.sum(a0 * annual * REPLACEMENT_COST_MULTIPLIER))
    cost1 = float(np.sum(a1 * annual * REPLACEMENT_COST_MULTIPLIER))
    return {
        "people": int(len(df)),
        "burnout_risk_avg_pct": [round(float(b0.mean() * 100), 1), round(float(b1.mean() * 100), 1)],
        "high_risk_count": [int((b0 * 100 >= HIGH_RISK_PCT).sum()), int((b1 * 100 >= HIGH_RISK_PCT).sum())],
        "attrition_risk_avg_pct": [round(float(a0.mean() * 100), 1), round(float(a1.mean() * 100), 1)],
        "expected_exits_12m": [round(float(a0.sum()), 1), round(float(a1.sum()), 1)],
        "expected_exit_cost_sar": [round(cost0), round(cost1)],
        "estimated_saving_sar": round(cost0 - cost1),
    }
