# %% [markdown]
# # EMPULSE: exploratory analysis of the two datasets
# EMPULSE synthetic dataset (1,000 employees) and the IBM HR Attrition dataset (1,470 rows).
# Purpose: show which signals relate to burnout risk and attrition. This is what the models in `ml/` build on.
# All EMPULSE data is synthetic; burnout risk is decision support, not a diagnosis.

# %%
import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
RAW = HERE / "data" / "raw"
FIG = HERE / "reports" / "figures"
FIG.mkdir(parents=True, exist_ok=True)
emp = pd.read_excel(RAW / "EMPULSE_Synthetic_Dataset_1000.xlsx", sheet_name="EMPULSE_Data")
ibm = pd.read_csv(RAW / "IBM_HR_Attrition.csv")
print(emp.shape, ibm.shape)

# %% [markdown]
# ## 1. What moves burnout risk in the EMPULSE dataset?

# %%
cols = ["WorkloadIndex", "OvertimeHoursMonthly", "WorkLifeBalance", "JobSatisfaction", "MoodScore",
        "EngagementScore", "AbsenceDaysAnnual", "RecognitionCount", "PerformanceRating", "TaskCompletionRate"]
corr = emp[cols + ["BurnoutRisk"]].corr()["BurnoutRisk"].drop("BurnoutRisk").sort_values()
print(corr.round(2))
fig, ax = plt.subplots(figsize=(7, 4))
corr.plot.barh(ax=ax, color=["#14b8a6" if v < 0 else "#ef5a48" for v in corr])
ax.set_title("Correlation with BurnoutRisk (EMPULSE)")
fig.tight_layout()
fig.savefig(FIG / "burnout_correlations.png", dpi=130)

# %% [markdown]
# ## 2. Burnout risk by overtime and by department

# %%
print(emp.groupby("OverTime")["BurnoutRisk"].agg(["mean", "count"]).round(1))
print(emp.groupby("Department")["BurnoutRisk"].mean().round(1).sort_values(ascending=False))
print(emp["BurnoutLevel"].value_counts())

# %% [markdown]
# ## 3. Wellbeing is not performance
# Performance and wellbeing are only weakly related, so a high performer can be at high burnout risk.
# This is why the EMPULSE design keeps them as two separate axes (Performance-Wellbeing Matrix).

# %%
print(emp[["TaskCompletionRate", "TaskQualityScore", "WellbeingScore", "BurnoutRisk"]].corr().round(2))

# %% [markdown]
# ## 4. Attrition drivers in the real IBM dataset

# %%
ibm["left"] = (ibm["Attrition"] == "Yes").astype(int)
print("overall attrition rate:", round(ibm["left"].mean() * 100, 1), "%")
for c in ["OverTime", "JobSatisfaction", "WorkLifeBalance", "JobLevel"]:
    print(ibm.groupby(c)["left"].mean().mul(100).round(1).to_string(), "\n")
fig, ax = plt.subplots(figsize=(5, 3.5))
ibm.groupby("OverTime")["left"].mean().mul(100).plot.bar(ax=ax, color="#0e2944")
ax.set_ylabel("Attrition %")
ax.set_title("IBM: attrition by overtime")
fig.tight_layout()
fig.savefig(FIG / "ibm_attrition_overtime.png", dpi=130)

# %% [markdown]
# ## 5. Take-aways used in the project
# 1. Workload, overtime and low work-life balance are the strongest burnout signals.
# 2. Overtime roughly triples attrition in the IBM data (30% vs 10%); low satisfaction and low income also raise it.
# 3. These relationships were used to design the synthetic generator (`ml/gen_core.py`) and to choose model features.
