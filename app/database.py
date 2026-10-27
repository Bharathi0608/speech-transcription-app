import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DEFAULT_PG_URL, SQLITE_FALLBACK_URL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("speech_to_text.db")

Base = declarative_base()

ACTIVE_DB_TYPE = "unknown"
ACTIVE_DB_URL = ""
engine = None
SessionLocal = None

def initialize_database_engine():
    global engine, SessionLocal, ACTIVE_DB_TYPE, ACTIVE_DB_URL

    # Try PostgreSQL first
    try:
        logger.info(f"Connecting to PostgreSQL at {DEFAULT_PG_URL.split('@')[-1]}...")
        pg_engine = create_engine(
            DEFAULT_PG_URL,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 3}
        )
        # Test connection using text query
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine = pg_engine
        ACTIVE_DB_TYPE = "PostgreSQL"
        ACTIVE_DB_URL = DEFAULT_PG_URL
        logger.info("Successfully connected to PostgreSQL database!")
    except Exception as e:
        logger.warning(f"PostgreSQL connection failed ({e}). Falling back seamlessly to SQLite database...")
        try:
            sqlite_engine = create_engine(
                SQLITE_FALLBACK_URL,
                connect_args={"check_same_thread": False}
            )
            with sqlite_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            engine = sqlite_engine
            ACTIVE_DB_TYPE = "SQLite (Resilient Fallback)"
            ACTIVE_DB_URL = SQLITE_FALLBACK_URL
            logger.info("Successfully initialized SQLite database!")
        except Exception as sqle:
            logger.error(f"Failed to initialize SQLite fallback: {sqle}")
            raise sqle

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

initialize_database_engine()

def get_db():
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Create tables if they don't exist."""
    import app.models  # Ensures models are registered on Base.metadata
    Base.metadata.create_all(bind=engine)
    logger.info(f"Database tables verified and initialized on {ACTIVE_DB_TYPE}.")

def get_db_info():
    """Return runtime database status."""
    sanitized_url = ACTIVE_DB_URL
    if "@" in sanitized_url:
        prefix, host_part = sanitized_url.split("@", 1)
        scheme_user = prefix.split(":", 1)[0]
        sanitized_url = f"{scheme_user}:****@{host_part}"
    return {
        "db_type": ACTIVE_DB_TYPE,
        "connection_url": sanitized_url,
        "status": "healthy"
    }
