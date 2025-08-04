"""
Database Utilities

Utility functions for database operations, transactions, and maintenance.
"""

import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.database import async_engine, get_async_session
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@asynccontextmanager
async def get_db_transaction():
    """
    Database transaction context manager.

    Provides automatic transaction management with rollback on exceptions.
    """
    async with get_async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database transaction error: {e}")
            raise
        finally:
            await session.close()


async def execute_raw_sql(query: str, params: Dict[str, Any] = None) -> Any:
    """
    Execute raw SQL query.

    Args:
        query: SQL query string
        params: Query parameters

    Returns:
        Query result
    """
    async with get_async_session() as session:
        try:
            result = await session.execute(text(query), params or {})
            await session.commit()
            return result
        except Exception as e:
            await session.rollback()
            logger.error(f"Raw SQL execution error: {e}")
            raise


async def get_table_info() -> Dict[str, Any]:
    """
    Get information about all database tables.

    Returns:
        Dictionary with table information
    """
    try:
        async with async_engine.connect() as conn:
            # Get table names
            def get_tables(connection):
                inspector = inspect(connection)
                return inspector.get_table_names()

            tables = await conn.run_sync(get_tables)

            table_info = {}
            for table in tables:

                def get_table_details(connection):
                    inspector = inspect(connection)
                    columns = inspector.get_columns(table)
                    indexes = inspector.get_indexes(table)
                    foreign_keys = inspector.get_foreign_keys(table)
                    return {
                        "columns": columns,
                        "indexes": indexes,
                        "foreign_keys": foreign_keys,
                    }

                table_info[table] = await conn.run_sync(get_table_details)

            return table_info
    except Exception as e:
        logger.error(f"Error getting table info: {e}")
        return {}


async def get_database_stats() -> Dict[str, Any]:
    """
    Get comprehensive database statistics.

    Returns:
        Dictionary with database statistics
    """
    stats = {
        "database_type": settings.db_type,
        "database_url": (
            settings.database_url.split("@")[-1]
            if "@" in settings.database_url
            else "local"
        ),
        "tables": {},
    }

    try:
        async with get_async_session() as session:
            # Get table row counts
            table_queries = {
                "users": "SELECT COUNT(*) FROM users",
                "media_assets": "SELECT COUNT(*) FROM media_assets",
                "file_versions": "SELECT COUNT(*) FROM file_versions",
                "people": "SELECT COUNT(*) FROM people",
                "faces": "SELECT COUNT(*) FROM faces",
                "collections": "SELECT COUNT(*) FROM collections",
                "settings": "SELECT COUNT(*) FROM settings",
                "events": "SELECT COUNT(*) FROM events",
                "locations": "SELECT COUNT(*) FROM locations",
            }

            for table, query in table_queries.items():
                try:
                    result = await session.execute(text(query))
                    count = result.scalar()
                    stats["tables"][table] = {"count": count}
                except Exception as e:
                    logger.warning(f"Could not get count for table {table}: {e}")
                    stats["tables"][table] = {"count": 0, "error": str(e)}

            # Get additional stats
            try:
                # Get file version tier distribution
                tier_query = """
                SELECT tier, COUNT(*) as count 
                FROM file_versions 
                GROUP BY tier
                """
                result = await session.execute(text(tier_query))
                tier_stats = {row[0]: row[1] for row in result.fetchall()}
                stats["file_version_tiers"] = tier_stats
            except Exception as e:
                logger.warning(f"Could not get tier statistics: {e}")

            try:
                # Get processing state distribution
                state_query = """
                SELECT processing_state, COUNT(*) as count 
                FROM file_versions 
                GROUP BY processing_state
                """
                result = await session.execute(text(state_query))
                state_stats = {row[0]: row[1] for row in result.fetchall()}
                stats["processing_states"] = state_stats
            except Exception as e:
                logger.warning(f"Could not get processing state statistics: {e}")

    except Exception as e:
        logger.error(f"Error getting database statistics: {e}")
        stats["error"] = str(e)

    return stats


async def vacuum_database():
    """
    Perform database maintenance (SQLite VACUUM or PostgreSQL equivalent).
    """
    try:
        if settings.is_sqlite:
            async with get_async_session() as session:
                await session.execute(text("VACUUM"))
                await session.commit()
                logger.info("SQLite database vacuumed successfully")
        elif settings.is_postgres:
            # PostgreSQL VACUUM cannot be run in a transaction
            async with async_engine.connect() as conn:
                await conn.execute(text("VACUUM"))
                logger.info("PostgreSQL database vacuumed successfully")
    except Exception as e:
        logger.error(f"Error vacuuming database: {e}")
        raise


