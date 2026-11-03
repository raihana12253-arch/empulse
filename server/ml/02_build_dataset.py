"""Build the EMPULSE demo data (1,240 people, 6 departments, 31 teams) so that it matches the design.

Run (after 01_train_models.py):   python server/ml/02_build_dataset.py

How it works, in short:
  1. Build the organisation (departments, teams, managers) from design_targets.py.
  2. PLAN the numbers the design shows: who is at elevated risk, each person's tier and score,
     engagement, who was recognized, who had an intervention, and each person's weekly risk.
  3. Ask the trained burnout model to produce exactly those risks: for every person and week we
     search the model inputs (workload, overtime, mood ...) until the model's answer equals the
     planned risk. So every stored risk really comes from the model.
  4. Make the seven criteria for every person so the EMPULSE Score lands on the planned score.
  5. Write the tables (data/generated/*.csv), check every design number and write a report.

ALL DATA IS SYNTHETIC. Names are invented.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import empulse_ml as E  # noqa: E402
import gen_core as G  # noqa: E402
import names as N  # noqa: E402
import design_targets as T  # noqa: E402

SEED = 20261011
rng = np.random.default_rng(SEED)
OUT = HERE / "data" / "generated"
REPORT = HERE / "reports" / "data_summary.md"

AS_OF = pd.Timestamp(T.AS_OF)
LAST = pd.Timestamp(T.LAST_WEEK)
NW = T.N_WEEKS
WEEKS = [LAST - pd.Timedelta(weeks=NW - 1 - i) for i in range(NW)]      # Mondays, oldest first
NOW = NW - 1                                                           # index of the latest week
W6 = NOW - 6                                                           # "6 weeks ago"

burn_b = E.load_bundle("burnout")
att_b = E.load_bundle("attrition")


def week_of(date) -> int:
    """Index of the week that contains this date."""
    d = pd.Timestamp(date)
    return int(np.clip((d - WEEKS[0]).days // 7, 0, NOW))


# month-end week of each month shown in H01 (Oct 2025 ... Sep 2026)
MONTHS = pd.period_range("2025-10", "2026-09", freq="M")
MONTH_END = [max(i for i, w in enumerate(WEEKS) if w.to_period("M") == m) for m in MONTHS]
ISO27 = [i for i, w in enumerate(WEEKS) if w.isocalendar().week == 27 and w.year == 2026][0]
HEAT_WEEKS = list(range(ISO27, ISO27 + 12))                            # ISO weeks 27..38
assert HEAT_WEEKS[-1] == NOW


def half_up(x):
    """Round half up, like PHP round() for positive numbers."""
    return np.floor(np.asarray(x, dtype=float) + 0.5).astype(int)


def fix_sum(v, target, free, lo, hi):
    """Add or remove 1 on randomly chosen free items until v.sum() == target (stays inside lo..hi)."""
    v = v.copy()
    lo = np.broadcast_to(lo, v.shape)
    hi = np.broadcast_to(hi, v.shape)
    diff = int(round(target - v.sum()))
    idx = np.where(free)[0]
    while diff != 0:
        step = 1 if diff > 0 else -1
        ok = idx[(v[idx] + step >= lo[idx]) & (v[idx] + step <= hi[idx])]
        if len(ok) == 0:
            raise RuntimeError("fix_sum: no room to move")
        pick = rng.choice(ok, min(abs(diff), len(ok)), replace=False)
        v[pick] += step
        diff -= step * len(pick)
    return v


def mean_sum(mean, n):
    """Integer total so that total / n rounds to `mean`."""
    return int(round(mean * n))


CHANGES = []        # design numbers we could not keep exactly (written to the report)


def changed(screen, design, data, why):
    CHANGES.append((screen, design, data, why))


# =====================================================================================
# 1. ORGANISATION
# =====================================================================================
named = {p["name"]: p for p in T.NAMED}
people = []
for dept, (headcount, teams) in T.DEPARTMENTS.items():
    people.append(dict(dept=dept, team=None, position="dept_head", spec=named.get(T.DEPT_HEAD.get(dept))))
    for team, members, lead in teams:
        people.append(dict(dept=dept, team=team, position="team_lead", spec=named.get(lead)))
        in_team = [p for p in T.NAMED if p.get("team") == team and not p.get("lead")]
        for j in range(members):
            people.append(dict(dept=dept, team=team, position="member", spec=in_team[j] if j < len(in_team) else None))
NP = len(people)
assert NP == 1240, NP
P = pd.DataFrame(people)
P["named"] = P["spec"].notna()
P["name"] = [s["name"] if s else None for s in P["spec"]]
IDX = {n: i for i, n in enumerate(P["name"]) if n}
spec = lambda i, key, default=None: (P.at[i, "spec"] or {}).get(key, default)  # noqa: E731

# reporting lines
P["manager_row"] = -1
P["is_line_manager"] = False
for dept, (_, teams) in T.DEPARTMENTS.items():
    head = P.index[(P["dept"] == dept) & (P["position"] == "dept_head")][0]
    for team, m, _ in teams:
        lead = P.index[(P["team"] == team) & (P["position"] == "team_lead")][0]
        P.at[lead, "manager_row"] = head
        mem = list(P.index[(P["team"] == team) & (P["position"] == "member")])
        if m <= 15:
            for i in mem:
                P.at[i, "manager_row"] = lead
            continue
        k = max(2, round(m / 11))
        free = [i for i in mem if not P.at[i, "named"]]
        lms = list(rng.choice(free, k, replace=False))
        rest = [i for i in mem if i not in lms]
        direct = rest[: max(0, 5 - k)]                     # the lead always has at least 5 direct reports
        for i in lms + direct:
            P.at[i, "manager_row"] = lead
        for j, i in enumerate(rest[len(direct):]):
            P.at[i, "manager_row"] = lms[j % k]
        P.loc[lms, "is_line_manager"] = True

# level, gender, tenure, work mode, age
lvl = rng.choice([1, 2, 3, 4], NP, p=[0.30, 0.34, 0.25, 0.11])
lvl = np.where(P["is_line_manager"], rng.choice([3, 4], NP, p=[0.6, 0.4]), lvl)
lvl = np.where(P["position"] == "team_lead", 4, lvl)
lvl = np.where(P["position"] == "dept_head", 5, lvl)
for i in P.index[P["named"]]:
    lvl[i] = spec(i, "level")
P["level"] = lvl
P["gender"] = [spec(i, "g") or ("F" if rng.random() < 0.42 else "M") for i in range(NP)]
tenure = np.clip(rng.gamma(2.0, 2.0, NP) + (lvl - 1) * 0.9, 0.3, 22)
for i in P.index[P["named"]]:
    if spec(i, "tenure"):
        tenure[i] = spec(i, "tenure")
P["tenure"] = tenure.round(1)
P["work_mode"] = rng.choice(["Hybrid", "On-site", "Remote"], NP, p=[0.58, 0.30, 0.12])
P["age"] = np.clip(np.round(23 + P["tenure"] + rng.gamma(2.0, 2.2, NP) + (lvl - 1) * 1.5), 22, 62).astype(int)
for n in ["Layla Haddad", "Khalid Mansour"]:
    P.at[IDX[n], "work_mode"] = "Hybrid"

# =====================================================================================
# 2. PLAN: who is at elevated burnout risk now (38 people)
# =====================================================================================
fixed_risk = {i: spec(i, "risk") for i in P.index[P["named"]] if spec(i, "risk") is not None}
P["elevated"] = False
for i, r in fixed_risk.items():
    P.at[i, "elevated"] = r >= T.HIGH_RISK
members = P["position"] == "member"
for team, k in T.ELEVATED_BY_TEAM.items():
    have = int(P.loc[P["team"] == team, "elevated"].sum())
    pool = P.index[(P["team"] == team) & members & ~P["named"]]
    P.loc[rng.choice(pool, k - have, replace=False), "elevated"] = True
done_teams = set(T.ELEVATED_BY_TEAM)
for dept, k in T.ELEVATED_BY_DEPT_REST.items():
    pool = P.index[(P["dept"] == dept) & members & ~P["named"] & ~P["team"].isin(done_teams)]
    P.loc[rng.choice(pool, k, replace=False), "elevated"] = True
assert P["elevated"].sum() == T.ELEVATED_NOW

# =====================================================================================
# 3. PLAN: tier of every person (exact counts per department, H02b)
# =====================================================================================
TIER_NAMES = [t for t, _ in T.TIERS]


def tier_of(score):
    for name, floor in T.TIERS:
        if score >= floor:
            return name
    return TIER_NAMES[-1]


W = np.array([T.WEIGHTS[c] for c in T.CRITERIA6])          # 10 25 15 15 10 10  (sum 85)


def score100(crit6, risk):
    """EMPULSE Score x 100 as an exact integer (criteria and risk are whole numbers)."""
    return crit6 @ W + T.WEIGHTS["job_burnout"] * (100 - np.asarray(risk))


fixed_score = {}
for i in P.index[P["named"]]:
    if spec(i, "criteria"):
        c = np.array([spec(i, "criteria")[k] for k in T.CRITERIA6])
        fixed_score[i] = int(half_up(score100(c, fixed_risk[i]) / 100))
    elif spec(i, "score") is not None:
        fixed_score[i] = spec(i, "score")
P["tier"] = None
for i, s in fixed_score.items():
    P.at[i, "tier"] = tier_of(s)

# latent "capability" (team effects make the H04 team scores possible)
TEAM_CAP = {"Security": 0.75, "Data Platform": 0.55, "App Engineering": 0.15, "IT Services": -0.45}
cap = rng.normal(0, 1, NP) + P["team"].map(TEAM_CAP).fillna(0).to_numpy()
cap += np.where(P["position"] != "member", 0.8, 0) + np.where(P["is_line_manager"], 0.4, 0)
# elevated people: 0 Gold (see report). Silver / Bronze / Growth split of the 38:
ELEV_SPLIT = {"Silver": 20, "Bronze": 13, "Growth Needed": 5}
el_free = P.index[P["elevated"] & P["tier"].isna()]
el_fixed = P.loc[P["elevated"] & P["tier"].notna(), "tier"].value_counts()
need = {t: ELEV_SPLIT[t] - int(el_fixed.get(t, 0)) for t in ELEV_SPLIT}
order = el_free[np.argsort(-cap[el_free])]
pos = 0
for t in ["Silver", "Bronze", "Growth Needed"]:
    P.loc[order[pos: pos + need[t]], "tier"] = t
    pos += need[t]
for dept in T.DEPARTMENTS:
    quota = dict(T.DEPT_TIERS[dept])
    for t, c in P.loc[(P["dept"] == dept) & P["tier"].notna(), "tier"].value_counts().items():
        quota[t] -= int(c)
    assert min(quota.values()) >= 0, (dept, quota)
    free = P.index[(P["dept"] == dept) & P["tier"].isna()]
    free = free[np.argsort(-cap[free])]
    pos = 0
    for t in TIER_NAMES:
        P.loc[free[pos: pos + quota[t]], "tier"] = t
        pos += quota[t]
assert P["tier"].isna().sum() == 0

# =====================================================================================
# 4. PLAN: burnout risk now (team and department averages, H04 / H06)
# =====================================================================================
TIER_RISK_SHIFT = {"Gold": -10, "Silver": -2, "Bronze": 3, "Growth Needed": 6}
risk = np.zeros(NP, dtype=int)
fixed = np.zeros(NP, dtype=bool)
for i, r in fixed_risk.items():
    risk[i], fixed[i] = r, True
el = P["elevated"].to_numpy()
n_el_free = int((el & ~fixed).sum())
risk[el & ~fixed] = rng.choice(np.arange(61, 75), n_el_free, p=np.linspace(2, 0.6, 14) / np.linspace(2, 0.6, 14).sum())
fixed |= el
leaders = (P["position"] != "member").to_numpy()
r_lead = np.clip(np.round(rng.normal(30, 6, NP)), 14, 48).astype(int)
risk[leaders & ~fixed] = r_lead[leaders & ~fixed]
fixed_lead = leaders.copy()
shift = P["tier"].map(TIER_RISK_SHIFT).to_numpy()
LO, HI = np.full(NP, 6), np.where(el, 80, 58)
HI = np.where(P["tier"] == "Gold", 42, HI)              # Gold needs low risk (score formula)

for dept, (hc, teams) in T.DEPARTMENTS.items():
    in_dept = (P["dept"] == dept).to_numpy()
    total = mean_sum(T.DEPT_RISK[dept], hc)
    team_names = [t for t, _, _ in teams]
    planned = {t: T.TEAM_RISK[t] for t in team_names if t in T.TEAM_RISK}
    # the remaining teams share what is left of the department total
    lead_sum = int(risk[in_dept & leaders].sum())
    planned_sum = sum(mean_sum(v, n) for t, n, _ in teams for tt, v in planned.items() if tt == t)
    rest = [(t, n) for t, n, _ in teams if t not in planned]
    rest_n = sum(n for _, n in rest)
    if rest:
        avg_rest = (total - lead_sum - planned_sum) / rest_n
        noise = rng.normal(0, 2.5, len(rest))
        means = avg_rest + noise - np.average(noise, weights=[n for _, n in rest])
        for (t, n), m in zip(rest, means):
            planned[t] = m
    for t, n, _ in teams:
        mask = ((P["team"] == t) & (P["position"] == "member")).to_numpy()
        free = mask & ~fixed
        if not free.any():                 # every member is a named person (Platform Reliability)
            continue
        base = planned[t] + shift + rng.normal(0, 7, NP)
        risk[free] = np.clip(np.round(base[free]), LO[free], HI[free])
        risk[:] = fix_sum(risk, mean_sum(planned[t], n) + int(risk[~mask].sum()), free, LO, HI)
    # exact department total (rounding of the free-team averages)
    named_rows = P["named"].to_numpy()
    free_d = in_dept & ~el & ~named_rows & (leaders | ~P["team"].isin(T.TEAM_RISK).to_numpy())
    risk[:] = fix_sum(risk, total + int(risk[~in_dept].sum()), free_d, LO, HI)
P["risk"] = risk
assert (P["risk"] >= T.HIGH_RISK).sum() == T.ELEVATED_NOW

# =====================================================================================
# 5. PLAN: EMPULSE Score now (exact tier counts, H04 team scores, org score 83)
# =====================================================================================
SCORE_RANGE = {"Gold": (90, 97), "Silver": (80, 89), "Bronze": (70, 79), "Growth Needed": (56, 69)}
SCORE_MEAN = {"Gold": 91.3, "Silver": 85.8, "Bronze": 75.6, "Growth Needed": 64.8}


def score_cap(r):
    """Highest score that is still realistic with risk r (criteria average 98)."""
    return np.floor((98 * 85 + 15 * (100 - np.asarray(r))) / 100).astype(int)


def score_floor(r):
    return np.ceil((48 * 85 + 15 * (100 - np.asarray(r))) / 100).astype(int)


score = np.zeros(NP, dtype=int)
for t, (lo_s, hi_s) in SCORE_RANGE.items():
    m = (P["tier"] == t).to_numpy()
    vals = np.arange(lo_s, hi_s + 1)
    # a smooth bump around the tier mean
    w = np.exp(-0.5 * ((vals - SCORE_MEAN[t]) / 2.6) ** 2)
    s = rng.choice(vals, m.sum(), p=w / w.sum())
    # higher scores to people with lower risk inside the same tier and department
    idx = np.where(m)[0]
    for dept in T.DEPARTMENTS:
        d_idx = idx[(P.loc[idx, "dept"] == dept).to_numpy()]
        d_s = np.sort(s[: len(d_idx)])[::-1]
        s = s[len(d_idx):]
        key = risk[d_idx] - 6 * cap[d_idx]
        score[d_idx[np.argsort(key)]] = d_s
for i, s in fixed_score.items():
    score[i] = s
s_lo = np.array([SCORE_RANGE[t][0] for t in P["tier"]])
s_hi = np.minimum(np.array([SCORE_RANGE[t][1] for t in P["tier"]]), score_cap(risk))
s_lo = np.maximum(s_lo, score_floor(risk))
score = np.clip(score, s_lo, s_hi)
free_s = np.ones(NP, dtype=bool)
free_s[list(fixed_score)] = False
for team, target in T.TEAM_SCORE.items():
    m = (P["team"] == team) & (P["position"] == "member")
    m = m.to_numpy()
    score[:] = fix_sum(score, mean_sum(target, m.sum()) + int(score[~m].sum()), m & free_s, s_lo, s_hi)
others = free_s & ~P["team"].isin(T.TEAM_SCORE).to_numpy()
score[:] = fix_sum(score, mean_sum(T.ORG_SCORE + 0.1, NP), others, s_lo, s_hi)
P["score"] = score
assert all(tier_of(s) == t for s, t in zip(P["score"], P["tier"]))

# =====================================================================================
# 6. PLAN: engagement now (H01, M03, H07)
# =====================================================================================
eng = np.zeros(NP, dtype=int)
fixed_e = np.zeros(NP, dtype=bool)
for i in P.index[P["named"]]:
    if spec(i, "engagement") is not None:
        eng[i], fixed_e[i] = spec(i, "engagement"), True
E_LO, E_HI = 35, 97
for dept, (hc, teams) in T.DEPARTMENTS.items():
    in_dept = (P["dept"] == dept).to_numpy()
    base = T.DEPT_ENGAGEMENT[dept] - 0.35 * (risk - T.DEPT_RISK[dept]) + rng.normal(0, 6, NP)
    eng[in_dept & ~fixed_e] = np.clip(np.round(base), E_LO, E_HI)[in_dept & ~fixed_e]
    team_fixed = np.zeros(NP, dtype=bool)
    for t, _, _ in teams:
        if t in T.TEAM_ENGAGEMENT:
            m = ((P["team"] == t) & (P["position"] == "member")).to_numpy()
            eng[:] = fix_sum(eng, mean_sum(T.TEAM_ENGAGEMENT[t], m.sum()) + int(eng[~m].sum()), m & ~fixed_e, E_LO, E_HI)
            team_fixed |= m
    eng[:] = fix_sum(eng, mean_sum(T.DEPT_ENGAGEMENT[dept], hc) + int(eng[~in_dept].sum()),
                     in_dept & ~fixed_e & ~team_fixed, E_LO, E_HI)
P["engagement"] = eng

# =====================================================================================
# 7. PLAN: recognition coverage (H09) - who was recognized in the last 60 days / 12 months
# =====================================================================================
# 60-day counts per department. H09 percentages: 81/74/70/66/58/52 and org 64%.
# All six percentages and 64% cannot hold together (smallest possible total 800 = 64.5% -> "65%"),
# so Operations shows 73% instead of 74% (see report).
REC60 = {"People": 52, "Operations": 233, "Finance": 83, "Sales": 173, "Technology": 122, "Customer Success": 136}
changed("H09", "Operations recognition rate 74%", "73% (233 of 318)",
        "with 81/74/70/66/58/52 the organisation total is at least 800 people = 64.5%, shown as 65%, not 64%")
fixed_rec = {}
for n, d in T.PR_LAST_RECOGNIZED.items():
    fixed_rec[IDX[n]] = d <= 60
for n in ["Layla Haddad", "Yousef Tamimi", "Dina Kassem", "Reem Aziz", "Adel Nasser", "Omar Saeed", "Yasmin Hadi"]:
    fixed_rec[IDX[n]] = True
upper = P["tier"].isin(["Gold", "Silver"]).to_numpy()
remote = (P["work_mode"] == "Remote").to_numpy()
onsite = (P["work_mode"] == "On-site").to_numpy()
female = (P["gender"] == "F").to_numpy()
u30 = (P["age"] < 30).to_numpy()
a3045 = ((P["age"] >= 30) & (P["age"] <= 45)).to_numpy()
w_sel = np.where(upper, 1.0, 0.70) * np.where(remote, 0.86, 1.0) * np.where(female, 1.02, 1.0) * np.where(u30, 0.95, 1.0)
rec60 = np.zeros(NP, dtype=bool)
for i, v in fixed_rec.items():
    rec60[i] = v
for dept, k in REC60.items():
    m = (P["dept"] == dept).to_numpy()
    free = np.where(m & ~np.isin(np.arange(NP), list(fixed_rec)))[0]
    k_free = k - int(rec60[m].sum())
    g = -np.log(-np.log(rng.random(len(free))))                    # Gumbel noise: weighted sampling
    pick = free[np.argsort(-(np.log(w_sel[free] * 0.45 + 1e-9) + g))[:k_free]]
    rec60[pick] = True


def ratios(r):
    rate = lambda m: r[m].mean()  # noqa: E731
    return {"gender_f_m": rate(female) / rate(~female), "remote_onsite": rate(remote) / rate(onsite),
            "under30_30to45": rate(u30) / rate(a3045), "lower_upper_tier": rate(~upper) / rate(upper)}


def ratio_error(r):
    got = ratios(r)
    return sum(abs(round(got[k], 2) - v) * 10 + abs(got[k] - v) for k, v in T.EQUITY.items())


# swap people inside the same department until the four equity ratios round to the design values
movable = ~np.isin(np.arange(NP), list(fixed_rec))
err = ratio_error(rec60)
for it in range(60000):
    if err < 0.02 and all(round(ratios(rec60)[k], 2) == v for k, v in T.EQUITY.items()):
        break
    dept = rng.choice(list(REC60))
    m = (P["dept"] == dept).to_numpy() & movable
    a = rng.choice(np.where(m & rec60)[0])
    b = rng.choice(np.where(m & ~rec60)[0])
    rec60[a], rec60[b] = False, True
    e2 = ratio_error(rec60)
    if e2 <= err:
        err = e2
    else:
        rec60[a], rec60[b] = True, False
P["rec60"] = rec60
# never recognized in 12 months: 96 people, all outside the 60-day group
never = np.zeros(NP, dtype=bool)
pool = np.where(~rec60 & movable & ~P["named"].to_numpy())[0]
pw = np.where(upper[pool], 0.7, 1.0)
never[rng.choice(pool, T.NEVER_RECOGNIZED_12M, replace=False, p=pw / pw.sum())] = True
P["never12"] = never
# days since the last recognition (on AS_OF)
last_days = np.where(rec60, rng.integers(1, 61, NP), rng.integers(61, 330, NP)).astype(float)
last_days[never] = np.nan
for n, d in T.PR_LAST_RECOGNIZED.items():
    last_days[IDX[n]] = d
P["last_rec_days"] = last_days
# awards shown by name in the design fix some people's dates (E08, M08)
award_days = {}
for recv, _cat, _giver, date, _out in T.SCRIPTED_AWARDS:
    award_days.setdefault(recv, []).append((AS_OF - pd.Timestamp(date)).days)
for n, ds in award_days.items():
    last_days[IDX[n]] = min(ds)
P["last_rec_days"] = last_days
changed("M08", "Noura Al-Saud last recognized 44 days ago", "9 days (award on 12 Sep)",
        "the same screen lists her Collaboration Hero award on 12 Sep")
# recognitions received in the last 90 days (a burnout model input)
rec90 = np.where(rec60, 1 + rng.poisson(0.9, NP), (last_days <= 90).astype(int))
rec90 = np.where(never, 0, np.clip(rec90, 0, 6))
EXTRA_KUDOS = {"Layla Haddad": ["2026-07-15"], "Maha Al-Otaibi": ["2026-09-03"]}   # E01 "3 this quarter", M08 "5 this month"
for n in set(award_days) | set(EXTRA_KUDOS):
    k = sum(1 for d in award_days.get(n, []) if d <= 90) + len(EXTRA_KUDOS.get(n, []))
    rec90[IDX[n]] = k
P["rec90"] = rec90

# =====================================================================================
# 8. CALIBRATE the model inputs so the burnout model gives the planned risk
# =====================================================================================
base_feat = G.sample_features(NP, rng, P["dept"].map(N.DEPT_EFFECT).to_numpy() + rng.normal(0, 0.3, NP))
base_feat["job_level"] = P["level"].to_numpy()
base_feat["tenure_years"] = P["tenure"].to_numpy()
base_feat["years_since_promotion"] = np.minimum(base_feat["years_since_promotion"], base_feat["tenure_years"]).round(1)
base_feat["engagement_score"] = P["engagement"].astype(float).to_numpy()
base_feat["recognition_90d"] = P["rec90"].astype(float).to_numpy()
base_feat["monthly_income_sar"] = ((np.array([G.LEVEL_INCOME[int(v)] for v in P["level"]]) * base_feat["income_ratio"]) / 50).round() * 50

LOW = dict(workload_index=42, overtime_hours_monthly=0.5, work_life_balance=3.95, job_satisfaction=3.9,
           mood_score=4.8, absence_days_annual=0)
HIGH = dict(workload_index=99, overtime_hours_monthly=38, work_life_balance=1.05, job_satisfaction=1.3,
            mood_score=1.4, absence_days_annual=17)
DECIMALS = dict(workload_index=1, overtime_hours_monthly=1, work_life_balance=2, job_satisfaction=2,
                mood_score=2, absence_days_annual=0)
DYN_NOW = list(LOW)
DYN_WEEK = ["workload_index", "overtime_hours_monthly", "work_life_balance", "job_satisfaction", "mood_score"]
delta_all = rng.uniform(-0.18, 0.18, (NP, len(DYN_NOW)))


def calibrate(base: pd.DataFrame, target: np.ndarray, dyn: list, delta: np.ndarray, tol=0.49, label=""):
    """Find inputs so that round(model risk) == target for every row.

    Each row moves along one line from a LOW-strain profile to a HIGH-strain profile
    (s = 0 ... 1, bent a little per person by `delta`). Bisection finds s; because the model
    is a step function, rows that land on a step are retried with nearby random candidates.
    """
    n = len(base)
    tgt = np.asarray(target, dtype=float)

    def build(rows, s, jit):
        X = base.iloc[rows].reset_index(drop=True).copy()
        for j, f in enumerate(dyn):
            sf = np.clip(s * (1 + delta[rows, j]) + jit[:, j], 0, 1)
            X[f] = np.round(LOW[f] + sf * (HIGH[f] - LOW[f]), DECIMALS[f])
        return X

    rows = np.arange(n)
    zero = np.zeros((n, len(dyn)))
    lo, hi = np.zeros(n), np.ones(n)
    for _ in range(26):
        mid = (lo + hi) / 2
        p = E.predict_proba(burn_b, build(rows, mid, zero)) * 100
        below = p < tgt
        lo, hi = np.where(below, mid, lo), np.where(below, hi, mid)
    s0 = (lo + hi) / 2
    X = build(rows, s0, zero)
    p = E.predict_proba(burn_b, X) * 100
    err = np.abs(p - tgt)
    for rnd in range(30):
        bad = np.where(err > tol)[0]
        if len(bad) == 0:
            break
        K = 48 if len(bad) > 300 else 400
        r_k = np.repeat(bad, K)
        spread = min(rnd + 1, 8)
        s_k = np.clip(s0[r_k] + rng.normal(0, 0.025 * spread, len(r_k)), 0, 1)
        jit = rng.normal(0, 0.02 * spread, (len(r_k), len(dyn)))
        Xc = build(r_k, s_k, jit)
        pc = E.predict_proba(burn_b, Xc) * 100
        ec = np.abs(pc - tgt[r_k]).reshape(len(bad), K)
        kb = ec.argmin(axis=1)
        better = ec[np.arange(len(bad)), kb] < err[bad]
        take = bad[better]
        src = (np.arange(len(bad)) * K + kb)[better]
        X.iloc[take, :] = Xc.iloc[src, :].to_numpy()
        p[take] = pc[src]
        err[take] = np.abs(p[take] - tgt[take])
    bad = int((err > tol).sum())
    print(f"  calibrate {label}: {n:,} rows, {bad} outside +-0.5 (max error {err.max():.2f})")
    return X, p


print("Calibrating current inputs ...")
cur_X, cur_p = calibrate(base_feat, P["risk"].to_numpy(), DYN_NOW, delta_all, label="now")
assert (half_up(cur_p) == P["risk"].to_numpy()).all(), "current risk not exact"

# =====================================================================================
# 9. SEVEN CRITERIA now, so the EMPULSE Score lands on the planned score
# =====================================================================================
CRIT_MEAN = np.array([93.0, 86.0, 72.0, 84.0, 90.0, 83.0])      # order = T.CRITERIA6
CRIT_SD = np.array([3.5, 4.5, 8.0, 5.5, 3.5, 6.5])
PR_MEAN = np.array([95.0, 84.0, 78.0, 90.0, 94.0, 91.0])        # M02 team averages
TECH_SHIFT = np.array([0, 1, -6, 0, 0, 3])                      # M03: Technology innovation 64


def make_criteria(target_score, r, profile, keep=None):
    """Whole-number criteria (0..100) with round(score) == target_score.

    profile: the person's own strengths (a vector around 0). keep: {criterion index: value}.
    """
    keep = keep or {}
    lo100 = 100 * target_score - 50 - 15 * (100 - r)       # allowed range for crit6 @ W
    hi100 = 100 * target_score + 49 - 15 * (100 - r)
    goal = (lo100 + hi100) / 2 + rng.uniform(-35, 35)
    x = profile.astype(float).copy()
    for k, v in keep.items():
        x[k] = v
    free = [k for k in range(6) if k not in keep]
    need_ = goal - x @ W
    # share the change by the room each criterion still has (so strong people do not all hit 100)
    room = np.array([100 - x[k] if need_ > 0 else x[k] - 40 for k in free])
    room = np.maximum(room, 0.5)
    x[free] += need_ * room / (W[free] @ room)
    x = np.clip(np.round(x), 30, 100).astype(int)
    for _ in range(400):
        tot = int(x @ W)
        if lo100 <= tot <= hi100:
            return x
        step = 1 if tot < lo100 else -1
        cand = [k for k in free if 30 <= x[k] + step <= 100]
        k = cand[rng.integers(len(cand))]
        x[k] += step
    raise RuntimeError(f"criteria failed for score {target_score}, risk {r}")


crit = np.zeros((NP, 6), dtype=int)
prof = rng.normal(0, 1, (NP, 6)) * CRIT_SD
for i in range(NP):
    s_now, r_now = int(P.at[i, "score"]), int(P.at[i, "risk"])
    if spec(i, "criteria"):
        crit[i] = [spec(i, "criteria")[k] for k in T.CRITERIA6]
        continue
    mean = PR_MEAN if P.at[i, "team"] == "Platform Reliability" else CRIT_MEAN + (TECH_SHIFT if P.at[i, "dept"] == "Technology" else 0)
    keep = {1: spec(i, "task")} if spec(i, "task") else None
    crit[i] = make_criteria(s_now, r_now, mean + prof[i], keep)
exact100 = score100(crit, P["risk"].to_numpy())
assert (half_up(exact100 / 100) == P["score"].to_numpy()).all()
for k, c in enumerate(T.CRITERIA6):
    P[c] = crit[:, k]
P["score_exact"] = exact100 / 100

changed("M02/M04/H04/H05", "Maha Al-Otaibi EMPULSE 93 (Gold)", "91 (Gold)",
        "with Task Completion 90 and burnout risk 35 the highest possible score is 92.25 even with every other criterion at 100")
print("Plan done:", P["tier"].value_counts().to_dict(), "org score", round(P["score"].mean(), 2))

# =====================================================================================
# 10. PLAN: interventions of 2026 (H01, H10, H12) - needed before the weekly risk paths
# =====================================================================================
TYPE_LEFT = dict(T.INTERVENTION_TYPES)                      # 96 / 48 / 41 / 27
PER_MONTH = {1: 14, 2: 16, 3: 18, 4: 20, 5: 22, 6: 26, 7: 42, 8: 26, 9: 28}     # = 212, July = rebalancing program
assert sum(PER_MONTH.values()) == T.INTERVENTIONS_2026


def rand_date(year, month, first_day=1, last_day=None):
    end = (pd.Timestamp(year, month, 1) + pd.offsets.MonthEnd(0)).day
    last_day = min(last_day or end, end)
    return pd.Timestamp(year, month, int(rng.integers(first_day, last_day + 1)))


# statuses per creation month (see report): Jan-Jul 158 = 56 measured + 92 completed + 6 declined + 4 cancelled
status_pool = {m: [] for m in PER_MONTH}
jan_jul = ["measured"] * 56 + ["completed"] * 92 + ["declined"] * 6 + ["cancelled"] * 4
rng.shuffle(jan_jul)
pos = 0
for m in range(1, 8):
    status_pool[m] = jan_jul[pos: pos + PER_MONTH[m]]
    pos += PER_MONTH[m]
status_pool[8] = ["active"] * 14 + ["measured"] * 2 + ["completed"] * 8 + ["declined", "cancelled"]
status_pool[9] = ["detected"] * 9 + ["proposed"] * 6 + ["active"] * 13

# scripted interventions from the design
SCRIPTED = [
    dict(code="INT-0311", who="Layla Haddad", month=2, created="2026-02-09", status="completed", type="Training & mentoring",
         title="Analytics tooling course · 2 sessions", problem="Digital adoption below team", root="New BI tool not yet adopted"),
    dict(code="INT-0371", who="Noura Al-Saud", month=4, created="2026-04-06", status="measured", type="Workload rebalance",
         title="Move pipeline on-call to rotation · weekly check-in", problem="Burnout risk 72%", root="Pipeline migration on top of on-call",
         drop=23),
    dict(code="INT-0392", who="Layla Haddad", month=6, created="2026-06-30", status="measured", type="Workload rebalance",
         title="Reduce workload 10% · reallocate 2 reports · bi-weekly check-in", problem="Burnout risk 68% while performance stayed high",
         root="Workload 122% of baseline · 2 recurring reports added 1 Jun", drop=23, expected=20,
         dates=dict(planned="2026-07-03", started="2026-07-07", checkin="2026-07-21", followup="2026-08-04", measured="2026-08-18"),
         eng=(66, 80), perf=(92, 94), progress=100),
    dict(code="INT-0418", who="Khalid Mansour", month=9, created="2026-09-14", status="proposed", type="Workload rebalance",
         title="Reallocate 2 tasks · check-in · 2-wk review", problem="Burnout risk 72%", root="Workload +18%, overtime +12 h/wk",
         expected=23, dates=dict(followup="2026-10-05"), progress=0),
    dict(code=None, who="Tariq Zaki", month=9, created="2026-09-08", status="active", type="Workload rebalance",
         title="Rotate on-call · 1 recovery day", problem="Burnout risk 66%", root="On-call load 2x team median", expected=16,
         dates=dict(planned="2026-09-14", started="2026-09-16", followup="2026-09-29"), progress=25, note="Early: overtime -5 h"),
    dict(code=None, who="Huda Nasser", month=9, created="2026-09-10", status="active", type="Training & mentoring",
         title="Supportive check-in Thursday", problem="Engagement 58, falling", root="Recognition gap and on-call nights", expected=8,
         dates=dict(planned="2026-09-17", started="2026-09-17", followup="2026-10-01"), progress=10),
    dict(code=None, who=None, group=("dept", "Customer Success", 38), month=9, created="2026-09-01", status="active",
         type="Recognition program", title="Recognition sprint · peer nominations", problem="Recognition gap",
         root="45% not recognised in 60+ days", owner="Lina Farhat", expected=0, expected_text="Engagement +6",
         dates=dict(planned="2026-09-03", started="2026-09-07", followup="2026-09-29"), progress=40, note="Recognition +11 so far"),
    dict(code=None, who=None, group=("team", "Finance Ops", 12), month=7, created="2026-07-06", status="measured",
         type="Training & mentoring", title="Hands-on training · 2 champions", problem="Digital adoption stall",
         root="New ERP flows skipped by 60%", owner="Adel Nasser", expected=0, expected_text="Digital +12",
         dates=dict(planned="2026-07-10", started="2026-07-20", followup="2026-09-14", measured="2026-09-14"), progress=100,
         note="Digital 58 -> 71"),
]
interv = []
for s in SCRIPTED:
    status_pool[s["month"]].remove(s["status"])
    TYPE_LEFT[s["type"]] -= 1
    interv.append(dict(s))
for m, sts in status_pool.items():
    for st in sts:
        interv.append(dict(code=None, who=None, month=m, created=None, status=st, type=None))
# types: measured ones follow the playbook numbers (23 workload, 17 recognition-only, 18 others)
measured_types = (["Workload rebalance"] * 23 + ["Recognition program"] * 17 + ["Training & mentoring"] * 10
                  + ["Task / team move"] * 8)
for it in interv:
    if it["status"] == "measured" and it["type"]:
        measured_types.remove(it["type"])
rng.shuffle(measured_types)
for it in interv:
    if it["status"] == "measured" and not it["type"]:
        it["type"] = measured_types.pop()
        TYPE_LEFT[it["type"]] -= 1
rest_types = [t for t, k in TYPE_LEFT.items() for _ in range(k)]
rng.shuffle(rest_types)
for it in interv:
    if not it["type"]:
        it["type"] = rest_types.pop()
assert not rest_types and not measured_types
# creation dates
for it in interv:
    if it["created"] is None:
        if it["status"] == "detected":
            it["created"] = rand_date(2026, 9, 1, 20)
        elif it["status"] == "proposed":
            it["created"] = rand_date(2026, 9, 8, 20)
        elif it["month"] == 9:
            it["created"] = rand_date(2026, 9, 1, 8)
        elif it["status"] == "measured" and it["month"] == 8:
            it["created"] = rand_date(2026, 8, 1, 2)      # measured 6 weeks after start, by 21 Sep
        else:
            it["created"] = rand_date(2026, it["month"])
    it["created"] = pd.Timestamp(it["created"])

# who: open interventions go to people at (or close to) elevated risk now; closed ones to anybody with strain
open_st = {"detected", "proposed", "active"}
taken = {IDX[s["who"]] for s in SCRIPTED if s["who"]}
el_pool = [i for i in np.where(P["elevated"])[0] if i not in taken]
near_pool = [i for i in np.argsort(-P["risk"].to_numpy()) if not P.at[i, "elevated"] and i not in taken and P.at[i, "position"] == "member"]
rng.shuffle(el_pool)
for it in interv:
    if it["who"] is None and "group" not in it and it["status"] in open_st:
        it["row"] = el_pool.pop() if el_pool else near_pool.pop(0)
        taken.add(it["row"])
closed_pool = [i for i in range(NP) if i not in taken and not P.at[i, "elevated"] and not P.at[i, "named"]
               and P.at[i, "position"] == "member"]
wts = np.clip(P["risk"].to_numpy()[closed_pool], 10, 58) ** 1.5
closed_pick = list(rng.choice(closed_pool, sum(1 for it in interv if "row" not in it and not it["who"] and "group" not in it),
                              replace=False, p=wts / wts.sum()))
for it in interv:
    if it["who"]:
        it["row"] = IDX[it["who"]]
    elif "group" in it:
        it["row"] = None
    elif "row" not in it:
        it["row"] = closed_pick.pop()

# planned outcome: improved = risk at least 5 points lower than at detection
#   measured: 43 of 58 improved (74%; workload 19 of 23 by 15+ points, recognition-only 9 of 17)
#   completed: 96 of 100 improved by now, active: 12 improved by now  -> 43 + 96 + 12 = 151 = 71% of 212
for it in interv:
    it.setdefault("improved", False)
by_type = lambda st, ty: [it for it in interv if it["status"] == st and it["type"] == ty and it.get("drop") is None]  # noqa: E731
for ty, k in [("Workload rebalance", 19), ("Recognition program", 9)]:
    pre = sum(1 for it in interv if it["status"] == "measured" and it["type"] == ty and it.get("drop"))
    lst = by_type("measured", ty)
    for j, it in enumerate(lst):
        it["improved"] = j < k - pre
for it in interv:
    if it["status"] == "measured" and it.get("drop"):
        it["improved"] = True
oth = [it for it in interv if it["status"] == "measured" and it["type"] in ("Training & mentoring", "Task / team move")
       and it.get("drop") is None and "group" not in it]
grp_measured = sum(1 for it in interv if it["status"] == "measured" and "group" in it)
for j, it in enumerate(oth):
    it["improved"] = j < 15 - grp_measured
for it in interv:
    if "group" in it and it["status"] == "measured":
        it["improved"] = True             # Finance Ops: digital 58 -> 71 (team outcome)
comp = [it for it in interv if it["status"] == "completed"]
for j, it in enumerate(comp):
    it["improved"] = j < 96
act = [it for it in interv if it["status"] == "active" and it["who"] is None and "group" not in it]
for j, it in enumerate(act):
    it["improved"] = j < 12
assert sum(it["improved"] for it in interv) == 151, sum(it["improved"] for it in interv)
assert sum(it["improved"] for it in interv if it["status"] == "measured") == 43

# =====================================================================================
# 11. PLAN: weekly burnout risk of every person (52 weeks)
# =====================================================================================
dept_arr = P["dept"].to_numpy()
r_now = P["risk"].to_numpy().astype(float)
wk = np.arange(NW)


def dept_path(d):
    """Department average risk for all 52 weeks. Weeks 27-38 come from the H06 heat map."""
    h = np.array(T.HEATMAP[d], dtype=float)
    path = np.zeros(NW)
    path[ISO27:] = h
    h0 = h[0]
    mar = week_of("2026-03-02")
    for w in range(ISO27):
        if w < mar:   # autumn and winter: a little below July, small wave
            path[w] = h0 - 2.5 + 1.2 * np.sin(2 * np.pi * w / 17)
        else:         # Q2 delivery surge: climbs to the July value
            path[w] = h0 - 2.5 + 2.5 * (w - mar) / (ISO27 - mar)
    return path


DPATH = {d: dept_path(d) for d in T.DEPARTMENTS}
shift_w = np.array([DPATH[d] - DPATH[d][NOW] for d in dept_arr])          # NP x NW


def ar_noise(sd, phi=0.8):
    """Smooth random wobble per person, exactly 0 in the latest week."""
    z = np.zeros((NP, NW))
    for w in range(NOW - 1, -1, -1):
        z[:, w] = phi * z[:, w + 1] + rng.normal(0, sd * np.sqrt(1 - phi ** 2), NP)
    return z


R = r_now[:, None] + shift_w + ar_noise(2.2)

# interventions: risk climbs before detection and falls after the start
FIXED_PATH = np.zeros(NP, dtype=bool)
for it in interv:
    it["w_detect"] = week_of(it["created"])
    it["w_start"] = min(it["w_detect"] + 1, NOW)
    it["w_measure"] = it["w_start"] + 6
    i = it["row"]
    if i is None or P.at[i, "named"]:
        continue
    wd, ws, wm = it["w_detect"], it["w_start"], it["w_measure"]
    base = R[i].copy()
    if it["status"] in open_st:
        # rising into today's (already high) value: lower before detection
        rise = rng.uniform(8, 16)
        R[i] -= rise * np.clip((wd - wk) / 8, 0, 1)
        if it["status"] == "active" and it["improved"]:
            # peaked at detection, already coming down a little
            peak = r_now[i] + rng.uniform(6, 10)
            R[i, wd: NOW] = np.linspace(peak, r_now[i] + 1, NOW - wd)
        continue
    baseline = rng.uniform(58, 70)
    A = max(6.0, baseline - base[wd])
    if it["status"] == "measured":
        if it["improved"]:
            drop = rng.uniform(15, 21) if it["type"] == "Workload rebalance" else rng.uniform(6, 18)
        else:
            drop = rng.uniform(-2.5, 2.5)
    else:
        drop = None
    H = np.zeros(NW)
    H[max(0, wd - 6): wd + 1] = np.linspace(0, A, wd + 1 - max(0, wd - 6))
    H[wd: ws + 1] = A
    if drop is not None:
        a_res = base[wd] + A - drop - base[min(wm, NOW)]
        H[ws: min(wm, NOW) + 1] = np.linspace(A, a_res, min(wm, NOW) + 1 - ws)
        if wm < NOW:
            fade = min(NOW, wm + 8)
            H[wm: fade + 1] = np.linspace(a_res, 0, fade + 1 - wm)
            H[fade:] = 0
        it["plan_drop"] = drop
    else:
        end = min(NOW, ws + 7)
        H[ws: end + 1] = np.linspace(A, 0, end + 1 - ws)
        H[end:] = 0
        if it["status"] == "completed" and not it["improved"]:
            H[ws: NOW] = A                         # did not improve: stays high until now ...
            H[NOW - 6: NOW + 1] = np.linspace(A, 0, 7)   # ... and only settles in the last weeks
    R[i] = base + H

# named people: exact stories
for n, pts in T.STORIES.items():
    i = IDX[n]
    xs = [week_of(d) for d, _ in pts]
    ys = [v for _, v in pts]
    R[i] = np.interp(wk, xs, ys) + np.r_[ar_noise(1.0)[i, :-1] * (wk[:-1] < xs[0]), 0]
    FIXED_PATH[i] = True
# Platform Reliability: average 34 on 30 Mar -> 51 now (H05); Tariq and Huda 52 six weeks ago (M06)
mar30 = week_of("2026-03-30")
PR_START = {"Tariq Zaki": 36, "Huda Nasser": 35, "Sami Youssef": 32, "Rami Khoury": 30, "Dana Farouk": 27,
            "Faisal Rahman": 25, "Maha Al-Otaibi": 24}
for n, start in PR_START.items():
    i = IDX[n]
    spec_i = named[n]
    xs, ys = [0, mar30], [start - 1, start]
    if spec_i.get("risk_6w"):
        xs.append(W6)
        ys.append(spec_i["risk_6w"])
    xs.append(NOW)
    ys.append(spec_i["risk"])
    R[i] = np.interp(wk, xs, ys) + np.r_[ar_noise(1.3)[i, :-1], 0]
    FIXED_PATH[i] = True
for i in P.index[P["named"]]:
    if not FIXED_PATH[i]:
        R[i] = r_now[i] + 0.5 * shift_w[i] + np.r_[ar_noise(1.2)[i, :-1], 0]
        FIXED_PATH[i] = True
R = np.clip(np.round(R), 3, 85).astype(int)
R[:, NOW] = P["risk"].to_numpy()
pr_rows = P.index[(P["team"] == "Platform Reliability") & (P["position"] == "member")]
R[pr_rows, mar30] = fix_sum(R[pr_rows, mar30], 34 * 9, np.array([n in PR_START for n in P.loc[pr_rows, "name"]]), 3, 59)

# make each intervention's planned outcome exact (risk at detection vs. 6 weeks after start / now)
PROTECT = np.zeros((NP, NW), dtype=bool)        # cells the later fixes must not touch
for it in interv:
    i = it["row"]
    if i is None or P.at[i, "named"] or it["status"] not in ("measured", "completed"):
        continue
    wd = it["w_detect"]
    later_w = min(it["w_measure"], NOW) if it["status"] == "measured" else NOW
    later = R[i, later_w]
    if it["improved"] and R[i, wd] < later + 6:
        R[i, wd] = min(85, later + 6 + int(rng.integers(0, 4)))
    elif not it["improved"] and not (later - 3 <= R[i, wd] <= later + 3):
        R[i, wd] = later + int(rng.integers(-2, 3))
    PROTECT[i, wd] = PROTECT[i, later_w] = True


# exact elevated count at each month end (H01) ...
def months_count():
    return [int((R[:, w] >= T.HIGH_RISK).sum()) for w in MONTH_END]


open_rows = {it["row"] for it in interv if it["row"] is not None and it["status"] in open_st}
can_move = ~FIXED_PATH & ~np.isin(np.arange(NP), list(open_rows))
for m, w in enumerate(MONTH_END):
    if w == NOW:
        continue
    target = T.ELEVATED_MONTHLY[m]
    have = int((R[:, w] >= 60).sum())
    if have < target:
        cand = np.where(can_move & ~PROTECT[:, w] & (R[:, w] >= 42) & (R[:, w] < 60))[0]
        cand = cand[np.argsort(-R[cand, w])][: target - have]
        for i in cand:
            lift = 60 + int(rng.integers(0, 3)) - R[i, w]
            for k, f in [(w - 2, 0.35), (w - 1, 0.7), (w, 1.0), (w + 1, 0.6), (w + 2, 0.3)]:
                if (0 <= k < NOW and k not in MONTH_END or k == w) and not PROTECT[i, k]:
                    R[i, k] = max(R[i, k], int(round(R[i, k] + lift * f)))
    elif have > target:
        cand = np.where(can_move & ~PROTECT[:, w] & (R[:, w] >= 60))[0]
        cand = cand[np.argsort(R[cand, w])][: have - target]
        for i in cand:
            cut = R[i, w] - (57 + int(rng.integers(0, 2)))
            for k, f in [(w - 1, 0.6), (w, 1.0), (w + 1, 0.6)]:
                if (0 <= k < NOW and k not in MONTH_END or k == w) and not PROTECT[i, k]:
                    R[i, k] = min(R[i, k], int(round(R[i, k] - cut * f)))
# ... and exact department averages in the heat-map weeks (H06), without crossing 60
for d, (hc, _) in T.DEPARTMENTS.items():
    m = dept_arr == d
    for k, w in enumerate(HEAT_WEEKS[:-1]):
        col = R[:, w].copy()
        free = m & can_move & ~PROTECT[:, w] & (col <= 56) & (col >= 5)
        col = fix_sum(col, mean_sum(T.HEATMAP[d][k], hc) + int(col[~m].sum()), free, 4, 57)
        R[:, w] = col
got = months_count()
assert got == T.ELEVATED_MONTHLY, got

# =====================================================================================
# 12. PLAN: weekly engagement (falls when risk rises; PR 79 -> 64, org 71 at the end of Q2)
# =====================================================================================
ENG = P["engagement"].to_numpy()[:, None] - 0.6 * (R - R[:, [NOW]]) + np.c_[ar_noise(1.6)[:, :-1], np.zeros(NP)]
is_pr = P.index.isin(pr_rows)
ENG[is_pr] = P.loc[pr_rows, "engagement"].to_numpy()[:, None] - 0.85 * (R[is_pr] - R[is_pr][:, [NOW]])
ENG_STORY = {"Khalid Mansour": [(W6, 85), (NOW, 71)],
             "Layla Haddad": [(week_of("2026-06-29"), 66), (week_of("2026-08-17"), 80), (NOW, 83)]}
for n, pts in ENG_STORY.items():
    i = IDX[n]
    xs = [w for w, _ in pts]
    ys = [v for _, v in pts]
    first = ENG[i, xs[0]]
    ENG[i] = np.where(wk >= xs[0], np.interp(wk, xs, ys), ENG[i] - first + ys[0])
ENG = np.clip(np.round(ENG), 30, 98).astype(int)
ENG[:, NOW] = P["engagement"].to_numpy()
pr_free = np.array([n not in ENG_STORY for n in P.loc[pr_rows, "name"]])
ENG[pr_rows, mar30] = fix_sum(ENG[pr_rows, mar30], 79 * 9, pr_free, 30, 98)
# org average 71 at the end of June: everybody (except named stories) a little lower before July
w_jun = MONTH_END[list(MONTHS).index(pd.Period("2026-06", "M"))]
story_rows = np.isin(np.arange(NP), [IDX[n] for n in ENG_STORY]) | is_pr
gap = ENG[:, w_jun].mean() - T.ORG_ENGAGEMENT_Q2
ramp = np.clip((NOW - wk) / (NOW - w_jun), 0, 1)
ENG[~story_rows] = np.clip(np.round(ENG[~story_rows] - gap * 1.03 * ramp), 30, 98).astype(int)
ENG[:, w_jun] = fix_sum(ENG[:, w_jun], mean_sum(T.ORG_ENGAGEMENT_Q2, NP), ~story_rows, 30, 98)
ENG[:, NOW] = P["engagement"].to_numpy()

# =====================================================================================
# 13. CALIBRATE every week (the model must give exactly the planned weekly risk)
# =====================================================================================
print("Calibrating 52 weeks ...")
static_cols = [c for c in cur_X.columns if c not in DYN_WEEK]
rows = np.repeat(np.arange(NP), NOW)              # all weeks except the latest (that is the current snapshot)
wk_of_row = np.tile(np.arange(NOW), NP)
WB = cur_X.iloc[rows].reset_index(drop=True)
WB["engagement_score"] = ENG[rows, wk_of_row].astype(float)
WX, Wp = calibrate(WB, R[rows, wk_of_row], DYN_WEEK, delta_all[rows][:, : len(DYN_WEEK)], label="weekly")
bad = np.where(half_up(Wp) != R[rows, wk_of_row])[0]
if len(bad):
    # last try: also let absence move for these rows
    X2, p2 = calibrate(WB.iloc[bad].reset_index(drop=True), R[rows[bad], wk_of_row[bad]], DYN_NOW, delta_all[rows[bad]], label="weekly retry")
    WX.iloc[bad, :] = X2[WX.columns].to_numpy()
    Wp[bad] = p2
still = np.where(half_up(Wp) != R[rows, wk_of_row])[0]
print(f"  weekly rows not exact after retry: {len(still)}")
R_model = R.copy()
R_model[rows, wk_of_row] = half_up(Wp)
WX["employee_row"] = rows
WX["week"] = wk_of_row
CX = cur_X.copy()
CX["employee_row"] = np.arange(NP)
CX["week"] = NOW
WEEKLY_X = pd.concat([WX, CX], ignore_index=True).sort_values(["employee_row", "week"]).reset_index(drop=True)
WEEKLY_X["burnout_risk_pct"] = R_model[WEEKLY_X["employee_row"], WEEKLY_X["week"]]
print("  months:", months_count(), "model:", [int((R_model[:, w] >= 60).sum()) for w in MONTH_END])

# =====================================================================================
# 14. EMPLOYEES: ids, names, e-mails, titles
# =====================================================================================
perm = rng.permutation(NP)
emp_id = np.empty(NP, dtype=int)
emp_id[perm] = np.arange(1, NP + 1)                 # random ids: the id order means nothing
P["id"] = emp_id
used = set(P["name"].dropna())
names_ = []
for i in range(NP):
    if P.at[i, "named"]:
        names_.append(P.at[i, "name"])
        continue
    pool_first = N.FEMALE_FIRST if P.at[i, "gender"] == "F" else N.MALE_FIRST
    while True:
        nm = f"{rng.choice(pool_first)} {rng.choice(N.LAST)}"
        if nm not in used:
            used.add(nm)
            names_.append(nm)
            break
P["name"] = names_
slug = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())  # noqa: E731
emails, used_e = [], {spec(i, "email") for i in range(NP) if spec(i, "email")}
for i in range(NP):
    e = spec(i, "email")
    if not e:
        first, last = P.at[i, "name"].split(" ", 1)
        base_e, k = f"{slug(first)}.{slug(last)}", 1
        e = f"{base_e}@horizon.demo"
        while e in used_e:
            k += 1
            e = f"{base_e}{k}@horizon.demo"
        used_e.add(e)
    emails.append(e)
P["email"] = emails
titles = []
for i in range(NP):
    d, t, lv = P.at[i, "dept"], P.at[i, "team"], int(P.at[i, "level"])
    if spec(i, "title"):
        titles.append(spec(i, "title"))
    elif P.at[i, "position"] == "dept_head":
        titles.append(f"VP {d}")
    elif P.at[i, "position"] == "team_lead":
        titles.append(f"Head of {t}")
    elif P.at[i, "is_line_manager"]:
        titles.append("Analytics Manager" if t in N.DATA_TEAMS else N.MANAGER_TITLE[d])
    else:
        pool_t = N.DATA_TITLES if t in N.DATA_TEAMS else N.IC_TITLES[d]
        titles.append(str(rng.choice(pool_t[min(lv, 4)])))
P["title"] = titles
P["app_role"] = [spec(i, "app_role") or ("manager" if (P.at[i, "position"] != "member" or P.at[i, "is_line_manager"]) else "employee")
                 for i in range(NP)]
P["manager_id"] = [int(emp_id[m]) if m >= 0 else None for m in P["manager_row"]]
P["hire_date"] = [(AS_OF - pd.Timedelta(days=int(t * 365.25))).date().isoformat() for t in P["tenure"]]
ROW_OF = {int(e): i for i, e in enumerate(emp_id)}
EID = lambda name: int(P.at[IDX[name], "id"])  # noqa: E731

DEPT_ID = {d: k + 1 for k, d in enumerate(T.DEPARTMENTS)}
TEAM_ID, team_rows = {}, []
for d, (_, teams) in T.DEPARTMENTS.items():
    for t, _, _ in teams:
        TEAM_ID[t] = len(TEAM_ID) + 1
        lead_row = P.index[(P["team"] == t) & (P["position"] == "team_lead")][0]
        team_rows.append(dict(id=TEAM_ID[t], name=t, department_id=DEPT_ID[d], lead_id=int(emp_id[lead_row])))
dept_rows = [dict(id=DEPT_ID[d], name=d, head_id=int(P.loc[(P["dept"] == d) & (P["position"] == "dept_head"), "id"].iloc[0]))
             for d in T.DEPARTMENTS]

# =====================================================================================
# 15. INTERVENTIONS table
# =====================================================================================
TYPE_COST = {"Workload rebalance": 3500, "Recognition program": 600, "Training & mentoring": 2200, "Task / team move": 1500}
TYPE_EXPECT = {"Workload rebalance": (15, 23), "Recognition program": (4, 8), "Training & mentoring": (5, 10), "Task / team move": (8, 14)}
TYPE_TEXT = {
    "Workload rebalance": ("Reduce workload 10% · reallocate tasks · bi-weekly check-in", "Workload above baseline"),
    "Recognition program": ("Recognize recent contributions · peer nominations", "Recognition gap"),
    "Training & mentoring": ("Mentor pairing · targeted training", "Skill gap on new tools"),
    "Task / team move": ("Move to a better-fitting project or rotation", "Role ambiguity"),
}
interv.sort(key=lambda it: (it["created"], it["row"] if it["row"] is not None else -1))
START_CODE = 207
for k, it in enumerate(interv):
    it["code_auto"] = f"INT-{START_CODE + k:04d}"
# design codes: swap with whichever intervention got that code
for it in interv:
    if it.get("code"):
        other = next(o for o in interv if o["code_auto"] == it["code"])
        other["code_auto"], it["code_auto"] = it["code_auto"], it["code"]
active_list = [it for it in interv if it["status"] == "active"]
due_this_week = [it for it in active_list if "dates" not in it][:T.FOLLOWUP_DUE_THIS_WEEK]
on_track_off = [it for it in active_list if it["who"] is None and "group" not in it][-5:]   # 22 of 27 on track
iv_rows = []
for it in interv:
    i = it["row"]
    st = it["status"]
    dts = dict(it.get("dates", {}))
    created = it["created"]
    day = lambda base, a, b: base + pd.Timedelta(days=int(rng.integers(a, b + 1)))  # noqa: E731
    proposed = None if st == "detected" else day(created, 0, 2)
    approved = pd.Timestamp(dts["planned"]) if "planned" in dts else (day(proposed, 1, 3) if st in ("active", "completed", "measured", "cancelled") else None)
    started = pd.Timestamp(dts["started"]) if "started" in dts else (day(approved, 1, 3) if approved is not None else None)
    if started is not None and started > AS_OF:
        started = AS_OF
    if st in ("measured", "completed") and i is not None and not it.get("dates"):
        started = WEEKS[it["w_start"]] + pd.Timedelta(days=int(rng.integers(0, 4)))
    checkin = pd.Timestamp(dts["checkin"]) if "checkin" in dts else (started + pd.Timedelta(days=14) if started is not None else None)
    followup = pd.Timestamp(dts["followup"]) if "followup" in dts else (started + pd.Timedelta(days=28) if started is not None else None)
    if st == "proposed" and "followup" not in dts:
        followup = None
    if it in due_this_week:
        followup = AS_OF + pd.Timedelta(days=int(rng.integers(0, 6)))
    elif st == "active" and "dates" not in it and followup is not None and followup <= AS_OF + pd.Timedelta(days=6):
        followup = AS_OF + pd.Timedelta(days=int(rng.integers(7, 15)))      # not due this week
    measured = pd.Timestamp(dts["measured"]) if "measured" in dts else (started + pd.Timedelta(days=42) if st == "measured" else None)
    if measured is not None and measured > AS_OF:
        measured = AS_OF
    completed = (started + pd.Timedelta(days=42)) if st == "completed" else measured
    if completed is not None and completed > AS_OF:
        completed = AS_OF - pd.Timedelta(days=1)
    base_r = int(R_model[i, it["w_detect"]]) if i is not None else None
    follow_r = int(R_model[i, min(it["w_measure"], NOW)]) if (i is not None and st == "measured") else None
    now_r = int(R_model[i, NOW]) if i is not None else None
    if st == "measured" and i is not None:
        outcome = "improved" if follow_r <= base_r - 5 else "no_change"
    elif st == "measured":
        outcome = "improved"
    else:
        outcome = None
    lo_e, hi_e = TYPE_EXPECT[it["type"]]
    expected = it.get("expected", int(rng.integers(lo_e, hi_e + 1)))
    title, root = TYPE_TEXT[it["type"]]
    if st == "active":
        progress = it.get("progress", int(np.clip((AS_OF - started).days / 42 * 100, 5, 90)))
    else:
        progress = it.get("progress", 100 if st in ("measured", "completed") else 0)
    grp = it.get("group")
    owner = EID(it["owner"]) if it.get("owner") else (int(P.at[i, "manager_id"]) if i is not None and P.at[i, "manager_id"] else None)
    iv_rows.append(dict(
        code=it["code_auto"], employee_id=int(emp_id[i]) if i is not None else None,
        team_id=TEAM_ID[grp[1]] if grp and grp[0] == "team" else None,
        department_id=DEPT_ID[grp[1]] if grp and grp[0] == "dept" else (DEPT_ID[P.at[i, "dept"]] if i is not None else None),
        people_count=grp[2] if grp else 1, type=it["type"], title=it.get("title", title),
        problem=it.get("problem", f"Burnout risk {base_r}%" if base_r is not None else ""),
        root_cause=it.get("root", root), status=st, on_track=int(st == "active" and it not in on_track_off),
        progress_pct=progress, proposed_by="PulseAI" if rng.random() < 0.7 else "Manager",
        owner_id=owner, human_approved=int(approved is not None),
        approved_by_id=owner if approved is not None else None,          # a person, never PulseAI
        detected_at=created.date().isoformat(),
        proposed_at=proposed.date().isoformat() if proposed is not None else None,
        approved_at=approved.date().isoformat() if approved is not None else None,
        started_at=started.date().isoformat() if started is not None else None,
        checkin_at=checkin.date().isoformat() if checkin is not None else None,
        followup_at=followup.date().isoformat() if followup is not None else None,
        completed_at=completed.date().isoformat() if completed is not None else None,
        measured_at=measured.date().isoformat() if measured is not None else None,
        expected_risk_drop=expected, expected_text=it.get("expected_text"),
        baseline_risk_pct=base_r, followup_risk_pct=follow_r, current_risk_pct=now_r, outcome=outcome,
        improved=int(i is not None and st not in open_st | {"declined", "cancelled"} and
                     ((follow_r if st == "measured" else now_r) <= base_r - 5)) if i is not None else int(it["improved"]),
        result_note=it.get("note"),
        cost_sar=int(round(TYPE_COST[it["type"]] * (grp[2] / 3 if grp else 1) * rng.uniform(0.8, 1.3), -1))))
IV = pd.DataFrame(iv_rows)
# open ones are "active" improved if risk is already 5+ lower than at detection
act_mask = IV["status"] == "active"
IV.loc[act_mask & IV["employee_id"].notna(), "improved"] = (
    IV.loc[act_mask & IV["employee_id"].notna(), "current_risk_pct"] <= IV.loc[act_mask & IV["employee_id"].notna(), "baseline_risk_pct"] - 5).astype(int)
IV.loc[IV["status"].isin(["detected", "proposed", "declined", "cancelled"]), "improved"] = 0
IV.loc[IV["employee_id"].isna() & (IV["status"] == "active"), "improved"] = 0
IV = IV.sort_values("code").reset_index(drop=True)
IV.insert(0, "id", np.arange(1, len(IV) + 1))
print("Interventions:", IV["status"].value_counts().to_dict(), "improved", int(IV["improved"].sum()),
      "measured improved", int((IV["outcome"] == "improved").sum()))

# =====================================================================================
# 16. MONTHLY SCORES (12 months; Q2 -> Q3 tier movement exactly as H02b)
# =====================================================================================
M = len(MONTHS)
q2 = list(MONTHS).index(pd.Period("2026-06", "M"))
risk_m = R_model[:, MONTH_END]
eng_m = ENG[:, MONTH_END]
S_m = np.zeros((NP, M), dtype=int)
CRIT_M = np.zeros((NP, M, 6), dtype=int)
CRIT_HIST = {   # June criteria of the two people whose criteria the design shows (E01, M04b baseline)
    "Layla Haddad": dict(task_completion=92, attendance_discipline=90, professional_behavior=89, innovation_creativity=72,
                         teamwork=79, technology_adoption=85),
    "Khalid Mansour": dict(task_completion=91, attendance_discipline=97, professional_behavior=86, innovation_creativity=84,
                           teamwork=85, technology_adoption=90),
}
hist_rows = {IDX[n]: np.array([v[c] for c in T.CRITERIA6]) for n, v in CRIT_HIST.items()}
for i, june in hist_rows.items():
    now_c = crit[i]
    for m in range(M):
        if m <= q2:
            c = june - np.where(np.arange(6) == 2, max(0, (q2 - m) // 3), 0)     # innovation grew slowly
        else:
            c = np.round(june + (now_c - june) * (m - q2) / (M - 1 - q2)).astype(int)
        CRIT_M[i, m] = c
        S_m[i, m] = half_up(score100(c, risk_m[i, m]) / 100)

lo_t = {t: SCORE_RANGE[t][0] for t in SCORE_RANGE}
hi_t = {t: SCORE_RANGE[t][1] for t in SCORE_RANGE}
cap_j, flo_j = score_cap(risk_m[:, q2]), score_floor(risk_m[:, q2])
feasible = lambda i, t: max(lo_t[t], flo_j[i]) <= min(hi_t[t], cap_j[i])  # noqa: E731
q3t = P["tier"].to_numpy()
q2t = q3t.copy()
for i in hist_rows:
    q2t[i] = tier_of(S_m[i, q2])
# movers seen from the Q3 tier: (Q3 tier, Q2 tier) -> count
MOVES = {("Gold", "Silver"): 49, ("Silver", "Gold"): 12, ("Silver", "Bronze"): T.BRONZE_TO_SILVER,
         ("Bronze", "Silver"): 18, ("Bronze", "Growth Needed"): 44, ("Growth Needed", "Bronze"): 7}
for i in hist_rows:
    if q2t[i] != q3t[i]:
        MOVES[(q3t[i], q2t[i])] -= 1
fixed_q2 = set(hist_rows)
sc = P["score"].to_numpy()
for (t3, t2), k in MOVES.items():
    cand = [i for i in np.where(q3t == t3)[0] if i not in fixed_q2 and feasible(i, t2) and not P.at[i, "named"]]
    forced = [i for i in cand if not feasible(i, t3)]
    up = TIER_NAMES.index(t2) > TIER_NAMES.index(t3)              # moved up a tier into t3
    rest_ = sorted([i for i in cand if i not in forced], key=lambda i: sc[i] if up else -sc[i])
    pick = (forced + rest_)[:k]
    assert len(pick) == k, (t3, t2, len(pick), k)
    for i in pick:
        q2t[i] = t2
        fixed_q2.add(i)
bad_stay = [i for i in range(NP) if i not in fixed_q2 and not feasible(i, q3t[i])]
assert not bad_stay, f"{len(bad_stay)} people cannot keep their tier in June"
for i in range(NP):
    if i in hist_rows:
        continue
    t2 = q2t[i]
    lo_i, hi_i = max(lo_t[t2], flo_j[i]), min(hi_t[t2], cap_j[i])
    if t2 == q3t[i]:
        s2 = sc[i] + rng.normal(0, 1.3)
    elif TIER_NAMES.index(t2) > TIER_NAMES.index(q3t[i]):        # was lower in June
        s2 = hi_i - rng.integers(0, 3)
    else:                                                        # was higher in June
        s2 = lo_i + rng.integers(0, 3)
    S_m[i, q2] = int(np.clip(round(s2), lo_i, hi_i))
    S_m[i, M - 1] = sc[i]
    for m in range(q2 + 1, M - 1):                               # July, August: on the way to today
        S_m[i, m] = round(S_m[i, q2] + (sc[i] - S_m[i, q2]) * (m - q2) / (M - 1 - q2))
    drift = 0.0
    for m in range(q2 - 1, -1, -1):                              # earlier months: small random walk
        drift += rng.normal(0, 0.9)
        S_m[i, m] = round(S_m[i, q2] + drift)
    caps = score_cap(risk_m[i])
    flos = score_floor(risk_m[i])
    for m in range(M):
        if m != q2:
            S_m[i, m] = int(np.clip(S_m[i, m], flos[m], caps[m]))
assert {t: int((np.array([tier_of(s) for s in S_m[:, q2]]) == t).sum()) for t in TIER_NAMES} == T.TIER_COUNTS_Q2
# H02b "Gold + Silver rose from 59% to 65% in four quarters": Dec 2025 at 59%, Mar 2026 at 58%
for per, share in [("2025-12", 0.59), ("2026-03", 0.58)]:
    m = list(MONTHS).index(pd.Period(per, "M"))
    caps, flos = score_cap(risk_m[:, m]), score_floor(risk_m[:, m])
    others_ = ~np.isin(np.arange(NP), list(hist_rows))
    diff = int((S_m[:, m] >= 80).sum()) - round(share * NP)
    if diff > 0:     # move some people just above 80 to just below
        cand = np.where(others_ & (S_m[:, m] >= 80) & (S_m[:, m] <= 82) & (flos <= 79))[0]
        pick = rng.choice(cand, diff, replace=False)
        S_m[pick, m] = np.maximum(flos[pick], 79 - rng.integers(0, 2, len(pick)))
    elif diff < 0:
        cand = np.where(others_ & (S_m[:, m] >= 77) & (S_m[:, m] <= 79) & (caps >= 80))[0]
        pick = rng.choice(cand, -diff, replace=False)
        S_m[pick, m] = np.minimum(caps[pick], 80 + rng.integers(0, 2, len(pick)))
print("Monthly criteria ...")
for i in range(NP):
    if i in hist_rows:
        continue
    for m in range(M):
        if m == M - 1:
            CRIT_M[i, m] = crit[i]
            continue
        prof_m = crit[i] + rng.normal(0, 1.2, 6)
        CRIT_M[i, m] = make_criteria(int(S_m[i, m]), int(risk_m[i, m]), prof_m)
S_exact = np.einsum("nmk,k->nm", CRIT_M, W) + 15 * (100 - risk_m)
assert (half_up(S_exact / 100) == S_m).all()

# =====================================================================================
# 17. CHECK-INS (private energy check-in + morale question, weekly)
# =====================================================================================
mood_w = np.zeros((NP, NW))
mood_w[WEEKLY_X["employee_row"], WEEKLY_X["week"]] = WEEKLY_X["mood_score"]
submitted = rng.random((NP, NW)) < 0.88
submitted[np.isin(np.arange(NP), pr_rows), NOW - 5:] = True                 # M01: n = 9
submitted[IDX["Layla Haddad"], NOW - 5:] = True                             # E01: 6-week streak
energy = np.clip(np.round(mood_w + rng.normal(0, 0.45, (NP, NW))), 1, 5).astype(int)
morale = np.clip(np.round(0.55 * ENG + 11 * (mood_w - 1) + rng.normal(0, 6, (NP, NW))), 5, 100).astype(int)
k_low = [NOW, NOW - 1, NOW - 3]                     # M06: Khalid rated his energy low 3 of the last 4 weeks
energy[IDX["Khalid Mansour"], k_low] = [2, 2, 2]
energy[IDX["Khalid Mansour"], NOW - 2] = 3
MORALE_T = {"Customer Insights": (81, 74), "Finance Ops": (75, 69), "Field Operations": (74, 76),
            "Data Platform": (75, 73), "CS · Enterprise": (63, 67), "Platform Reliability": (55, 70)}   # H07 (now, Aug)
w_aug = MONTH_END[list(MONTHS).index(pd.Period("2026-08", "M"))]
for t, (now_v, aug_v) in MORALE_T.items():
    rows_t = P.index[(P["team"] == t) & (P["position"] == "member")].to_numpy()
    for w, target in [(NOW, now_v), (w_aug, aug_v)]:
        sub = rows_t[submitted[rows_t, w]]
        vals = morale[sub, w] + (target - int(np.median(morale[sub, w])))
        order_ = np.argsort(vals)
        mid = len(vals) // 2
        if len(vals) % 2 == 0:
            vals[order_[mid - 1]] = target
            vals[order_[mid]] = target
        else:
            vals[order_[mid]] = target
        morale[sub, w] = np.clip(vals, 5, 100)
        assert np.median(morale[sub, w]) == target, (t, w)
share = rng.random(NP) < 0.62
share[IDX["Layla Haddad"]] = share[IDX["Khalid Mansour"]] = True
ck = np.argwhere(submitted)
CHECKINS = pd.DataFrame({"employee_id": emp_id[ck[:, 0]], "week_start": [WEEKS[w].date().isoformat() for w in ck[:, 1]],
                         "energy": energy[ck[:, 0], ck[:, 1]], "morale": morale[ck[:, 0], ck[:, 1]],
                         "share_trend": share[ck[:, 0]].astype(int)})

# =====================================================================================
# 18. RECOGNITIONS (H09: 171 awards in Q3 from 142 people, coverage 64%, Q2 57%)
# =====================================================================================
Q3_START = (AS_OF - pd.Timestamp("2026-07-01")).days                      # 82 days ago
Q2_WIN = ((AS_OF - pd.Timestamp("2026-06-30")).days, (AS_OF - pd.Timestamp("2026-05-02")).days)    # 83 .. 142
ev = {i: [] for i in range(NP)}                                           # days before AS_OF
fixed_ev = {}
for recv, cat, giver, date, out in T.SCRIPTED_AWARDS:
    fixed_ev.setdefault(IDX[recv], []).append((AS_OF - pd.Timestamp(date)).days)
for n, ds in EXTRA_KUDOS.items():
    fixed_ev.setdefault(IDX[n], []).extend((AS_OF - pd.Timestamp(d)).days for d in ds)
for i in range(NP):
    if never[i]:
        continue
    L = int(last_days[i])
    if i in fixed_ev:
        ev[i] = sorted(fixed_ev[i])
        extra = int(rec90[i]) - sum(1 for d in ev[i] if d <= 90)
        ev[i] += list(rng.integers(L, 83, max(0, extra)))
    else:
        ev[i] = [L] + (list(rng.integers(L, 91, int(rec90[i]) - 1)) if L <= 90 and rec90[i] > 1 else [])
# Q2 coverage: 57% recognized in the 60 days up to 30 Jun
in_q2 = np.array([any(Q2_WIN[0] <= d <= Q2_WIN[1] for d in ev[i]) for i in range(NP)])
need_q2 = round(0.57 * NP) - int(in_q2.sum())
cand_q2 = [i for i in range(NP) if not never[i] and not in_q2[i] and last_days[i] < 91]
for i in rng.choice(cand_q2, need_q2, replace=False):
    ev[i].append(int(rng.integers(91, Q2_WIN[1] + 1)))
# older recognitions (5 - 12 months ago), outside the Q2 window
for i in range(NP):
    if never[i]:
        continue
    lo_d = max(int(last_days[i]), Q2_WIN[1] + 1)
    for _ in range(int(rng.poisson(1.3))):
        if lo_d < 364:
            ev[i].append(int(rng.integers(lo_d, 365)))
RECS = [(i, d) for i in range(NP) for d in ev[i]]
CAT_MSG = {
    "Performance Star": ["Delivered the release a week early and kept quality high.", "Closed the quarter's hardest backlog item."],
    "Innovation Champion": ["Turned a rough idea into a tool the team now uses daily.", "Proposed a simpler way and proved it with a pilot."],
    "Collaboration Hero": ["Brought two teams together on a tough dependency.", "Always makes time to unblock others."],
    "Digital Pioneer": ["Helped the whole team adopt the new tool.", "Automated a manual report everyone relied on."],
    "Team Supporter": ["Stepped in during a busy week without being asked.", "Covered on-call so a colleague could rest."],
    "Growth Champion": ["Finished a hard certification while delivering.", "Took on a stretch role and grew into it."],
}
KUDOS_MSG = ["Thank you for the quick help today.", "Great review, it caught a real issue.", "Thanks for the clear hand-over.",
             "Your summary saved me an hour.", "Thanks for jumping on that call."]
OUTCOMES = ["Cycle time -12%", "Customer escalations -20%", "Report requests -15%", "On-time delivery 96%", "Error rate -30%",
            "Onboarding time -2 days", "NPS +6", "Backlog -18 items"]
rec_df = pd.DataFrame(RECS, columns=["row", "days"])
rec_df["kind"] = "kudos"
rec_df["category"] = None
rec_df["giver_row"] = -1
rec_df["giver_name"] = None
rec_df["outcome"] = None
rec_df["message"] = None
# scripted awards
for recv, cat, giver, date, out in T.SCRIPTED_AWARDS:
    d = (AS_OF - pd.Timestamp(date)).days
    k = rec_df.index[(rec_df["row"] == IDX[recv]) & (rec_df["days"] == d) & (rec_df["kind"] == "kudos")][0]
    rec_df.loc[k, ["kind", "category", "outcome"]] = ["award", cat, out]
    if giver in IDX:
        rec_df.loc[k, "giver_row"] = IDX[giver]
    else:
        rec_df.loc[k, "giver_name"] = giver
cats_left = dict(T.AWARDS_Q3)
for _, cat, *_ in T.SCRIPTED_AWARDS:
    cats_left[cat] -= 1
q3_free = rec_df.index[(rec_df["days"] <= Q3_START) & (rec_df["kind"] == "kudos")
                       & ~rec_df["row"].isin([IDX[n] for n in EXTRA_KUDOS])].to_numpy()
wq = np.where(upper[rec_df.loc[q3_free, "row"]], 1.0, 0.75)
award_k = rng.choice(q3_free, sum(cats_left.values()), replace=False, p=wq / wq.sum())
cat_list = [c for c, k in cats_left.items() for _ in range(k)]
rng.shuffle(cat_list)
rec_df.loc[award_k, "kind"] = "award"
rec_df.loc[award_k, "category"] = cat_list
# givers: managers and teammates
team_rows_of = {t: P.index[P["team"] == t].to_numpy() for t in P["team"].dropna().unique()}


def pick_giver(i, award):
    mgr = P.at[i, "manager_row"]
    t = P.at[i, "team"]
    mates = team_rows_of.get(t, np.array([mgr]))
    mates = mates[mates != i]
    if (award and rng.random() < 0.55 and mgr >= 0) or len(mates) == 0:
        return int(mgr)
    if rng.random() < 0.1:
        return int(rng.integers(NP))
    return int(rng.choice(mates))


for k in rec_df.index[rec_df["giver_row"] < 0]:
    if rec_df.at[k, "giver_name"] is None:
        g = pick_giver(int(rec_df.at[k, "row"]), rec_df.at[k, "kind"] == "award")
        rec_df.at[k, "giver_row"] = g if g != rec_df.at[k, "row"] else int(P.at[int(rec_df.at[k, "row"]), "manager_row"])
# exactly 142 different people gave the 171 awards in Q3
aw = rec_df.index[rec_df["kind"] == "award"]
fixed_aw = set(rec_df.index[(rec_df["kind"] == "award") & rec_df["outcome"].notna()])
for _ in range(5000):
    givers = rec_df.loc[aw, "giver_row"]
    distinct = givers[givers >= 0].nunique()
    if distinct == T.AWARD_GIVERS_Q3:
        break
    k = rng.choice([x for x in aw if x not in fixed_aw])
    i = int(rec_df.at[k, "row"])
    if distinct > T.AWARD_GIVERS_Q3:     # give it to someone who already gave an award (their manager if possible)
        counts = givers.value_counts()
        if counts.get(rec_df.at[k, "giver_row"], 0) == 1:
            mgr = int(P.at[i, "manager_row"])
            new = mgr if mgr in counts.index and mgr != rec_df.at[k, "giver_row"] else int(rng.choice(counts.index[counts.index >= 0]))
            if new != i:
                rec_df.at[k, "giver_row"] = new
    else:                                # a new giver from the same team
        counts = givers.value_counts()
        if counts.get(rec_df.at[k, "giver_row"], 0) > 1:
            mates = team_rows_of.get(P.at[i, "team"], np.array([], dtype=int))
            new_c = [m for m in mates if m != i and m not in counts.index]
            if new_c:
                rec_df.at[k, "giver_row"] = int(rng.choice(new_c))
# 58% of Q3 awards are linked to an outcome
link_need = round(T.AWARDS_LINKED_PCT / 100 * 171) - int(rec_df.loc[aw, "outcome"].notna().sum())
link_k = rng.choice([k for k in aw if pd.isna(rec_df.at[k, "outcome"])], link_need, replace=False)
rec_df.loc[link_k, "outcome"] = rng.choice(OUTCOMES, len(link_k))
for k in rec_df.index:
    if rec_df.at[k, "kind"] == "award":
        if rec_df.at[k, "message"] is None:
            rec_df.at[k, "message"] = str(rng.choice(CAT_MSG[rec_df.at[k, "category"]]))
    else:
        rec_df.at[k, "message"] = str(rng.choice(KUDOS_MSG))
# older awards (before Q3) keep the same categories, about 1 in 4 recognitions
old_k = rec_df.index[(rec_df["days"] > Q3_START) & (rng.random(len(rec_df)) < 0.25)]
rec_df.loc[old_k, "kind"] = "award"
rec_df.loc[old_k, "category"] = rng.choice(list(T.AWARDS_Q3), len(old_k))
rec_df.loc[old_k, "message"] = [str(rng.choice(CAT_MSG[c])) for c in rec_df.loc[old_k, "category"]]
rec_df["date"] = [(AS_OF - pd.Timedelta(days=int(d))).date().isoformat() for d in rec_df["days"]]
RECOG = pd.DataFrame({
    "giver_id": [int(emp_id[g]) if g >= 0 else None for g in rec_df["giver_row"]],
    "giver_name": rec_df["giver_name"], "receiver_id": emp_id[rec_df["row"]], "kind": rec_df["kind"],
    "category": rec_df["category"], "message": rec_df["message"], "linked_outcome": rec_df["outcome"],
    "is_public": np.where(rec_df["kind"] == "award", 1, (rng.random(len(rec_df)) < 0.8).astype(int)),
    "created_at": rec_df["date"]}).sort_values(["created_at", "receiver_id"]).reset_index(drop=True)
RECOG.insert(0, "id", np.arange(1, len(RECOG) + 1))
voices = {"Layla Haddad": 24, "Yousef Tamimi": 17, "Noura Al-Saud": 12, "Dina Kassem": 15, "Reem Aziz": 9, "Maha Al-Otaibi": 11}
RECOG["voices"] = 0
for n, v in voices.items():
    m = (RECOG["receiver_id"] == EID(n)) & RECOG["linked_outcome"].notna()
    RECOG.loc[RECOG.index[m][-1], "voices"] = v
aw_mask = (RECOG["kind"] == "award") & (RECOG["created_at"] >= "2026-07-01")
RECOG.loc[aw_mask & (RECOG["voices"] == 0), "voices"] = rng.integers(2, 20, int((aw_mask & (RECOG["voices"] == 0)).sum()))
P["last_recognized_at"] = [(AS_OF - pd.Timedelta(days=int(d))).date().isoformat() if not np.isnan(d) else None for d in last_days]

# =====================================================================================
# 19. IDEAS and who worked on them (H08, E04, E05, E06)
# =====================================================================================
D = lambda s: pd.Timestamp(s)  # noqa: E731
# ideas the design shows by name (code number -> details). Codes count 2026 ideas: 118 submitted + 3 drafts = IDEA-121.
KNOWN_IDEAS = {
    12: dict(title="Supplier Contract Scanner", team="Finance Ops", status="implemented", submitted="2026-02-09",
             approved="2026-03-02", build="2026-05-25", implemented="2026-07-13", verified="2026-07-27", value=120_000, cost=30_000, size=4),
    25: dict(title="Shift Handover Bot", team="Field Operations", status="implemented", submitted="2026-03-09",
             approved="2026-04-06", build="2026-06-08", implemented="2026-07-27", verified="2026-08-10", value=140_000, cost=35_000, size=5),
    45: dict(title="Returns Triage Rules", team="Supply Chain", status="implemented", submitted="2026-04-13",
             approved="2026-07-01", build="2026-07-06", implemented="2026-08-17", verified="2026-08-31", value=80_000, cost=20_000, size=4),
    60: dict(title="Smart Onboarding Journeys", team="Employee Experience", status="in_build", submitted="2026-05-25",
             approved="2026-07-07", build="2026-07-14", value=95_000, cost=30_000, size=5, progress=55, open_roles="Content Designer"),
    66: dict(title="Ticket Auto-Triage", team="IT Services", status="in_build", submitted="2026-06-08",
             approved="2026-07-20", build="2026-07-27", value=110_000, cost=40_000, size=8, progress=45),
    70: dict(title="Predictive Stock Rebalancing", team="Logistics Planning", status="in_build", submitted="2026-06-15",
             approved="2026-07-13", build="2026-07-20", value=260_000, cost=70_000, size=7, progress=70, note="Pilot"),
    84: dict(title="Self-serve Insight Hub", owner="Layla Haddad", status="implemented", submitted="2026-07-08",
             approved="2026-07-15", build="2026-07-20", implemented="2026-08-30", verified="2026-09-14", value=180_000, cost=45_000,
             size=4, members=["Sara Nabil", "Hassan Ali", "Majed Harb"], note="Report requests -38% · adopted by 5 teams"),
    88: dict(title="Customer Effort Score Live", team="CS · Enterprise", status="approved", submitted="2026-07-20",
             approved="2026-08-10", value=120_000, cost=35_000, size=2, open_roles="Data Engineer · Analyst"),
    90: dict(title="Self-healing Deploy Rollback", owner="Rami Khoury", status="in_build", submitted="2026-07-27",
             approved="2026-08-04", build="2026-08-10", value=160_000, cost=45_000, size=6, progress=60, members=["Faisal Rahman"]),
    95: dict(title="Capacity Forecaster", owner="Maha Al-Otaibi", status="in_build", submitted="2026-08-05",
             approved="2026-09-02", build="2026-09-07", value=120_000, cost=40_000, size=6, progress=40, members=["Noura Al-Saud"]),
    99: dict(title="Incident Postmortem Copilot", owner="Khalid Mansour", status="in_build", submitted="2026-08-10",
             approved="2026-09-08", build="2026-09-14", value=90_000, cost=30_000, size=6, progress=10),
    102: dict(title="Churn Early-signal Alerts", owner="Layla Haddad", status="approved", submitted="2026-08-12",
              approved="2026-08-26", value=150_000, cost=40_000, size=2, members=["Sara Nabil"], open_roles="ML Engineer",
              note="Team forming · needs ML engineer"),
    117: dict(title="Invoice Anomaly Radar", owner="Adel Nasser", status="approved", submitted="2026-09-01",
              approved="2026-09-09", value=310_000, cost=85_000, size=2, members=["Dina Kassem"],
              open_roles="Data Analyst, UX Designer, AI Specialist", note="Build 14 weeks, starts 5 Oct"),
    119: dict(title="Health Score Early Alerts", team="SMB Success", status="draft", submitted=None, created="2026-09-15", size=1),
    120: dict(title="Proposal Block Library", team="Enterprise Sales", status="draft", submitted=None, created="2026-09-18", size=1),
    121: dict(title="Survey Auto-Coding Assistant", owner="Layla Haddad", status="draft", submitted=None, created="2026-09-21",
              value=150_000, cost=40_000, size=1, novelty=78, feasibility=84, value_score=72, impact=69, readiness=76),
}
OTHER_PR_IDEAS = ["On-call Load Balancer", "Flaky-test Quarantine Bot", "Alert Noise Reducer"]
# submission date anchors (codes are given in submission order)
ANCH = [(1, "2026-01-05"), (12, "2026-02-09"), (25, "2026-03-09"), (38, "2026-03-30"), (39, "2026-04-01"), (45, "2026-04-13"),
        (60, "2026-05-25"), (66, "2026-06-08"), (70, "2026-06-15"), (76, "2026-06-29"), (77, "2026-07-01"), (84, "2026-07-08"),
        (88, "2026-07-20"), (90, "2026-07-27"), (95, "2026-08-05"), (99, "2026-08-10"), (102, "2026-08-12"), (117, "2026-09-01"),
        (118, "2026-09-20")]
ax = [a for a, _ in ANCH]
ay = [D(b).value for _, b in ANCH]
sub_dates = {c: pd.Timestamp(int(np.interp(c, ax, ay))).normalize() for c in range(1, 119)}
# statuses of the other ideas
#   Q1+Q2 (codes 1-76): 3 implemented, 3 in build (above), 3 parked (blocked by data owners), 7 merged, 60 rejected
#   Q3 (codes 77-118): 1 implemented, 3 approved, 3 in build (above), 20 rejected, 15 waiting for the council
h1_free = [c for c in range(1, 77) if c not in KNOWN_IDEAS]
q3_free = [c for c in range(77, 119) if c not in KNOWN_IDEAS]
rng.shuffle(h1_free)
st_of = {}
for c in h1_free[:3]:
    st_of[c] = "parked"
for c in h1_free[3:10]:
    st_of[c] = "merged"
for c in h1_free[10:]:
    st_of[c] = "rejected"
q3_sorted = sorted(q3_free)
for c in q3_sorted[-15:]:
    st_of[c] = "ai_reviewed"               # the newest ones wait for the Innovation Council
for c in q3_sorted[:-15]:
    st_of[c] = "rejected"
# 3 Q2 ideas blocked by data owners must be Q2 (H08 "3 ideas blocked by data owners in Q2")
parked = [c for c, s in st_of.items() if s == "parked"]
q2_rej = [c for c in range(39, 77) if st_of.get(c) == "rejected"]
for c_old, c_new in zip([c for c in parked if c < 39], q2_rej):
    st_of[c_old], st_of[c_new] = "rejected", "parked"

# department of each idea: known ones fixed, others so that ideas per department are 34/33/21/18/6/6
DEPT_IDEAS = {"Technology": 34, "Operations": 33, "Sales": 21, "Customer Success": 18, "Finance": 6, "People": 6}
team_dept = {t: d for d, (_, ts) in T.DEPARTMENTS.items() for t, _, _ in ts}
idea_dept = {}
for c, k in KNOWN_IDEAS.items():
    if c > 118:
        continue
    idea_dept[c] = P.at[IDX[k["owner"]], "dept"] if "owner" in k else team_dept[k["team"]]
left = dict(DEPT_IDEAS)
for d in idea_dept.values():
    left[d] -= 1
free_codes = [c for c in range(1, 119) if c not in idea_dept]
dl = [d for d, k in left.items() for _ in range(k)]
rng.shuffle(dl)
for c, d in zip(free_codes, dl):
    idea_dept[c] = d
pr_codes = [c for c in q3_free if idea_dept[c] == "Technology"][:3]       # 3 more Platform Reliability ideas (M09)

# participants per department (people involved in any 2026 idea) and the H07 / M01 team numbers
PART = {"Technology": 136, "Operations": 134, "People": 24, "Sales": 87, "Customer Success": 74, "Finance": 25}
changed("H08", "People participation 37%", "38% (24 of 64)", "with 64 people 37% is not possible: 23 = 35.9%, 24 = 37.5%")
changed("H07", "Finance Ops innovation 24", "25% (3 of 12)", "with 12 people 24% is not possible")
changed("H07", "Platform Reliability innovation 58", "56% (5 of 9)", "M01 says 5 of 9 people are involved in ideas")
TEAM_PART_NAMED = {"Customer Insights": ["Layla Haddad", "Sara Nabil", "Hassan Ali", "Majed Harb"],
                   "Finance Ops": ["Adel Nasser", "Dina Kassem"],
                   "Platform Reliability": ["Rami Khoury", "Faisal Rahman", "Maha Al-Otaibi", "Noura Al-Saud", "Khalid Mansour"],
                   "Data Platform": ["Hadi Karam"]}
innov_c = P["innovation_creativity"].to_numpy()
part = np.zeros(NP, dtype=bool)
quota_teams = set(T.TEAM_PARTICIPATION)
for t, k in T.TEAM_PARTICIPATION.items():
    rows_t = P.index[(P["team"] == t) & (P["position"] == "member")].to_numpy()
    nm = [IDX[n] for n in TEAM_PART_NAMED.get(t, [])]
    part[nm] = True
    nm_members = [i for i in nm if i in rows_t]          # a team lead (Adel) is not counted in the team's members
    rest_t = [i for i in rows_t if i not in nm]
    w_ = np.exp((innov_c[rest_t] - 70) / 10)
    part[rng.choice(rest_t, k - len(nm_members), replace=False, p=w_ / w_.sum())] = True
for d, k in PART.items():
    m = (P["dept"] == d).to_numpy()
    have = int(part[m].sum())
    pool_d = np.where(m & ~part & ~(P["team"].isin(quota_teams) & (P["position"] == "member")).to_numpy())[0]
    w_ = np.exp((innov_c[pool_d] - 70) / 10)
    part[rng.choice(pool_d, k - have, replace=False, p=w_ / w_.sum())] = True
assert int(part.sum()) == sum(PART.values())

ideas, members = [], []
used_part = set()
part_by_dept = {d: list(np.where(part & (P["dept"] == d).to_numpy())[0]) for d in T.DEPARTMENTS}
for d in part_by_dept:
    rng.shuffle(part_by_dept[d])


def next_member(d, exclude, team=None):
    """An unused participant of this department (same team first), else any participant again."""
    pool_ = [i for i in part_by_dept[d] if i not in used_part and i not in exclude
             and not (P.at[i, "team"] in quota_teams and P.at[i, "team"] != team)]
    if team:
        same = [i for i in pool_ if P.at[i, "team"] == team]
        pool_ = same or pool_
    if not pool_:
        pool_ = [i for i in part_by_dept[d] if i not in exclude and (team is None or P.at[i, "team"] == team or P.at[i, "team"] not in quota_teams)]
    return pool_[0] if pool_ else None


TITLE_POOL = {d: list(v) for d, v in N.IDEA_TITLES.items()}
CATEGORIES = N.IDEA_CATEGORIES
# in-build ideas pick their people first, so their teams are 38 different people (E06)
for code in sorted(range(1, 122), key=lambda c: (KNOWN_IDEAS.get(c, {}).get("status") != "in_build", c)):
    k = KNOWN_IDEAS.get(code, {})
    d = idea_dept.get(code) or (P.at[IDX[k["owner"]], "dept"] if "owner" in k else team_dept[k["team"]])
    status = k.get("status") or st_of[code]
    # owner
    if "owner" in k:
        owner = IDX[k["owner"]]
    elif "team" in k:
        cands = [i for i in part_by_dept[d] if P.at[i, "team"] == k["team"]] or part_by_dept[d]
        owner = cands[0]
    elif code in pr_codes:
        owner = IDX[["Faisal Rahman", "Noura Al-Saud", "Rami Khoury"][pr_codes.index(code)]]
    else:
        owner = next_member(d, set())
    used_part.add(owner)
    team_o = P.at[owner, "team"]
    if code <= 118 and owner not in np.where(part)[0]:
        raise RuntimeError(f"owner of IDEA-{code:03d} is not a participant")
    size = k.get("size", int(np.clip(1 + rng.poisson(3.2), 1, 7)))
    mem = [owner] + [IDX[n] for n in k.get("members", [])]
    for i in mem:
        used_part.add(i)
    while len(mem) < size and code <= 118:
        # in-build teams take people from across the department (E06: 38 different contributors)
        nxt = next_member(d, set(mem), team_o if (team_o in quota_teams and status != "in_build") else None)
        if nxt is None:
            break
        mem.append(nxt)
        used_part.add(nxt)
    if code in pr_codes:
        title = OTHER_PR_IDEAS[pr_codes.index(code)]
    elif "title" in k:
        title = k["title"]
    else:
        title = str(rng.choice(TITLE_POOL[d]))
    sub = D(k["submitted"]) if k.get("submitted") else (sub_dates.get(code) if code <= 118 else None)
    created = D(k["created"]) if k.get("created") else sub
    reviewed = sub + pd.Timedelta(days=int(rng.integers(1, 3))) if sub is not None else None
    if reviewed is not None and reviewed > AS_OF:
        reviewed = AS_OF
    if reviewed is not None and sub < D("2026-07-01") and reviewed >= D("2026-07-01"):
        reviewed = D("2026-06-30")
    decided = D(k["approved"]) if k.get("approved") else None
    if status in ("rejected", "parked", "merged"):
        decided = reviewed + pd.Timedelta(days=int(rng.integers(5, 21)))
        if sub < D("2026-07-01"):
            decided = min(decided, D("2026-06-30"))
        decided = min(decided, AS_OF)
    val = k.get("value", int(round(rng.lognormal(11.0, 0.6), -4)))
    ideas.append(dict(
        code=f"IDEA-{code:03d}", title=title, department_id=DEPT_ID[d], team_id=TEAM_ID.get(team_o), owner_id=int(emp_id[owner]),
        status=status, category=str(rng.choice(CATEGORIES)),
        created_at=created.date().isoformat() if created is not None else None,
        submitted_at=sub.date().isoformat() if sub is not None else None,
        reviewed_at=reviewed.date().isoformat() if reviewed is not None else None,
        decided_at=decided.date().isoformat() if decided is not None else None,
        build_started_at=k["build"] if k.get("build") else None,
        implemented_at=k.get("implemented"), verified_at=k.get("verified"),
        expected_savings_sar=val, cost_sar=k.get("cost", int(round(val * rng.uniform(0.2, 0.4), -3))),
        realized_savings_sar=val if status == "implemented" else 0,
        novelty=k.get("novelty", int(np.clip(rng.normal(66, 12), 25, 98))),
        feasibility=k.get("feasibility", int(np.clip(rng.normal(72, 10), 30, 98))),
        value_score=k.get("value_score", int(np.clip(rng.normal(65, 12), 25, 98))),
        impact_score=k.get("impact", int(np.clip(rng.normal(60, 12), 20, 98))),
        readiness=k.get("readiness", int(np.clip(rng.normal(64, 12), 20, 98))),
        progress_pct=k.get("progress", 100 if status == "implemented" else 0),
        open_roles=k.get("open_roles"), note=k.get("note")))
    for j, i in enumerate(mem):
        members.append(dict(idea_code=f"IDEA-{code:03d}", employee_id=int(emp_id[i]), role="owner" if j == 0 else "contributor"))
# participants nobody placed yet join an idea of their department
for i in np.where(part)[0]:
    if i not in used_part:
        d = P.at[i, "dept"]
        t = P.at[i, "team"]
        ok_st = lambda x: x["status"] not in ("draft", "in_build")   # noqa: E731  (in-build teams stay 38 people, E06)
        opts = [x for x in ideas if x["department_id"] == DEPT_ID[d] and ok_st(x)
                and (t not in quota_teams or x["team_id"] == TEAM_ID.get(t))]
        if not opts:
            opts = [x for x in ideas if x["department_id"] == DEPT_ID[d] and ok_st(x)]
        x = opts[int(rng.integers(len(opts)))]
        members.append(dict(idea_code=x["code"], employee_id=int(emp_id[i]), role="contributor"))
        used_part.add(i)
ideas.sort(key=lambda x: x["code"])
IDEAS = pd.DataFrame(ideas)
# ideas of 2025 (88): only their numbers matter (H08 "+34%")
old = []
for c in range(1, T.IDEAS_2025 + 1):
    d = rng.choice(list(DEPT_IDEAS), p=np.array(list(DEPT_IDEAS.values())) / 118)
    sub = D("2025-01-06") + pd.Timedelta(days=int((c - 1) * 355 / T.IDEAS_2025))
    s = "implemented" if (c <= 60 and c % 15 == 0) else ("parked" if c % 7 == 0 else "rejected")   # implemented within 2025
    val = int(round(rng.lognormal(11.0, 0.6), -4))
    owner = int(rng.choice(np.where((P["dept"] == d).to_numpy() & ~P["named"].to_numpy())[0]))
    old.append(dict(code=f"IDEA-25-{c:03d}", title=str(rng.choice(TITLE_POOL[d])), department_id=DEPT_ID[d],
                    team_id=TEAM_ID.get(P.at[owner, "team"]), owner_id=int(emp_id[owner]), status=s, category=str(rng.choice(CATEGORIES)),
                    created_at=sub.date().isoformat(), submitted_at=sub.date().isoformat(),
                    reviewed_at=(sub + pd.Timedelta(days=2)).date().isoformat(), decided_at=(sub + pd.Timedelta(days=14)).date().isoformat(),
                    build_started_at=(sub + pd.Timedelta(days=30)).date().isoformat() if s == "implemented" else None,
                    implemented_at=(sub + pd.Timedelta(days=120)).date().isoformat() if s == "implemented" else None,
                    verified_at=(sub + pd.Timedelta(days=134)).date().isoformat() if s == "implemented" else None,
                    expected_savings_sar=val, cost_sar=int(round(val * 0.3, -3)), realized_savings_sar=val if s == "implemented" else 0,
                    novelty=int(np.clip(rng.normal(62, 12), 25, 98)), feasibility=int(np.clip(rng.normal(70, 10), 30, 98)),
                    value_score=int(np.clip(rng.normal(62, 12), 25, 98)), impact_score=int(np.clip(rng.normal(58, 12), 20, 98)),
                    readiness=int(np.clip(rng.normal(60, 12), 20, 98)), progress_pct=100 if s == "implemented" else 0,
                    open_roles=None, note=None))
IDEAS = pd.concat([pd.DataFrame(old), IDEAS], ignore_index=True)
IDEAS.insert(0, "id", np.arange(1, len(IDEAS) + 1))
id_of_code = dict(zip(IDEAS["code"], IDEAS["id"]))
IDEA_MEMBERS = pd.DataFrame(members).drop_duplicates(["idea_code", "employee_id"])
IDEA_MEMBERS.insert(0, "idea_id", IDEA_MEMBERS.pop("idea_code").map(id_of_code))
P["idea_participant"] = part

# =====================================================================================
# 20. INNOVATION DNA (7 traits, organisation medians exactly as H08, Layla as E04)
# =====================================================================================
dna = np.zeros((NP, 7))
for k in range(7):
    dna[:, k] = (T.DNA_ORG_MEDIAN[k] + 0.55 * (innov_c - 72) + np.where(part, 6, -4) + rng.normal(0, 9, NP))
dna = np.clip(np.round(dna), 10, 99).astype(int)
lay = IDX["Layla Haddad"]
dna[lay] = T.DNA_LAYLA
for k in range(7):
    col = dna[:, k]
    target = T.DNA_ORG_MEDIAN[k]
    free = np.ones(NP, dtype=bool)
    free[lay] = False
    col[free] += target - int(np.median(col))
    order_ = np.argsort(col, kind="stable")
    mid = [order_[NP // 2 - 1], order_[NP // 2]]
    for j in mid:
        if j != lay:
            col[j] = target
    col[free & (np.argsort(np.argsort(col, kind="stable")) < NP // 2 - 1) & (col > target)] = target
    col[free & (np.argsort(np.argsort(col, kind="stable")) > NP // 2) & (col < target)] = target
    dna[:, k] = np.clip(col, 5, 99)
    assert np.median(dna[:, k]) == target, (k, np.median(dna[:, k]))
DNA = pd.DataFrame(dna, columns=T.DNA_TRAITS)
DNA.insert(0, "employee_id", emp_id)

# =====================================================================================
# 21. SKILLS
# =====================================================================================
skills = []
for i in range(NP):
    pool_s = N.DATA_SKILLS if P.at[i, "team"] in N.DATA_TEAMS else N.SKILLS[P.at[i, "dept"]]
    for sname in rng.choice(pool_s, 4, replace=False):
        lv_s = int(np.clip(round(1 + P.at[i, "tenure"] / 4 + P.at[i, "level"] * 0.4 + rng.normal(0, 0.8)), 1, 5))
        skills.append(dict(employee_id=int(emp_id[i]), skill=str(sname), category="Technical", level=lv_s))
    for sname in rng.choice(N.SOFT_SKILLS, 2, replace=False):
        skills.append(dict(employee_id=int(emp_id[i]), skill=str(sname), category="Soft", level=int(np.clip(round(rng.normal(3.4, 0.9)), 1, 5))))
SKILLS = pd.DataFrame(skills)
SKILLS.insert(0, "id", np.arange(1, len(SKILLS) + 1))

# =====================================================================================
# 22. ECONOMIC IMPACT FY2026 (H12) - transparent assumptions, Finance can change them
# =====================================================================================
eco = [dict(section="component", item_key=k, label=lab, value_sar=v, basis=b, sort_order=n + 1)
       for n, (k, lab, v, b) in enumerate(T.ECONOMIC)]
eco += [dict(section="summary", item_key="expected", label="Expected annual impact", value_sar=sum(v for _, _, v, _ in T.ECONOMIC),
             basis="Sum of the six components", sort_order=1),
        dict(section="summary", item_key="range_low", label="Likely range, low", value_sar=T.ECONOMIC_RANGE[0], basis="Low end of the estimate", sort_order=2),
        dict(section="summary", item_key="range_high", label="Likely range, high", value_sar=T.ECONOMIC_RANGE[1], basis="High end of the estimate", sort_order=3),
        dict(section="summary", item_key="cost", label="Program cost", value_sar=T.ECONOMIC_COST,
             basis=f"Interventions SAR {int(IV.loc[IV['detected_at'] >= '2026-01-01', 'cost_sar'].sum()):,} + platform and people time", sort_order=4),
        dict(section="summary", item_key="realized", label="Realized so far", value_sar=T.ECONOMIC_REALIZED, basis="62% of expected", sort_order=5)]
by_src = [("workload", "Workload rebalancing", 2_800_000), ("recognition", "Recognition programs", 600_000),
          ("training", "Training & mentoring", 700_000), ("moves", "Team & task moves", 200_000), ("ideas", "Implemented ideas", 500_000)]
eco += [dict(section="source", item_key=k, label=lab, value_sar=v, basis="H12 ribbon", sort_order=n + 1) for n, (k, lab, v) in enumerate(by_src)]
ECON = pd.DataFrame(eco)
changed("H12", "Ribbons 2.8M + 0.6M + 0.7M + 0.2M + 0.5M", "stored as shown (= SAR 4.8M)",
        "the ribbons add up to 4.8M while the total and the six components are 4.2M - needs a decision")
changed("H12", "Productivity 3.1% x SAR 52M = SAR 1.62M", "stored as 1.62M", "3.1% x 52M is 1.61M; 1.62M keeps the total at 4.20M")

# =====================================================================================
# 23. CURRENT SNAPSHOT with model explanations
# =====================================================================================
print("Explaining every person's risk (Shapley drivers) ...")
feat_now = cur_X.copy()
p_att = E.predict_proba(att_b, feat_now)


def compact(d):
    keep = lambda lst: [{k: it[k] for k in ("feature", "label", "value", "baseline_value", "impact_pts")} for it in lst]  # noqa: E731
    return json.dumps({"increasing": keep(d["increasing"]), "protective": keep(d["protective"])}, ensure_ascii=False, separators=(",", ":"))


bd, ad = [], []
for i in range(NP):
    row = feat_now.iloc[i]
    bd.append(compact(E.drivers(burn_b, row, top_k=4)))
    ad.append(compact(E.drivers(att_b, row, top_k=4)))
DEV = pd.Series([None] * NP, dtype=object)
DEV[P["tier"] == "Growth Needed"] = "90-day plan · mentor"
for n, v in {"Layla Haddad": "Path to Gold", "Omar Saeed": "Leadership track", "Bilal Omar": "Care-first plan",
             "Adel Nasser": "Mentoring 2", "Huda Nasser": "Check-in scheduled", "Khalid Mansour": "INT-0418 proposed"}.items():
    DEV[IDX[n]] = v
need_dev = T.DEV_PLANS_ACTIVE - int(DEV.notna().sum())
cand_dev = [i for i in range(NP) if DEV[i] is None]
cw = np.where(P["elevated"].to_numpy()[cand_dev], 4.0, 1.0) * np.where(P["score"].to_numpy()[cand_dev] >= 87, 2.0, 1.0)
for i in rng.choice(cand_dev, need_dev, replace=False, p=cw / cw.sum()):
    if P.at[i, "elevated"]:
        DEV[i] = "Care-first plan"
    elif P.at[i, "score"] >= 87 and P.at[i, "tier"] == "Silver":
        DEV[i] = "Path to Gold"
    elif P.at[i, "position"] != "member" or P.at[i, "is_line_manager"]:
        DEV[i] = "Leadership track"
    else:
        DEV[i] = str(rng.choice(["Skills plan", "Mentoring", "Stretch project"]))
CUR = pd.DataFrame({"employee_id": emp_id, "as_of": T.AS_OF})
for c in E.BURNOUT_FEATURES + ["income_ratio", "years_since_promotion", "monthly_income_sar"]:
    CUR[c] = feat_now[c].to_numpy()
CUR["burnout_risk_pct"] = P["risk"].to_numpy()
CUR["burnout_change_6w"] = R_model[:, NOW] - R_model[:, W6]
CUR["attrition_risk_pct"] = half_up(p_att * 100)
CUR["burnout_drivers"] = bd
CUR["attrition_drivers"] = ad
for c in T.CRITERIA6:
    CUR[c] = P[c].to_numpy()
CUR["job_burnout"] = 100 - P["risk"].to_numpy()
CUR["empulse_score_exact"] = P["score_exact"].round(2).to_numpy()
CUR["empulse_score"] = P["score"].to_numpy()
CUR["tier"] = P["tier"].to_numpy()
CUR["last_recognized_at"] = P["last_recognized_at"].to_numpy()
CUR["development_plan"] = DEV.to_numpy()
CUR = CUR.sort_values("employee_id").reset_index(drop=True)

EMP = pd.DataFrame({
    "id": emp_id, "employee_code": [f"HZ{e:04d}" for e in emp_id], "full_name": P["name"],
    "first_name": [n.split(" ", 1)[0] for n in P["name"]], "last_name": [n.split(" ", 1)[1] for n in P["name"]],
    "email": P["email"], "gender": P["gender"], "age": P["age"], "job_title": P["title"], "job_level": P["level"],
    "department_id": P["dept"].map(DEPT_ID), "team_id": P["team"].map(TEAM_ID).astype("Int64"),
    "position": P["position"], "is_line_manager": P["is_line_manager"].astype(int),
    "manager_id": pd.array(P["manager_id"], dtype="Int64"), "app_role": P["app_role"],
    "hire_date": P["hire_date"], "tenure_years": P["tenure"], "work_mode": P["work_mode"],
    "work_location": rng.choice(["Riyadh", "Jeddah", "Dammam", "Madinah"], NP, p=[0.5, 0.25, 0.17, 0.08]),
    "monthly_income_sar": feat_now["monthly_income_sar"].astype(int).to_numpy(),
    "is_demo_person": P["named"].astype(int)}).sort_values("id").reset_index(drop=True)

WEEKLY = pd.DataFrame({
    "employee_id": emp_id[WEEKLY_X["employee_row"]], "week_start": [WEEKS[w].date().isoformat() for w in WEEKLY_X["week"]],
    "workload_index": WEEKLY_X["workload_index"], "overtime_hours_monthly": WEEKLY_X["overtime_hours_monthly"],
    "work_life_balance": WEEKLY_X["work_life_balance"], "job_satisfaction": WEEKLY_X["job_satisfaction"],
    "mood_score": WEEKLY_X["mood_score"], "engagement_score": WEEKLY_X["engagement_score"].astype(int),
    "burnout_risk_pct": WEEKLY_X["burnout_risk_pct"].astype(int)}).sort_values(["employee_id", "week_start"]).reset_index(drop=True)

mrows = []
for m, per in enumerate(MONTHS):
    for i in range(NP):
        mrows.append([int(emp_id[i]), per.to_timestamp().date().isoformat(), *CRIT_M[i, m].tolist(), int(risk_m[i, m]),
                      100 - int(risk_m[i, m]), int(eng_m[i, m]), round(S_exact[i, m] / 100, 2), int(S_m[i, m]), tier_of(int(S_m[i, m]))])
MONTHLY = pd.DataFrame(mrows, columns=["employee_id", "month", *T.CRITERIA6, "burnout_risk_pct", "job_burnout", "engagement_score",
                                       "empulse_score_exact", "empulse_score", "tier"]).sort_values(["employee_id", "month"]).reset_index(drop=True)

# =====================================================================================
# 24. WRITE the tables
# =====================================================================================
OUT.mkdir(parents=True, exist_ok=True)
for old_file in OUT.glob("*.csv"):
    old_file.unlink()
TABLES = {
    "departments": pd.DataFrame(dept_rows), "teams": pd.DataFrame(team_rows), "employees": EMP,
    "employee_current": CUR, "weekly_metrics": WEEKLY, "monthly_scores": MONTHLY, "checkins": CHECKINS,
    "interventions": IV, "ideas": IDEAS, "idea_members": IDEA_MEMBERS, "recognitions": RECOG,
    "innovation_dna": DNA.sort_values("employee_id"), "skills": SKILLS, "economic_items": ECON,
}
for name, df in TABLES.items():
    df.to_csv(OUT / f"{name}.csv", index=False)
    print(f"  {name:18s} {len(df):>7,d} rows")

# =====================================================================================
# 25. CHECK every design number against the written tables
# =====================================================================================
checks = []


def check(screen, what, design, got, allowed=None):
    """PASS = equals the design. CHANGED = equals the value we had to use (see 'Design numbers changed')."""
    ok = design == got
    status = "PASS" if ok else ("CHANGED" if allowed is not None and got == allowed else "FAIL")
    checks.append((screen, what, design, got, status))


emp = EMP.merge(CUR, left_on="id", right_on="employee_id")
emp["dept"] = emp["department_id"].map({v: k for k, v in DEPT_ID.items()})
emp["team"] = emp["team_id"].map({v: k for k, v in TEAM_ID.items()})
mem_ = emp["position"] == "member"
pct = lambda a, b: int(half_up(100 * a / b))  # noqa: E731
r0 = lambda x: int(half_up(x))  # noqa: E731
check("H01/H03", "people", 1240, len(emp))
check("H01", "departments / teams", (6, 31), (len(dept_rows), len(team_rows)))
for d, (hc, teams) in T.DEPARTMENTS.items():
    check("H01/H04", f"{d} headcount", hc, int((emp["dept"] == d).sum()))
    check("H04/H06", f"{d} burnout now", T.DEPT_RISK[d], r0(emp.loc[emp["dept"] == d, "burnout_risk_pct"].mean()))
    check("H01/M03", f"{d} engagement", T.DEPT_ENGAGEMENT[d], r0(emp.loc[emp["dept"] == d, "engagement_score"].mean()))
    for t, n, _ in teams:
        check("H04/H07", f"{t} people", n, int(((emp["team"] == t) & mem_).sum()))
for t, v in T.TEAM_RISK.items():
    check("H04/H06", f"{t} burnout", v, r0(emp.loc[(emp["team"] == t) & mem_, "burnout_risk_pct"].mean()))
for t, v in T.TEAM_ENGAGEMENT.items():
    check("H07/M01", f"{t} engagement", v, r0(emp.loc[(emp["team"] == t) & mem_, "engagement_score"].mean()))
for t, v in T.TEAM_SCORE.items():
    check("H04", f"{t} EMPULSE", v, r0(emp.loc[(emp["team"] == t) & mem_, "empulse_score"].mean()))
check("H01", "organisation EMPULSE", T.ORG_SCORE, r0(emp["empulse_score"].mean()))
check("H01", "organisation engagement", T.ORG_ENGAGEMENT, r0(emp["engagement_score"].mean()))
check("H01/H06", "elevated burnout risk now", T.ELEVATED_NOW, int((emp["burnout_risk_pct"] >= 60).sum()))
check("H06", "share of workforce", "3.1%", f"{100 * (emp['burnout_risk_pct'] >= 60).mean():.1f}%")
hot = emp["team"].isin(["Platform Reliability", "IT Services", "CS · Enterprise"]) & (emp["burnout_risk_pct"] >= 60)
check("H06", "hotspots share of elevated", 42, pct(hot.sum(), 38))
wk_ = WEEKLY.merge(EMP[["id", "department_id"]], left_on="employee_id", right_on="id")
wk_["dept"] = wk_["department_id"].map({v: k for k, v in DEPT_ID.items()})
me_dates = [WEEKS[w].date().isoformat() for w in MONTH_END]
check("H01", "elevated per month Oct-Sep", T.ELEVATED_MONTHLY,
      [int((wk_.loc[wk_["week_start"] == d, "burnout_risk_pct"] >= 60).sum()) for d in me_dates])
heat_dates = [WEEKS[w].date().isoformat() for w in HEAT_WEEKS]
for d in T.DEPARTMENTS:
    got_h = wk_[wk_["dept"] == d].groupby("week_start")["burnout_risk_pct"].mean()
    check("H06", f"heat map {d} W27-W38", T.HEATMAP[d], [r0(got_h[x]) for x in heat_dates])
tiers_now = emp["tier"].value_counts().to_dict()
check("H02b/H01", "tiers now", T.TIER_COUNTS, {t: int(tiers_now.get(t, 0)) for t in T.TIER_COUNTS})
for d, q in T.DEPT_TIERS.items():
    vc = emp.loc[emp["dept"] == d, "tier"].value_counts().to_dict()
    check("H02b", f"{d} tiers", q, {t: int(vc.get(t, 0)) for t in q})
jun = MONTHLY[MONTHLY["month"] == "2026-06-01"].set_index("employee_id")["tier"]
sep = MONTHLY[MONTHLY["month"] == "2026-09-01"].set_index("employee_id")["tier"]
check("H02b", "tiers Q2", T.TIER_COUNTS_Q2, {t: int((jun == t).sum()) for t in T.TIER_COUNTS_Q2})
rank = {t: k for k, t in enumerate(reversed(TIER_NAMES))}
mv = sep.map(rank) - jun.map(rank)
check("H02b", "moved up / down / Bronze->Silver", (T.MOVED_UP, T.MOVED_DOWN, T.BRONZE_TO_SILVER),
      (int((mv > 0).sum()), int((mv < 0).sum()), int(((jun == "Bronze") & (sep == "Silver")).sum())))
check("H03", "development plans active", T.DEV_PLANS_ACTIVE, int(emp["development_plan"].notna().sum()))
check("H03", "Growth tier all with a plan", 74, int((emp["development_plan"].notna() & (emp["tier"] == "Growth Needed")).sum()))
# named people
by_name = emp.set_index("full_name")
for p in T.NAMED:
    row = by_name.loc[p["name"]]
    if "risk" in p:
        check("named", f"{p['name']} burnout risk", p["risk"], int(row["burnout_risk_pct"]))
    if "score" in p:
        check("named", f"{p['name']} EMPULSE", p.get("design_score", p["score"]), int(row["empulse_score"]), allowed=p["score"])
    if "engagement" in p:
        check("named", f"{p['name']} engagement", p["engagement"], int(row["engagement_score"]))
    if "task" in p:
        check("named", f"{p['name']} task completion", p["task"], int(row["task_completion"]))
    if "criteria" in p:
        check("named", f"{p['name']} criteria", p["criteria"], {k: int(row[k]) for k in p["criteria"]})
check("E01-E03", "Layla EMPULSE (new formula)", 84, int(by_name.loc["Layla Haddad", "empulse_score"]))
check("M04b", "Khalid EMPULSE (new formula)", 82, int(by_name.loc["Khalid Mansour", "empulse_score"]))
yas = EID("Yasmin Hadi")
team9 = emp[emp["manager_id"] == yas]
check("M01", "Yasmin direct reports", 9, len(team9))
check("M01", "Yasmin team high-risk (badge 3)", 3, int((team9["burnout_risk_pct"] >= 60).sum()))
check("M01/H04", "Platform Reliability burnout", 51, r0(team9["burnout_risk_pct"].mean()))
check("M01", "Platform Reliability engagement", 64, r0(team9["engagement_score"].mean()))
check("M06", "Khalid 6 weeks ago", 46, int(WEEKLY.loc[(WEEKLY["employee_id"] == EID("Khalid Mansour")) & (WEEKLY["week_start"] == WEEKS[W6].date().isoformat()), "burnout_risk_pct"].iloc[0]))
for n, pts in T.STORIES.items():
    wl_ = WEEKLY[WEEKLY["employee_id"] == EID(n)].set_index("week_start")["burnout_risk_pct"]
    check("story", f"{n} risk path", [v for _, v in pts], [int(wl_[WEEKS[week_of(d)].date().isoformat()]) for d, _ in pts])
pr_w = WEEKLY[WEEKLY["employee_id"].isin(team9["id"])].groupby("week_start")[["burnout_risk_pct", "engagement_score"]].mean()
check("H05", "PR risk 30 Mar -> now", T.PR_RISK_26W, (r0(pr_w.loc["2026-03-30", "burnout_risk_pct"]), r0(pr_w.loc[WEEKS[NOW].date().isoformat(), "burnout_risk_pct"])))
check("H05", "PR engagement 30 Mar -> now", T.PR_ENGAGEMENT_26W, (r0(pr_w.loc["2026-03-30", "engagement_score"]), r0(pr_w.loc[WEEKS[NOW].date().isoformat(), "engagement_score"])))
jun_w = WEEKS[MONTH_END[q2]].date().isoformat()
check("H01", "org engagement end of Q2", T.ORG_ENGAGEMENT_Q2, r0(WEEKLY.loc[WEEKLY["week_start"] == jun_w, "engagement_score"].mean()))
# recognition
rc = RECOG.copy()
rc["days"] = (AS_OF - pd.to_datetime(rc["created_at"])).dt.days
got60 = rc[rc["days"] <= 60].groupby("receiver_id").size()
emp["rec60_t"] = emp["id"].isin(got60.index)
check("H09/H01", "recognition rate (60 days)", T.RECOG_RATE_ORG, pct(emp["rec60_t"].sum(), NP))
for d, v in T.RECOG_RATE_60D.items():
    check("H09", f"recognition rate {d}", v, pct(emp.loc[emp["dept"] == d, "rec60_t"].sum(), (emp["dept"] == d).sum()),
          allowed=73 if d == "Operations" else None)
q2win = rc[(rc["created_at"] >= "2026-05-02") & (rc["created_at"] <= "2026-06-30")]
check("H09", "recognition rate Q2", T.RECOG_RATE_Q2, pct(q2win["receiver_id"].nunique(), NP))
never_ = NP - rc[rc["days"] <= 365]["receiver_id"].nunique()
check("H09", "never recognized (12 months)", T.NEVER_RECOGNIZED_12M, never_)
q3a = rc[(rc["kind"] == "award") & (rc["created_at"] >= "2026-07-01")]
check("H09/E08", "awards Q3 by category", T.AWARDS_Q3, {c: int((q3a["category"] == c).sum()) for c in T.AWARDS_Q3})
check("H09", "award givers Q3", T.AWARD_GIVERS_Q3, int(q3a["giver_id"].dropna().nunique()))
check("H09", "awards linked to outcomes", T.AWARDS_LINKED_PCT, pct(q3a["linked_outcome"].notna().sum(), len(q3a)))
rr = ratios(emp.set_index("id").loc[emp_id, "rec60_t"].to_numpy())     # back in planning row order
check("H09", "equity ratios", T.EQUITY, {k: round(v, 2) for k, v in rr.items()})
for n, dd in T.PR_LAST_RECOGNIZED.items():
    last = rc.loc[rc["receiver_id"] == EID(n), "days"].min()
    check("M08/E08", f"{n} days since recognized", dd, int(last))
check("E01", "Layla recognitions this quarter", 3, int(((rc["receiver_id"] == EID("Layla Haddad")) & (rc["created_at"] >= "2026-07-01")).sum()))
pr_sep = rc[rc["receiver_id"].isin(team9["id"]) & (rc["created_at"] >= "2026-09-01")]
check("M08", "Platform Reliability recognitions this month", 5, len(pr_sep))
# interventions
iv26 = IV[IV["detected_at"] >= "2026-01-01"]
check("H01/H12", "interventions 2026", T.INTERVENTIONS_2026, len(iv26))
check("H12", "types", T.INTERVENTION_TYPES, {t: int((iv26["type"] == t).sum()) for t in T.INTERVENTION_TYPES})
check("H10", "detected / proposed / active / measured", T.INTERVENTION_STATUS,
      {s: int((iv26["status"] == s).sum()) for s in T.INTERVENTION_STATUS})
act_ = iv26[iv26["status"] == "active"]
check("H10/H01", "active on track", T.ACTIVE_ON_TRACK_PCT, pct(act_["on_track"].sum(), len(act_)))
check("H10/H01", "follow-up due this week", T.FOLLOWUP_DUE_THIS_WEEK,
      int(((act_["followup_at"] >= T.AS_OF) & (act_["followup_at"] <= "2026-09-27")).sum()))
meas = iv26[iv26["status"] == "measured"]
check("H10/H01", "measured improved", T.MEASURED_IMPROVED_PCT, pct((meas["outcome"] == "improved").sum(), len(meas)))
check("H12/H01", "people improved", T.PEOPLE_IMPROVED_PCT, pct(iv26["improved"].sum(), len(iv26)))
wl_m = meas[(meas["type"] == "Workload rebalance") & meas["employee_id"].notna()]
check("H10", "workload playbook (15+ points)", (19, 23),
      (int((wl_m["baseline_risk_pct"] - wl_m["followup_risk_pct"] >= 15).sum()), len(wl_m)))
rc_m = meas[meas["type"] == "Recognition program"]
check("H10", "recognition-only playbook", (9, 17), (int((rc_m["outcome"] == "improved").sum()), len(rc_m)))
ivc = IV.set_index("code")
check("H10", "INT-0392 Layla 68 -> 45", (68, 45), (int(ivc.loc["INT-0392", "baseline_risk_pct"]), int(ivc.loc["INT-0392", "followup_risk_pct"])))
check("H10", "INT-0418 Khalid proposed", "proposed", ivc.loc["INT-0418", "status"])
check("H10", "INT-0371 Noura 72 -> 49", (72, 49), (int(ivc.loc["INT-0371", "baseline_risk_pct"]), int(ivc.loc["INT-0371", "followup_risk_pct"])))
check("rule", "every started intervention is human-approved by a person",
      True, bool((IV.loc[IV["started_at"].notna(), "human_approved"] == 1).all()
                 and IV.loc[IV["started_at"].notna(), "approved_by_id"].notna().all()))
# ideas
i26 = IDEAS[IDEAS["code"].str.match(r"IDEA-\d{3}$") & IDEAS["submitted_at"].notna()]
check("H08", "ideas this year", T.IDEAS_2026, len(i26))
check("H08", "ideas last year", T.IDEAS_2025, int(IDEAS["code"].str.startswith("IDEA-25-").sum()))
inq3 = lambda col: int(((IDEAS[col] >= "2026-07-01") & (IDEAS[col] <= T.AS_OF)).sum())  # noqa: E731
check("H08/E06", "Q3 funnel", T.IDEAS_Q3, dict(submitted=inq3("submitted_at"), reviewed=inq3("reviewed_at"),
                                               approved=int(((IDEAS["decided_at"] >= "2026-07-01") & IDEAS["status"].isin(["approved", "in_build", "implemented"])).sum()),
                                               in_build=int((IDEAS["status"] == "in_build").sum()),
                                               implemented=inq3("implemented_at"), verified=inq3("verified_at")))
imp = IDEAS[(IDEAS["implemented_at"] >= "2026-01-01")]
check("H08/E06", "verified savings this year", T.IDEAS_IMPLEMENTED_VALUE, int(imp["realized_savings_sar"].sum()))
tti = (pd.to_datetime(imp["implemented_at"]) - pd.to_datetime(imp["submitted_at"])).dt.days / 7
check("H08", "time to impact (median weeks)", 19, r0(tti.median()))
bld = IDEA_MEMBERS[IDEA_MEMBERS["idea_id"].isin(IDEAS.loc[IDEAS["status"] == "in_build", "id"])]
check("E06", "contributors in build", 38, int(bld["employee_id"].nunique()))
m26 = IDEA_MEMBERS[IDEA_MEMBERS["idea_id"].isin(IDEAS.loc[IDEAS["code"].str.match(r"IDEA-\d{3}$"), "id"])]
emp["ideas26"] = emp["id"].isin(m26["employee_id"])
check("H01/H08", "participation org", 39, pct(emp["ideas26"].sum(), NP))
for d, v in T.PARTICIPATION.items():
    check("H08", f"participation {d}", v, pct(emp.loc[emp["dept"] == d, "ideas26"].sum(), (emp["dept"] == d).sum()),
          allowed=38 if d == "People" else None)
for t, k in T.TEAM_PARTICIPATION.items():
    check("H07/M01", f"{t} people in ideas", k, int(emp.loc[(emp["team"] == t) & mem_, "ideas26"].sum()))
check("E04", "Layla ideas", ["IDEA-084", "IDEA-102", "IDEA-121"],
      sorted(IDEAS.loc[IDEAS["owner_id"] == EID("Layla Haddad"), "code"].tolist()))
check("H08", "DNA organisation medians", T.DNA_ORG_MEDIAN, [int(np.median(DNA[c])) for c in T.DNA_TRAITS])
check("E04", "Layla DNA", T.DNA_LAYLA, DNA.set_index("employee_id").loc[EID("Layla Haddad"), T.DNA_TRAITS].astype(int).tolist())
# economics
check("H12", "expected impact", 4_200_000, int(ECON.loc[ECON["section"] == "component", "value_sar"].sum()))
# score formula and rules
crit_cols = T.CRITERIA6
calc = (emp[crit_cols].to_numpy() @ W + 15 * (100 - emp["burnout_risk_pct"].to_numpy()))
check("rule", "score = criteria x weights (all 1,240)", True, bool((half_up(calc / 100) == emp["empulse_score"]).all()))
mcalc = MONTHLY[crit_cols].to_numpy() @ W + 15 * MONTHLY["job_burnout"].to_numpy()
check("rule", "monthly scores use the same formula", True, bool((half_up(mcalc / 100) == MONTHLY["empulse_score"]).all()))
check("rule", "every line manager has >= 5 direct reports", True,
      bool(emp[emp["is_line_manager"] == 1]["id"].map(emp.groupby("manager_id").size()).min() >= 5))
pr = E.predict_proba(burn_b, WEEKLY.merge(CUR[["employee_id", "absence_days_annual", "recognition_90d", "tenure_years", "job_level",
                                               "training_times_last_year"]], on="employee_id"))
check("rule", "weekly risks come from the model (re-scored)", True,
      bool((np.abs(pr * 100 - WEEKLY["burnout_risk_pct"].to_numpy()) <= 1.0).mean() > 0.97))

check("H02b", "Gold + Silver share Q4 2025 -> Q3 2026", (59, 65),
      (pct(MONTHLY.loc[MONTHLY["month"] == "2025-12-01", "tier"].isin(["Gold", "Silver"]).sum(), NP),
       pct(MONTHLY.loc[MONTHLY["month"] == "2026-09-01", "tier"].isin(["Gold", "Silver"]).sum(), NP)))

# ---- design conflicts and consequences of the supervisor's decisions (values come from the data) ----
el_t = emp.loc[emp["burnout_risk_pct"] >= 60, "tier"].value_counts()
changed("H01/H02b/H06", "38 elevated: 9 Gold, 17 Silver, 9 Bronze, 3 Growth",
        f"0 Gold, {el_t.get('Silver', 0)} Silver, {el_t.get('Bronze', 0)} Bronze, {el_t.get('Growth Needed', 0)} Growth",
        "Job Burnout (15%) = 100 - risk: with risk 60+ a Gold score needs every other criterion near 99 (decision Q1)")
changed("M01/M04/M04b/H03/H05", "Khalid Mansour GOLD 91", "SILVER 82 (82.05)", "supervisor formula, decision Q1")
changed("M04b", "Khalid highest recorded score 93", f"{int(MONTHLY.loc[MONTHLY['employee_id'] == EID('Khalid Mansour'), 'empulse_score'].max())}",
        "his history is recomputed with the new formula")
changed("E01-E03/H03", "Layla Haddad SILVER 87", "SILVER 84 (83.75)", "supervisor formula, decision Q1")
tm9 = emp[emp["manager_id"] == yas]
vc9 = tm9["tier"].value_counts()
changed("M02", "Platform Reliability tier mix 2 Gold / 5 Silver / 2 Bronze",
        f"{vc9.get('Gold', 0)} Gold / {vc9.get('Silver', 0)} Silver / {vc9.get('Bronze', 0)} Bronze", "Khalid is Silver now")
changed("M01/M02/H04", "Platform Reliability team EMPULSE 85", f"{tm9['empulse_score'].mean():.1f} -> {r0(tm9['empulse_score'].mean())}",
        "average of the 9 member scores shown in M04 (with Khalid 82, Maha 91)")
crit_avg = {c: r0(tm9[c].mean()) for c in T.CRITERIA6}
changed("M02/M03", "Platform Reliability averages: task 88, attendance 95, professional 94, teamwork 90, innovation 78, technology 91",
        ", ".join(f"{c} {v}" for c, v in crit_avg.items()),
        "task completion is the average of the 9 PERFORMANCE values in M04 (84.3); the others follow from each member's score")
pr_trend = MONTHLY[MONTHLY["employee_id"].isin(tm9["id"]) & (MONTHLY["month"] >= "2026-04-01")].groupby("month")["empulse_score"].mean()
changed("M02", "Team score trend Apr-Sep 86 86 87 86 86 85", " ".join(str(r0(v)) for v in pr_trend), "recomputed with the new formula")
lay_tr = MONTHLY[(MONTHLY["employee_id"] == EID("Layla Haddad")) & (MONTHLY["month"] >= "2026-03-01")]["empulse_score"]
changed("E02", "Layla score journey Mar-Sep 80 80 81 81 83 85 87", " ".join(map(str, lay_tr)),
        "Job Burnout drops her June score (risk 68) - the recovery after INT-0392 now shows in the score")
changed("H04", "IT Services 110 people", "104 members + team lead",
        "the five Technology teams in H04 already add up to 212; team leads and the VP are counted in the department, "
        "and a team's people = its members without the lead (Platform Reliability 9 = Yasmin's 9 reports)")
changed("H04", "App Engineering burnout 44, Security 36", "49 and 42",
        "with the H04 team values Technology can only average 47; 49 is shown on H01, H04, H06 and H12, so we kept 49")
changed("H04/H07", "Data Platform burnout 38 (H04) / 41 (H07)", "41", "the two screens disagree; 41 keeps Technology at 49")
changed("H03", "Customer Insights department", "Operations",
        "H03 shows Layla, Aya, Bilal, Hassan and Omar in Operations · Customer Insights")
tier_avg = emp.groupby("tier")["empulse_score"].mean()
changed("H02b", "tier labels 90 / 85 / 75 / 64 (average score per tier)",
        " / ".join(f"{tier_avg[t]:.1f}" for t in TIER_NAMES),
        "with these averages the organisation score would be 81.8, not 83 (H01, H04); we kept 83")
changed("E08/H09", "Team Supporter 28 (E08) / 29 (H09)", "29", "29 makes the six categories add up to 171")
changed("M08", "41% of the team not recognized in 60 days", "22% (2 of 9)",
        "the per-person list on the same screen has only Khalid (71) and Sami (64) above 60 days")
changed("H07", "team RECOGNITION column 78 / 71 / 73 / 62 / 44 / 55", "not stored",
        "as 60-day rates most are impossible with 11/12/14/19/9 people; the meaning of this column must be decided in H07")
changed("H09", "recognition rate 64% (60 days) and 171 recognitions in Q3", "awards + simple thanks (kudos)",
        "171 awards cannot reach 64% of 1,240 people in 60 days; the rate counts awards and kudos, the categories count awards only")
changed("H10", "Detected 9, proposed 6, active 27, measured 58 (= 100) of 212", "plus 100 completed, 7 declined, 5 cancelled",
        "the design does not say what the other 112 are")
changed("H10/H12", "71% improved (H12) vs 74% improved (H10)", "both kept",
        "71% = 151 of all 212 have risk 5+ points lower than at detection; 74% = 43 of the 58 formally measured")
changed("E06", "In build 4 (filter) vs 6 (header and H08)", "6", "two numbers on the same screen; the funnel needs 6")
meas_imp = IV[(IV["outcome"] == "improved") & IV["employee_id"].notna()]
check("H06", "intervention success: average risk drop (pts)", 15, r0((meas_imp["baseline_risk_pct"] - meas_imp["followup_risk_pct"]).mean()))
changed("all", "today's date", "21 Sep 2026", "M06 'Today 21 Sep', E01 'Thu 24 Sep', heat map ends at week 38")

n_fail = sum(1 for c in checks if c[4] == "FAIL")
n_chg = sum(1 for c in checks if c[4] == "CHANGED")
print(f"Checks: {len(checks) - n_fail - n_chg} PASS, {n_chg} CHANGED (explained), {n_fail} FAIL")
for c in checks:
    if c[4] == "FAIL":
        print("  FAIL", c[0], c[1], "design", c[2], "data", c[3])

# =====================================================================================
# 26. REPORT
# =====================================================================================
lines = ["# Generated data: design check", "",
         f"As of {T.AS_OF} (latest week {T.LAST_WEEK}, 52 weeks). All data is synthetic. Seed {SEED}.", "",
         "## Tables", ""]
lines += [f"- `{n}`: {len(df):,} rows" for n, df in TABLES.items()]
lines += ["", "## Design numbers changed (cannot be kept exactly)", "", "| Screen | Design | Data | Why |", "|---|---|---|---|"]
lines += [f"| {a} | {b} | {c} | {d} |" for a, b, c, d in CHANGES]
lines += ["", "## Checks", "", "| Screen | What | Design | Data | Result |", "|---|---|---|---|---|"]
lines += [f"| {a} | {b} | {c} | {d} | {e} |" for a, b, c, d, e in checks]
lay_m = MONTHLY[MONTHLY["employee_id"] == EID("Layla Haddad")][["month", "empulse_score", "burnout_risk_pct"]]
kh_m = MONTHLY[MONTHLY["employee_id"] == EID("Khalid Mansour")][["month", "empulse_score", "burnout_risk_pct"]]
tm = MONTHLY.merge(EMP[["id", "team_id"]], left_on="employee_id", right_on="id")
pr_m = tm[tm["employee_id"].isin(team9["id"])].groupby("month")["empulse_score"].mean().round(1)
q_share = {m_: round(100 * MONTHLY.loc[MONTHLY["month"] == m_, "tier"].isin(["Gold", "Silver"]).mean(), 1)
           for m_ in ["2025-12-01", "2026-03-01", "2026-06-01", "2026-09-01"]}
lines += ["", "## Score histories with the new formula (for the screens that show history)", "",
          "Layla (E02 'score journey'): " + ", ".join(f"{r.month[:7]} {r.empulse_score} (risk {r.burnout_risk_pct})" for r in lay_m.itertuples()),
          "", "Khalid: " + ", ".join(f"{r.month[:7]} {r.empulse_score} (risk {r.burnout_risk_pct})" for r in kh_m.itertuples()),
          "", "Platform Reliability average (M02 trend): " + ", ".join(f"{k[:7]} {v}" for k, v in pr_m.items()),
          "", f"Gold + Silver share by quarter end (H02b layers): {q_share}"]
REPORT.write_text("\n".join(lines), encoding="utf-8")
print("Report:", REPORT)
