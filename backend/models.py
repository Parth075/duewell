from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, default="")
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    bills = relationship("Bill", back_populates="user")

class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    biller = Column(String, nullable=False)
    category = Column(String, default="Other")
    amount = Column(Float, nullable=False)
    dueDate = Column(String, nullable=False) # e.g. "Sep 21" or "2026-09-21"
    status = Column(String, default="due-soon") # "overdue" | "due-soon" | "paid"
    initials = Column(String, default="BL")
    accent = Column(String, default="#485cc7")
    account = Column(String, default="•••• 0000")
    autopay = Column(Boolean, default=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="bills")
    reminders = relationship("Reminder", back_populates="bill", cascade="all, delete-orphan")

class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    reminder_date = Column(String, nullable=False)
    status = Column(String, default="scheduled") # "scheduled" | "sent"
    channel = Column(String, default="in-app") # "email" | "in-app"
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    bill = relationship("Bill", back_populates="reminders")
