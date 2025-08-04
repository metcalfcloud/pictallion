"""
Database Management CLI

Command-line tool for managing database operations, migrations, and maintenance.
"""

import asyncio
import argparse
import sys
from pathlib import Path

# Add the app directory to Python path
sys.path.append(str(Path(__file__).parent))

from app.core.database import db_manager
from app.core.migrations import migration_manager, check_schema_compatibility
from app.core.db_utils import (
    get_database_stats, vacuum_database, analyze_database, 
    check_database_integrity, backup_database, restore_database
)


async def init_database():
    """Initialize database with migrations."""
    print("Initializing database...")
    success = await db_manager.initialize()
    if success:
        print("✅ Database initialized successfully")
    else:
        print("❌ Database initialization failed")
        return False
    return True


async def reset_database():
    """Reset database (drop and recreate all tables)."""
    print("⚠️  WARNING: This will delete all data!")
    confirm = input("Type 'yes' to confirm: ")
    if confirm.lower() != 'yes':
        print("Operation cancelled")
        return
    
    print("Resetting database...")
    await db_manager.reset()
    print("✅ Database reset completed")


async def check_status():
    """Check database and migration status."""
    print("Checking database status...")
    
    # Health check
    health = await db_manager.health_check()
    print(f"Database health: {health.get('database', 'unknown')}")
    print(f"Database type: {health.get('type', 'unknown')}")
    
    # Migration status
    status = await migration_manager.check_migration_status()
    print(f"Current revision: {status.get('current_revision', 'None')}")
    print(f"Head revision: {status.get('head_revision', 'None')}")
    print(f"Status: {status.get('status', 'Unknown')}")
    
    # Compatibility check
    compatibility = await check_schema_compatibility()
    print(f"Schema compatible: {compatibility.get('compatible', False)}")
    if compatibility.get('issues'):
        print("Issues found:")
        for issue in compatibility['issues']:
            print(f"  ❌ {issue}")
    if compatibility.get('warnings'):
        print("Warnings:")
        for warning in compatibility['warnings']:
            print(f"  ⚠️  {warning}")


async def show_stats():
    """Show database statistics."""
    print("Database Statistics:")
    stats = await get_database_stats()
    
    if 'error' in stats:
        print(f"❌ Error getting stats: {stats['error']}")
        return
    
    print(f"Database type: {stats.get('database_type', 'unknown')}")
    print(f"Database URL: {stats.get('database_url', 'unknown')}")
    
    print("\nTable counts:")
    for table, info in stats.get('tables', {}).items():
        count = info.get('count', 0)
        error = info.get('error')
        if error:
            print(f"  {table}: Error - {error}")
        else:
            print(f"  {table}: {count}")
    
    if 'file_version_tiers' in stats:
        print("\nFile version tiers:")
        for tier, count in stats['file_version_tiers'].items():
            print(f"  {tier}: {count}")
    
    if 'processing_states' in stats:
        print("\nProcessing states:")
        for state, count in stats['processing_states'].items():
            print(f"  {state}: {count}")


async def run_migrations():
    """Run pending migrations."""
    print("Running migrations...")
    success = migration_manager.upgrade_to_head()
    if success:
        print("✅ Migrations completed successfully")
    else:
        print("❌ Migration failed")


def create_migration():
    """Create a new migration."""
    message = input("Enter migration message: ").strip()
    if not message:
        print("Migration message is required")
        return
    
    autogenerate = input("Auto-generate migration? (y/n): ").lower() == 'y'
    
    print(f"Creating migration: {message}")
    success = migration_manager.create_migration(message, autogenerate=autogenerate)
    if success:
        print("✅ Migration created successfully")
    else:
        print("❌ Migration creation failed")


async def maintenance():
    """Run database maintenance tasks."""
    print("Running database maintenance...")
    
    try:
        print("- Vacuuming database...")
        await vacuum_database()
        
        print("- Analyzing database...")
        await analyze_database()
        
        print("✅ Maintenance completed successfully")
    except Exception as e:
        print(f"❌ Maintenance failed: {e}")


async def integrity_check():
    """Check database integrity."""
    print("Checking database integrity...")
    results = await check_database_integrity()
    
    print(f"Overall status: {results.get('status', 'unknown')}")
    print("Checks performed:")
    for check in results.get('checks', []):
        print(f"  {check}")


def backup():
    """Backup database."""
    backup_path = input("Enter backup file path: ").strip()
    if not backup_path:
        print("Backup path is required")
        return
    
    print(f"Creating backup: {backup_path}")
    success = asyncio.run(backup_database(backup_path))
    if success:
        print("✅ Backup created successfully")
    else:
        print("❌ Backup failed")


def restore():
    """Restore database from backup."""
    backup_path = input("Enter backup file path: ").strip()
    if not backup_path:
        print("Backup path is required")
        return
    
    print("⚠️  WARNING: This will overwrite the current database!")
    confirm = input("Type 'yes' to confirm: ")
    if confirm.lower() != 'yes':
        print("Operation cancelled")
        return
    
    print(f"Restoring from backup: {backup_path}")
    success = asyncio.run(restore_database(backup_path))
    if success:
        print("✅ Database restored successfully")
    else:
        print("❌ Restore failed")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description="Database Management CLI")
    parser.add_argument('command', choices=[
        'init', 'reset', 'status', 'stats', 'migrate', 'create-migration',
        'maintenance', 'integrity', 'backup', 'restore'
    ], help='Command to execute')
    
    args = parser.parse_args()
    
    try:
        if args.command == 'init':
            asyncio.run(init_database())
        elif args.command == 'reset':
            asyncio.run(reset_database())
        elif args.command == 'status':
            asyncio.run(check_status())
        elif args.command == 'stats':
            asyncio.run(show_stats())
        elif args.command == 'migrate':
            asyncio.run(run_migrations())
        elif args.command == 'create-migration':
            create_migration()
        elif args.command == 'maintenance':
            asyncio.run(maintenance())
        elif args.command == 'integrity':
            asyncio.run(integrity_check())
        elif args.command == 'backup':
            backup()
        elif args.command == 'restore':
            restore()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()