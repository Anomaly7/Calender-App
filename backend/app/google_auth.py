import os
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

from fastapi import APIRouter, Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from starlette.responses import RedirectResponse
from app.availability import parse_event, find_free_time
from datetime import datetime, timedelta

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
        scopes=SCOPES
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
    end = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"

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
    request.app.state.google_busy = busy

    return RedirectResponse("http://localhost:5500/frontend/index.html")

@router.get("/auth/status")
def google_status(request: Request):
    return {
        "connected": hasattr(request.app.state, "google_busy")
    }

@router.post("/auth/disconnect")
def disconnect_google(request: Request):
    if hasattr(request.app.state, "google_busy"):
        del request.app.state.google_busy
    return {"disconnected": True}
