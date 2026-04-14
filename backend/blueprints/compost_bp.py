"""
Compost Tracking Blueprint

Routes:
- GET/POST /api/compost-piles - List and create compost piles
- GET/PUT/DELETE /api/compost-piles/<id> - Manage specific pile
- POST /api/compost-piles/<id>/ingredients - Add ingredient to pile
"""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime, timedelta

from models import db, CompostPile, CompostIngredient
from plant_database import COMPOST_MATERIALS

compost_bp = Blueprint('compost', __name__, url_prefix='/api/compost-piles')


@compost_bp.route('', methods=['GET', 'POST'])
@login_required
def compost_piles():
    """Get all compost piles or create new one"""
    if request.method == 'POST':
        data = request.json
        pile = CompostPile(
            user_id=current_user.id,
            name=data['name'],
            location=data['location'],
            width=data['size']['width'],
            length=data['size']['length'],
            height=data['size']['height'],
            estimated_ready_date=datetime.now() + timedelta(days=90)
        )
        db.session.add(pile)
        db.session.commit()
        return jsonify(pile.to_dict()), 201

    piles = CompostPile.query.filter_by(user_id=current_user.id).all()
    return jsonify([pile.to_dict() for pile in piles])


@compost_bp.route('/<int:pile_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def compost_pile(pile_id):
    """Get, update, or delete a compost pile"""
    pile = CompostPile.query.get_or_404(pile_id)

    # Verify ownership
    if pile.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        db.session.delete(pile)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        pile.status = data.get('status', pile.status)
        pile.moisture = data.get('moisture', pile.moisture)
        if data.get('lastTurned'):
            pile.last_turned = datetime.now()
        db.session.commit()

    return jsonify(pile.to_dict())


@compost_bp.route('/<int:pile_id>/ingredients', methods=['POST'])
@login_required
def add_compost_ingredient(pile_id):
    """Add ingredient to compost pile"""
    pile = CompostPile.query.get_or_404(pile_id)

    # Verify ownership
    if pile.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.json

    material = COMPOST_MATERIALS.get(data['material'])
    if not material:
        return jsonify({'error': 'Invalid material'}), 400

    ingredient = CompostIngredient(
        compost_pile_id=pile_id,
        name=data['material'],
        amount=data['amount'],
        type=material['type'],
        cn_ratio=material['cnRatio']
    )
    db.session.add(ingredient)

    # Recalculate C:N ratio
    total_carbon = 0
    total_nitrogen = 0
    for ing in pile.ingredients:
        carbon = (ing.cn_ratio * ing.amount) / 31
        nitrogen = ing.amount / 31
        total_carbon += carbon
        total_nitrogen += nitrogen

    # Add new ingredient
    carbon = (ingredient.cn_ratio * ingredient.amount) / 31
    nitrogen = ingredient.amount / 31
    total_carbon += carbon
    total_nitrogen += nitrogen

    pile.cn_ratio = total_carbon / total_nitrogen if total_nitrogen > 0 else 30

    db.session.commit()
    return jsonify(pile.to_dict())
