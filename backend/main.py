import os
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv

import models
import auth
import agent
import scheduler
from database import engine, get_db, SessionLocal, Base

load_dotenv()

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
    seed_database()
    scheduler.start_scheduler()
    yield
    scheduler.shutdown_scheduler()

app = FastAPI(
    title="Duewell - Bill Payment Reminder & Agent API",
    description="Backend API for managing bills, automated reminders, AI extraction, and conversational assistance.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for local development and Vercel production deployments
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|.*\.vercel\.app)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Schemas -----------------

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
    name: Optional[str] = "Alex Shah"

# ----------------- Helper Functions -----------------

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

# ----------------- Routes -----------------

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

# --- Auth Routes ---
@app.post("/auth/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        email=req.email,
        name=req.name,
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
        # Demo tolerance: allow test login for alex@example.com
        if req.email == "alex@example.com":
            user = db.query(models.User).filter(models.User.email == "alex@example.com").first()
        else:
            raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = auth.create_access_token({"sub": user.email, "user_id": user.id})
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}

@app.get("/auth/me")
def get_current_user(db: Session = Depends(get_db)):
    user = db.query(models.User).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "email": user.email, "name": user.name}

# --- Bills CRUD ---
@app.get("/bills")
def list_bills(db: Session = Depends(get_db)):
    bills = db.query(models.Bill).order_by(models.Bill.id.desc()).all()
    return [format_bill_response(b) for b in bills]

@app.post("/bills", status_code=status.HTTP_201_CREATED)
def create_bill(bill_in: BillCreate, db: Session = Depends(get_db)):
    # Generate initials
    words = bill_in.biller.strip().split()
    initials = "".join([w[0] for w in words[:2]]).upper() if words else "BL"
    
    # Category color map
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
def get_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return format_bill_response(bill)

@app.patch("/bills/{bill_id}")
def update_bill(bill_id: int, updates: BillUpdate, db: Session = Depends(get_db)):
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    update_data = updates.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bill, field, value)
    
    db.commit()
    db.refresh(bill)
    return format_bill_response(bill)

@app.delete("/bills/{bill_id}")
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    db.delete(bill)
    db.commit()
    return {"success": True, "message": f"Bill {bill_id} deleted"}

# --- Document Upload & Gemini Extraction ---
@app.post("/bills/upload")
async def upload_bill_document(file: UploadFile = File(...)):
    """
    Accepts bill image/PDF, extracts structured details using Gemini AI.
    """
    try:
        content = await file.read()
        mime_type = file.content_type or "image/png"
        extracted = agent.extract_bill_from_document(file_bytes=content, mime_type=mime_type)
        return {"success": True, "data": extracted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

# --- Reminder Trigger ---
@app.post("/bills/{bill_id}/trigger-reminder")
def trigger_reminder(bill_id: int, recipient_email: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Triggers an on-demand reminder for a bill using agent.decide_reminder_schedule
    and scheduler.send_notification.
    """
    try:
        reminder = scheduler.trigger_bill_reminder(bill_id=bill_id, db=db, user_email=recipient_email)
        return {
            "success": True,
            "message": "Reminder triggered successfully",
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

@app.get("/reminders")
def list_reminders(db: Session = Depends(get_db)):
    reminders = db.query(models.Reminder).order_by(models.Reminder.id.desc()).limit(20).all()
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

# --- AI Chat Assistant ---
@app.post("/chat")
def chat_with_agent(req: ChatRequest, db: Session = Depends(get_db)):
    bills = db.query(models.Bill).all()
    bills_list = [format_bill_response(b) for b in bills]
    reply = agent.answer_query(user_query=req.message, bills=bills_list)
    return {"reply": reply}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
