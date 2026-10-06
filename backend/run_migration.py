import sys
import os

# Ensure the backend directory is in the python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from alembic.config import Config
from alembic import command

def run_migration():
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    print("Migration successful!")

if __name__ == "__main__":
    run_migration()
