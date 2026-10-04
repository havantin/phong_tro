"""
Database connection and session management for FastAPI
Supports PostgreSQL on Supabase via DATABASE_URL
"""
import os
import re
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

def get_normalized_database_url() -> str:
    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        return "sqlite:///./phongtro_tn.db"
    
    match = re.match(r"(?:postgresql|postgres)(?:\+psycopg2)?://([^:]+):(.*)@([^@/:]+)(?::(\d+))?/(.+)", db_url)
    if match:
        user = match.group(1)
        raw_pwd = match.group(2)
        host = match.group(3)
        port = match.group(4) or "5432"
        dbname = match.group(5)

        if raw_pwd.startswith("[") and raw_pwd.endswith("]"):
            raw_pwd = raw_pwd[1:-1]
        
        encoded_pwd = urllib.parse.quote_plus(raw_pwd)
        encoded_user = urllib.parse.quote_plus(user)
        return f"postgresql+psycopg2://{encoded_user}:{encoded_pwd}@{host}:{port}/{dbname}"
    else:
        if db_url.startswith("postgresql://"):
            return "postgresql+psycopg2://" + db_url[len("postgresql://"):]
        elif db_url.startswith("postgres://"):
            return "postgresql+psycopg2://" + db_url[len("postgres://"):]
        return db_url

SQLALCHEMY_DATABASE_URL = get_normalized_database_url()

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
