import os
import time

import jwt
from fastapi import Header, HTTPException

ALGORITHM = "HS256"
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days


def create_session_token(user_id: str) -> str:
    secret = os.getenv("SESSION_SECRET")
    payload = {"sub": user_id, "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def get_current_user(authorization: str = Header(None)) -> str:
    """FastAPI dependency: the caller's identity, proven by a signed session
    token - never trust a client-supplied user_id query param for this, or
    anyone can read/overwrite anyone else's schedule just by guessing or
    typing in their email."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not signed in")

    token = authorization[len("Bearer "):]
    secret = os.getenv("SESSION_SECRET")

    try:
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Session expired, please sign in again")

    return payload["sub"]
