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
    gmail_user = (os.getenv("GMAIL_USER") or GMAIL_USER or "").strip()
    gmail_pw = (os.getenv("GMAIL_APP_PASSWORD") or GMAIL_APP_PASSWORD or "").strip()

    # If recipient is demo address, redirect to GMAIL_USER so real email is received
    if recipient_email and ("@example.com" in recipient_email or recipient_email == "alex@example.com"):
        if gmail_user:
            print(f"[scheduler] Redirecting demo recipient '{recipient_email}' -> '{gmail_user}'")
            recipient_email = gmail_user
        else:
            return {
                "channel": "in-app",
                "status": "skipped",
                "recipient": recipient_email,
                "reason": "Recipient is demo address (alex@example.com) and GMAIL_USER is not set in Render environment"
            }

    if not gmail_user or not gmail_pw:
        missing = []
        if not gmail_user: missing.append("GMAIL_USER")
        if not gmail_pw: missing.append("GMAIL_APP_PASSWORD")
        reason = f"Missing environment variable(s): {', '.join(missing)} in Render"
        print(f"[scheduler.in-app] {reason}. Fallback to in-app notification.")
        return {"channel": "in-app", "status": "sent", "recipient": recipient_email, "reason": reason}

    if not recipient_email:
        return {"channel": "in-app", "status": "failed", "error": "No recipient email provided"}

    try:
        msg = MIMEMultipart()
        msg["From"] = f"Duewell Assistant <{gmail_user}>"
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
            server.login(gmail_user, gmail_pw)
            server.send_message(msg)

        print(f"[scheduler] Email sent successfully to {recipient_email}")
        return {"channel": "email", "status": "sent", "recipient": recipient_email}
    except Exception as e:
        print(f"[scheduler] Failed to send email via SMTP: {e}")
        return {"channel": "in-app", "status": "failed_smtp", "error": str(e), "recipient": recipient_email}

def trigger_bill_reminder(bill_id: int, db: Session, user_email: str = None) -> models.Reminder:
    """
    On-demand reminder trigger:
    Runs decide_reminder_schedule + send_notification + creates DB reminder entry.
    """
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise ValueError(f"Bill with ID {bill_id} not found")

    target_email = user_email
    if not target_email and bill.user_id:
        user = db.query(models.User).filter(models.User.id == bill.user_id).first()
        if user and user.email and user.email != "alex@example.com":
            target_email = user.email

    gmail_user = os.getenv("GMAIL_USER", GMAIL_USER)
    if not target_email or target_email == "alex@example.com":
        target_email = gmail_user or "alex@example.com"

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
        recipient_email=target_email,
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
    reminder.notif_meta = notif_result
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
