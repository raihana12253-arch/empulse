# server/ml — models and demo data (Python 3.12)

Python is used ONLY here (machine learning). The web app is HTML/CSS/JS + PHP + MySQL.
This folder is closed to the browser (`server/.htaccess`).

| File | What it does |
|---|---|
| `requirements.txt` | exact library versions (the saved models need the same versions) |
| `empulse_ml.py` | load a model, predict risk, explain it (Shapley drivers), what-if simulation |
| `gen_core.py` | makes the synthetic training pool (6,000 snapshots) |
| `names.py` | invented names, job titles, skills, idea titles |
| `design_targets.py` | **every number from the design** the data must match (one place to check) |
| `00_analysis.py` | optional: charts of the raw datasets (needs matplotlib) |
| `01_train_models.py` | trains the burnout and attrition models → `models/*.pkl`, `reports/model_report.md` |
| `02_build_dataset.py` | builds the 1,240-person demo data so that it matches the design → `data/generated/*.csv`, `reports/data_summary.md` |
| `03_export_sql.py` | writes `server/data.sql` from the CSV files |
| `data/raw/` | IBM HR Attrition (real, public) and the EMPULSE 1,000-row sample (used by 00 and 01) |

## Run (Windows, inside `C:\xampp\htdocs\empulse`)
```
py -3.12 -m pip install -r server\ml\requirements.txt
py -3.12 server\ml\01_train_models.py
py -3.12 server\ml\02_build_dataset.py      (about 1-2 minutes)
py -3.12 server\ml\03_export_sql.py
```
Then import `server\database.sql` and `server\data.sql` (see `server/docs/README.md`).
You only need this when you change the data. `server/data.sql` is already made.

## How the demo data is made (short)
1. Build the organisation from the design (6 departments, 31 teams, managers).
2. Plan what the design shows: who is at elevated risk, tiers, scores, engagement, recognition, interventions, weekly risk.
3. For every person and every week, search the model inputs (workload, overtime, mood …) until the
   **trained burnout model** gives exactly the planned risk. So every stored risk comes from the model.
4. Make the seven criteria so that the EMPULSE Score (published weights, Job Burnout = 100 − risk) lands on the planned score.
5. Check every design number → `reports/data_summary.md` (PASS / CHANGED with the reason).

The same seed always gives the same data. All names and numbers are synthetic.
