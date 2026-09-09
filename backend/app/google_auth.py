import os
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

from fastapi import APIRouter, Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from starlette.responses import RedirectResponse
from app.availability import parse_event, find_free_time
from datetime import datetime, timedelta
from app.db import conn


router = APIRouter()

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

def get_flow():
    return Flow.from_client_config(
        {
            "web": {
                "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [os.getenv("REDIRECT_URI")]
            }
        },
        scopes=SCOPES,
        # /auth/login and /auth/callback are separate requests, each building
        # a fresh Flow, so there's no way to carry a PKCE code_verifier
        # between them. This is a confidential client (has a client_secret),
        # so PKCE isn't required — disable it rather than losing the verifier.
        autogenerate_code_verifier=False
    )

@router.get("/auth/login")
def login():
    flow = get_flow()
    flow.redirect_uri = os.getenv("REDIRECT_URI")

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true"
    )

    return RedirectResponse(auth_url)

@router.get("/auth/callback")
def callback(request: Request):
    flow = get_flow()
    flow.redirect_uri = os.getenv("REDIRECT_URI")

    flow.fetch_token(authorization_response=str(request.url))
    credentials = flow.credentials

    service = build("calendar", "v3", credentials=credentials)

    now = datetime.utcnow().isoformat() + "Z"
    end = (datetime.utcnow() + timedelta(days=14)).isoformat() + "Z"

    # Use calendar account email as user identity
    calendar = build("calendar", "v3", credentials=credentials)

    calendar_info = calendar.calendarList().get(calendarId="primary").execute()
    email = calendar_info["id"]   # usually the email
    user_id = email               # simple + stable


    conn.execute(
        "INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)",
        (user_id, email)
    )
    conn.commit()

    events_result = service.events().list(
        calendarId="primary",
        timeMin=now,
        timeMax=end,
        singleEvents=True,
        orderBy="startTime"
    ).execute()

    events = events_result.get("items", [])
    
    print("RAW GOOGLE EVENTS:")
    for e in events:
        print(e.get("summary"), e.get("start"), e.get("end"))

    busy = [parse_event(e) for e in events]

    # Store Google Calendar busy times for later merging
    conn.execute(
        "DELETE FROM busy_times WHERE user_id = ? AND source = 'google'",
        (user_id,)
    )

    for start, end in busy:
        conn.execute(
            "INSERT INTO busy_times (user_id, start, end, source) VALUES (?, ?, ?, ?)",
            (user_id, start.isoformat(), end.isoformat(), "google")
        )

    conn.commit()


    return RedirectResponse(f"https://calender-app-one-xi.vercel.app/?user={user_id}")

@router.get("/auth/status")
def google_status(request: Request):
    user_id = request.query_params.get("user")
    if not user_id:
        return {"connected": False}

    row = conn.execute(
        "SELECT 1 FROM busy_times WHERE user_id = ? AND source = 'google' LIMIT 1",
        (user_id,)
    ).fetchone()

    return {"connected": row is not None}

@router.post("/auth/disconnect")
def disconnect_google(request: Request):
    user_id = request.query_params.get("user")
    if not user_id:
        return {"disconnected": True}

    conn.execute(
        "DELETE FROM busy_times WHERE user_id = ? AND source = 'google'",
        (user_id,)
    )
    conn.commit()

    return {"disconnected": True}

@router.get("/auth/me")
def me(request: Request):
    user_id = request.query_params.get("user")
    if not user_id:
        return {"email": None}

    row = conn.execute(
        "SELECT email FROM users WHERE id = ?",
        (user_id,)
    ).fetchone()

    return {"email": row[0] if row else None}

@router.post("/auth/logout")
def logout(request: Request):
    user_id = request.query_params.get("user")
    if not user_id:
        return {"logged_out": True}

    conn.execute(
        "DELETE FROM busy_times WHERE user_id = ? AND source = 'google'",
        (user_id,)
    )
    conn.commit()

    return {"logged_out": True}
