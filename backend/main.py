import os
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, Request, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv

import models
import auth
import agent
import scheduler
from database import engine, get_db, SessionLocal, Base

load_dotenv()

ENV = os.getenv("ENV", "development")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")

# ── CORS ──────────────────────────────────────────────────────────────────────
# Primary allowed origin comes from env; dev origins are always allowed.
_ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "").strip()
_ALLOWED_ORIGINS: list[str] = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
if _ALLOWED_ORIGIN:
    _ALLOWED_ORIGINS.append(_ALLOWED_ORIGIN)

# Pre-seeded bills data to mirror frontend initial state
INITIAL_SEEDED_BILLS = [
    {
        "biller": "Airtel Broadband",
        "category": "Internet",
        "amount": 1299.0,
        "dueDate": "Sep 21",
        "status": "due-soon",
        "initials": "AB",
        "accent": "#e84645",
        "account": "•••• 4820",
        "autopay": False,
        "note": "Your plan renews monthly."
    },
    {
        "biller": "HDFC Bank",
        "category": "Credit card",
        "amount": 18420.0,
        "dueDate": "Sep 18",
        "status": "overdue",
        "initials": "HB",
        "accent": "#e85f3f",
        "account": "•••• 8041",
        "autopay": False,
        "note": "Minimum due ₹1,840."
    },
    {
        "biller": "MSEDCL",
        "category": "Electricity",
        "amount": 2430.0,
        "dueDate": "Sep 24",
        "status": "due-soon",
        "initials": "MS",
        "accent": "#4f7dff",
        "account": "•••• 1129",
        "autopay": True,
        "note": "Average monthly bill ₹2,210."
    },
    {
        "biller": "Netflix",
        "category": "Subscriptions",
        "amount": 649.0,
        "dueDate": "Sep 27",
        "status": "due-soon",
        "initials": "N",
        "accent": "#d9364a",
        "account": "•••• 2118",
        "autopay": True,
        "note": "Premium plan."
    },
    {
        "biller": "LIC Premium",
        "category": "Insurance",
        "amount": 5600.0,
        "dueDate": "Oct 04",
        "status": "paid",
        "initials": "L",
        "accent": "#e3b94a",
        "account": "•••• 0914",
        "autopay": False,
        "note": "Paid on Sep 03."
    },
    {
        "biller": "Pune Municipal",
        "category": "Property tax",
        "amount": 3200.0,
        "dueDate": "Oct 09",
        "status": "paid",
        "initials": "PM",
        "accent": "#2e9a73",
        "account": "•••• 7302",
        "autopay": False,
        "note": "Receipt saved."
    }
]

def seed_database():
    """Seeds demo data — only runs in development mode."""
    if ENV in ("production", "test"):
        return

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Seed demo user
        demo_user = db.query(models.User).filter(models.User.email == "alex@example.com").first()
        if not demo_user:
            demo_user = models.User(
                email="alex@example.com",
                name="Alex Shah",
                hashed_password=auth.hash_password("password123")
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)
            print("[database] Seeded demo user: alex@example.com")

        # 2. Seed default bills if empty
        if db.query(models.Bill).count() == 0:
            for b in INITIAL_SEEDED_BILLS:
                bill_obj = models.Bill(
                    user_id=demo_user.id,
                    biller=b["biller"],
                    category=b["category"],
                    amount=b["amount"],
                    dueDate=b["dueDate"],
                    status=b["status"],
                    initials=b["initials"],
                    accent=b["accent"],
                    account=b["account"],
                    autopay=b["autopay"],
                    note=b["note"]
                )
                db.add(bill_obj)
            db.commit()
            print(f"[database] Seeded {len(INITIAL_SEEDED_BILLS)} default bills.")

        # 3. Seed initial reminders if empty
        if db.query(models.Reminder).count() == 0:
            sample_reminders = [
                ("Airtel due in 3 days - Reminder scheduled for tomorrow at 9:00 AM.", "due-soon"),
                ("HDFC card needs attention - Your payment is 2 days overdue.", "overdue"),
                ("LIC marked as paid - Receipt saved to your payment history.", "paid")
            ]
            first_bill = db.query(models.Bill).first()
            if first_bill:
                for text, tag in sample_reminders:
                    rem = models.Reminder(
                        bill_id=first_bill.id,
                        reminder_date=datetime.utcnow().strftime("%b %d"),
                        status="sent",
                        channel="in-app",
                        message=text
                    )
                    db.add(rem)
                db.commit()
                print("[database] Seeded initial sample reminders.")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_database()
    if ENV != "test":
        scheduler.start_scheduler()
    yield
    if ENV != "test":
        scheduler.shutdown_scheduler()

