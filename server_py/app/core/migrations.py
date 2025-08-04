"""
Migration Management

Utilities for managing database migrations programmatically.
Provides functions to run migrations, check status, and manage schema versions.
"""

import logging
import asyncio
from typing import Dict, Any, List, Optional
from pathlib import Path
import subprocess
import sys

from alembic.config import Config
from alembic import command
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import text

from app.core.config import settings
from app.core.database import async_engine, get_async_session

logger = logging.getLogger(__name__)


class MigrationManager:
    """Manages database migrations using Alembic."""
    
    def __init__(self):
        # Get the path to alembic.ini
        self.alembic_cfg_path = Path(__file__).parent.parent.parent / "alembic.ini"
        self.alembic_cfg = Config(str(self.alembic_cfg_path))
        
        # Set the database URL in the config
        self.alembic_cfg.set_main_option("sqlalchemy.url", settings.get_database_url())
    
    async def get_current_revision(self) -> Optional[str]:
        """Get the current database revision."""
        try:
            async with async_engine.connect() as connection:
                def get_revision(conn):
                    context = MigrationContext.configure(conn)
                    return context.get_current_revision()
                
                revision = await connection.run_sync(get_revision)
                return revision
        except Exception as e:
            logger.error(f"Error getting current revision: {e}")
            return None
    
    async def get_head_revision(self) -> Optional[str]:
        """Get the head (latest) revision from migration scripts."""
        try:
            script_dir = ScriptDirectory.from_config(self.alembic_cfg)
            return script_dir.get_current_head()
        except Exception as e:
            logger.error(f"Error getting head revision: {e}")
            return None
    
    async def get_migration_history(self) -> List[Dict[str, Any]]:
        """Get the migration history."""
        try:
            script_dir = ScriptDirectory.from_config(self.alembic_cfg)
            revisions = []
            
            for revision in script_dir.walk_revisions():
                revisions.append({
                    "revision": revision.revision,
                    "down_revision": revision.down_revision,
                    "description": revision.doc,
                    "create_date": getattr(revision, 'create_date', None)
                })
            
            return revisions
        except Exception as e:
            logger.error(f"Error getting migration history: {e}")
            return []
    
    def upgrade_to_head(self) -> bool:
        """Upgrade database to the latest revision."""
        try:
            command.upgrade(self.alembic_cfg, "head")
            logger.info("Database upgraded to head revision")
            return True
        except Exception as e:
            logger.error(f"Error upgrading database: {e}")
            return False
    
    def upgrade_to_revision(self, revision: str) -> bool:
        """Upgrade database to a specific revision."""
        try:
            command.upgrade(self.alembic_cfg, revision)
            logger.info(f"Database upgraded to revision {revision}")
            return True
        except Exception as e:
            logger.error(f"Error upgrading to revision {revision}: {e}")
            return False
    
    def downgrade_to_revision(self, revision: str) -> bool:
        """Downgrade database to a specific revision."""
        try:
            command.downgrade(self.alembic_cfg, revision)
            logger.info(f"Database downgraded to revision {revision}")
            return True
        except Exception as e:
            logger.error(f"Error downgrading to revision {revision}: {e}")
            return False
    
    def create_migration(self, message: str, autogenerate: bool = True) -> bool:
        """Create a new migration."""
        try:
            if autogenerate:
                command.revision(self.alembic_cfg, message=message, autogenerate=True)
            else:
                command.revision(self.alembic_cfg, message=message)
            logger.info(f"Migration created: {message}")
            return True
        except Exception as e:
            logger.error(f"Error creating migration: {e}")
            return False
    
    async def check_migration_status(self) -> Dict[str, Any]:
        """Check the current migration status."""
        current = await self.get_current_revision()
        head = await self.get_head_revision()
        
        status = {
            "current_revision": current,
            "head_revision": head,
            "is_up_to_date": current == head,
            "needs_upgrade": current != head and head is not None
        }
        
        if current is None:
            status["status"] = "No migrations applied"
        elif current == head:
            status["status"] = "Up to date"
        else:
            status["status"] = "Migrations pending"
        
        return status
    
    async def ensure_migration_table_exists(self) -> bool:
        """Ensure the Alembic version table exists."""
        try:
            async with get_async_session() as session:
                # Check if alembic_version table exists
                if settings.is_sqlite:
                    query = """
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name='alembic_version'
                    """
                else:
                    query = """
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_name='alembic_version'
                    """
                
                result = await session.execute(text(query))
                exists = result.fetchone() is not None
                
                if not exists:
                    # Create the version table
                    command.stamp(self.alembic_cfg, "head")
                    logger.info("Alembic version table created")
                
                return True
        except Exception as e:
            logger.error(f"Error ensuring migration table exists: {e}")
            return False
    
    async def reset_database(self) -> bool:
        """Reset database by downgrading to base and upgrading to head."""
        try:
            # Downgrade to base
            command.downgrade(self.alembic_cfg, "base")
            logger.info("Database downgraded to base")
            
            # Upgrade to head
            command.upgrade(self.alembic_cfg, "head")
            logger.info("Database upgraded to head")
            
            return True
        except Exception as e:
            logger.error(f"Error resetting database: {e}")
            return False


