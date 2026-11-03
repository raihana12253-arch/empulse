"""Write server/data.sql from the generated tables (data/generated/*.csv).

Run (after 02_build_dataset.py):   python server/ml/03_export_sql.py
Then import server/database.sql and server/data.sql into MySQL (see server/docs/README.md).
"""
from __future__ import annotations

import math
from pathlib import Path

import pandas as pd

import design_targets as T

HERE = Path(__file__).resolve().parent
CSV = HERE / "data" / "generated"
OUT = HERE.parent / "data.sql"

# insert order: a table comes after the tables it points to
TABLES = ["departments", "teams", "employees", "employee_current", "weekly_metrics", "monthly_scores", "checkins",
          "interventions", "ideas", "idea_members", "recognitions", "innovation_dna", "skills", "economic_items"]
BATCH = 1000          # rows per INSERT statement


def sql_value(v) -> str:
    """One value written the way MySQL expects it."""
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else repr(round(v, 4))
    s = str(v).replace("\\", "\\\\").replace("'", "''")
    return f"'{s}'"


def main():
    lines = [
        "-- =====================================================================",
        "-- server/data.sql — generated demo data for EMPULSE. DO NOT EDIT BY HAND.",
        "-- Made by server/ml/03_export_sql.py from server/ml/data/generated/*.csv",
        "-- Import AFTER database.sql. Importing again replaces the data.",
        "-- ALL DATA IS SYNTHETIC.",
        "-- =====================================================================",
        "USE empulse;",
        "SET NAMES utf8mb4;",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "SET autocommit = 0;",
    ]
    for t in reversed(TABLES):
        lines.append(f"DELETE FROM {t};")
    lines.append("DELETE FROM app_settings;")
    lines.append("INSERT INTO app_settings (setting_key, setting_value) VALUES "
                 f"('as_of_date', '{T.AS_OF}'), ('latest_week', '{T.LAST_WEEK}'), ('data_seed', '20261011');")
    total = 0
    for t in TABLES:
        df = pd.read_csv(CSV / f"{t}.csv", keep_default_na=True)
        df = df.astype(object).where(pd.notna(df), None)
        cols = ", ".join(df.columns)
        rows = df.to_numpy().tolist()
        lines.append(f"\n-- {t}: {len(rows):,} rows")
        for start in range(0, len(rows), BATCH):
            chunk = rows[start:start + BATCH]
            values = ",\n".join("(" + ", ".join(sql_value(v) for v in r) + ")" for r in chunk)
            lines.append(f"INSERT INTO {t} ({cols}) VALUES\n{values};")
        total += len(rows)
    # link the demo accounts to their person (matched by e-mail)
    lines += ["",
              "-- demo accounts -> their person in employees",
              "UPDATE users u JOIN employees e ON e.email = u.email SET u.employee_id = e.id;",
              "COMMIT;",
              "SET FOREIGN_KEY_CHECKS = 1;", ""]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT} ({total:,} rows, {OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
