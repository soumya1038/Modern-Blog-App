from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session
import markdown
import os
import json
from datetime import datetime
import urllib.parse
import gzip
import base64
import bcrypt

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-here')
app.config['DATABASE'] = os.environ.get('DATABASE_URL', 'sqlite:///blog.db')

BLOG_DIR = 'blogs'
if not os.path.exists(BLOG_DIR):
    os.makedirs(BLOG_DIR)

def compress_data(data):
    json_str = json.dumps(data)
    compressed = gzip.compress(json_str.encode('utf-8'))
    return base64.b64encode(compressed).decode('utf-8')

def decompress_data(encoded_data):
    compressed = base64.b64decode(encoded_data)
    json_str = gzip.decompress(compressed).decode('utf-8')
    return json.loads(json_str)

def get_all_blogs():
    blogs = []
    if os.path.exists(BLOG_DIR):
        for filename in os.listdir(BLOG_DIR):
            if filename.endswith('.gz') or filename.endswith('.json'):
                with open(os.path.join(BLOG_DIR, filename), 'r', encoding='utf-8') as f:
                    if filename.endswith('.json'):
                        blog = json.load(f)
                    else:
                        blog = decompress_data(f.read())
                    # Initialize likes if not present
                    if 'likes' not in blog:
                        blog['likes'] = 0
                    blogs.append(blog)
    return sorted(blogs, key=lambda x: x['created_at'], reverse=True)

# Simple user storage (in production, use a proper database)
USERS_FILE = 'users.json'
NOTIFICATIONS_FILE = 'notifications.json'
FOLLOWS_FILE = 'follows.json'

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)
            # Migrate old user format to new format with personal info
            for username, data in users.items():
                if isinstance(data, str):  # Old format: username -> password
                    users[username] = {
                        'password': data,
                        'personal_info': {}
                    }
            return users
    return {}

def save_users(users):
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)

