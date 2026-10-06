import asyncio
import asyncpg
import sys

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def main():
    print("Connecting to DB...")
    # Try IPv4 first
    try:
        conn = await asyncpg.connect('postgresql://postgres:postgres@127.0.0.1:5432/study_assistant', timeout=3)
    except Exception as e:
        print("IPv4 failed:", e)
        # Try IPv6
        conn = await asyncpg.connect('postgresql://postgres:postgres@[::1]:5432/study_assistant', timeout=3)
        
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS flashcard_sets (
            id UUID PRIMARY KEY,
            chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            corpus_version INTEGER NOT NULL,
            scope JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL
        );
        CREATE TABLE IF NOT EXISTS flashcards (
            id UUID PRIMARY KEY,
            flashcard_set_id UUID NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            sources_json JSONB,
            difficulty VARCHAR(50) NOT NULL,
            repetitions INTEGER NOT NULL,
            review_interval INTEGER NOT NULL,
            ease_factor DOUBLE PRECISION NOT NULL,
            next_review_at TIMESTAMP WITH TIME ZONE NOT NULL,
            last_reviewed_at TIMESTAMP WITH TIME ZONE,
            review_count INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL
        );
        CREATE TABLE IF NOT EXISTS flashcard_reviews (
            id UUID PRIMARY KEY,
            flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            rating VARCHAR(50) NOT NULL,
            previous_interval INTEGER NOT NULL,
            new_interval INTEGER NOT NULL,
            reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL
        );
    """)
    print("Flashcard tables created.")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
