import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'study.db')
print(f"Connecting to {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    columns_to_add = [
        ("response_length", "VARCHAR(20) NOT NULL DEFAULT 'medium'"),
        ("explanation_level", "VARCHAR(50) NOT NULL DEFAULT 'undergraduate'"),
        ("not_in_docs_behavior", "VARCHAR(20) NOT NULL DEFAULT 'tell_me'"),
        ("citation_style", "VARCHAR(20) NOT NULL DEFAULT 'inline'"),
        ("default_search_scope", "VARCHAR(20) NOT NULL DEFAULT 'selected'"),
        ("follow_up_suggestions", "BOOLEAN NOT NULL DEFAULT 1"),
        ("simplify_difficult_concepts", "BOOLEAN NOT NULL DEFAULT 0"),
        ("external_knowledge", "BOOLEAN NOT NULL DEFAULT 0"),
        ("answer_format", "VARCHAR(30) NOT NULL DEFAULT 'paragraph'")
    ]

    for col_name, col_def in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE user_preferences ADD COLUMN {col_name} {col_def};")
            print(f"Successfully added column {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"Column {col_name} already exists.")
            else:
                print(f"Failed to add column {col_name}: {e}")

    conn.commit()
    print("Database alteration complete.")
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals():
        conn.close()
