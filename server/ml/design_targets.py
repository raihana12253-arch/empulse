"""Every number from the Figma design that the generated data must match.

One place, so a student can check each number against the design image.
The screen where each number appears is written next to it.
02_build_dataset.py reads this file and checks every target at the end
(ml/reports/data_summary.md lists PASS / CHANGED / NOT POSSIBLE for each one).
"""

# ------------------------------------------------------------------ dates
# The design's "today" is Monday 21 Sep 2026 (M06 "Today 21 Sep", E01 "Thu 24 Sep").
# The last full week in the data is ISO week 38 (14-20 Sep), the last column of the H06 heat map.
AS_OF = "2026-09-21"
LAST_WEEK = "2026-09-14"
N_WEEKS = 52

# ------------------------------------------------------------------ the seven criteria (server/config.php)
# weights in percent; job_burnout = 100 - burnout risk %
WEIGHTS = {
    "attendance_discipline": 10,
    "task_completion": 25,
    "innovation_creativity": 15,
    "teamwork": 15,
    "professional_behavior": 10,
    "technology_adoption": 10,
    "job_burnout": 15,
}
CRITERIA6 = ["attendance_discipline", "task_completion", "innovation_creativity",
             "teamwork", "professional_behavior", "technology_adoption"]
TIERS = [("Gold", 90), ("Silver", 80), ("Bronze", 70), ("Growth Needed", 0)]
HIGH_RISK = 60          # "elevated burnout risk" = risk >= 60

# ------------------------------------------------------------------ organisation (H01, H02, H04, H07)
# department: (headcount, [(team, members, lead)])
# Team "members" do NOT include the team lead: Platform Reliability = 9 people = Yasmin's 9 reports.
DEPARTMENTS = {
    "Technology": (212, [("Platform Reliability", 9, "Yasmin Hadi"), ("Data Platform", 14, None),
                         ("App Engineering", 58, None), ("Security", 21, None), ("IT Services", 104, None)]),
    "Operations": (318, [("Customer Insights", 11, "Omar Saeed"), ("Field Operations", 40, None),
                         ("Analytics Platform", 18, "Nadia Karim"), ("Supply Chain", 62, None),
                         ("Logistics Planning", 60, None), ("Procurement", 60, None), ("Facilities & Safety", 59, None)]),
    "Customer Success": (264, [("CS · Enterprise", 19, None), ("SMB Success", 48, None), ("Onboarding", 48, None),
                               ("Support Desk", 48, None), ("Renewals", 47, None), ("Customer Care", 47, None)]),
    "Finance": (118, [("Finance Ops", 12, "Adel Nasser"), ("Accounting", 51, None), ("Treasury & Risk", 51, None)]),
    "People": (64, [("HRBP", 12, None), ("Talent Acquisition", 16, None), ("Learning & Development", 15, None),
                    ("Employee Experience", 16, None)]),
    "Sales": (264, [("Enterprise Sales", 43, None), ("SMB Sales", 43, None), ("Partnerships", 43, None),
                    ("Sales Operations", 43, None), ("Digital Channels", 43, None), ("Brand & Content", 42, None)]),
}
DEPT_HEAD = {"People": "Rana Aziz"}       # other department heads get generated names

# ------------------------------------------------------------------ burnout risk now (H01, H04, H06)
DEPT_RISK = {"Technology": 49, "Operations": 31, "Customer Success": 44, "Finance": 28, "People": 24, "Sales": 38}
# Team averages. H04 says App Engineering 44 and Security 36, but with them the Technology average
# can only be 47, not 49 (shown on H01/H04/H06/H12). We keep 49 and move these two (see report).
TEAM_RISK = {"Platform Reliability": 51, "IT Services": 52, "Data Platform": 41, "App Engineering": 49,
             "Security": 42, "CS · Enterprise": 46, "Customer Insights": 33, "Finance Ops": 29,
             "Field Operations": 30}
ELEVATED_NOW = 38
# where the 38 elevated people are (hotspots PR + IT Services + CS · Enterprise = 16 = 42%, H06)
ELEVATED_BY_TEAM = {"Platform Reliability": 3, "IT Services": 8, "CS · Enterprise": 5, "App Engineering": 3,
                    "Data Platform": 1, "Customer Insights": 2}
