import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from dotenv import load_dotenv

import agent
import models
from database import SessionLocal

load_dotenv()

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")

scheduler = BackgroundScheduler()

def send_notification(recipient_email: str, subject: str, message: str) -> dict:
    """
    Sends email via Gmail SMTP if credentials exist, otherwise logs in-app notification.
    """
    if GMAIL_USER and GMAIL_APP_PASSWORD and recipient_email:
        try:
            msg = MIMEMultipart()
            msg["From"] = f"Duewell Assistant <{GMAIL_USER}>"
            msg["To"] = recipient_email
            msg["Subject"] = subject

            body = (
                f"Hello,\n\n"
                f"{message}\n\n"
                f"— Duewell Bill Companion\n"
                f"Less mental load. More room to live."
            )
            msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
                server.send_message(msg)

            try:
                print(f"[scheduler] Email sent successfully to {recipient_email}")
            except Exception:
                pass
            return {"channel": "email", "status": "sent"}
        except Exception as e:
            try:
                print(f"[scheduler] Failed to send email via SMTP: {e}")
            except Exception:
                pass
            # Fall back to in-app
            return {"channel": "in-app", "status": "sent", "error": str(e)}

    try:
        safe_msg = f"{subject} - {message}".encode('ascii', errors='replace').decode('ascii')
        print(f"[scheduler.in-app] Notification logged: {safe_msg}")
    except Exception:
        pass
    return {"channel": "in-app", "status": "sent"}

def trigger_bill_reminder(bill_id: int, db: Session, user_email: str = "alex@example.com") -> models.Reminder:
    """
    On-demand reminder trigger:
    Runs decide_reminder_schedule + send_notification + creates DB reminder entry.
    """
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise ValueError(f"Bill with ID {bill_id} not found")

    bill_dict = {
        "id": bill.id,
        "biller": bill.biller,
        "amount": bill.amount,
        "dueDate": bill.dueDate,
        "category": bill.category,
        "status": bill.status,
    }

    decision = agent.decide_reminder_schedule(bill_dict)
    message = decision.get("message", f"Friendly reminder: {bill.biller} payment of ₹{bill.amount} is due {bill.dueDate}.")
    subject = f"Duewell Reminder: {bill.biller} is due {bill.dueDate}"

    notif_result = send_notification(
        recipient_email=user_email,
        subject=subject,
        message=message
    )

    reminder = models.Reminder(
        bill_id=bill.id,
        reminder_date=datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
        status="sent",
        channel=notif_result.get("channel", "in-app"),
        message=message,
        created_at=datetime.utcnow()
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder

def daily_reminder_sweep():
    """
    Scheduled job that scans for upcoming bills and sends reminders automatically.
    """
    print(f"[{datetime.utcnow().isoformat()}] Running scheduled daily reminder sweep...")
    db = SessionLocal()
    try:
        upcoming_bills = db.query(models.Bill).filter(models.Bill.status != "paid").all()
        for b in upcoming_bills:
            # Check if reminder already sent today
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            existing = db.query(models.Reminder).filter(
                models.Reminder.bill_id == b.id,
                models.Reminder.reminder_date.startswith(today_str)
            ).first()
            if not existing:
                try:
                    trigger_bill_reminder(b.id, db)
                except Exception as ex:
                    print(f"[scheduler] Sweep error for bill {b.id}: {ex}")
    finally:
        db.close()

def start_scheduler():
    if not scheduler.running:
        # Run daily sweep every 24 hours (and once on startup)
        scheduler.add_job(daily_reminder_sweep, 'interval', hours=24, id='daily_bill_sweep', replace_existing=True)
        scheduler.start()
        print("[scheduler] APScheduler started successfully.")

def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        print("[scheduler] APScheduler stopped.")
