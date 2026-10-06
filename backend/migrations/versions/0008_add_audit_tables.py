"""add audit_logs, failed_login_attempts, and session metadata

Revision ID: 0008_add_audit_tables
Revises: 0007_add_system_configs
Create Date: 2026-10-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql # wait, it's sqlite usually but JSONB is postgres. Let's see what dialect is used in other migrations. Wait, the models use JSONB from sqlite? Wait, sqlite JSON is usually sqlalchemy.JSON. Let's not import postgresql here unless it's used.

revision = '0008_add_audit_tables'
down_revision = '0007_add_system_configs'

def upgrade():
    # audit_logs table
    op.create_table('audit_logs',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('actor_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('actor_username', sa.String(100), nullable=True),  # denormalized for display
        sa.Column('action', sa.String(100), nullable=False),          # e.g. USER_CREATED, DOC_DELETED
        sa.Column('target_type', sa.String(50), nullable=True),       # user, document, session, config
        sa.Column('target_id', sa.String(200), nullable=True),        # UUID or key string
        sa.Column('target_label', sa.String(300), nullable=True),     # human-readable label
        sa.Column('metadata', sa.JSON(), nullable=True),              # extra JSONB details
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])
    op.create_index('ix_audit_logs_actor_id', 'audit_logs', ['actor_id'])

    # failed_login_attempts table
    op.create_table('failed_login_attempts',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('username_attempted', sa.String(100), nullable=False),
        sa.Column('ip_address', sa.String(64), nullable=False),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_failed_login_ip', 'failed_login_attempts', ['ip_address', 'created_at'])
    op.create_index('ix_failed_login_username', 'failed_login_attempts', ['username_attempted', 'created_at'])

    # Add IP + user-agent to sessions
    op.add_column('sessions', sa.Column('ip_address', sa.String(64), nullable=True))
    op.add_column('sessions', sa.Column('user_agent', sa.String(500), nullable=True))

def downgrade():
    op.drop_column('sessions', 'user_agent')
    op.drop_column('sessions', 'ip_address')
    op.drop_index('ix_failed_login_username', table_name='failed_login_attempts')
    op.drop_index('ix_failed_login_ip', table_name='failed_login_attempts')
    op.drop_table('failed_login_attempts')
    op.drop_index('ix_audit_logs_actor_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_created_at', table_name='audit_logs')
    op.drop_table('audit_logs')
