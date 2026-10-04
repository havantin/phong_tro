from logging.config import fileConfig
import os
import sys
import re
import urllib.parse
from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.models import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def get_normalized_database_url() -> str:
    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        raise ValueError("DATABASE_URL is not set in environment variables.")
    
    # If the user copied [password] with square brackets or special characters like @ in password,
    # let's parse and clean it safely
    # Example: postgresql://postgres:[Tinha672005@]@db.ubvitrnokzanjxeydhxt.supabase.co:5432/postgres
    # or postgresql://postgres:Tinha672005@@db...
    match = re.match(r"(?:postgresql|postgres)(?:\+psycopg2)?://([^:]+):(.*)@([^@/:]+)(?::(\d+))?/(.+)", db_url)
    if match:
        user = match.group(1)
        raw_pwd = match.group(2)
        host = match.group(3)
        port = match.group(4) or "5432"
        dbname = match.group(5)

        # Strip enclosing square brackets if user left them in from [YOUR-PASSWORD]
        if raw_pwd.startswith("[") and raw_pwd.endswith("]"):
            raw_pwd = raw_pwd[1:-1]
        
        encoded_pwd = urllib.parse.quote_plus(raw_pwd)
        encoded_user = urllib.parse.quote_plus(user)
        db_url = f"postgresql+psycopg2://{encoded_user}:{encoded_pwd}@{host}:{port}/{dbname}"
    else:
        if db_url.startswith("postgresql://"):
            db_url = "postgresql+psycopg2://" + db_url[len("postgresql://"):]
        elif db_url.startswith("postgres://"):
            db_url = "postgresql+psycopg2://" + db_url[len("postgres://"):]

    return db_url

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_normalized_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_normalized_database_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
