"""
Livestock Blueprint

Routes for managing chickens, ducks, beehives, and other livestock.
Includes egg production tracking, hive inspections, honey harvests, and health records.
"""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime, timedelta
from utils.helpers import parse_iso_date
from simulation_clock import get_utc_now

from models import (
    db,
    Chicken,
    Duck,
    Beehive,
    Livestock,
    EggProduction,
    DuckEggProduction,
    HiveInspection,
    HoneyHarvest,
    HealthRecord
)

livestock_bp = Blueprint('livestock', __name__, url_prefix='/api')


# ==================== CHICKEN ROUTES ====================

@livestock_bp.route('/chickens', methods=['GET', 'POST'])
@login_required
def chickens_api():
    """Get all chickens or create new flock"""
    if request.method == 'POST':
        data = request.json
        hatch_date = None
        if data.get('hatchDate'):
            hatch_date = parse_iso_date(data['hatchDate'])

        chicken = Chicken(
            user_id=current_user.id,
            name=data['name'],
            breed=data.get('breed'),
            quantity=data.get('quantity', 1),
            hatch_date=hatch_date,
            purpose=data.get('purpose'),
            sex=data.get('sex'),
            coop_location=data.get('coopLocation'),
            notes=data.get('notes')
        )
        db.session.add(chicken)
        db.session.commit()
        return jsonify(chicken.to_dict()), 201

    status_filter = request.args.get('status', 'active')
    if status_filter == 'all':
        chickens = Chicken.query.filter_by(user_id=current_user.id).all()
    else:
        chickens = Chicken.query.filter_by(user_id=current_user.id, status=status_filter).all()
    return jsonify([c.to_dict() for c in chickens])


