import sqlite3
conn = sqlite3.connect('app.db')
cursor = conn.cursor()
cursor.execute("SELECT key, value FROM system_configs WHERE key LIKE 'LLM_%' OR key = 'TOP_K'")
print(cursor.fetchall())
