"""Tier 0 follow-up: identify real vs test users, detail the main user's plan-only rows."""
import sqlite3
from datetime import date

con = sqlite3.connect("backend/instance/homestead.db")
con.row_factory = sqlite3.Row
cur = con.cursor()
today = date.today().isoformat()

ids = (59, 60, 80, 96, 230, 256, 257, 258, 259, 263, 264, 265)
print("Who are these users?")
for r in cur.execute(
    f"SELECT id, username, email, is_admin, created_at, last_login FROM users "
    f"WHERE id IN ({','.join('?'*len(ids))}) ORDER BY id", ids):
    print(f"  u{r['id']:<4} {r['username']:<28} {str(r['email']):<35} "
          f"admin={r['is_admin']} created={str(r['created_at'])[:10]} last_login={str(r['last_login'])[:10]}")

print(f"\nTotal users: {cur.execute('SELECT COUNT(*) FROM users').fetchone()[0]}")

# Detail for user 59 (the heavy user): plan-only events, past-due vs upcoming
q = """
SELECT pe.id, pe.plant_id, pe.variety,
       date(pe.seed_start_date) AS seed_start,
       date(pe.transplant_date) AS transplant,
       pe.quantity, pe.completed, pe.quantity_completed,
       CASE WHEN date(pe.seed_start_date) < date(?) THEN 'PAST-DUE' ELSE 'upcoming' END AS due
FROM planting_event pe
LEFT JOIN indoor_seed_start iss
       ON iss.planting_event_id = pe.id AND iss.cancelled_at IS NULL
WHERE pe.user_id = 59
  AND pe.event_type = 'planting'
  AND pe.seed_start_date IS NOT NULL
  AND pe.cancelled_at IS NULL
  AND iss.id IS NULL
ORDER BY pe.seed_start_date
"""
print("\nUser 59 — plan-only transplant events (no linked IndoorSeedStart):")
for r in cur.execute(q, (today,)):
    done = "done" if (r["completed"] or (r["quantity_completed"] or 0) >= (r["quantity"] or 1)) else "open"
    print(f"  ev{r['id']:>4} {r['plant_id']:<16} {str(r['variety'] or ''):<20} "
          f"seed {r['seed_start']} transplant {str(r['transplant'])} qty {str(r['quantity']):<4} [{done}] {r['due']}")

con.close()
