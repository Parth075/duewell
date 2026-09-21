"""
Acceptance tests for the Duewell backend auth & multi-user security fixes.

Run from the backend/ directory:
    pytest tests/test_auth.py -v

Requires: pytest, httpx, fastapi[all]
    pip install pytest httpx
"""

import os
import pytest
from fastapi.testclient import TestClient

# Point to an in-memory SQLite DB for tests so we don't touch bills.db
os.environ.setdefault("JWT_SECRET", "test_secret_key_for_pytest_only_32c")
os.environ.setdefault("ENV", "test")  # prevents seeding demo data

from main import app  # noqa: E402 — must come after env vars are set

client = TestClient(app)


# ── Helpers ──────────────────────────────────────────────────────────────────

def signup(email: str, password: str, name: str = "Test User") -> dict:
    """Sign up and return {token, user}."""
    res = client.post("/auth/signup", json={"email": email, "password": password, "name": name})
    assert res.status_code == 200, f"Signup failed: {res.text}"
    return res.json()

def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

def create_bill(token: str, biller: str = "Test Biller", amount: float = 100.0) -> dict:
    res = client.post(
        "/bills",
        json={"biller": biller, "amount": amount, "dueDate": "Oct 01"},
        headers=auth_header(token),
    )
    assert res.status_code == 201, f"Create bill failed: {res.text}"
    return res.json()


# ── Acceptance Test 1: Sign up as user A ─────────────────────────────────────

def test_signup_shows_real_name_and_empty_bills():
    """AT1: Sign up as user A — header shows A's real name, bills list is empty."""
    data = signup("usera@test.com", "password1", "Alice Nair")

    assert data["user"]["name"] == "Alice Nair"
    assert data["user"]["email"] == "usera@test.com"
    assert "id" in data["user"]

    # Bills list should be empty for a fresh account
    res = client.get("/bills", headers=auth_header(data["token"]))
    assert res.status_code == 200
    assert res.json() == []


# ── Acceptance Test 2: Second user sees only their own bills ──────────────────

def test_two_users_see_only_their_own_bills():
    """AT2: Sign out, sign in as another user — only that user's bills are shown."""
    a = signup("user_a2@test.com", "passA", "User A2")
    b = signup("user_b2@test.com", "passB", "User B2")

    # A creates a bill
    bill_a = create_bill(a["token"], biller="A's Electricity", amount=999)

    # B creates a bill
    bill_b = create_bill(b["token"], biller="B's Netflix", amount=649)

    # A should only see their own bill
    res_a = client.get("/bills", headers=auth_header(a["token"]))
    billers_a = {b["biller"] for b in res_a.json()}
    assert "A's Electricity" in billers_a
    assert "B's Netflix" not in billers_a

    # B should only see their own bill
    res_b = client.get("/bills", headers=auth_header(b["token"]))
    billers_b = {b["biller"] for b in res_b.json()}
    assert "B's Netflix" in billers_b
    assert "A's Electricity" not in billers_b


# ── Acceptance Test 3 & 4: Unauthenticated requests to protected routes → 401 ─

def test_no_token_returns_401_on_protected_routes():
    """AT3 & AT4: Requests with no token to any protected route return 401."""
    assert client.get("/bills").status_code == 401
    assert client.post("/bills", json={"biller": "x", "amount": 1, "dueDate": "Oct 1"}).status_code == 401
    assert client.get("/reminders").status_code == 401
    assert client.post("/chat", json={"message": "hello"}).status_code == 401
    assert client.get("/auth/me").status_code == 401


def test_expired_or_bad_token_returns_401():
    """AT6: Requests with an invalid token return 401."""
    bad_header = {"Authorization": "Bearer this.is.not.a.valid.jwt"}
    assert client.get("/bills", headers=bad_header).status_code == 401
    assert client.get("/auth/me", headers=bad_header).status_code == 401


# ── Acceptance Test 5: Cross-user bill access returns 404 ────────────────────

def test_user_cannot_access_another_users_bill():
    """AT5: With user A's token, GET/PATCH/DELETE for user B's bill returns 404."""
    a = signup("user_a3@test.com", "passA3", "User A3")
    b = signup("user_b3@test.com", "passB3", "User B3")

    bill_b = create_bill(b["token"], biller="B's Private Bill")

    # A tries to GET B's bill
    res = client.get(f"/bills/{bill_b['id']}", headers=auth_header(a["token"]))
    assert res.status_code == 404, f"Expected 404 got {res.status_code}: {res.text}"

    # A tries to PATCH B's bill
    res = client.patch(
        f"/bills/{bill_b['id']}",
        json={"status": "paid"},
        headers=auth_header(a["token"]),
    )
    assert res.status_code == 404

    # A tries to DELETE B's bill
    res = client.delete(f"/bills/{bill_b['id']}", headers=auth_header(a["token"]))
    assert res.status_code == 404


