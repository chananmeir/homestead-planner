"""
Photo Management Blueprint

Routes:
- GET/POST /api/photos - List and upload photos
- PUT/DELETE /api/photos/<id> - Update or delete photo
"""
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from PIL import Image
from datetime import datetime
import os

from models import db, Photo
from utils.validators import allowed_file

photos_bp = Blueprint('photos', __name__, url_prefix='/api/photos')


@photos_bp.route('', methods=['GET', 'POST'])
@login_required
def photos():
    """Get all photos or upload new one"""
    if request.method == 'POST':
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            # Add timestamp to filename to avoid conflicts
            name, ext = os.path.splitext(filename)
            filename = f"{name}_{int(datetime.now().timestamp())}{ext}"
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)

            # Save and optimize image
            img = Image.open(file)
            # Resize if too large
            max_size = (1920, 1920)
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            img.save(filepath, optimize=True, quality=85)

            photo = Photo(
                user_id=current_user.id,
                filename=filename,
                filepath=f"/static/uploads/{filename}",
                caption=request.form.get('caption', ''),
                category=request.form.get('category', 'garden'),
                garden_bed_id=request.form.get('gardenBedId') or None
            )
            db.session.add(photo)
            db.session.commit()
            return jsonify(photo.to_dict()), 201

        return jsonify({'error': 'Invalid file type'}), 400

    photos = Photo.query.filter_by(user_id=current_user.id).all()
    return jsonify([photo.to_dict() for photo in photos])


@photos_bp.route('/<int:photo_id>', methods=['PUT', 'DELETE'])
@login_required
def manage_photo(photo_id):
    """Update or delete a photo"""
    photo = Photo.query.get_or_404(photo_id)

    # Verify ownership
    if photo.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        # Delete file from filesystem
        filepath = os.path.join('static/uploads', photo.filename)
        if os.path.exists(filepath):
            os.remove(filepath)
        db.session.delete(photo)
        db.session.commit()
        return '', 204

    # PUT method - update photo metadata
    data = request.json

    if 'caption' in data:
        photo.caption = data['caption']
    if 'category' in data:
        photo.category = data['category']
    if 'gardenBedId' in data:
        photo.garden_bed_id = data['gardenBedId'] if data['gardenBedId'] else None

    db.session.commit()

    return jsonify({
        'id': photo.id,
        'filename': photo.filename,
        'filepath': photo.filepath,
        'caption': photo.caption,
        'category': photo.category,
        'gardenBedId': photo.garden_bed_id,
        'uploadedAt': photo.uploaded_at.isoformat() if photo.uploaded_at else None
    })
