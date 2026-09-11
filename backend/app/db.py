import os

import psycopg2
from dotenv import load_dotenv

# Loaded here (not just in main.py) since this module connects to the
# database at import time, which can happen before main.py's own
# load_dotenv() call runs.
load_dotenv()

_raw_conn = psycopg2.connect(os.getenv("DATABASE_URL"))


class _Connection:
    """Wraps a psycopg2 connection so the rest of the app can keep using
    the sqlite3-style conn.execute(sql, params) / conn.commit() calling
    convention it was written against."""

    def __init__(self, raw):
        self._raw = raw

    def execute(self, sql, params=()):
        cur = self._raw.cursor()
        cur.execute(sql.replace("?", "%s"), params)
        return cur

    def commit(self):
        self._raw.commit()


conn = _Connection(_raw_conn)

conn.execute("""
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT
)
""")

conn.execute("""
CREATE TABLE IF NOT EXISTS busy_times (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    start TEXT,
    end_time TEXT,
    source TEXT,
    raw_timezone TEXT,
    title TEXT
)
""")

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

conn.execute("""
CREATE TABLE IF NOT EXISTS apple_credentials (
    user_id TEXT PRIMARY KEY,
    apple_email TEXT,
    encrypted_password TEXT
)
""")

conn.commit()
