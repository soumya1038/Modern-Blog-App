from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import markdown
import os
import json
from datetime import datetime
import urllib.parse

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-here')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///blog.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    personal_info = db.Column(db.Text, default='{}')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Blog(db.Model):
    id = db.Column(db.String(200), primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    author = db.Column(db.String(80), nullable=False)
    tags = db.Column(db.Text, default='[]')
    word_count = db.Column(db.Integer, default=0)
    reading_time = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime)
    likes = db.Column(db.Integer, default=0)
    liked_by = db.Column(db.Text, default='[]')
    comments = db.Column(db.Text, default='[]')

class Follow(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    follower = db.Column(db.String(80), nullable=False)
    following = db.Column(db.String(80), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user = db.Column(db.String(80), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    message = db.Column(db.Text, nullable=False)
    blog_id = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    read = db.Column(db.Boolean, default=False)

# Create tables
with app.app_context():
    db.create_all()

def get_all_blogs():
    blogs = Blog.query.order_by(Blog.created_at.desc()).all()
    blog_list = []
    for blog in blogs:
        blog_dict = {
            'id': blog.id,
            'title': blog.title,
            'content': blog.content,
            'author': blog.author,
            'tags': json.loads(blog.tags),
            'word_count': blog.word_count,
            'reading_time': blog.reading_time,
            'created_at': blog.created_at.isoformat(),
            'likes': blog.likes,
            'liked_by': json.loads(blog.liked_by),
            'comments': json.loads(blog.comments)
        }
        if blog.updated_at:
            blog_dict['updated_at'] = blog.updated_at.isoformat()
        blog_list.append(blog_dict)
    return blog_list

def load_users():
    users = {}
    for user in User.query.all():
        users[user.username] = {
            'password': user.password_hash,
            'personal_info': json.loads(user.personal_info)
        }
    return users

def save_users(users):
    for username, data in users.items():
        user = User.query.filter_by(username=username).first()
        if user:
            if 'personal_info' in data:
                user.personal_info = json.dumps(data['personal_info'])
            if 'password' in data and not data['password'].startswith('pbkdf2'):
                user.set_password(data['password'])
        else:
            user = User(username=username, personal_info=json.dumps(data.get('personal_info', {})))
            if 'password' in data:
                user.set_password(data['password'])
            db.session.add(user)
    db.session.commit()

def load_notifications():
    notifications = {}
    for notif in Notification.query.all():
        if notif.user not in notifications:
            notifications[notif.user] = []
        notifications[notif.user].append({
            'id': str(notif.id),
            'type': notif.type,
            'message': notif.message,
            'blog_id': notif.blog_id,
            'created_at': notif.created_at.isoformat(),
            'read': notif.read
        })
    return notifications

def save_notifications(notifications):
    # This function is kept for compatibility but notifications are saved directly
    pass

def load_follows():
    follows = {}
    for follow in Follow.query.all():
        if follow.follower not in follows:
            follows[follow.follower] = []
        follows[follow.follower].append(follow.following)
    return follows

def save_follows(follows):
    # Clear existing follows and rebuild
    Follow.query.delete()
    for follower, following_list in follows.items():
        for following in following_list:
            follow = Follow(follower=follower, following=following)
            db.session.add(follow)
    db.session.commit()

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
    notification = Notification(
        user=user,
        type=type,
        message=message,
        blog_id=blog_id
    )
    db.session.add(notification)
    
    # Keep only last 50 notifications per user
    user_notifications = Notification.query.filter_by(user=user).order_by(Notification.created_at.desc()).all()
    if len(user_notifications) >= 50:
        old_notifications = user_notifications[49:]
        for old_notif in old_notifications:
            db.session.delete(old_notif)
    
    db.session.commit()

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
            existing_user = User.query.filter_by(username=username).first()
            if existing_user:
                if request.headers.get('Accept') == 'application/json':
                    return jsonify({'success': False, 'message': 'Username already exists'})
                flash('Username already exists', 'error')
            else:
                user = User(username=username, personal_info=json.dumps({}))
                user.set_password(password)
                db.session.add(user)
                db.session.commit()
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
        
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
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
    
    user = User.query.filter_by(username=session['user']).first()
    if not user:
        flash('User not found', 'error')
        return redirect(url_for('login'))
    
    user_blogs = [blog for blog in get_all_blogs() if blog.get('author') == session['user']]
    personal_info = json.loads(user.personal_info)
    
    if request.method == 'POST':
        action = request.form.get('action')
        
        if action == 'update_profile_image':
            if 'profile_image' in request.files:
                file = request.files['profile_image']
                if file and file.filename:
                    import uuid
                    filename = f"{uuid.uuid4().hex}_{file.filename}"
                    upload_dir = 'static/uploads'
                    if not os.path.exists(upload_dir):
                        os.makedirs(upload_dir)
                    file.save(os.path.join(upload_dir, filename))
                    
                    info = json.loads(user.personal_info)
                    info['profile_image'] = f'uploads/{filename}'
                    user.personal_info = json.dumps(info)
                    db.session.commit()
                    flash('Profile picture updated successfully!', 'success')
        
        elif action == 'clear_profile_image':
            info = json.loads(user.personal_info)
            if 'profile_image' in info:
                old_image = info['profile_image']
                if old_image:
                    image_path = os.path.join('static', old_image)
                    if os.path.exists(image_path):
                        os.remove(image_path)
                info['profile_image'] = ''
                user.personal_info = json.dumps(info)
                db.session.commit()
                flash('Profile picture removed successfully!', 'success')
        
        elif action == 'update_personal_info':
            info = json.loads(user.personal_info)
            info.update({
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
            user.personal_info = json.dumps(info)
            db.session.commit()
            flash('Personal information updated successfully!', 'success')
        
        elif action == 'change_password':
            current_password = request.form['current_password']
            new_password = request.form['new_password']
            
            if not user.check_password(current_password):
                flash('Current password is incorrect', 'error')
            elif len(new_password) < 6:
                flash('New password must be at least 6 characters', 'error')
            else:
                user.set_password(new_password)
                db.session.commit()
                flash('Password changed successfully!', 'success')
        
        elif action == 'delete_account':
            password = request.form['password']
            if not user.check_password(password):
                flash('Password is incorrect', 'error')
            else:
                username = session['user']
                
                # Delete all user's blog posts
                Blog.query.filter_by(author=username).delete()
                
                # Delete all follow relationships
                Follow.query.filter_by(follower=username).delete()
                Follow.query.filter_by(following=username).delete()
                
                # Delete all notifications
                Notification.query.filter_by(user=username).delete()
                
                # Delete user account
                db.session.delete(user)
                db.session.commit()
                
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
    
    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        session['user'] = username
        return jsonify({'success': True})
    return jsonify({'success': False})

def get_user_info(username):
    user = User.query.filter_by(username=username).first()
    if user:
        return json.loads(user.personal_info)
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
    blog_obj = Blog.query.get(blog_id)
    if blog_obj:
        blog = {
            'id': blog_obj.id,
            'title': blog_obj.title,
            'content': blog_obj.content,
            'author': blog_obj.author,
            'tags': json.loads(blog_obj.tags),
            'word_count': blog_obj.word_count,
            'reading_time': blog_obj.reading_time,
            'created_at': blog_obj.created_at.isoformat(),
            'likes': blog_obj.likes,
            'liked_by': json.loads(blog_obj.liked_by),
            'comments': json.loads(blog_obj.comments)
        }
        if blog_obj.updated_at:
            blog['updated_at'] = blog_obj.updated_at.isoformat()
        
        blog['content_html'] = markdown.markdown(blog['content'])
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
            
            if not save_local:
                blog = Blog(
                    id=blog_id,
                    title=title,
                    author=session['user'],
                    content=content,
                    tags=json.dumps([tag.strip() for tag in tags.split(',') if tag.strip()]),
                    word_count=len(content.split()),
                    reading_time=max(1, len(content.split()) // 200)
                )
                db.session.add(blog)
                db.session.commit()
            
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
            existing_blog = Blog.query.get(blog_id)
            if not existing_blog:
                blog = Blog(
                    id=blog_id,
                    title=blog_data['title'],
                    author=blog_data['author'],
                    content=blog_data['content'],
                    tags=json.dumps(blog_data.get('tags', [])),
                    word_count=blog_data.get('word_count', 0),
                    reading_time=blog_data.get('reading_time', 1)
                )
                db.session.add(blog)
                synced_count += 1
    
    db.session.commit()
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
    
    blog = Blog.query.get(blog_id)
    if not blog:
        flash('Blog post not found', 'error')
        return redirect(url_for('index'))
    
    if blog.author != session['user']:
        flash('You can only edit your own posts', 'error')
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        title = request.form['title']
        content = request.form['content']
        tags = request.form.get('tags', '')
        
        if title and content:
            blog.title = title
            blog.content = content
            blog.tags = json.dumps([tag.strip() for tag in tags.split(',') if tag.strip()])
            blog.word_count = len(content.split())
            blog.reading_time = max(1, len(content.split()) // 200)
            blog.updated_at = datetime.utcnow()
            
            db.session.commit()
            flash('Blog post updated successfully!', 'success')
            return redirect(url_for('view_blog', blog_id=blog_id))
        else:
            flash('Please fill in all fields', 'error')
    
    blog_data = {
        'id': blog.id,
        'title': blog.title,
        'content': blog.content,
        'tags': json.loads(blog.tags)
    }
    return render_template('edit_blog.html', blog=blog_data)

@app.route('/delete/<blog_id>', methods=['POST'])
def delete_blog(blog_id):
    if 'user' not in session:
        flash('Please log in to delete posts', 'error')
        return redirect(url_for('login'))
    
    blog = Blog.query.get(blog_id)
    if blog:
        if blog.author != session['user']:
            flash('You can only delete your own posts', 'error')
            return redirect(url_for('index'))
        
        db.session.delete(blog)
        db.session.commit()
        flash('Blog post deleted successfully!', 'success')
    else:
        flash('Blog post not found', 'error')
    return redirect(url_for('index'))

@app.route('/like/<blog_id>', methods=['POST'])
def like_blog(blog_id):
    if 'user' not in session:
        return jsonify({'error': 'Please log in to like posts'}), 401
    
    blog = Blog.query.get(blog_id)
    if blog:
        liked_by = json.loads(blog.liked_by)
        user = session['user']
        
        if user in liked_by:
            liked_by.remove(user)
            blog.likes -= 1
            liked = False
            message = 'Like removed'
        else:
            liked_by.append(user)
            blog.likes += 1
            liked = True
            message = 'Post liked!'
        
        blog.liked_by = json.dumps(liked_by)
        db.session.commit()
        
        # Add notification for blog author (if not self-like)
        if liked and blog.author != user:
            add_notification(
                blog.author, 
                'like', 
                f"{user} liked your post '{blog.title[:30]}{'...' if len(blog.title) > 30 else ''}",
                blog_id
            )
        
        return jsonify({
            'likes': blog.likes,
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
    
    blog = Blog.query.get(blog_id)
    if blog:
        comments = json.loads(blog.comments)
        
        comment = {
            'author': session['user'],
            'text': comment_text,
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M')
        }
        
        comments.append(comment)
        blog.comments = json.dumps(comments)
        db.session.commit()
        
        # Add notification for blog author (if not self-comment)
        if blog.author != session['user']:
            add_notification(
                blog.author, 
                'comment', 
                f"{session['user']} commented on your post '{blog.title[:30]}{'...' if len(blog.title) > 30 else ''}",
                blog_id
            )
        
        return jsonify({'success': True})
    return jsonify({'error': 'Blog not found'}), 404

@app.route('/comments/<blog_id>')
def get_comments(blog_id):
    blog = Blog.query.get(blog_id)
    if blog:
        comments = json.loads(blog.comments)
        return jsonify({'comments': comments})
    return jsonify({'error': 'Blog not found'}), 404

@app.route('/share/<blog_id>')
def share_blog(blog_id):
    blog = Blog.query.get(blog_id)
    if blog:
        share_data = {
            'title': blog.title,
            'url': request.url_root + f'blog/{blog_id}',
            'text': f"Check out this blog post: {blog.title}"
        }
        return jsonify(share_data)
    return jsonify({'error': 'Blog not found'}), 404

@app.route('/notifications')
def get_notifications():
    if 'user' not in session:
        return jsonify({'notifications': []})
    
    notifications = Notification.query.filter_by(user=session['user']).order_by(Notification.created_at.desc()).all()
    notification_list = []
    for notif in notifications:
        notification_list.append({
            'id': str(notif.id),
            'type': notif.type,
            'message': notif.message,
            'blog_id': notif.blog_id,
            'created_at': notif.created_at.isoformat(),
            'read': notif.read
        })
    return jsonify({'notifications': notification_list})

@app.route('/notifications/mark-read', methods=['POST'])
def mark_notifications_read():
    if 'user' not in session:
        return jsonify({'success': False})
    
    Notification.query.filter_by(user=session['user']).update({'read': True})
    db.session.commit()
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
    
    Notification.query.filter_by(user=session['user']).delete()
    db.session.commit()
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
    user_exists = User.query.filter_by(username=username).first()
    if not user_exists:
        return jsonify({'success': False, 'message': 'User not found'})
    
    # Check if already following
    existing_follow = Follow.query.filter_by(follower=current_user, following=username).first()
    
    if existing_follow:
        # Unfollow
        db.session.delete(existing_follow)
        db.session.commit()
        return jsonify({'success': True, 'message': f'Unfollowed {username}', 'action': 'unfollowed'})
    else:
        # Follow
        follow = Follow(follower=current_user, following=username)
        db.session.add(follow)
        db.session.commit()
        
        # Add notification for followed user
        add_notification(
            username,
            'follow',
            f'{current_user} started following you'
        )
        
        return jsonify({'success': True, 'message': f'Successfully followed {username}!', 'action': 'followed'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='127.0.0.1', port=port, debug=True)