ELEVATED_BY_DEPT_REST = {"Customer Success": 6, "Sales": 6, "Operations": 3, "Finance": 1}
# H01 "people at elevated burnout risk", month by month (Oct 2025 ... Sep 2026)
ELEVATED_MONTHLY = [44, 42, 45, 43, 41, 47, 50, 55, 58, 61, 46, 38]
# H06 heat map: department average risk, ISO weeks 27..38 of 2026
HEATMAP = {
    "Technology":       [38, 39, 41, 44, 47, 50, 53, 55, 54, 51, 50, 49],
    "Customer Success": [40, 41, 41, 42, 44, 46, 47, 47, 46, 45, 44, 44],
    "Sales":            [34, 35, 36, 38, 40, 42, 42, 41, 40, 39, 38, 38],
    "Operations":       [30, 31, 33, 36, 39, 41, 40, 37, 34, 32, 31, 31],
    "Finance":          [26, 27, 28, 30, 31, 31, 30, 29, 28, 28, 28, 28],
    "People":           [22, 23, 23, 24, 25, 25, 25, 24, 24, 24, 24, 24],
}

# ------------------------------------------------------------------ engagement now (H01, M03, H07)
ORG_ENGAGEMENT = 75
DEPT_ENGAGEMENT = {"Technology": 71, "Operations": 79, "Customer Success": 71, "Finance": 77, "People": 84, "Sales": 74}
TEAM_ENGAGEMENT = {"Customer Insights": 82, "Finance Ops": 76, "Field Operations": 78, "Data Platform": 72,
                   "CS · Enterprise": 63, "Platform Reliability": 64}
ORG_ENGAGEMENT_Q2 = 71      # H01 "75, up 4 vs Q2"

# ------------------------------------------------------------------ tiers (H01, H02b, H03)
TIER_COUNTS = {"Gold": 223, "Silver": 583, "Bronze": 360, "Growth Needed": 74}
TIER_COUNTS_Q2 = {"Gold": 186, "Silver": 546, "Bronze": 397, "Growth Needed": 111}
MOVED_UP, MOVED_DOWN, BRONZE_TO_SILVER = 185, 37, 92
ORG_SCORE = 83
# tier counts per department, from the H02b percentages (rounded so the totals stay 223/583/360/74)
DEPT_TIERS = {
    "Technology":       {"Gold": 47, "Silver": 104, "Bronze": 52, "Growth Needed": 9},
    "Operations":       {"Gold": 54, "Silver": 150, "Bronze": 95, "Growth Needed": 19},
    "Customer Success": {"Gold": 29, "Silver": 108, "Bronze": 98, "Growth Needed": 29},
    "Finance":          {"Gold": 24, "Silver": 58, "Bronze": 29, "Growth Needed": 7},
    "People":           {"Gold": 12, "Silver": 32, "Bronze": 17, "Growth Needed": 3},
    "Sales":            {"Gold": 57, "Silver": 131, "Bronze": 69, "Growth Needed": 7},
}
TEAM_SCORE = {"Data Platform": 86, "App Engineering": 84, "Security": 87, "IT Services": 81}   # H04
DEV_PLANS_ACTIVE = 214      # H03, includes all 74 Growth Needed