def load_notifications():
    if os.path.exists(NOTIFICATIONS_FILE):
        with open(NOTIFICATIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_notifications(notifications):
    with open(NOTIFICATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(notifications, f, indent=2)

def load_follows():
    if os.path.exists(FOLLOWS_FILE):
        with open(FOLLOWS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_follows(follows):
    with open(FOLLOWS_FILE, 'w', encoding='utf-8') as f:
        json.dump(follows, f, indent=2)

def get_followers_count(username):
    follows = load_follows()
    count = 0
    for follower, following_list in follows.items():
        if username in following_list:
            count += 1
    return count

def get_following_count(username):
    follows = load_follows()
    return len(follows.get(username, []))

def add_notification(user, type, message, blog_id=None):
    notifications = load_notifications()
    if user not in notifications:
        notifications[user] = []
    
    notification = {
        'id': str(len(notifications[user]) + 1),
        'type': type,
        'message': message,
        'blog_id': blog_id,
        'created_at': datetime.now().isoformat(),
        'read': False
    }
    
    notifications[user].append(notification)
    # Keep only last 50 notifications per user
    notifications[user] = notifications[user][-50:]
    save_notifications(notifications)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        remember_me = request.form.get('remember_me')
        
        if not username or not password:
            if request.headers.get('Accept') == 'application/json':
                return jsonify({'success': False, 'message': 'Please fill in all fields'})
            flash('Please fill in all fields', 'error')
        elif len(password) < 6:
            if request.headers.get('Accept') == 'application/json':
                return jsonify({'success': False, 'message': 'Password must be at least 6 characters'})
            flash('Password must be at least 6 characters', 'error')
        else:
            users = load_users()
            if username in users:
                if request.headers.get('Accept') == 'application/json':
                    return jsonify({'success': False, 'message': 'Username already exists'})
                flash('Username already exists', 'error')
            else:
                users[username] = {
                    'password': hash_password(password),
                    'personal_info': {}
                }
                save_users(users)
                session['user'] = username
                
                if request.headers.get('Accept') == 'application/json':
                    return jsonify({'success': True, 'remember': bool(remember_me), 'username': username})
                flash('Account created successfully!', 'success')
                return redirect(url_for('index'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        remember_me = request.form.get('remember_me')
        
        users = load_users()
        user_data = users.get(username)
        if username in users:
            user_password = user_data['password'] if isinstance(user_data, dict) else user_data
            # Check if password is already hashed (starts with $2b$)
            if user_password.startswith('$2b$'):
                password_valid = verify_password(password, user_password)
            else:
                # Legacy plain text password - hash it and update
                password_valid = user_password == password
                if password_valid:
                    if isinstance(user_data, dict):
                        users[username]['password'] = hash_password(password)
                    else:
                        users[username] = {'password': hash_password(password), 'personal_info': {}}
                    save_users(users)
        else:
            password_valid = False
        
        if username in users and password_valid:
            session['user'] = username
            flash('Logged in successfully!', 'success')
            return jsonify({'success': True, 'remember': bool(remember_me), 'username': username})
        else:
            return jsonify({'success': False, 'message': 'Invalid username or password'})
    return render_template('login.html')

@app.route('/profile', methods=['GET', 'POST'])
def profile():
    if 'user' not in session:
        flash('Please log in to view profile', 'error')
        return redirect(url_for('login'))
    
    users = load_users()
    user_blogs = [blog for blog in get_all_blogs() if blog.get('author') == session['user']]
    user_data = users[session['user']]
    user_password = user_data['password'] if isinstance(user_data, dict) else user_data
    personal_info = user_data.get('personal_info', {}) if isinstance(user_data, dict) else {}
    
    if request.method == 'POST':
        action = request.form.get('action')
        
        if action == 'update_profile_image':
            if isinstance(user_data, str):
                users[session['user']] = {'password': user_data, 'personal_info': {}}
            
            if 'profile_image' in request.files:
                file = request.files['profile_image']
                if file and file.filename:
                    import uuid
                    filename = f"{uuid.uuid4().hex}_{file.filename}"
                    upload_dir = 'static/uploads'
                    if not os.path.exists(upload_dir):
                        os.makedirs(upload_dir)
                    file.save(os.path.join(upload_dir, filename))
                    users[session['user']]['personal_info']['profile_image'] = f'uploads/{filename}'
                    save_users(users)
                    flash('Profile picture updated successfully!', 'success')
        
        elif action == 'clear_profile_image':
            if isinstance(user_data, str):
                users[session['user']] = {'password': user_data, 'personal_info': {}}
            
            # Remove profile image file if it exists
            if 'profile_image' in users[session['user']]['personal_info']:
                old_image = users[session['user']]['personal_info']['profile_image']
                if old_image:
                    image_path = os.path.join('static', old_image)
                    if os.path.exists(image_path):
                        os.remove(image_path)
                users[session['user']]['personal_info']['profile_image'] = ''
                save_users(users)
                flash('Profile picture removed successfully!', 'success')
        
        elif action == 'update_personal_info':
            if isinstance(user_data, str):
                users[session['user']] = {'password': user_data, 'personal_info': {}}
            
            users[session['user']]['personal_info'].update({
                'name': request.form.get('name', ''),
                'signature': request.form.get('signature', ''),
                'address': request.form.get('address', ''),
                'phone': request.form.get('phone', ''),
                'dob': request.form.get('dob', ''),
                'email': request.form.get('email', ''),
                'bio': request.form.get('bio', ''),
                'facebook': request.form.get('facebook', ''),
                'twitter': request.form.get('twitter', ''),
                'instagram': request.form.get('instagram', ''),
                'youtube': request.form.get('youtube', ''),
                'github': request.form.get('github', ''),
                'linkedin': request.form.get('linkedin', '')
            })
            save_users(users)
            flash('Personal information updated successfully!', 'success')
        
        elif action == 'change_password':
            current_password = request.form['current_password']
            new_password = request.form['new_password']
            
            # Verify current password
            if user_password.startswith('$2b$'):
                current_valid = verify_password(current_password, user_password)
            else:
                current_valid = user_password == current_password
            
            if not current_valid:
                flash('Current password is incorrect', 'error')
            elif len(new_password) < 6:
                flash('New password must be at least 6 characters', 'error')
            else:
                if isinstance(user_data, str):
                    users[session['user']] = {'password': hash_password(new_password), 'personal_info': {}}
                else:
                    users[session['user']]['password'] = hash_password(new_password)
                save_users(users)
                flash('Password changed successfully!', 'success')
        
        elif action == 'delete_account':
            password = request.form['password']
            # Verify password for account deletion
            if user_password.startswith('$2b$'):
                password_valid = verify_password(password, user_password)
            else:
                password_valid = user_password == password
            
            if not password_valid:
                flash('Password is incorrect', 'error')
            else:
                # Delete user account
                del users[session['user']]
                save_users(users)
                
                # Delete all user's blog posts
                for blog in user_blogs:
                    blog_file = os.path.join(BLOG_DIR, f"{blog['id']}.gz")
                    if os.path.exists(blog_file):
                        os.remove(blog_file)
                
                session.pop('user', None)
                flash('Account deleted successfully', 'success')
                return redirect(url_for('index'))
    
    followers_count = get_followers_count(session['user'])
    following_count = get_following_count(session['user'])
    
    return render_template('profile.html', 
                         user_blogs=user_blogs, 
                         personal_info=personal_info,
                         followers_count=followers_count,
                         following_count=following_count)

@app.route('/logout')
def logout():
    session.pop('user', None)
    flash('Logged out successfully!', 'success')
    return redirect(url_for('index'))

@app.route('/clear-credentials', methods=['POST'])
def clear_credentials():
    # This endpoint helps clear localStorage from server side if needed
    return jsonify({'success': True})

@app.route('/auto-login', methods=['POST'])
def auto_login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    users = load_users()
    user_data = users.get(username)
    if username in users:
        user_password = user_data['password'] if isinstance(user_data, dict) else user_data
        if user_password.startswith('$2b$'):
            password_valid = verify_password(password, user_password)
        else:
            password_valid = user_password == password
    else:
        password_valid = False
    
    if username in users and password_valid:
        session['user'] = username
        return jsonify({'success': True})
    return jsonify({'success': False})

def get_user_info(username):
    users = load_users()
    user_data = users.get(username, {})
    if isinstance(user_data, dict):
        return user_data.get('personal_info', {})
    return {}

@app.context_processor
def inject_user_info():
    return dict(get_user_info=get_user_info)

@app.route('/')
def index():
    blogs = get_all_blogs()
    follows = load_follows()
    current_user_follows = follows.get(session.get('user', ''), [])
    
    # Add user info and follow status to each blog
    for blog in blogs:
        blog['author_info'] = get_user_info(blog.get('author', ''))
        blog['is_following'] = blog.get('author') in current_user_follows
    return render_template('index.html', blogs=blogs)

@app.route('/blog/<blog_id>')
def view_blog(blog_id):
    # Try .json first, then .gz
    blog_file = os.path.join(BLOG_DIR, f'{blog_id}.json')
    is_json = True
    if not os.path.exists(blog_file):
        blog_file = os.path.join(BLOG_DIR, f'{blog_id}.gz')
        is_json = False
    
    if os.path.exists(blog_file):
        with open(blog_file, 'r', encoding='utf-8') as f:
            blog = json.load(f) if is_json else decompress_data(f.read())
        
        blog['content_html'] = markdown.markdown(blog['content'])
        
        # Initialize likes and comments if not present
        if 'likes' not in blog:
            blog['likes'] = 0
        if 'liked_by' not in blog:
            blog['liked_by'] = []
        if 'comments' not in blog:
            blog['comments'] = []
        
        # Check if current user has liked this post
        blog['user_liked'] = session.get('user') in blog['liked_by'] if 'user' in session else False
        
        return render_template('blog.html', blog=blog)
    return "Blog not found", 404

@app.route('/add', methods=['GET', 'POST'])
def add_blog():
    if 'user' not in session:
        flash('Please log in to create a post', 'error')
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        title = data.get('title')
        content = data.get('content')
        tags = data.get('tags', '')
        save_local = data.get('save_local', False)
        
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
            
            if not save_local:
                blog_file = os.path.join(BLOG_DIR, f'{blog_id}.gz')
                with open(blog_file, 'w') as f:
                    f.write(compress_data(blog_data))
            
            if request.is_json:
                return jsonify({'success': True, 'blog_id': blog_id, 'blog_data': blog_data})
            else:
                flash('Blog post created successfully!', 'success')
                return redirect(url_for('view_blog', blog_id=blog_id))
        else:
            if request.is_json:
                return jsonify({'success': False, 'message': 'Please fill in all fields'})
            flash('Please fill in all fields', 'error')
    
    return render_template('add_blog.html')

@app.route('/get-local-blogs')
def get_local_blogs():
    if 'user' not in session:
        return jsonify({'blogs': []})
    return jsonify({'user': session['user']})

@app.route('/sync-blogs', methods=['POST'])
def sync_blogs():
    if 'user' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    data = request.get_json()
    local_blogs = data.get('blogs', [])
    
    synced_count = 0
    for blog_data in local_blogs:
        if blog_data.get('author') == session['user']:
            blog_id = blog_data['id']
            blog_file = os.path.join(BLOG_DIR, f'{blog_id}.gz')
            if not os.path.exists(blog_file):
                with open(blog_file, 'w') as f:
                    f.write(compress_data(blog_data))
                synced_count += 1
    
    return jsonify({'success': True, 'synced': synced_count})

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
    
    # Try .json first, then .gz
    blog_file = os.path.join(BLOG_DIR, f'{blog_id}.json')
    is_json = True
    if not os.path.exists(blog_file):
        blog_file = os.path.join(BLOG_DIR, f'{blog_id}.gz')
        is_json = False
    
    if not os.path.exists(blog_file):
        flash('Blog post not found', 'error')
        return redirect(url_for('index'))
    
    with open(blog_file, 'r', encoding='utf-8') as f:
        blog_data = json.load(f) if is_json else decompress_data(f.read())
    
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
                if is_json:
                    json.dump(blog_data, f, indent=2)
                else:
                    f.write(compress_data(blog_data))
            
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
    
    # Try .json first, then .gz
    blog_file = os.path.join(BLOG_DIR, f'{blog_id}.json')
    is_json = True
    if not os.path.exists(blog_file):
        blog_file = os.path.join(BLOG_DIR, f'{blog_id}.gz')
        is_json = False
    
    if os.path.exists(blog_file):
        with open(blog_file, 'r', encoding='utf-8') as f:
            blog_data = json.load(f) if is_json else decompress_data(f.read())
        
        if blog_data.get('author') != session['user']:
            flash('You can only delete your own posts', 'error')
            return redirect(url_for('index'))
        
        os.remove(blog_file)
        flash('Blog post deleted successfully!', 'success')
    else:
        flash('Blog post not found', 'error')
    return redirect(url_for('index'))

@app.route('/like/<blog_id>', methods=['POST'])
def like_blog(blog_id):
    if 'user' not in session:
        return jsonify({'error': 'Please log in to like posts'}), 401
    
    # Try .json first, then .gz
    blog_file = os.path.join(BLOG_DIR, f'{blog_id}.json')
    is_json = True
    if not os.path.exists(blog_file):
        blog_file = os.path.join(BLOG_DIR, f'{blog_id}.gz')
        is_json = False
    
    if os.path.exists(blog_file):
        with open(blog_file, 'r', encoding='utf-8') as f:
            blog = json.load(f) if is_json else decompress_data(f.read())
        
        if 'likes' not in blog:
            blog['likes'] = 0
        if 'liked_by' not in blog:
            blog['liked_by'] = []
        
        user = session['user']
        if user in blog['liked_by']:
            blog['liked_by'].remove(user)
            blog['likes'] -= 1
            liked = False
            message = 'Like removed'
        else:
            blog['liked_by'].append(user)
            blog['likes'] += 1
            liked = True
            message = 'Post liked!'
        
        with open(blog_file, 'w', encoding='utf-8') as f:
            if is_json:
                json.dump(blog, f, indent=2)
            else:
                f.write(compress_data(blog))
        
        # Add notification for blog author (if not self-like)
        if liked and blog.get('author') != user:
            add_notification(
                blog['author'], 
                'like', 
                f"{user} liked your post '{blog['title'][:30]}{'...' if len(blog['title']) > 30 else ''}",
                blog_id
            )
        
        return jsonify({
            'likes': blog['likes'],
            'liked': liked,
            'message': message
        })
    return jsonify({'error': 'Blog not found'}), 404

@app.route('/comment/<blog_id>', methods=['POST'])
def add_comment(blog_id):
    if 'user' not in session:
        return jsonify({'error': 'Please log in to comment'}), 401
    
    data = request.get_json()
    comment_text = data.get('text', '').strip()
    
    if not comment_text:
        return jsonify({'error': 'Comment cannot be empty'}), 400
    
    # Try .json first, then .gz
    blog_file = os.path.join(BLOG_DIR, f'{blog_id}.json')
    is_json = True
    if not os.path.exists(blog_file):
        blog_file = os.path.join(BLOG_DIR, f'{blog_id}.gz')
        is_json = False
    
    if os.path.exists(blog_file):
        with open(blog_file, 'r', encoding='utf-8') as f:
            blog = json.load(f) if is_json else decompress_data(f.read())
        
        if 'comments' not in blog:
            blog['comments'] = []
        
        comment = {
            'author': session['user'],
            'text': comment_text,
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M')
        }
        
        blog['comments'].append(comment)
        
        with open(blog_file, 'w', encoding='utf-8') as f:
            if is_json:
                json.dump(blog, f, indent=2)
            else:
                f.write(compress_data(blog))
        
        # Add notification for blog author (if not self-comment)
        if blog.get('author') != session['user']:
            add_notification(
                blog['author'], 
                'comment', 
                f"{session['user']} commented on your post '{blog['title'][:30]}{'...' if len(blog['title']) > 30 else ''}",
                blog_id
            )
        
        return jsonify({'success': True})
    return jsonify({'error': 'Blog not found'}), 404

@app.route('/comments/<blog_id>')
def get_comments(blog_id):
    # Try .json first, then .gz
    blog_file = os.path.join(BLOG_DIR, f'{blog_id}.json')
    is_json = True
    if not os.path.exists(blog_file):
        blog_file = os.path.join(BLOG_DIR, f'{blog_id}.gz')
        is_json = False
    
    if os.path.exists(blog_file):
        with open(blog_file, 'r', encoding='utf-8') as f:
            blog = json.load(f) if is_json else decompress_data(f.read())
        
        comments = blog.get('comments', [])
        return jsonify({'comments': comments})
    return jsonify({'error': 'Blog not found'}), 404

@app.route('/share/<blog_id>')
def share_blog(blog_id):
    # Try .json first, then .gz
    blog_file = os.path.join(BLOG_DIR, f'{blog_id}.json')
    is_json = True
    if not os.path.exists(blog_file):
        blog_file = os.path.join(BLOG_DIR, f'{blog_id}.gz')
        is_json = False
    
    if os.path.exists(blog_file):
        with open(blog_file, 'r', encoding='utf-8') as f:
            blog = json.load(f) if is_json else decompress_data(f.read())
        
        share_data = {
            'title': blog['title'],
            'url': request.url_root + f'blog/{blog_id}',
            'text': f"Check out this blog post: {blog['title']}"
        }
        return jsonify(share_data)
    return jsonify({'error': 'Blog not found'}), 404

@app.route('/notifications')
def get_notifications():
    if 'user' not in session:
        return jsonify({'notifications': []})
    
    notifications = load_notifications()
    user_notifications = notifications.get(session['user'], [])
    # Return notifications in reverse order (newest first)
    return jsonify({'notifications': list(reversed(user_notifications))})

@app.route('/notifications/mark-read', methods=['POST'])
def mark_notifications_read():
    if 'user' not in session:
        return jsonify({'success': False})
    
    notifications = load_notifications()
    if session['user'] in notifications:
        for notif in notifications[session['user']]:
            notif['read'] = True
        save_notifications(notifications)
    
    return jsonify({'success': True})

@app.route('/notifications/mark-all-read', methods=['POST'])
def mark_all_notifications_read():
    if 'user' not in session:
        return jsonify({'success': False})
    
    notifications = load_notifications()
    if session['user'] in notifications:
        for notif in notifications[session['user']]:
            notif['read'] = True
        save_notifications(notifications)
    
    return jsonify({'success': True})

@app.route('/notifications/clear-all', methods=['POST'])
def clear_all_notifications():
    if 'user' not in session:
        return jsonify({'success': False})
    
    notifications = load_notifications()
    if session['user'] in notifications:
        notifications[session['user']] = []
        save_notifications(notifications)
    
    return jsonify({'success': True})

@app.route('/follow/<username>', methods=['POST'])
def follow_user(username):
    if 'user' not in session:
        return jsonify({'success': False, 'message': 'Please login to follow users'}), 401
    
    current_user = session['user']
    
    # Can't follow yourself
    if current_user == username:
        return jsonify({'success': False, 'message': 'You cannot follow yourself'})
    
    # Check if user exists
    users = load_users()
    if username not in users:
        return jsonify({'success': False, 'message': 'User not found'})
    
    follows = load_follows()
    
    # Initialize if not exists
    if current_user not in follows:
        follows[current_user] = []
    
    # Check if already following
    if username in follows[current_user]:
        # Unfollow
        follows[current_user].remove(username)
        save_follows(follows)
        return jsonify({'success': True, 'message': f'Unfollowed {username}', 'action': 'unfollowed'})
    else:
        # Follow
        follows[current_user].append(username)
        save_follows(follows)
        
        # Add notification for followed user
        add_notification(
            username,
            'follow',
            f'{current_user} started following you'
        )
        
        return jsonify({'success': True, 'message': f'Successfully followed {username}!', 'action': 'followed'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)