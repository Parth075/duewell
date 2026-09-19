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

import json
import urllib.request
import urllib.error

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM = os.getenv("RESEND_FROM", "Duewell <onboarding@resend.dev>")

scheduler = BackgroundScheduler()

def send_via_resend(recipient_email: str, subject: str, message: str) -> dict:
    """
    Sends email via Resend HTTP REST API over port 443 (HTTPS).
    Works on Render Free Tier with zero blocked ports.
    """
    api_key = (os.getenv("RESEND_API_KEY") or RESEND_API_KEY or "").strip()
    from_email = (os.getenv("RESEND_FROM") or RESEND_FROM or "Duewell <onboarding@resend.dev>").strip()

    if not api_key:
        return {"channel": "in-app", "status": "skipped", "error": "RESEND_API_KEY is not set"}

    html_content = f"""<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; color: #111827;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="display: flex; align-items: center; margin-bottom: 24px;">
      <span style="font-size: 22px; font-weight: 700; color: #1d4ed8; letter-spacing: -0.5px;">Duewell</span>
      <span style="font-size: 13px; color: #6b7280; margin-left: 8px; font-weight: 500;">· bill companion</span>
    </div>
    <p style="font-size: 16px; line-height: 1.6; color: #374151; margin: 0 0 24px 0; white-space: pre-line;">{message}</p>
    <div style="padding: 16px; background-color: #f3f4f6; border-radius: 10px; margin-bottom: 24px;">
      <span style="font-size: 13px; color: #4b5563;">Status: <strong>Active Reminder</strong> · Automated via Duewell AI</span>
    </div>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">Duewell — Less mental load. More room to live.</p>
  </div>
</body>
</html>"""

    payload = json.dumps({
        "from": from_email,
        "to": [recipient_email],
        "subject": subject,
        "html": html_content,
        "text": f"{message}\n\n— Duewell Bill Companion\nLess mental load. More room to live."
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Duewell-App/1.0"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            resp_body = json.loads(resp.read().decode("utf-8"))
            print(f"[scheduler.resend] Email sent successfully to {recipient_email}: {resp_body}")
            return {
                "channel": "email",
                "status": "sent",
                "recipient": recipient_email,
                "provider": "resend",
                "id": resp_body.get("id")
            }
    except urllib.error.HTTPError as e:
        err_raw = e.read().decode("utf-8", errors="ignore")
        print(f"[scheduler.resend] Resend HTTP {e.code}: {err_raw}")
        try:
            err_json = json.loads(err_raw)
            err_msg = err_json.get("message", err_raw)
        except Exception:
            err_msg = err_raw
        return {
            "channel": "in-app",
            "status": "failed_resend",
            "error": f"Resend API error: {err_msg}",
            "recipient": recipient_email
        }
    except Exception as e:
        print(f"[scheduler.resend] Network error calling Resend API: {e}")
        return {
            "channel": "in-app",
            "status": "failed_resend",
            "error": str(e),
            "recipient": recipient_email
        }

def send_notification(recipient_email: str, subject: str, message: str) -> dict:
    """
    Sends email via Resend HTTP API (recommended on Render) or Gmail SMTP,
    falling back to in-app notification if neither is configured.
    """
    resend_key = (os.getenv("RESEND_API_KEY") or RESEND_API_KEY or "").strip()
    gmail_user = (os.getenv("GMAIL_USER") or GMAIL_USER or "").strip()
    gmail_pw = (os.getenv("GMAIL_APP_PASSWORD") or GMAIL_APP_PASSWORD or "").strip()
    fallback_email = (os.getenv("RESEND_TO") or gmail_user or "").strip()

    # If recipient is demo address, redirect to real user email
    if recipient_email and ("@example.com" in recipient_email or recipient_email == "alex@example.com"):
        if fallback_email:
            print(f"[scheduler] Redirecting demo recipient '{recipient_email}' -> '{fallback_email}'")
            recipient_email = fallback_email
        elif not resend_key and not gmail_user:
            return {
                "channel": "in-app",
                "status": "skipped",
                "recipient": recipient_email,
                "reason": "Recipient is demo address (alex@example.com) and no email provider is configured in Render"
            }

    # 1. Primary: Use Resend API via HTTPS (works on Render free tier, port 443)
    if resend_key:
        print(f"[scheduler] Using Resend HTTPS provider for recipient: {recipient_email}")
        return send_via_resend(recipient_email, subject, message)

    # 2. Secondary: Try Gmail SMTP (works locally, but blocked on Render Free tier)
    if gmail_user and gmail_pw and recipient_email:
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

            print(f"[scheduler] Email sent successfully to {recipient_email} via SMTP")
            return {"channel": "email", "status": "sent", "recipient": recipient_email, "provider": "gmail_smtp"}
        except Exception as e:
            print(f"[scheduler] Failed to send email via SMTP: {e}")
            return {
                "channel": "in-app",
                "status": "failed_smtp",
                "error": f"SMTP Error: {str(e)}. Tip: Set RESEND_API_KEY in Render to bypass SMTP port blocking.",
                "recipient": recipient_email
            }

    # 3. Fallback: In-app notification
    reason = "Neither RESEND_API_KEY nor GMAIL credentials set in Render"
    print(f"[scheduler.in-app] {reason}. Logged as in-app notification.")
    return {"channel": "in-app", "status": "sent", "recipient": recipient_email, "reason": reason}

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
