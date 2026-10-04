"""
SQLAlchemy Models for PhongTro Thai Nguyen
Entities:
- users
- rooms
- room_images
- amenities
- room_amenities
- locations
- favorites
- reviews
- reports
- chat_sessions
- chat_messages
- room_views
- contacts
"""
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Text,
    DateTime,
    ForeignKey,
    Boolean,
    Table,
    Index,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# Many-to-many relationship table between Room and Amenity
room_amenity_association = Table(
    "room_amenities",
    Base.metadata,
    Column("room_id", String(64), ForeignKey("rooms.id", ondelete="CASCADE"), primary_key=True),
    Column("amenity_id", String(64), ForeignKey("amenities.id", ondelete="CASCADE"), primary_key=True),
)

class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=True)
    password_hash = Column(String(255), nullable=False)
    avatar = Column(String(255), nullable=True)
    role = Column(String(20), default="USER", nullable=False, index=True)  # USER, OWNER, ADMIN
    status = Column(String(20), default="active", nullable=False)  # active, locked
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    rooms = relationship("Room", back_populates="owner", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="user", cascade="all, delete-orphan")
    room_views = relationship("RoomView", back_populates="user", cascade="all, delete-orphan")
    contacts = relationship("Contact", back_populates="user", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")

class Location(Base):
    __tablename__ = "locations"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    short_name = Column(String(50), index=True, nullable=False)  # ICTU, TNUT, SEVT, etc.
    type = Column(String(50), nullable=False, index=True)  # university, college, hospital, industrial_zone, landmark
    address = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class Amenity(Base):
    __tablename__ = "amenities"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    icon = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    rooms = relationship("Room", secondary=room_amenity_association, back_populates="amenities")

class Room(Base):
    __tablename__ = "rooms"

    id = Column(String(64), primary_key=True, index=True)
    owner_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False, index=True)  # VND/tháng
    area = Column(Float, nullable=False, index=True)  # m2
    room_type = Column(String(50), default="tro_khep_kin", nullable=False, index=True)
    province = Column(String(50), default="Thái Nguyên", nullable=False, index=True)
    district = Column(String(100), default="TP. Thái Nguyên", nullable=False, index=True)
    ward = Column(String(100), nullable=False)
    street = Column(String(100), nullable=True)
    address = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    max_people = Column(Integer, default=2)
    gender_requirement = Column(String(20), default="all")  # all, male_only, female_only
    deposit = Column(Float, default=0)
    electricity_price = Column(Float, default=3500)
    water_price = Column(Float, default=25000)
    internet_price = Column(Float, default=80000)
    service_fee = Column(Float, default=0)
    status = Column(String(20), default="available", nullable=False, index=True)  # available, rented, pending, rejected, hidden
    view_count = Column(Integer, default=0)
    contact_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="rooms")
    amenities = relationship("Amenity", secondary=room_amenity_association, back_populates="rooms")
    images = relationship("RoomImage", back_populates="room", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="room", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="room", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="room", cascade="all, delete-orphan")
    views = relationship("RoomView", back_populates="room", cascade="all, delete-orphan")
    contacts = relationship("Contact", back_populates="room", cascade="all, delete-orphan")

class RoomImage(Base):
    __tablename__ = "room_images"

    id = Column(String(64), primary_key=True, index=True)
    room_id = Column(String(64), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    room = relationship("Room", back_populates="images")

class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    room_id = Column(String(64), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="favorites")
    room = relationship("Room", back_populates="favorites")

class Review(Base):
    __tablename__ = "reviews"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    room_id = Column(String(64), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="reviews")
    room = relationship("Room", back_populates="reviews")

class Report(Base):
    __tablename__ = "reports"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    room_id = Column(String(64), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    reason = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
    status = Column(String(20), default="pending", nullable=False, index=True)  # pending, resolved, dismissed
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="reports")
    room = relationship("Room", back_populates="reports")

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    context_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(64), primary_key=True, index=True)
    session_id = Column(String(64), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(String(20), nullable=False)  # user, bot
    text = Column(Text, nullable=False)
    structured_query_json = Column(Text, nullable=True)
    matched_rooms_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("ChatSession", back_populates="messages")

class RoomView(Base):
    __tablename__ = "room_views"

    id = Column(String(64), primary_key=True, index=True)
    room_id = Column(String(64), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    room = relationship("Room", back_populates="views")
    user = relationship("User", back_populates="room_views")

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(String(64), primary_key=True, index=True)
    room_id = Column(String(64), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    sender_name = Column(String(100), nullable=False)
    sender_phone = Column(String(20), nullable=False)
    sender_email = Column(String(100), nullable=True)
    message = Column(Text, nullable=False)
    status = Column(String(20), default="new", nullable=False, index=True)  # new, contacted, resolved
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    room = relationship("Room", back_populates="contacts")
    user = relationship("User", back_populates="contacts")
