import sqlite3
import json

db = sqlite3.connect('study.db')
row = db.execute("SELECT payload, error FROM jobs WHERE type='generate_answer' AND status='failed' ORDER BY created_at DESC LIMIT 1").fetchone()

if row:
    payload, error = row
    print("Error:", error)
    print("Payload:", json.dumps(json.loads(payload), indent=2))
else:
    print("No failed jobs.")
