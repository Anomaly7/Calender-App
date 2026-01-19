from fastapi import FastAPI
from app.google_auth import router as google_router
from dotenv import load_dotenv
from app.group_availability import router as group_router
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(
    title="Calendar Availability API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow frontend access
    allow_credentials=True,
    allow_methods=["*"],  # allow POST, OPTIONS, etc.
    allow_headers=["*"],
)

app.include_router(group_router)
app.include_router(google_router)

@app.get("/")
def root():
    return {"status": "API running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

