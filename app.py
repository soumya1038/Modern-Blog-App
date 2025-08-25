from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session
import markdown
import os
import json
from datetime import datetime
import urllib.parse

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-here')
app.config['DATABASE'] = os.environ.get('DATABASE_URL', 'sqlite:///blog.db')

BLOG_DIR = 'blogs'
if not os.path.exists(BLOG_DIR):
    os.makedirs(BLOG_DIR)

def get_all_blogs():
    blogs = []
    if os.path.exists(BLOG_DIR):
        for filename in os.listdir(BLOG_DIR):
            if filename.endswith('.json'):
                with open(os.path.join(BLOG_DIR, filename), 'r', encoding='utf-8') as f:
                    blog = json.load(f)
                    blogs.append(blog)
    return sorted(blogs, key=lambda x: x['created_at'], reverse=True)

# Simple user storage (in production, use a proper database)
USERS_FILE = 'users.json'

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_users(users):
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)

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
            users = load_users()
            if username in users:
                flash('Username already exists', 'error')
            else:
                users[username] = password
                save_users(users)
                session['user'] = username
                flash('Account created successfully!', 'success')
                return redirect(url_for('index'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        users = load_users()
        if username in users and users[username] == password:
            session['user'] = username
            flash('Logged in successfully!', 'success')
            return redirect(url_for('index'))
        else:
            flash('Invalid username or password', 'error')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('user', None)
    flash('Logged out successfully!', 'success')
    return redirect(url_for('index'))

@app.route('/')
def index():
    blogs = get_all_blogs()
    return render_template('index.html', blogs=blogs)

@app.route('/blog/<blog_id>')
def view_blog(blog_id):
    blog_file = os.path.join(BLOG_DIR, f'{blog_id}.json')
    if os.path.exists(blog_file):
        with open(blog_file, 'r', encoding='utf-8') as f:
            blog = json.load(f)
        blog['content_html'] = markdown.markdown(blog['content'])
        return render_template('blog.html', blog=blog)
    return "Blog not found", 404

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
            blog_data = {
                'id': blog_id,
                'title': title,
                'author': session['user'],
                'content': content,
                'tags': [tag.strip() for tag in tags.split(',') if tag.strip()],
                'word_count': len(content.split()),
                'reading_time': max(1, len(content.split()) // 200),
                'created_at': datetime.now().isoformat()
            }
            
            blog_file = os.path.join(BLOG_DIR, f'{blog_id}.json')
            with open(blog_file, 'w', encoding='utf-8') as f:
                json.dump(blog_data, f, indent=2)
            
            flash('Blog post created successfully!', 'success')
            return redirect(url_for('view_blog', blog_id=blog_id))
        else:
            flash('Please fill in all fields', 'error')
    
    return render_template('add_blog.html')

@app.route('/autosave', methods=['POST'])
def autosave():
    data = request.get_json()
    draft_id = data.get('draft_id', 'draft_' + str(int(datetime.now().timestamp())))
    
    draft_data = {
        'id': draft_id,
        'title': data.get('title', ''),
        'author': data.get('author', ''),
        'content': data.get('content', ''),
        'tags': data.get('tags', ''),
        'saved_at': datetime.now().isoformat(),
        'is_draft': True
    }
    
    drafts_dir = 'drafts'
    if not os.path.exists(drafts_dir):
        os.makedirs(drafts_dir)
    
    draft_file = os.path.join(drafts_dir, f'{draft_id}.json')
    with open(draft_file, 'w', encoding='utf-8') as f:
        json.dump(draft_data, f, indent=2)
    
    return jsonify({'status': 'saved', 'draft_id': draft_id})

@app.route('/edit/<blog_id>', methods=['GET', 'POST'])
def edit_blog(blog_id):
    if 'user' not in session:
        flash('Please log in to edit posts', 'error')
        return redirect(url_for('login'))
    
    blog_file = os.path.join(BLOG_DIR, f'{blog_id}.json')
    if not os.path.exists(blog_file):
        flash('Blog post not found', 'error')
        return redirect(url_for('index'))
    
    with open(blog_file, 'r', encoding='utf-8') as f:
        blog_data = json.load(f)
    
    if blog_data.get('author') != session['user']:
        flash('You can only edit your own posts', 'error')
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        title = request.form['title']
        content = request.form['content']
        tags = request.form.get('tags', '')
        
        if title and content:
            blog_data.update({
                'title': title,
                'content': content,
                'tags': [tag.strip() for tag in tags.split(',') if tag.strip()],
                'word_count': len(content.split()),
                'reading_time': max(1, len(content.split()) // 200),
                'updated_at': datetime.now().isoformat()
            })
            
            with open(blog_file, 'w', encoding='utf-8') as f:
                json.dump(blog_data, f, indent=2)
            
            flash('Blog post updated successfully!', 'success')
            return redirect(url_for('view_blog', blog_id=blog_id))
        else:
            flash('Please fill in all fields', 'error')
    
    return render_template('edit_blog.html', blog=blog_data)

@app.route('/delete/<blog_id>', methods=['POST'])
def delete_blog(blog_id):
    if 'user' not in session:
        flash('Please log in to delete posts', 'error')
        return redirect(url_for('login'))
    
    blog_file = os.path.join(BLOG_DIR, f'{blog_id}.json')
    if os.path.exists(blog_file):
        with open(blog_file, 'r', encoding='utf-8') as f:
            blog_data = json.load(f)
        
        if blog_data.get('author') != session['user']:
            flash('You can only delete your own posts', 'error')
            return redirect(url_for('index'))
        
        os.remove(blog_file)
        flash('Blog post deleted successfully!', 'success')
    else:
        flash('Blog post not found', 'error')
    return redirect(url_for('index'))

@app.route('/share/<blog_id>')
def share_blog(blog_id):
    blog_file = os.path.join(BLOG_DIR, f'{blog_id}.json')
    if os.path.exists(blog_file):
        with open(blog_file, 'r', encoding='utf-8') as f:
            blog = json.load(f)
        
        share_data = {
            'title': blog['title'],
            'url': request.url_root + f'blog/{blog_id}',
            'text': f"Check out this blog post: {blog['title']}"
        }
        return jsonify(share_data)
    return jsonify({'error': 'Blog not found'}), 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)