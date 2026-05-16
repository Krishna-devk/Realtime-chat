import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Text, DateTime, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

# Helper to generate UUID strings
def generate_uuid():
    return str(uuid.uuid4())

# Association table for room members
room_members = Table(
    "room_members",
    Base.metadata,
    Column("room_id", String(36), ForeignKey("chat_rooms.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("joined_at", DateTime(timezone=True), server_default=func.now())
)

class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=True)
    bio = Column(String(255), nullable=True)
    avatar_url = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    rooms = relationship("ChatRoom", secondary=room_members, back_populates="members")
    messages = relationship("Message", back_populates="sender")

class ChatRoom(Base):
    __tablename__ = "chat_rooms"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=True)
    is_group = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    members = relationship("User", secondary=room_members, back_populates="rooms")
    messages = relationship("Message", back_populates="room", order_by="Message.created_at")

class Message(Base):
    __tablename__ = "messages"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    client_msg_id = Column(String(36), unique=True, nullable=False, index=True)
    room_id = Column(String(36), ForeignKey("chat_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    room = relationship("ChatRoom", back_populates="messages")
    sender = relationship("User", back_populates="messages")
