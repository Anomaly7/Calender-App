import sqlite3

conn = sqlite3.connect("calendar.db", check_same_thread=False)

conn.execute("""
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT
)
""")

conn.execute("""
CREATE TABLE IF NOT EXISTS busy_times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    start TEXT,
    end TEXT,
    source TEXT
)
""")

# CREATE TABLE IF NOT EXISTS above won't retrofit new columns onto a
# database that already exists (e.g. in production), so add them explicitly.
existing_columns = {row[1] for row in conn.execute("PRAGMA table_info(busy_times)").fetchall()}
if "raw_timezone" not in existing_columns:
    conn.execute("ALTER TABLE busy_times ADD COLUMN raw_timezone TEXT")
if "title" not in existing_columns:
    conn.execute("ALTER TABLE busy_times ADD COLUMN title TEXT")

conn.commit()

conn.execute("""
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY
)
""")

conn.execute("""
CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT,
    user_id TEXT
)
""")

conn.commit()
