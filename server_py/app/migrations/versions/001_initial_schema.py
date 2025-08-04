"""Initial schema matching TypeScript backend

Revision ID: 001
Revises:
Create Date: 2025-08-03 12:30:00.000000

"""

import sqlalchemy as sa
import sqlmodel
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        "users",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("username", sa.TEXT(), nullable=False),
        sa.Column("password", sa.TEXT(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    # Create media_assets table
    op.create_table(
        "media_assets",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("original_filename", sa.TEXT(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create file_versions table
    op.create_table(
        "file_versions",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("media_asset_id", sa.VARCHAR(), nullable=False),
        sa.Column("tier", sa.TEXT(), nullable=False),
        sa.Column("file_path", sa.TEXT(), nullable=False),
        sa.Column("file_hash", sa.TEXT(), nullable=False),
        sa.Column("file_size", sa.INTEGER(), nullable=False),
        sa.Column("mime_type", sa.TEXT(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_reviewed", sa.BOOLEAN(), nullable=True, server_default="false"),
        sa.Column("rating", sa.INTEGER(), nullable=True, server_default="0"),
        sa.Column(
            "keywords",
            postgresql.ARRAY(sa.String()),
            nullable=True,
            server_default="'{}'",
        ),
        sa.Column("location", sa.TEXT(), nullable=True),
        sa.Column("event_type", sa.TEXT(), nullable=True),
        sa.Column("event_name", sa.TEXT(), nullable=True),
        sa.Column("perceptual_hash", sa.TEXT(), nullable=True),
        sa.Column("ai_short_description", sa.TEXT(), nullable=True),
        sa.Column(
            "processing_state", sa.TEXT(), nullable=True, server_default="'processed'"
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(
            ["media_asset_id"],
            ["media_assets.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create asset_history table
    op.create_table(
        "asset_history",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("media_asset_id", sa.VARCHAR(), nullable=False),
        sa.Column("action", sa.TEXT(), nullable=False),
        sa.Column("details", sa.TEXT(), nullable=True),
        sa.Column(
            "timestamp", sa.TIMESTAMP(), nullable=False, server_default=sa.text("NOW()")
        ),
        sa.ForeignKeyConstraint(
            ["media_asset_id"],
            ["media_assets.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create collections table
    op.create_table(
        "collections",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.TEXT(), nullable=False),
        sa.Column("description", sa.TEXT(), nullable=True),
        sa.Column("is_public", sa.BOOLEAN(), nullable=True, server_default="false"),
        sa.Column("cover_photo", sa.TEXT(), nullable=True),
        sa.Column(
            "is_smart_collection", sa.BOOLEAN(), nullable=True, server_default="false"
        ),
        sa.Column(
            "smart_rules", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create people table
    op.create_table(
        "people",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.TEXT(), nullable=False),
        sa.Column("notes", sa.TEXT(), nullable=True),
        sa.Column("birthdate", sa.TIMESTAMP(), nullable=True),
        sa.Column("face_count", sa.INTEGER(), nullable=True, server_default="0"),
        sa.Column("representative_face", sa.TEXT(), nullable=True),
        sa.Column("selected_thumbnail_face_id", sa.TEXT(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create settings table
    op.create_table(
        "settings",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("key", sa.TEXT(), nullable=False),
        sa.Column("value", sa.TEXT(), nullable=False),
        sa.Column("category", sa.TEXT(), nullable=False, server_default="'general'"),
        sa.Column("description", sa.TEXT(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_settings_key"), "settings", ["key"], unique=True)

    # Create ai_prompts table
    op.create_table(
        "ai_prompts",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.TEXT(), nullable=False),
        sa.Column("description", sa.TEXT(), nullable=True),
        sa.Column("category", sa.TEXT(), nullable=False),
        sa.Column("provider", sa.TEXT(), nullable=False),
        sa.Column("system_prompt", sa.TEXT(), nullable=False),
        sa.Column("user_prompt", sa.TEXT(), nullable=False),
        sa.Column("is_default", sa.BOOLEAN(), nullable=True, server_default="false"),
        sa.Column("is_active", sa.BOOLEAN(), nullable=True, server_default="true"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create locations table
    op.create_table(
        "locations",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.TEXT(), nullable=False),
        sa.Column("description", sa.TEXT(), nullable=True),
        sa.Column("latitude", sa.TEXT(), nullable=False),
        sa.Column("longitude", sa.TEXT(), nullable=False),
        sa.Column("radius", sa.INTEGER(), nullable=True, server_default="100"),
        sa.Column(
            "is_user_defined", sa.BOOLEAN(), nullable=True, server_default="false"
        ),
        sa.Column("photo_count", sa.INTEGER(), nullable=True, server_default="0"),
        sa.Column("place_name", sa.TEXT(), nullable=True),
        sa.Column("place_type", sa.TEXT(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create global_tag_library table
    op.create_table(
        "global_tag_library",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("tag", sa.TEXT(), nullable=False),
        sa.Column("usage_count", sa.INTEGER(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_global_tag_library_tag"), "global_tag_library", ["tag"], unique=True
    )
    op.create_index(
        "idx_global_tag_library_usage",
        "global_tag_library",
        ["usage_count"],
        postgresql_using="btree",
    )

    # Create collection_photos table
    op.create_table(
        "collection_photos",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("collection_id", sa.VARCHAR(), nullable=False),
        sa.Column("photo_id", sa.VARCHAR(), nullable=False),
        sa.Column(
            "added_at", sa.TIMESTAMP(), nullable=False, server_default=sa.text("NOW()")
        ),
        sa.ForeignKeyConstraint(
            ["collection_id"],
            ["collections.id"],
        ),
        sa.ForeignKeyConstraint(
            ["photo_id"],
            ["file_versions.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create events table
    op.create_table(
        "events",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.TEXT(), nullable=False),
        sa.Column("type", sa.TEXT(), nullable=False),
        sa.Column("date", sa.TIMESTAMP(), nullable=False),
        sa.Column("is_recurring", sa.BOOLEAN(), nullable=True, server_default="false"),
        sa.Column("recurring_type", sa.TEXT(), nullable=True),
        sa.Column("country", sa.TEXT(), nullable=True),
        sa.Column("region", sa.TEXT(), nullable=True),
        sa.Column("person_id", sa.VARCHAR(), nullable=True),
        sa.Column("is_enabled", sa.BOOLEAN(), nullable=True, server_default="true"),
        sa.Column("description", sa.TEXT(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["people.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create faces table
    op.create_table(
        "faces",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("photo_id", sa.VARCHAR(), nullable=False),
        sa.Column("person_id", sa.VARCHAR(), nullable=True),
        sa.Column(
            "bounding_box", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("confidence", sa.INTEGER(), nullable=False),
        sa.Column("embedding", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ignored", sa.BOOLEAN(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["people.id"],
        ),
        sa.ForeignKeyConstraint(
            ["photo_id"],
            ["file_versions.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create relationships table
    op.create_table(
        "relationships",
        sa.Column(
            "id",
            sa.VARCHAR(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("person1_id", sa.VARCHAR(), nullable=False),
        sa.Column("person2_id", sa.VARCHAR(), nullable=False),
        sa.Column("relationship_type", sa.TEXT(), nullable=False),
        sa.Column("notes", sa.TEXT(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(
            ["person1_id"],
            ["people.id"],
        ),
        sa.ForeignKeyConstraint(
            ["person2_id"],
            ["people.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("relationships")
    op.drop_table("faces")
    op.drop_table("events")
    op.drop_table("collection_photos")
    op.drop_table("global_tag_library")
    op.drop_table("locations")
    op.drop_table("ai_prompts")
    op.drop_table("settings")
    op.drop_table("people")
    op.drop_table("collections")
    op.drop_table("asset_history")
    op.drop_table("file_versions")
    op.drop_table("media_assets")
    op.drop_table("users")
