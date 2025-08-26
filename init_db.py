import psycopg2
import os

database_url = os.environ.get('DATABASE_URL')
if database_url and database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

if database_url:
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    
    # Create tables
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(80) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            personal_info TEXT DEFAULT '{}'
        )
    ''')
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS blogs (
            id VARCHAR(200) PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            content TEXT NOT NULL,
            author VARCHAR(80) NOT NULL,
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
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS follows (
            id SERIAL PRIMARY KEY,
            follower VARCHAR(80) NOT NULL,
            following VARCHAR(80) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_name VARCHAR(80) NOT NULL,
            type VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            blog_id VARCHAR(200),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            read BOOLEAN DEFAULT FALSE
        )
    ''')
    
    conn.commit()
    cur.close()
    conn.close()
    print("Database initialized successfully")