# ------------------------------------------------------------------ named people
# score = EMPULSE Score with the supervisor's formula. Criteria not listed are generated
# so that the score rounds to the target.
NAMED = [
    # Platform Reliability (Yasmin's 9 direct reports, M04 / M04b / M06)
    dict(name="Khalid Mansour", g="M", team="Platform Reliability", title="Platform Engineer", level=3, tenure=6.3,
         risk=72, risk_6w=46, engagement=71,
         criteria=dict(task_completion=95, attendance_discipline=98, professional_behavior=90,
                       innovation_creativity=86, teamwork=88, technology_adoption=92)),
    dict(name="Tariq Zaki", g="M", team="Platform Reliability", title="Site Reliability Engineer", level=3,
         risk=66, risk_6w=52, engagement=55, score=78, task=79),
    dict(name="Huda Nasser", g="F", team="Platform Reliability", title="Site Reliability Engineer", level=3,
         risk=63, risk_6w=52, engagement=58, score=82, task=81),
    dict(name="Sami Youssef", g="M", team="Platform Reliability", title="Platform Engineer", level=2,
         risk=52, engagement=60, score=74, task=76),
    dict(name="Rami Khoury", g="M", team="Platform Reliability", title="DevOps Engineer", level=2,
         risk=47, engagement=63, score=84, task=83),
    dict(name="Dana Farouk", g="F", team="Platform Reliability", title="Platform Engineer", level=2,
         risk=44, engagement=64, score=86, task=85),
    dict(name="Noura Al-Saud", g="F", team="Platform Reliability", title="Site Reliability Engineer", level=2,
         risk=41, engagement=68, score=87, task=84),
    dict(name="Faisal Rahman", g="M", team="Platform Reliability", title="Platform Engineer", level=2,
         risk=38, engagement=66, score=88, task=86),
    dict(name="Maha Al-Otaibi", g="F", team="Platform Reliability", title="Staff Engineer", level=4,
         risk=35, engagement=71, score=91, design_score=93, task=90),   # design 93: impossible with task 90 and risk 35 (max 92.25)
    # team leads
    dict(name="Yasmin Hadi", g="F", team="Platform Reliability", lead=True, title="Engineering Manager", level=4,
         risk=30, email="yasmin@horizon.demo", app_role="manager"),
    dict(name="Omar Saeed", g="M", team="Customer Insights", lead=True, title="Insights Manager", level=4,
         risk=28, score=89, email="omar.saeed@horizon.demo", app_role="manager"),
    dict(name="Nadia Karim", g="F", team="Analytics Platform", lead=True, title="Head of Analytics Platform", level=4),
    dict(name="Adel Nasser", g="M", team="Finance Ops", lead=True, title="Finance Transformation Lead", level=4, score=90),
    # People department
    dict(name="Rana Aziz", g="F", dept="People", head=True, title="Chief People Officer", level=5,
         risk=20, email="rana@horizon.demo", app_role="hr"),
    dict(name="Lina Farhat", g="F", team="HRBP", title="HR Business Partner", level=3,
         risk=25, score=88, app_role="hr"),
    # Customer Insights (E01-E10, H03)
    dict(name="Layla Haddad", g="F", team="Customer Insights", title="Senior Data Analyst", level=3, tenure=4.2,
         risk=36, engagement=83, email="layla@horizon.demo",
         criteria=dict(task_completion=94, attendance_discipline=91, professional_behavior=89,
                       innovation_creativity=78, teamwork=81, technology_adoption=88)),
    dict(name="Aya Mourad", g="F", team="Customer Insights", title="Data Analyst", level=2, risk=30, score=85),
    dict(name="Bilal Omar", g="M", team="Customer Insights", title="Data Analyst", level=2, risk=62, score=72),
    dict(name="Hassan Ali", g="M", team="Customer Insights", title="Junior Data Analyst", level=1, risk=64, score=66),
    dict(name="Yousef Tamimi", g="M", team="Customer Insights", title="Data Analyst", level=2),
    dict(name="Reem Aziz", g="F", team="Customer Insights", title="Junior Data Analyst", level=1),
    dict(name="Sara Nabil", g="F", team="Customer Insights", title="Data Scientist", level=3),
    dict(name="Majed Harb", g="M", team="Customer Insights", title="Analytics Engineer", level=2),
    # others shown in the design
    dict(name="Dina Kassem", g="F", team="Finance Ops", title="Senior Accountant", level=3, score=86),
    dict(name="Salma Idris", g="F", team="Digital Channels", title="UX Designer", level=2),
    dict(name="Hadi Karam", g="M", team="Data Platform", title="ML Engineer", level=3),
]

# history stories (weekly risk at a given date)
STORIES = {
    # E03 / H10 INT-0392: 68 on 30 Jun -> 45 on 18 Aug -> 36 now
    "Layla Haddad": [("2026-03-30", 41), ("2026-06-01", 50), ("2026-06-29", 68), ("2026-07-06", 68),
                     ("2026-08-17", 45), ("2026-09-14", 36)],
    # M06: 46 six weeks ago -> 72 now
    "Khalid Mansour": [("2026-03-30", 31), ("2026-06-22", 38), ("2026-08-03", 46), ("2026-09-14", 72)],
    # H10 INT-0371: 72 -> 49 in April-May
    "Noura Al-Saud": [("2026-03-30", 66), ("2026-04-06", 72), ("2026-05-25", 49), ("2026-09-14", 41)],
}
PR_RISK_26W = (34, 51)          # H05: Platform Reliability average 34 (30 Mar) -> 51 now
PR_ENGAGEMENT_26W = (79, 64)    # H05

# ------------------------------------------------------------------ recognition (H09, E08, M08)
RECOG_RATE_60D = {"People": 81, "Operations": 74, "Finance": 70, "Sales": 66, "Technology": 58, "Customer Success": 52}
RECOG_RATE_ORG = 64
RECOG_RATE_Q2 = 57              # "+7 vs Q2"
NEVER_RECOGNIZED_12M = 96
AWARDS_Q3 = {"Performance Star": 38, "Innovation Champion": 24, "Collaboration Hero": 41,
             "Digital Pioneer": 17, "Team Supporter": 29, "Growth Champion": 22}     # = 171
