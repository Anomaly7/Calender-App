import os
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

from urllib.parse import quote
from fastapi import APIRouter, Depends, Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from starlette.responses import RedirectResponse
from app.availability import parse_event, find_free_time, PST
from app.auth_utils import create_session_token, get_current_user
from datetime import datetime, time, timedelta
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

    # A full year out (plus a week back) so Month view has real data
    # whenever the user navigates within the synced range, not just the
    # current week.
    today = datetime.now(PST).date()
    now = datetime.combine(today - timedelta(days=7), time.min, tzinfo=PST).isoformat()
    end = datetime.combine(today + timedelta(days=366), time.max, tzinfo=PST).isoformat()

    # Use calendar account email as user identity
    calendar = build("calendar", "v3", credentials=credentials)

    calendar_info = calendar.calendarList().get(calendarId="primary").execute()
    email = calendar_info["id"]   # usually the email
    user_id = email               # simple + stable


    conn.execute(
        "INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT (id) DO NOTHING",
        (user_id, email)
    )
    conn.commit()

    # A year of (singleEvents-expanded) events can span many pages -
    # Google caps each page at maxResults, so keep following nextPageToken
    # until it's exhausted.
    events = []
    page_token = None
    while True:
        events_result = service.events().list(
            calendarId="primary",
            timeMin=now,
            timeMax=end,
            singleEvents=True,
            orderBy="startTime",
            maxResults=2500,
            pageToken=page_token
        ).execute()
        events.extend(events_result.get("items", []))
        page_token = events_result.get("nextPageToken")
        if not page_token:
            break

    busy = [parse_event(e) for e in events]

    # Store Google Calendar busy times for later merging
    conn.execute(
        "DELETE FROM busy_times WHERE user_id = ? AND source = 'google'",
        (user_id,)
    )

    for start, end, raw_timezone, title in busy:
        conn.execute(
            "INSERT INTO busy_times (user_id, start, end_time, source, raw_timezone, title) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, start.isoformat(), end.isoformat(), "google", raw_timezone, title)
        )

    conn.commit()


    token = create_session_token(user_id)
    return RedirectResponse(f"https://calender-app-one-xi.vercel.app/?user={quote(user_id)}&token={quote(token)}")

@router.get("/auth/status")
def google_status(user_id: str = Depends(get_current_user)):
    row = conn.execute(
        "SELECT 1 FROM busy_times WHERE user_id = ? AND source = 'google' LIMIT 1",
        (user_id,)
    ).fetchone()

    return {"connected": row is not None}

@router.post("/auth/disconnect")
def disconnect_google(user_id: str = Depends(get_current_user)):
    conn.execute(
        "DELETE FROM busy_times WHERE user_id = ? AND source = 'google'",
        (user_id,)
    )
    conn.commit()

    return {"disconnected": True}

@router.get("/auth/me")
def me(user_id: str = Depends(get_current_user)):
    row = conn.execute(
        "SELECT email FROM users WHERE id = ?",
        (user_id,)
    ).fetchone()

    return {"email": row[0] if row else None}

@router.post("/auth/logout")
def logout(user_id: str = Depends(get_current_user)):
    conn.execute(
        "DELETE FROM busy_times WHERE user_id = ? AND source = 'google'",
        (user_id,)
    )
    conn.commit()

    return {"logged_out": True}
