"""
Initialize or recreate all database tables.
Run this if tables are missing.

Run directly: python init_db.py
(Guarded by __main__ since Jun 2026 — importing this module no longer touches the DB.)
"""
from app import app, db


def main():
    print("============================================================")
    print("DATABASE INITIALIZATION")
    print("============================================================")

    with app.app_context():
        print("\nCreating all tables from models...")
        db.create_all()
        print("\nDone! All tables created.")

        # Verify tables exist
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        print(f"\nTables in database ({len(tables)}):")
        for table in sorted(tables):
            print(f"  - {table}")

    print("\n============================================================")
    print("Database initialization complete!")
    print("============================================================")


if __name__ == '__main__':
    main()
