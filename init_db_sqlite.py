import sqlite3

conn = sqlite3.connect('blog.db')
cur = conn.cursor()

# Create tables
cur.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        personal_info TEXT DEFAULT '{}'
    )
''')

cur.execute('''
    CREATE TABLE IF NOT EXISTS blogs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        word_count INTEGER DEFAULT 0,
        reading_time INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        likes INTEGER DEFAULT 0,
        liked_by TEXT DEFAULT '[]',
        comments TEXT DEFAULT '[]'
    )
''')

conn.commit()
cur.close()
conn.close()
print("SQLite database initialized successfully")