# Global migration manager instance
migration_manager = MigrationManager()


async def initialize_database():
    """
    Initialize database with migrations.
    
    This function should be called during application startup to ensure
    the database schema is up to date.
    """
    try:
        logger.info("Initializing database...")
        
        # Ensure migration table exists
        await migration_manager.ensure_migration_table_exists()
        
        # Check migration status
        status = await migration_manager.check_migration_status()
        logger.info(f"Migration status: {status}")
        
        # Apply pending migrations if needed
        if status["needs_upgrade"]:
            logger.info("Applying pending migrations...")
            success = migration_manager.upgrade_to_head()
            if success:
                logger.info("Database migrations applied successfully")
            else:
                logger.error("Failed to apply migrations")
                return False
        
        logger.info("Database initialization completed")
        return True
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        return False


async def check_schema_compatibility() -> Dict[str, Any]:
    """
    Check if the current database schema is compatible with the TypeScript backend.
    
    Returns:
        Dictionary with compatibility check results
    """
    compatibility = {
        "compatible": True,
        "issues": [],
        "warnings": []
    }
    
    try:
        async with get_async_session() as session:
            # Check for required tables
            required_tables = [
                "users", "media_assets", "file_versions", "asset_history",
                "collections", "collection_photos", "people", "faces",
                "settings", "ai_prompts", "events", "global_tag_library",
                "relationships", "locations"
            ]
            
            for table in required_tables:
                if settings.is_sqlite:
                    query = f"""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name='{table}'
                    """
                else:
                    query = f"""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_name='{table}'
                    """
                
                result = await session.execute(text(query))
                exists = result.fetchone() is not None
                
                if not exists:
                    compatibility["compatible"] = False
                    compatibility["issues"].append(f"Missing required table: {table}")
            
            # Check for required columns in key tables
            key_columns = {
                "media_assets": ["id", "original_filename", "created_at"],
                "file_versions": ["id", "media_asset_id", "tier", "file_path", "file_hash"],
                "people": ["id", "name", "face_count"],
                "faces": ["id", "photo_id", "person_id", "bounding_box", "confidence"]
            }
            
            for table, columns in key_columns.items():
                if settings.is_sqlite:
                    result = await session.execute(text(f"PRAGMA table_info({table})"))
                    existing_columns = [row[1] for row in result.fetchall()]
                else:
                    query = f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name='{table}'
                    """
                    result = await session.execute(text(query))
                    existing_columns = [row[0] for row in result.fetchall()]
                
                for column in columns:
                    if column not in existing_columns:
                        compatibility["compatible"] = False
                        compatibility["issues"].append(f"Missing column {column} in table {table}")
            
            # Check current migration status
            status = await migration_manager.check_migration_status()
            if not status["is_up_to_date"]:
                compatibility["warnings"].append("Database migrations are not up to date")
            
    except Exception as e:
        compatibility["compatible"] = False
        compatibility["issues"].append(f"Error checking schema compatibility: {e}")
        logger.error(f"Schema compatibility check failed: {e}")
    
    return compatibility


# Export main functions
__all__ = [
    "MigrationManager",
    "migration_manager",
    "initialize_database",
    "check_schema_compatibility"
]