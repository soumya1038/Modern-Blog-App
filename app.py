from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
import markdown
import os
import json
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-here')
database_url = os.environ.get('DATABASE_URL', 'sqlite:///blog.db')

def get_db_connection():
    if database_url.startswith('postgres'):
        url = database_url.replace('postgres://', 'postgresql://', 1) if database_url.startswith('postgres://') else database_url
        return psycopg2.connect(url, cursor_factory=RealDictCursor)
    return None

def get_all_blogs():
    conn = get_db_connection()
    if not conn:
        return []
    
    cur = conn.cursor()
    cur.execute("SELECT * FROM blogs ORDER BY created_at DESC")
    blogs = cur.fetchall()
    cur.close()
    conn.close()
    
    blog_list = []
    for blog in blogs:
        blog_dict = dict(blog)
        blog_dict['tags'] = json.loads(blog_dict.get('tags', '[]'))
        blog_dict['liked_by'] = json.loads(blog_dict.get('liked_by', '[]'))
        blog_dict['comments'] = json.loads(blog_dict.get('comments', '[]'))
        if blog_dict['created_at']:
            blog_dict['created_at'] = blog_dict['created_at'].isoformat()
        if blog_dict.get('updated_at'):
            blog_dict['updated_at'] = blog_dict['updated_at'].isoformat()
        blog_list.append(blog_dict)
    return blog_list

@app.route('/')
def index():
    blogs = get_all_blogs()
    return render_template('index.html', blogs=blogs)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        if not username or not password:
            flash('Please fill in all fields', 'error')
        elif len(password) < 6:
            flash('Password must be at least 6 characters', 'error')
        else:
            conn = get_db_connection()
            if conn:
                cur = conn.cursor()
                cur.execute("SELECT username FROM users WHERE username = %s", (username,))
                if cur.fetchone():
                    flash('Username already exists', 'error')
                else:
                    password_hash = generate_password_hash(password)
                    cur.execute("INSERT INTO users (username, password_hash, personal_info) VALUES (%s, %s, %s)", 
                              (username, password_hash, '{}'))
                    conn.commit()
                    session['user'] = username
                    flash('Account created successfully!', 'success')
                    cur.close()
                    conn.close()
                    return redirect(url_for('index'))
                cur.close()
                conn.close()
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            cur.execute("SELECT password_hash FROM users WHERE username = %s", (username,))
            user = cur.fetchone()
            if user and check_password_hash(user['password_hash'], password):
                session['user'] = username
                flash('Logged in successfully!', 'success')
                return jsonify({'success': True, 'username': username})
            else:
                return jsonify({'success': False, 'message': 'Invalid username or password'})
            cur.close()
            conn.close()
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('user', None)
    flash('Logged out successfully!', 'success')
    return redirect(url_for('index'))

@app.route('/add', methods=['GET', 'POST'])
def add_blog():
    if 'user' not in session:
        flash('Please log in to create a post', 'error')
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        title = request.form['title']
        content = request.form['content']
        tags = request.form.get('tags', '')
        
        if title and content:
            blog_id = title.lower().replace(' ', '-').replace('.', '').replace(',', '').replace('?', '').replace('!', '')
            
            conn = get_db_connection()
            if conn:
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO blogs (id, title, content, author, tags, word_count, reading_time) 
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (blog_id, title, content, session['user'], 
                     json.dumps([tag.strip() for tag in tags.split(',') if tag.strip()]),
                     len(content.split()), max(1, len(content.split()) // 200)))
                conn.commit()
                cur.close()
                conn.close()
                flash('Blog post created successfully!', 'success')
                return redirect(url_for('view_blog', blog_id=blog_id))
        else:
            flash('Please fill in all fields', 'error')
    
    return render_template('add_blog.html')

@app.route('/blog/<blog_id>')
def view_blog(blog_id):
    conn = get_db_connection()
    if not conn:
        return "Blog not found", 404
    
    cur = conn.cursor()
    cur.execute("SELECT * FROM blogs WHERE id = %s", (blog_id,))
    blog_obj = cur.fetchone()
    cur.close()
    conn.close()
    
    if blog_obj:
        blog = dict(blog_obj)
        blog['tags'] = json.loads(blog.get('tags', '[]'))
        blog['liked_by'] = json.loads(blog.get('liked_by', '[]'))
        blog['comments'] = json.loads(blog.get('comments', '[]'))
        blog['content_html'] = markdown.markdown(blog['content'])
        blog['user_liked'] = session.get('user') in blog['liked_by'] if 'user' in session else False
        if blog['created_at']:
            blog['created_at'] = blog['created_at'].isoformat()
        if blog.get('updated_at'):
            blog['updated_at'] = blog['updated_at'].isoformat()
        
        return render_template('blog.html', blog=blog)
    return "Blog not found", 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)