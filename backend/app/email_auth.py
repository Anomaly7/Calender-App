import re

import bcrypt
from fastapi import APIRouter, Body, HTTPException

from app.auth_utils import create_session_token
from app.db import conn

router = APIRouter()

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@router.post("/auth/signup")
def signup(body: dict = Body(...)):
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    existing = conn.execute("SELECT id FROM users WHERE id = ?", (email,)).fetchone()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists - try signing in instead."
        )

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    conn.execute(
        "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
        (email, email, password_hash)
    )
    conn.commit()

    token = create_session_token(email)
    return {"token": token, "email": email}


@router.post("/auth/login")
def login(body: dict = Body(...)):
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    row = conn.execute("SELECT password_hash FROM users WHERE id = ?", (email,)).fetchone()

    if not row or not row[0]:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    if not bcrypt.checkpw(password.encode(), row[0].encode()):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    token = create_session_token(email)
    return {"token": token, "email": email}
