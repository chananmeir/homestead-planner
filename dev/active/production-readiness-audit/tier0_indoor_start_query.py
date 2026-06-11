"""Tier 0 evidence query: are plan-only seedings piling up?

Read-only. Compares transplant-type PlantingEvents (seed_start_date set)
against linked IndoorSeedStart rows. See indoor-start-export-bridge-proposal.md.
"""
import sqlite3
from datetime import date

DB = "backend/instance/homestead.db"
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
cur = con.cursor()

tables = [r[0] for r in cur.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
print("tables:", ", ".join(tables))

# Confirm expected tables exist before querying
for t in ("planting_event", "indoor_seed_start"):
    if t not in tables:
        raise SystemExit(f"expected table missing: {t}")

today = date.today().isoformat()
print(f"\nreal today: {today}")

q = """
SELECT
  pe.user_id,
  strftime('%Y', COALESCE(pe.seed_start_date, pe.transplant_date)) AS yr,
  COUNT(*) AS total,
  SUM(CASE WHEN iss.id IS NOT NULL THEN 1 ELSE 0 END) AS tracked,
  SUM(CASE WHEN iss.id IS NULL THEN 1 ELSE 0 END) AS plan_only,
  SUM(CASE WHEN iss.id IS NULL AND date(pe.seed_start_date) < date(?)
       THEN 1 ELSE 0 END) AS plan_only_past_due
FROM planting_event pe
LEFT JOIN indoor_seed_start iss
       ON iss.planting_event_id = pe.id
      AND iss.cancelled_at IS NULL
WHERE pe.event_type = 'planting'
  AND pe.seed_start_date IS NOT NULL
  AND pe.cancelled_at IS NULL
GROUP BY pe.user_id, yr
ORDER BY pe.user_id, yr
"""
print("\nPer user/year — transplant-type events (seed_start_date set):")
print(f"{'user':>4} {'year':>5} {'total':>6} {'tracked':>8} {'plan-only':>10} {'past-due plan-only':>19}")
for r in cur.execute(q, (today,)):
    print(f"{r['user_id']:>4} {r['yr'] or '?':>5} {r['total']:>6} {r['tracked']:>8} "
          f"{r['plan_only']:>10} {r['plan_only_past_due']:>19}")

# Detail: the past-due plan-only rows (the "banner was ignored" evidence)
q2 = """
SELECT pe.user_id, pe.id, pe.plant_id, pe.variety,
       date(pe.seed_start_date) AS seed_start,
       date(pe.transplant_date) AS transplant,
       pe.quantity, pe.completed, pe.quantity_completed
FROM planting_event pe
LEFT JOIN indoor_seed_start iss
       ON iss.planting_event_id = pe.id AND iss.cancelled_at IS NULL
WHERE pe.event_type = 'planting'
  AND pe.seed_start_date IS NOT NULL
  AND pe.cancelled_at IS NULL
  AND iss.id IS NULL
  AND date(pe.seed_start_date) < date(?)
ORDER BY pe.seed_start_date
LIMIT 40
"""
rows = list(cur.execute(q2, (today,)))
print(f"\nPast-due plan-only events ({len(rows)} shown, cap 40):")
for r in rows:
    done = "done" if (r["completed"] or (r["quantity_completed"] or 0) >= (r["quantity"] or 1)) else "open"
    print(f"  u{r['user_id']} ev{r['id']:>4} {r['plant_id']:<18} {str(r['variety'] or ''):<22} "
          f"seed {r['seed_start']} transplant {r['transplant']} qty {r['quantity']} [{done}]")

# Context: how were existing IndoorSeedStarts created? (no provenance col —
# infer by whether they link to an event at all)
q3 = """
SELECT user_id,
       COUNT(*) AS total,
       SUM(CASE WHEN planting_event_id IS NOT NULL THEN 1 ELSE 0 END) AS linked,
       SUM(CASE WHEN planting_event_id IS NULL THEN 1 ELSE 0 END) AS standalone
FROM indoor_seed_start
WHERE cancelled_at IS NULL
GROUP BY user_id
"""
print("\nIndoorSeedStart rows (active):")
print(f"{'user':>4} {'total':>6} {'linked-to-event':>16} {'standalone':>11}")
for r in cur.execute(q3):
    print(f"{r['user_id']:>4} {r['total']:>6} {r['linked']:>16} {r['standalone']:>11}")

con.close()