app = FastAPI(
    title="Duewell - Bill Payment Reminder & Agent API",
    description="Backend API for managing bills, automated reminders, AI extraction, and conversational assistance.",
    version="1.0.0",
    lifespan=lifespan
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Security scheme (Bearer token) ────────────────────────────────────────────
_bearer_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    """
    FastAPI dependency: decode JWT from Authorization: Bearer header,
    load the matching User row, raise 401 on any failure.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = auth.decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id: Optional[int] = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def require_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    """
    Extends get_current_user: also requires the user to be the configured admin.
    When ADMIN_EMAIL is not set, all authenticated users are refused (safe default).
    """
    if not ADMIN_EMAIL or current_user.email != ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )
    return current_user

# ── Schemas ────────────────────────────────────────────────────────────────────

class BillCreate(BaseModel):
    biller: str
    category: Optional[str] = "Other"
    amount: float
    dueDate: str
    status: Optional[str] = "due-soon"
    initials: Optional[str] = None
    accent: Optional[str] = None
    account: Optional[str] = "•••• 0000"
    autopay: Optional[bool] = False
    note: Optional[str] = None

class BillUpdate(BaseModel):
    biller: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    dueDate: Optional[str] = None
    status: Optional[str] = None
    account: Optional[str] = None
    autopay: Optional[bool] = None
    note: Optional[str] = None

class ChatRequest(BaseModel):
    message: str

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = ""

# ── Helpers ────────────────────────────────────────────────────────────────────

def format_bill_response(bill: models.Bill) -> dict:
    return {
        "id": bill.id,
        "biller": bill.biller,
        "category": bill.category,
        "amount": bill.amount,
        "dueDate": bill.dueDate,
        "status": bill.status,
        "initials": bill.initials or bill.biller[:2].upper(),
        "accent": bill.accent or "#485cc7",
        "account": bill.account or "•••• 0000",
        "autopay": bool(bill.autopay),
        "note": bill.note or ""
    }

def _get_bill_for_user(bill_id: int, user: models.User, db: Session) -> models.Bill:
    """Load a bill and verify it belongs to the current user. Returns 404 if not found or not owned."""
    bill = db.query(models.Bill).filter(
        models.Bill.id == bill_id,
        models.Bill.user_id == user.id
    ).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill

# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "app": "Duewell Bill Reminder System",
        "status": "online",
        "docs": "/docs",
        "agent": "gemini-3.6-flash"
    }

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

# ── Auth routes (public) ───────────────────────────────────────────────────────

@app.post("/auth/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        email=req.email,
        name=req.name or req.email.split("@")[0],
        hashed_password=auth.hash_password(req.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = auth.create_access_token({"sub": user.email, "user_id": user.id})
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}

@app.post("/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or not auth.verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = auth.create_access_token({"sub": user.email, "user_id": user.id})
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}

@app.get("/auth/me")
def me(current_user: models.User = Depends(get_current_user)):
    """Returns the currently authenticated user's profile."""
    return {"id": current_user.id, "email": current_user.email, "name": current_user.name}

# ── Bills CRUD (all protected + user-scoped) ───────────────────────────────────

@app.get("/bills")
def list_bills(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bills = (
        db.query(models.Bill)
        .filter(models.Bill.user_id == current_user.id)
        .order_by(models.Bill.id.desc())
        .all()
    )
    return [format_bill_response(b) for b in bills]

@app.post("/bills", status_code=status.HTTP_201_CREATED)
def create_bill(
    bill_in: BillCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    words = bill_in.biller.strip().split()
    initials = "".join([w[0] for w in words[:2]]).upper() if words else "BL"

    color_map = {
        "Internet": "#e84645",
        "Credit card": "#e85f3f",
        "Electricity": "#4f7dff",
        "Subscriptions": "#d9364a",
        "Insurance": "#e3b94a",
        "Property tax": "#2e9a73",
        "Utilities": "#2e9a73"
    }
    accent = bill_in.accent or color_map.get(bill_in.category, "#485cc7")

    bill = models.Bill(
        user_id=current_user.id,
        biller=bill_in.biller,
        category=bill_in.category or "Other",
        amount=bill_in.amount,
        dueDate=bill_in.dueDate,
        status=bill_in.status or "due-soon",
        initials=initials,
        accent=accent,
        account=bill_in.account or "•••• 0000",
        autopay=bill_in.autopay or False,
        note=bill_in.note or ""
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return format_bill_response(bill)

@app.get("/bills/{bill_id}")
def get_bill(
    bill_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return format_bill_response(_get_bill_for_user(bill_id, current_user, db))

@app.patch("/bills/{bill_id}")
def update_bill(
    bill_id: int,
    updates: BillUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bill = _get_bill_for_user(bill_id, current_user, db)
    update_data = updates.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bill, field, value)
    db.commit()
    db.refresh(bill)
    return format_bill_response(bill)

@app.delete("/bills/{bill_id}")
def delete_bill(
    bill_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bill = _get_bill_for_user(bill_id, current_user, db)
    db.delete(bill)
    db.commit()
    return {"success": True, "message": f"Bill {bill_id} deleted"}

# ── Document upload & AI extraction ───────────────────────────────────────────

@app.post("/bills/upload")
async def upload_bill_document(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    """Accepts bill image/PDF, extracts structured details using Gemini AI."""
    try:
        content = await file.read()
        mime_type = file.content_type or "image/png"
        extracted = agent.extract_bill_from_document(file_bytes=content, mime_type=mime_type)
        return {"success": True, "data": extracted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

# ── Reminder trigger ───────────────────────────────────────────────────────────

@app.post("/bills/{bill_id}/trigger-reminder")
def trigger_reminder(
    bill_id: int,
    recipient_email: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Triggers an on-demand reminder for a bill the current user owns."""
    # Verify ownership first
    _get_bill_for_user(bill_id, current_user, db)
    try:
        # Use the requester's email if none explicitly supplied
        effective_email = recipient_email or current_user.email
        reminder = scheduler.trigger_bill_reminder(
            bill_id=bill_id, db=db, user_email=effective_email
        )
        notif = getattr(reminder, "notif_meta", {})
        return {
            "success": True,
            "message": "Email sent!" if notif.get("channel") == "email" else "In-app reminder saved",
            "channel": notif.get("channel", reminder.channel),
            "recipient": notif.get("recipient"),
            "error": notif.get("error"),
            "reason": notif.get("reason"),
            "reminder": {
                "id": reminder.id,
                "bill_id": reminder.bill_id,
                "reminder_date": reminder.reminder_date,
                "status": reminder.status,
                "channel": reminder.channel,
                "message": reminder.message
            }
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Reminders (user-scoped through bill ownership) ────────────────────────────

@app.get("/reminders")
def list_reminders(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminders = (
        db.query(models.Reminder)
        .join(models.Bill, models.Reminder.bill_id == models.Bill.id)
        .filter(models.Bill.user_id == current_user.id)
        .order_by(models.Reminder.id.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": r.id,
            "bill_id": r.bill_id,
            "reminder_date": r.reminder_date,
            "status": r.status,
            "channel": r.channel,
            "message": r.message
        }
        for r in reminders
    ]

# ── AI Chat (user-scoped bills) ────────────────────────────────────────────────

@app.post("/chat")
def chat_with_agent(
    req: ChatRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bills = db.query(models.Bill).filter(models.Bill.user_id == current_user.id).all()
    bills_list = [format_bill_response(b) for b in bills]
    reply = agent.answer_query(user_query=req.message, bills=bills_list)
    return {"reply": reply}

# ── Admin-only diagnostic routes ───────────────────────────────────────────────

@app.get("/mail-status")
def mail_status(admin: models.User = Depends(require_admin)):
    """Diagnostic check — admin only."""
    resend_key = (os.getenv("RESEND_API_KEY") or "").strip()
    gmail_user = (os.getenv("GMAIL_USER") or "").strip()
    gmail_pw = (os.getenv("GMAIL_APP_PASSWORD") or "").strip()

    has_resend = bool(resend_key and resend_key.startswith("re_"))
    has_gmail = bool(gmail_user and gmail_pw)

    return {
        "active_provider": "resend (HTTPS port 443 - Recommended for Render)" if has_resend else ("gmail_smtp (raw socket)" if has_gmail else "in-app fallback"),
        "resend": {
            "configured": has_resend,
            "status": "ready" if has_resend else "Add RESEND_API_KEY to Render Environment Variables"
        },
        "gmail_smtp": {
            "configured": has_gmail,
            "note": "Blocked on Render free tier (Errno 101); works locally or with paid Render"
        },
        "instructions": "Get free API key at resend.com -> Add RESEND_API_KEY in Render -> Emails work instantly!"
    }

@app.post("/test-mail")
def test_mail(to: Optional[str] = None, admin: models.User = Depends(require_admin)):
    """Sends a test email — admin only."""
    gmail_user = (os.getenv("GMAIL_USER") or "").strip()
    target = to or gmail_user
    if not target or "@" not in target:
        raise HTTPException(status_code=400, detail="GMAIL_USER is not configured.")
    result = scheduler.send_notification(
        recipient_email=target,
        subject="Duewell Live Test: SMTP Working!",
        message="Congratulations! Your Duewell email notification system is fully configured and delivering live emails."
    )
    return result

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