@livestock_bp.route('/chickens/<int:chicken_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def chicken_detail(chicken_id):
    """Get, update, or delete a specific chicken/flock"""
    chicken = Chicken.query.get_or_404(chicken_id)

    # Verify ownership
    if chicken.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        db.session.delete(chicken)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        chicken.name = data.get('name', chicken.name)
        chicken.breed = data.get('breed', chicken.breed)
        chicken.quantity = data.get('quantity', chicken.quantity)
        chicken.purpose = data.get('purpose', chicken.purpose)
        chicken.sex = data.get('sex', chicken.sex)
        chicken.status = data.get('status', chicken.status)
        chicken.coop_location = data.get('coopLocation', chicken.coop_location)
        chicken.notes = data.get('notes', chicken.notes)
        db.session.commit()

    return jsonify(chicken.to_dict())


# ==================== EGG PRODUCTION ROUTES ====================

@livestock_bp.route('/egg-production', methods=['GET', 'POST'])
@login_required
def egg_production():
    """Get all egg records or add new record"""
    if request.method == 'POST':
        data = request.json

        # Verify the chicken belongs to current user
        chicken = Chicken.query.get(data['chickenId'])
        if not chicken or chicken.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        record = EggProduction(
            chicken_id=data['chickenId'],
            eggs_collected=data['eggsCollected'],
            eggs_sold=data.get('eggsSold', 0),
            eggs_eaten=data.get('eggsEaten', 0),
            eggs_incubated=data.get('eggsIncubated', 0),
            notes=data.get('notes')
        )
        db.session.add(record)
        db.session.commit()
        return jsonify(record.to_dict()), 201

    # Get recent records (last 30 days) for user's chickens only
    thirty_days_ago = get_utc_now() - timedelta(days=30)
    user_chicken_ids = [c.id for c in Chicken.query.filter_by(user_id=current_user.id).all()]
    records = EggProduction.query.filter(
        EggProduction.date >= thirty_days_ago,
        EggProduction.chicken_id.in_(user_chicken_ids)
    ).order_by(EggProduction.date.desc()).all()
    return jsonify([r.to_dict() for r in records])


# ==================== DUCK ROUTES ====================

@livestock_bp.route('/ducks', methods=['GET', 'POST'])
@login_required
def ducks_api():
    """Get all ducks/waterfowl or create new flock"""
    if request.method == 'POST':
        data = request.json
        hatch_date = None
        if data.get('hatchDate'):
            hatch_date = parse_iso_date(data['hatchDate'])

        duck = Duck(
            user_id=current_user.id,
            name=data['name'],
            breed=data.get('breed'),
            quantity=data.get('quantity', 1),
            hatch_date=hatch_date,
            purpose=data.get('purpose'),
            sex=data.get('sex'),
            coop_location=data.get('coopLocation'),
            notes=data.get('notes')
        )
        db.session.add(duck)
        db.session.commit()
        return jsonify(duck.to_dict()), 201

    status_filter = request.args.get('status', 'active')
    if status_filter == 'all':
        ducks = Duck.query.filter_by(user_id=current_user.id).all()
    else:
        ducks = Duck.query.filter_by(user_id=current_user.id, status=status_filter).all()
    return jsonify([d.to_dict() for d in ducks])


@livestock_bp.route('/ducks/<int:duck_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def duck_detail(duck_id):
    """Get, update, or delete a specific duck flock"""
    duck = Duck.query.get_or_404(duck_id)

    # Verify ownership
    if duck.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        db.session.delete(duck)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        duck.name = data.get('name', duck.name)
        duck.breed = data.get('breed', duck.breed)
        duck.quantity = data.get('quantity', duck.quantity)
        duck.purpose = data.get('purpose', duck.purpose)
        duck.sex = data.get('sex', duck.sex)
        duck.status = data.get('status', duck.status)
        duck.coop_location = data.get('coopLocation', duck.coop_location)
        duck.notes = data.get('notes', duck.notes)
        db.session.commit()

    return jsonify(duck.to_dict())


# ==================== DUCK EGG PRODUCTION ROUTES ====================

@livestock_bp.route('/duck-egg-production', methods=['GET', 'POST'])
@login_required
def duck_egg_production():
    """Get all duck egg records or add new record"""
    if request.method == 'POST':
        data = request.json

        # Verify the duck belongs to current user
        duck = Duck.query.get(data['chickenId'])  # Using same field name for frontend compatibility
        if not duck or duck.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        record = DuckEggProduction(
            chicken_id=data['chickenId'],  # Using same field name for frontend compatibility
            eggs_collected=data['eggsCollected'],
            eggs_sold=data.get('eggsSold', 0),
            eggs_eaten=data.get('eggsEaten', 0),
            eggs_incubated=data.get('eggsIncubated', 0),
            notes=data.get('notes')
        )
        db.session.add(record)
        db.session.commit()
        return jsonify(record.to_dict()), 201

    # Get recent records (last 30 days) for user's ducks only
    thirty_days_ago = get_utc_now() - timedelta(days=30)
    user_duck_ids = [d.id for d in Duck.query.filter_by(user_id=current_user.id).all()]
    records = DuckEggProduction.query.filter(
        DuckEggProduction.date >= thirty_days_ago,
        DuckEggProduction.chicken_id.in_(user_duck_ids)
    ).order_by(DuckEggProduction.date.desc()).all()
    return jsonify([r.to_dict() for r in records])


# ==================== BEEHIVE ROUTES ====================

@livestock_bp.route('/beehives', methods=['GET', 'POST'])
@login_required
def beehives_api():
    """Get all beehives or create new hive"""
    if request.method == 'POST':
        data = request.json
        install_date = None
        if data.get('installDate'):
            install_date = parse_iso_date(data['installDate'])

        hive = Beehive(
            user_id=current_user.id,
            name=data['name'],
            type=data.get('type'),
            install_date=install_date,
            queen_marked=data.get('queenMarked', False),
            queen_color=data.get('queenColor'),
            status=data.get('status', 'active'),
            location=data.get('location'),
            notes=data.get('notes')
        )
        db.session.add(hive)
        db.session.commit()
        return jsonify(hive.to_dict()), 201

    status_filter = request.args.get('status', 'active')
    if status_filter == 'all':
        hives = Beehive.query.filter_by(user_id=current_user.id).all()
    else:
        hives = Beehive.query.filter_by(user_id=current_user.id, status=status_filter).all()
    return jsonify([h.to_dict() for h in hives])


@livestock_bp.route('/beehives/<int:hive_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def beehive_detail(hive_id):
    """Get, update, or delete a specific beehive"""
    hive = Beehive.query.get_or_404(hive_id)

    # Verify ownership
    if hive.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        db.session.delete(hive)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        hive.name = data.get('name', hive.name)
        hive.type = data.get('type', hive.type)
        hive.queen_marked = data.get('queenMarked', hive.queen_marked)
        hive.queen_color = data.get('queenColor', hive.queen_color)
        hive.status = data.get('status', hive.status)
        hive.location = data.get('location', hive.location)
        hive.notes = data.get('notes', hive.notes)
        db.session.commit()

    return jsonify(hive.to_dict())


# ==================== HIVE INSPECTION ROUTES ====================

@livestock_bp.route('/hive-inspections', methods=['GET', 'POST'])
@login_required
def hive_inspections():
    """Get all inspections or add new inspection"""
    if request.method == 'POST':
        data = request.json

        # Verify the beehive belongs to current user
        beehive = Beehive.query.get(data['beehiveId'])
        if not beehive or beehive.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        inspection = HiveInspection(
            beehive_id=data['beehiveId'],
            queen_seen=data.get('queenSeen'),
            eggs_seen=data.get('eggsSeen'),
            brood_pattern=data.get('broodPattern'),
            temperament=data.get('temperament'),
            population=data.get('population'),
            honey_stores=data.get('honeyStores'),
            pests_diseases=data.get('pestsDiseases'),
            actions_taken=data.get('actionsTaken'),
            notes=data.get('notes')
        )
        db.session.add(inspection)
        db.session.commit()
        return jsonify(inspection.to_dict()), 201

    # Get recent inspections (last 60 days) for user's beehives only
    sixty_days_ago = get_utc_now() - timedelta(days=60)
    user_beehive_ids = [h.id for h in Beehive.query.filter_by(user_id=current_user.id).all()]
    inspections = HiveInspection.query.filter(
        HiveInspection.date >= sixty_days_ago,
        HiveInspection.beehive_id.in_(user_beehive_ids)
    ).order_by(HiveInspection.date.desc()).all()
    return jsonify([i.to_dict() for i in inspections])


# ==================== HONEY HARVEST ROUTES ====================

@livestock_bp.route('/honey-harvests', methods=['GET', 'POST'])
@login_required
def honey_harvests():
    """Get all honey harvests or add new harvest"""
    if request.method == 'POST':
        data = request.json

        # Verify the beehive belongs to current user
        beehive = Beehive.query.get(data['beehiveId'])
        if not beehive or beehive.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        harvest = HoneyHarvest(
            beehive_id=data['beehiveId'],
            frames_harvested=data.get('framesHarvested'),
            honey_weight=data.get('honeyWeight'),
            wax_weight=data.get('waxWeight'),
            notes=data.get('notes')
        )
        db.session.add(harvest)
        db.session.commit()
        return jsonify(harvest.to_dict()), 201

    # Get all honey harvests for user's beehives only
    user_beehive_ids = [h.id for h in Beehive.query.filter_by(user_id=current_user.id).all()]
    harvests = HoneyHarvest.query.filter(
        HoneyHarvest.beehive_id.in_(user_beehive_ids)
    ).order_by(HoneyHarvest.date.desc()).all()
    return jsonify([h.to_dict() for h in harvests])


# ==================== GENERAL LIVESTOCK ROUTES ====================

@livestock_bp.route('/livestock', methods=['GET', 'POST'])
@login_required
def livestock_api():
    """Get all livestock or create new animal"""
    if request.method == 'POST':
        data = request.json
        birth_date = None
        if data.get('birthDate'):
            birth_date = parse_iso_date(data['birthDate'])

        animal = Livestock(
            user_id=current_user.id,
            name=data.get('name'),
            species=data.get('species') or data.get('animalType', ''),
            breed=data.get('breed'),
            tag_number=data.get('tagNumber'),
            birth_date=birth_date,
            sex=data.get('sex'),
            purpose=data.get('purpose'),
            sire=data.get('sire'),
            dam=data.get('dam'),
            location=data.get('location'),
            weight=data.get('weight'),
            notes=data.get('notes')
        )
        db.session.add(animal)
        db.session.commit()
        return jsonify(animal.to_dict()), 201

    status_filter = request.args.get('status', 'active')
    if status_filter == 'all':
        animals = Livestock.query.filter_by(user_id=current_user.id).all()
    else:
        animals = Livestock.query.filter_by(user_id=current_user.id, status=status_filter).all()
    return jsonify([a.to_dict() for a in animals])


@livestock_bp.route('/livestock/<int:animal_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def livestock_detail(animal_id):
    """Get, update, or delete a specific livestock animal"""
    animal = Livestock.query.get_or_404(animal_id)

    # Verify ownership
    if animal.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        db.session.delete(animal)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        animal.name = data.get('name', animal.name)
        animal.species = data.get('species') or data.get('animalType', animal.species)
        animal.breed = data.get('breed', animal.breed)
        animal.tag_number = data.get('tagNumber', animal.tag_number)
        animal.sex = data.get('sex', animal.sex)
        animal.purpose = data.get('purpose', animal.purpose)
        animal.status = data.get('status', animal.status)
        animal.location = data.get('location', animal.location)
        animal.weight = data.get('weight', animal.weight)
        animal.notes = data.get('notes', animal.notes)
        db.session.commit()

    return jsonify(animal.to_dict())


# ==================== HEALTH RECORD ROUTES ====================

@livestock_bp.route('/health-records', methods=['GET', 'POST'])
@login_required
def health_records():
    """Get all health records or add new record"""
    if request.method == 'POST':
        data = request.json
        next_due = None
        if data.get('nextDueDate'):
            next_due = parse_iso_date(data['nextDueDate'])

        record = HealthRecord(
            livestock_id=data['livestockId'],
            type=data['type'],
            treatment=data.get('treatment'),
            medication=data.get('medication'),
            dosage=data.get('dosage'),
            veterinarian=data.get('veterinarian'),
            cost=data.get('cost'),
            next_due_date=next_due,
            notes=data.get('notes')
        )
        db.session.add(record)
        db.session.commit()
        return jsonify(record.to_dict()), 201

    records = HealthRecord.query.join(Livestock).filter(
        Livestock.user_id == current_user.id
    ).order_by(HealthRecord.date.desc()).limit(50).all()
    return jsonify([r.to_dict() for r in records])
