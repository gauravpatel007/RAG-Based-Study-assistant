import asyncio
import sys

async def main():
    try:
        from app.core.database import engine
        from sqlalchemy import text
        print("Engine created. Connecting to DB...")
        async with engine.begin() as conn:
            print("Connected. Altering tables...")
            
            queries = [
                "ALTER TABLE user_preferences ADD COLUMN response_length VARCHAR(20) DEFAULT 'medium' NOT NULL;",
                "ALTER TABLE user_preferences ADD COLUMN explanation_level VARCHAR(50) DEFAULT 'undergraduate' NOT NULL;",
                "ALTER TABLE user_preferences ADD COLUMN not_in_docs_behavior VARCHAR(20) DEFAULT 'tell_me' NOT NULL;",
                "ALTER TABLE user_preferences ADD COLUMN citation_style VARCHAR(20) DEFAULT 'inline' NOT NULL;",
                "ALTER TABLE user_preferences ADD COLUMN default_search_scope VARCHAR(20) DEFAULT 'selected' NOT NULL;",
                "ALTER TABLE user_preferences ADD COLUMN follow_up_suggestions BOOLEAN DEFAULT true NOT NULL;",
                "ALTER TABLE user_preferences ADD COLUMN simplify_difficult_concepts BOOLEAN DEFAULT false NOT NULL;",
                "ALTER TABLE user_preferences ADD COLUMN external_knowledge BOOLEAN DEFAULT false NOT NULL;",
                "UPDATE alembic_version SET version_num='0005_ai_preferences';"
            ]
            
            for q in queries:
                try:
                    await conn.execute(text(q))
                    print(f"Executed: {q}")
                except Exception as e:
                    print(f"Error executing {q}: {e}")
                    
        print("Done.")
    except Exception as e:
        print(f"Fatal error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
