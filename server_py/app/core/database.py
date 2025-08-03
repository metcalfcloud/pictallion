"""
Database Configuration and Connection Management

Handles SQLModel/SQLAlchemy async database connections with support for
both SQLite (development) and PostgreSQL (production) databases.
"""

import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel, create_engine
from sqlalchemy import event
from sqlalchemy.engine import Engine

from app.core.config import settings

logger = logging.getLogger(__name__)

# Create async engine based on database type
if settings.is_sqlite:
    # SQLite configuration with async support
    async_engine = create_async_engine(
        settings.get_database_url(),
        echo=settings.is_development,
        future=True,
        connect_args={"check_same_thread": False}
    )
    
    # Enable foreign key constraints for SQLite
    @event.listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

elif settings.is_postgres:
    # PostgreSQL configuration
    async_engine = create_async_engine(
        settings.get_database_url(),
        echo=settings.is_development,
        future=True,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600
    )
else:
    raise ValueError(f"Unsupported database type: {settings.db_type}")

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function to get async database session.
    
    Yields:
        AsyncSession: Database session for async operations
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Database session error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_db_and_tables():
    """
    Create database tables using SQLModel metadata.
    
    This function should be called during application startup to ensure
    all tables are created before the application starts handling requests.
    """
    try:
        async with async_engine.begin() as conn:
            # Import all models to ensure they are registered with SQLModel
            from app.models import (
                User, MediaAsset, FileVersion, AssetHistory, Collection,
                CollectionPhoto, Person, Face, Setting, AIPrompt, Event,
                GlobalTagLibrary, Relationship, Location
            )
            
            # Create all tables
            await conn.run_sync(SQLModel.metadata.create_all)
            logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise


async def drop_db_and_tables():
    """
    Drop all database tables.
    
    WARNING: This will delete all data. Use only for testing or reset scenarios.
    """
    try:
        async with async_engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.drop_all)
            logger.warning("All database tables dropped")
    except Exception as e:
        logger.error(f"Error dropping database tables: {e}")
        raise


async def check_database_connection() -> bool:
    """
    Check if database connection is working.
    
    Returns:
        bool: True if connection is successful, False otherwise
    """
    try:
        async with AsyncSessionLocal() as session:
            # Simple query to test connection
            result = await session.execute("SELECT 1")
            result.fetchone()
            logger.info("Database connection successful")
            return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False


class DatabaseManager:
    """
    Database manager for handling migrations and database operations.
    """
    
    def __init__(self):
        self.engine = async_engine
        self.session_factory = AsyncSessionLocal
    
    async def initialize(self):
        """Initialize database with migrations."""
        from app.core.migrations import initialize_database
        return await initialize_database()
    
    async def reset(self):
        """Reset database by dropping and recreating all tables."""
        await drop_db_and_tables()
        await create_db_and_tables()
    
    async def health_check(self) -> dict:
        """
        Perform database health check.
        
        Returns:
            dict: Health check results
        """
        try:
            connection_ok = await check_database_connection()
            return {
                "database": "healthy" if connection_ok else "unhealthy",
                "type": settings.db_type,
                "url": settings.database_url.split("@")[-1] if "@" in settings.database_url else "local"
            }
        except Exception as e:
            return {
                "database": "unhealthy",
                "error": str(e),
                "type": settings.db_type
            }
    
    async def get_stats(self) -> dict:
        """
        Get database statistics.
        
        Returns:
            dict: Database statistics
        """
        try:
            from app.core.db_utils import get_database_stats
            return await get_database_stats()
        except Exception as e:
            logger.error(f"Error getting database stats: {e}")
            return {"error": str(e)}
    
    async def check_compatibility(self) -> dict:
        """
        Check schema compatibility with TypeScript backend.
        
        Returns:
            dict: Compatibility check results
        """
        try:
            from app.core.migrations import check_schema_compatibility
            return await check_schema_compatibility()
        except Exception as e:
            logger.error(f"Error checking compatibility: {e}")
            return {"compatible": False, "error": str(e)}


# Global database manager instance
db_manager = DatabaseManager()


# Dependency for FastAPI
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for getting database session.
    
    Yields:
        AsyncSession: Database session
    """
    async for session in get_async_session():
        yield session