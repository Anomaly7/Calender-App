import sqlite3

conn = sqlite3.connect("calendar.db", check_same_thread=False)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS busy_times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    start TEXT,
    end TEXT,
    source TEXT
)
""")

conn.commit()

cursor.execute("""
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT,
    user_id TEXT
)
""")

conn.commit()
