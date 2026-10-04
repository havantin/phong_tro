"""
FastAPI Application Entry Point for PhongTro Thai Nguyen
Connected to PostgreSQL on Supabase via SQLAlchemy
"""
import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.database import get_db, engine
from app.models.models import (
    Base,
    User,
    Room,
    Location,
    Amenity,
    Review,
    Favorite,
    Report,
    Contact,
    RoomView,
)

# Initialize FastAPI app
app = FastAPI(
    title="PhongTro Thai Nguyen API",
    description="Hệ thống tìm kiếm phòng trọ thông minh tại Thái Nguyên ứng dụng AI Chatbot & PostgreSQL",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "app": "PhongTro Thai Nguyen API",
        "scope": "Tỉnh Thái Nguyên",
        "database": "PostgreSQL (Supabase)",
        "status": "online",
        "docs_url": "/docs",
    }

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        room_count = db.query(Room).count()
        user_count = db.query(User).count()
        return {
            "status": "healthy",
            "province": "Thái Nguyên",
            "db_connected": True,
            "total_rooms": room_count,
            "total_users": user_count,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/api/locations")
def get_locations(db: Session = Depends(get_db)):
    """Fetch all Thai Nguyen universities, colleges, hospitals, and industrial zones"""
    return db.query(Location).all()

@app.get("/api/amenities")
def get_amenities(db: Session = Depends(get_db)):
    """Fetch all room amenities"""
    return db.query(Amenity).all()

@app.get("/api/rooms")
def get_rooms(
    keyword: Optional[str] = None,
    ward: Optional[str] = None,
    room_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    status: str = "available",
    db: Session = Depends(get_db)
):
    """Search & filter rooms in Thai Nguyen"""
    query = db.query(Room).filter(Room.province == "Thái Nguyên")

    if status:
        query = query.filter(Room.status == status)

    if keyword:
        pattern = f"%{keyword}%"
        query = query.filter(
            or_(
                Room.title.ilike(pattern),
                Room.description.ilike(pattern),
                Room.address.ilike(pattern),
                Room.street.ilike(pattern),
                Room.ward.ilike(pattern),
            )
        )

    if ward:
        query = query.filter(Room.ward == ward)

    if room_type:
        query = query.filter(Room.room_type == room_type)

    if min_price is not None:
        query = query.filter(Room.price >= min_price)

    if max_price is not None:
        query = query.filter(Room.price <= max_price)

    rooms = query.order_by(desc(Room.created_at)).all()
    
    # Format with images and amenities
    result = []
    for r in rooms:
        result.append({
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "price": r.price,
            "area": r.area,
            "room_type": r.room_type,
            "province": r.province,
            "district": r.district,
            "ward": r.ward,
            "street": r.street,
            "address": r.address,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "max_people": r.max_people,
            "deposit": r.deposit,
            "status": r.status,
            "view_count": r.view_count,
            "contact_count": r.contact_count,
            "images": [img.url for img in r.images],
            "amenities": [a.code for a in r.amenities],
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return result

@app.get("/api/rooms/{room_id}")
def get_room_detail(room_id: str, db: Session = Depends(get_db)):
    """Get single room details"""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Phòng trọ không tồn tại")
    
    return {
        "id": room.id,
        "owner_id": room.owner_id,
        "owner_name": room.owner.full_name if room.owner else None,
        "owner_phone": room.owner.phone if room.owner else None,
        "title": room.title,
        "description": room.description,
        "price": room.price,
        "area": room.area,
        "room_type": room.room_type,
        "province": room.province,
        "district": room.district,
        "ward": room.ward,
        "street": room.street,
        "address": room.address,
        "latitude": room.latitude,
        "longitude": room.longitude,
        "max_people": room.max_people,
        "gender_requirement": room.gender_requirement,
        "deposit": room.deposit,
        "electricity_price": room.electricity_price,
        "water_price": room.water_price,
        "internet_price": room.internet_price,
        "service_fee": room.service_fee,
        "status": room.status,
        "images": [img.url for img in room.images],
        "amenities": [a.code for a in room.amenities],
        "reviews": [
            {
                "id": rev.id,
                "user_name": rev.user.full_name if rev.user else "Người dùng ẩn danh",
                "rating": rev.rating,
                "comment": rev.comment,
                "created_at": rev.created_at.isoformat() if rev.created_at else None,
            }
            for rev in room.reviews
        ],
        "created_at": room.created_at.isoformat() if room.created_at else None,
    }
