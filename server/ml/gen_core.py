"""Shared synthetic-data generation for EMPULSE (features + risk outcomes).

The same generator makes (a) the large historical pool the models are trained on and
(b) the 1,240-person roster. All data is SYNTHETIC. The relationships (workload,
overtime, low mood, low work-life balance raise burnout; low satisfaction, low pay,
stalled promotion raise attrition) follow the correlations found in the EMPULSE and IBM
datasets, but the numbers are invented.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from empulse_ml import sigmoid

LEVEL_INCOME = {1: 6000, 2: 9000, 3: 14000, 4: 21000, 5: 32000}


def sample_features(n: int, rng: np.random.Generator, eff: np.ndarray | None = None) -> pd.DataFrame:
    """Current-state features for n people. `eff` is a context effect (team/department
    strain) added to each person's latent strain."""
    if eff is None:
        eff = rng.normal(0, 0.55, n)
    s = 0.7 * rng.normal(0, 1, n) + eff

    level = rng.choice([1, 2, 3, 4, 5], n, p=[0.33, 0.30, 0.22, 0.10, 0.05])
    tenure = np.clip(rng.gamma(2.0, 2.2, n) + (level - 1) * 0.8, 0.2, 24)
    workload = np.clip(66 + 12 * s + rng.normal(0, 5, n), 25, 100)
    overtime = np.clip(9 + 5.5 * s + rng.normal(0, 3, n), 0, 45)
    wlb = np.clip(3.0 - 0.55 * s + rng.normal(0, 0.5, n), 1, 4)
    sat = np.clip(3.0 - 0.40 * s + rng.normal(0, 0.6, n), 1, 4)
    mood = np.clip(3.9 - 0.42 * s + rng.normal(0, 0.45, n), 1, 5)
    engagement = np.clip(78 - 5 * s + rng.normal(0, 8, n), 30, 100)
    absence = np.clip(np.round(5 + 1.8 * s + rng.normal(0, 2.2, n)), 0, 25)
    recog = rng.poisson(1.8, n).clip(0, 12)
    training = rng.poisson(3.0, n).clip(0, 8)
    ysp = np.minimum(rng.gamma(1.5, 1.3, n), np.maximum(tenure, 0.2))
    income_ratio = np.clip(rng.normal(1.0, 0.15, n), 0.6, 1.6)
    income = np.array([LEVEL_INCOME[int(l)] for l in level]) * income_ratio

    return pd.DataFrame(
        {
            "workload_index": workload.round(1),
            "overtime_hours_monthly": overtime.round(1),
            "work_life_balance": wlb.round(2),
            "job_satisfaction": sat.round(2),
            "mood_score": mood.round(2),
            "engagement_score": engagement.round(1),
            "absence_days_annual": absence,
            "recognition_90d": recog,
            "tenure_years": tenure.round(1),
            "job_level": level,
            "training_times_last_year": training,
            "years_since_promotion": ysp.round(1),
            "income_ratio": income_ratio.round(3),
            "monthly_income_sar": (income / 50).round() * 50,
            "latent_strain": s.round(3),
        }
    )


def burnout_logit(df: pd.DataFrame) -> np.ndarray:
    return (
        0.030 * (df["workload_index"] - 66)
        + 0.060 * (df["overtime_hours_monthly"] - 9)
        - 0.55 * (df["work_life_balance"] - 3)
        - 0.35 * (df["job_satisfaction"] - 3)
        - 0.70 * (df["mood_score"] - 3.9)
        - 0.018 * (df["engagement_score"] - 78)
        + 0.07 * (df["absence_days_annual"] - 5)
        - 0.10 * (df["recognition_90d"] - 1.8)
        + 0.05 * (df["job_level"] - 2)
    ).to_numpy()


def attrition_logit(df: pd.DataFrame) -> np.ndarray:
    return (
        -0.55 * (df["job_satisfaction"] - 3)
        - 0.020 * (df["engagement_score"] - 78)
        + 0.035 * (df["overtime_hours_monthly"] - 9)
        - 0.30 * (df["work_life_balance"] - 3)
        + 0.012 * (df["workload_index"] - 66)
        - 0.25 * (df["mood_score"] - 3.9)
        - 2.2 * (df["income_ratio"] - 1.0)
        - 0.045 * (df["tenure_years"] - 5)
        + 0.12 * (df["years_since_promotion"] - 1.9)
        - 0.12 * (df["recognition_90d"] - 1.8)
        - 0.05 * (df["training_times_last_year"] - 3)
    ).to_numpy()


def calibrate_intercept(logit: np.ndarray, noise_sd: float, target: float, rng: np.random.Generator) -> float:
    """Find b so that mean(sigmoid(logit + b + noise)) == target."""
    noise = rng.normal(0, noise_sd, len(logit))
    lo, hi = -10.0, 10.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if sigmoid(logit + mid + noise).mean() > target:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def make_labels(df: pd.DataFrame, rng: np.random.Generator, b_burn: float, b_att: float, noise_sd: float = 0.6):
    """Draw 90-day burnout event and 12-month exit outcomes for a historical pool."""
    pb = sigmoid(burnout_logit(df) + b_burn + rng.normal(0, noise_sd, len(df)))
    pa = sigmoid(attrition_logit(df) + b_att + 0.8 * (pb - pb.mean()) + rng.normal(0, noise_sd, len(df)))
    return (rng.random(len(df)) < pb).astype(int), (rng.random(len(df)) < pa).astype(int)