# ── Acceptance Test 7: /test-mail is refused for non-admins ──────────────────

def test_test_mail_refuses_non_admin():
    """AT7: /test-mail returns 403 for a normal authenticated user."""
    user = signup("normaluser@test.com", "normalpass", "Normal User")
    res = client.post("/test-mail", headers=auth_header(user["token"]))
    assert res.status_code == 403

def test_mail_status_refuses_non_admin():
    """AT7b: /mail-status returns 403 for a normal authenticated user."""
    user = signup("normaluser2@test.com", "normalpass2", "Normal User 2")
    res = client.get("/mail-status", headers=auth_header(user["token"]))
    assert res.status_code == 403


# ── /auth/me returns the token owner ─────────────────────────────────────────

def test_auth_me_returns_correct_user():
    """/auth/me must reflect the token holder, not the first DB row."""
    a = signup("user_me_a@test.com", "passA", "Me User A")
    b = signup("user_me_b@test.com", "passB", "Me User B")

    res_a = client.get("/auth/me", headers=auth_header(a["token"]))
    assert res_a.status_code == 200
    assert res_a.json()["email"] == "user_me_a@test.com"

    res_b = client.get("/auth/me", headers=auth_header(b["token"]))
    assert res_b.status_code == 200
    assert res_b.json()["email"] == "user_me_b@test.com"


# ── Reminders are scoped to the current user's bills ─────────────────────────

def test_reminders_scoped_to_user():
    """Reminders endpoint only returns reminders for the current user's bills."""
    a = signup("user_rem_a@test.com", "passA", "Rem User A")
    b = signup("user_rem_b@test.com", "passB", "Rem User B")

    bill_b = create_bill(b["token"], biller="B's Reminder Bill")

    # Insert a reminder directly for B's bill in the DB (avoiding external SMTP/Gemini calls)
    from database import SessionLocal
    import models
    db = SessionLocal()
    try:
        rem_b = models.Reminder(
            bill_id=bill_b["id"],
            reminder_date="2026-09-22 09:00:00",
            status="sent",
            channel="in-app",
            message="Reminder for B's bill"
        )
        db.add(rem_b)
        db.commit()
    finally:
        db.close()

    # A's reminder list should be empty
    res_a = client.get("/reminders", headers=auth_header(a["token"]))
    assert res_a.status_code == 200
    assert res_a.json() == []

    # B's reminder list should have B's reminder
    res_b = client.get("/reminders", headers=auth_header(b["token"]))
    assert res_b.status_code == 200
    assert len(res_b.json()) == 1
    assert res_b.json()[0]["bill_id"] == bill_b["id"]


# ── Chat uses only the current user's bills ───────────────────────────────────

from unittest.mock import patch

def test_chat_scoped_to_user():
    """POST /chat returns a response grounded in only the current user's bills."""
    a = signup("user_chat_a@test.com", "passA", "Chat User A")
    with patch("agent.answer_query", return_value="You currently have 0 bills.") as mock_answer:
        res = client.post("/chat", json={"message": "What is my total?"}, headers=auth_header(a["token"]))
        assert res.status_code == 200
        assert res.json() == {"reply": "You currently have 0 bills."}
        # Verify agent was called with empty bills list for user A
        mock_answer.assert_called_once_with(user_query="What is my total?", bills=[])


# ── Cross-user reminder trigger returns 404 ───────────────────────────────────

def test_user_cannot_trigger_reminder_for_another_users_bill():
    """Triggering a reminder for another user's bill returns 404."""
    a = signup("user_trig_a@test.com", "passA", "Trig User A")
    b = signup("user_trig_b@test.com", "passB", "Trig User B")
    bill_b = create_bill(b["token"], biller="B's Private Trigger Bill")

    # A tries to trigger reminder on B's bill -> 404
    res = client.post(f"/bills/{bill_b['id']}/trigger-reminder", headers=auth_header(a["token"]))
    assert res.status_code == 404


# ── Public routes are still accessible without auth ──────────────────────────

def test_public_routes_accessible():
    """GET / and GET /health must not require auth."""
    assert client.get("/").status_code == 200
    assert client.get("/health").status_code == 200