async def analyze_database():
    """
    Analyze database for query optimization (update statistics).
    """
    try:
        if settings.is_sqlite:
            async with get_async_session() as session:
                await session.execute(text("ANALYZE"))
                await session.commit()
                logger.info("SQLite database analyzed successfully")
        elif settings.is_postgres:
            async with async_engine.connect() as conn:
                await conn.execute(text("ANALYZE"))
                logger.info("PostgreSQL database analyzed successfully")
    except Exception as e:
        logger.error(f"Error analyzing database: {e}")
        raise


async def check_database_integrity() -> Dict[str, Any]:
    """
    Check database integrity and return results.

    Returns:
        Dictionary with integrity check results
    """
    results = {"status": "unknown", "checks": []}

    try:
        async with get_async_session() as session:
            if settings.is_sqlite:
                # SQLite integrity check
                result = await session.execute(text("PRAGMA integrity_check"))
                integrity_result = result.fetchone()
                if integrity_result and integrity_result[0] == "ok":
                    results["status"] = "healthy"
                    results["checks"].append("SQLite integrity check: PASSED")
                else:
                    results["status"] = "error"
                    results["checks"].append(
                        f"SQLite integrity check: FAILED - {integrity_result}"
                    )

                # Check foreign key constraints
                result = await session.execute(text("PRAGMA foreign_key_check"))
                fk_violations = result.fetchall()
                if not fk_violations:
                    results["checks"].append("Foreign key constraints: PASSED")
                else:
                    results["status"] = "error"
                    results["checks"].append(
                        f"Foreign key violations found: {len(fk_violations)}"
                    )

            elif settings.is_postgres:
                # PostgreSQL doesn't have a simple integrity check
                # We'll do basic connectivity and constraint checks
                await session.execute(text("SELECT 1"))
                results["status"] = "healthy"
                results["checks"].append("PostgreSQL connectivity: PASSED")

                # Check for constraint violations (simplified)
                try:
                    # This is a basic check - in production you'd want more comprehensive checks
                    await session.execute(
                        text("SELECT COUNT(*) FROM information_schema.tables")
                    )
                    results["checks"].append("Schema accessibility: PASSED")
                except Exception as e:
                    results["status"] = "error"
                    results["checks"].append(f"Schema check: FAILED - {e}")

    except Exception as e:
        results["status"] = "error"
        results["checks"].append(f"Database integrity check failed: {e}")
        logger.error(f"Database integrity check error: {e}")

    return results


async def backup_database(backup_path: str) -> bool:
    """
    Create a database backup (SQLite only for now).

    Args:
        backup_path: Path to backup file

    Returns:
        True if backup successful, False otherwise
    """
    try:
        if settings.is_sqlite:
            import os
            import shutil

            # Get the source database path
            db_path = settings.database_url.replace("sqlite:///", "").replace(
                "sqlite://", ""
            )

            if os.path.exists(db_path):
                # Create backup directory if it doesn't exist
                os.makedirs(os.path.dirname(backup_path), exist_ok=True)

                # Copy database file
                shutil.copy2(db_path, backup_path)
                logger.info(f"Database backed up to {backup_path}")
                return True
            else:
                logger.error(f"Source database not found: {db_path}")
                return False
        else:
            logger.warning("Database backup not implemented for PostgreSQL")
            return False

    except Exception as e:
        logger.error(f"Database backup failed: {e}")
        return False


async def restore_database(backup_path: str) -> bool:
    """
    Restore database from backup (SQLite only for now).

    Args:
        backup_path: Path to backup file

    Returns:
        True if restore successful, False otherwise
    """
    try:
        if settings.is_sqlite:
            import os
            import shutil

            if not os.path.exists(backup_path):
                logger.error(f"Backup file not found: {backup_path}")
                return False

            # Get the target database path
            db_path = settings.database_url.replace("sqlite:///", "").replace(
                "sqlite://", ""
            )

            # Close any existing connections
            await async_engine.dispose()

            # Restore database file
            shutil.copy2(backup_path, db_path)
            logger.info(f"Database restored from {backup_path}")
            return True
        else:
            logger.warning("Database restore not implemented for PostgreSQL")
            return False

    except Exception as e:
        logger.error(f"Database restore failed: {e}")
        return False


# Export commonly used functions
__all__ = [
    "get_db_transaction",
    "execute_raw_sql",
    "get_table_info",
    "get_database_stats",
    "vacuum_database",
    "analyze_database",
    "check_database_integrity",
    "backup_database",
    "restore_database",
]
