"""Add user_profiles and user_preferences tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-25

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS user_preferences CASCADE")
    op.execute("DROP TABLE IF EXISTS user_profiles CASCADE")
    
    # -- user_profiles --
    op.create_table(
        "user_profiles",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("email", sa.String(254), nullable=True),
        sa.Column("phone_number", sa.String(16), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("bio", sa.String(300), nullable=True),
        sa.Column("institution", sa.String(150), nullable=True),
        sa.Column("course", sa.String(100), nullable=True),
        sa.Column("avatar_key", sa.String(500), nullable=True),
        sa.Column("avatar_version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )

    # -- user_preferences --
    op.create_table(
        "user_preferences",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("theme", sa.String(5), nullable=False, server_default="light"),
        sa.Column("accent_color", sa.String(6), nullable=False, server_default="black"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("theme IN ('light', 'dark')", name="ck_user_preferences_theme"),
        sa.CheckConstraint(
            "accent_color IN ('gray', 'blue', 'green', 'yellow', 'pink', 'orange', 'purple', 'black')",
            name="ck_user_preferences_accent_color",
        ),
    )

    # Backfill default rows for all existing users
    op.execute(
        "INSERT INTO user_profiles (user_id, created_at, updated_at) "
        "SELECT id, NOW(), NOW() FROM users "
        "ON CONFLICT DO NOTHING"
    )
    op.execute(
        "INSERT INTO user_preferences (user_id, created_at, updated_at) "
        "SELECT id, NOW(), NOW() FROM users "
        "ON CONFLICT DO NOTHING"
    )


def downgrade() -> None:
    op.drop_table("user_preferences")
    op.drop_table("user_profiles")