AWARD_GIVERS_Q3 = 142
AWARDS_LINKED_PCT = 58
EQUITY = {"gender_f_m": 1.02, "remote_onsite": 0.86, "under30_30to45": 0.95, "lower_upper_tier": 0.71}
# days since last recognition on 21 Sep (M08)
PR_LAST_RECOGNIZED = {"Khalid Mansour": 71, "Sami Youssef": 64, "Noura Al-Saud": 9,   # M08 list says 44, same screen shows her award on 12 Sep
                      "Tariq Zaki": 38,
                      "Dana Farouk": 30, "Huda Nasser": 22, "Rami Khoury": 15, "Faisal Rahman": 12,
                      "Maha Al-Otaibi": 5, "Hassan Ali": 62}
# awards shown by name in the design: (receiver, category, giver, date, outcome)
SCRIPTED_AWARDS = [
    ("Layla Haddad", "Innovation Champion", "Innovation Council", "2026-09-02", "Report requests -38% · SAR 180K / yr"),
    ("Layla Haddad", "Collaboration Hero", "Omar Saeed", "2026-08-20", "Coached two new analysts on the churn model"),
    ("Yousef Tamimi", "Team Supporter", "Layla Haddad", "2026-08-24", "Enabled INT-0392 · Layla's burnout risk 68% -> 45%"),
    ("Noura Al-Saud", "Collaboration Hero", "Yasmin Hadi", "2026-09-12", "Pipeline migration with zero downtime · deploy time -41%"),
    ("Dina Kassem", "Digital Pioneer", "Adel Nasser", "2026-09-10", "Digital adoption 58 -> 71"),
    ("Reem Aziz", "Growth Champion", "Omar Saeed", "2026-09-08", "Growth path 3 of 4 milestones"),
    ("Maha Al-Otaibi", "Performance Star", "Yasmin Hadi", "2026-09-16", "Blameless incident review culture · repeat incidents -27%"),
    ("Faisal Rahman", "Team Supporter", "Noura Al-Saud", "2026-09-09", "Covered Tariq's on-call without being asked"),
]

# ------------------------------------------------------------------ innovation (H08, E04, E06)
IDEAS_2026 = 118                # submitted 1 Jan - 21 Sep 2026
IDEAS_2025 = 88                 # 118 = +34%
IDEAS_Q3 = dict(submitted=42, reviewed=42, approved=11, in_build=6, implemented=4, verified=4)
IDEAS_IMPLEMENTED_VALUE = 520_000
PARTICIPATION = {"Technology": 64, "Operations": 42, "People": 37, "Sales": 33, "Customer Success": 28, "Finance": 21}
TEAM_PARTICIPATION = {"Customer Insights": 6, "Finance Ops": 3, "Field Operations": 15, "Data Platform": 10,
                      "CS · Enterprise": 5, "Platform Reliability": 5}       # people, from H07 / M01
DNA_TRAITS = ["idea_generation", "problem_solving", "experimentation", "collaboration",
              "digital_innovation", "implementation", "business_impact"]
DNA_ORG_MEDIAN = [61, 64, 55, 68, 59, 60, 52]
DNA_LAYLA = [88, 91, 74, 79, 86, 58, 66]

# ------------------------------------------------------------------ interventions (H01, H10, H12)
INTERVENTIONS_2026 = 212
INTERVENTION_TYPES = {"Workload rebalance": 96, "Recognition program": 48, "Training & mentoring": 41,
                      "Task / team move": 27}
INTERVENTION_STATUS = {"detected": 9, "proposed": 6, "active": 27, "measured": 58}   # rest: completed / declined
ACTIVE_ON_TRACK_PCT = 81
FOLLOWUP_DUE_THIS_WEEK = 4
MEASURED_IMPROVED_PCT = 74
PEOPLE_IMPROVED_PCT = 71

# ------------------------------------------------------------------ economic impact FY2026 (H12)
ECONOMIC = [
    # key, label, value SAR, how it is calculated
    ("productivity", "Productivity gains", 1_620_000, "+3.1% output on treated teams x SAR 52M payroll"),
    ("turnover", "Turnover reduction", 960_000, "8 avoided regrettable exits x SAR 120K replacement cost"),
    ("burnout", "Burnout reduction", 540_000, "9 fewer burnout-related leaves x SAR 60K"),
    ("innovation", "Innovation savings", 520_000, "4 implemented ideas, savings verified by Finance"),
    ("absence", "Absenteeism reduction", 380_000, "-1.4 days x 212 people x SAR 1,280 / day"),
    ("training", "Training ROI", 180_000, "3.2x on SAR 56K of targeted training"),
]
ECONOMIC_COST = 900_000
ECONOMIC_RANGE = (3_400_000, 4_900_000)
ECONOMIC_REALIZED = 2_600_000
