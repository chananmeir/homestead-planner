"""
Trellis Structure Management Blueprint

Routes:
- GET/POST /api/trellis-structures - List and create trellis structures
- GET/PUT/DELETE /api/trellis-structures/<id> - Manage specific trellis
- GET /api/trellis-structures/<id>/capacity - Get capacity and allocation info
"""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import db, TrellisStructure, PlantingEvent, Property
from sqlalchemy import func

trellis_bp = Blueprint('trellis', __name__, url_prefix='/api')


@trellis_bp.route('/trellis-structures', methods=['GET', 'POST'])
@login_required
def trellis_structures():
    """Get all trellis structures or create new one"""
    if request.method == 'POST':
        data = request.json

        # Validate property ownership (optional - only needed if using Property Designer)
        property_id = data.get('propertyId')
        if property_id:
            prop = Property.query.get(property_id)
            if not prop or prop.user_id != current_user.id:
                return jsonify({'error': 'Property not found or unauthorized'}), 403

        # Create trellis structure
        trellis = TrellisStructure(
            user_id=current_user.id,
            property_id=property_id,  # Optional: None if created from Garden Designer
            garden_bed_id=data.get('gardenBedId'),
            name=data['name'],
            trellis_type=data.get('trellisType', 'post_wire'),
            start_x=data['startX'],
            start_y=data['startY'],
            end_x=data['endX'],
            end_y=data['endY'],
            height_inches=data.get('heightInches', 72.0),
            wire_spacing_inches=data.get('wireSpacingInches'),
            num_wires=data.get('numWires'),
            notes=data.get('notes', '')
        )

        # Calculate length automatically
        trellis.calculate_length()

        db.session.add(trellis)
        db.session.commit()
        return jsonify(trellis.to_dict()), 201

    # GET: List all trellis structures for current user
    # Optional filters by property and/or garden bed
    property_id = request.args.get('propertyId', type=int)
    garden_bed_id = request.args.get('gardenBedId', type=int)

    query = TrellisStructure.query.filter_by(user_id=current_user.id)
    if property_id:
        query = query.filter_by(property_id=property_id)
    if garden_bed_id:
        query = query.filter_by(garden_bed_id=garden_bed_id)

    trellises = query.all()
    return jsonify([t.to_dict() for t in trellises])


@trellis_bp.route('/trellis-structures/<int:trellis_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def trellis_structure_detail(trellis_id):
    """Get, update, or delete a specific trellis structure"""
    trellis = TrellisStructure.query.get_or_404(trellis_id)

    # Verify ownership
    if trellis.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        # Check if any plants are allocated to this trellis
        allocated_plants = PlantingEvent.query.filter_by(
            trellis_structure_id=trellis_id
        ).count()

        if allocated_plants > 0:
            return jsonify({
                'error': f'Cannot delete trellis: {allocated_plants} plants are currently allocated to it'
            }), 400

        db.session.delete(trellis)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        trellis.name = data.get('name', trellis.name)
        trellis.trellis_type = data.get('trellisType', trellis.trellis_type)
        trellis.start_x = data.get('startX', trellis.start_x)
        trellis.start_y = data.get('startY', trellis.start_y)
        trellis.end_x = data.get('endX', trellis.end_x)
        trellis.end_y = data.get('endY', trellis.end_y)
        trellis.height_inches = data.get('heightInches', trellis.height_inches)
        trellis.wire_spacing_inches = data.get('wireSpacingInches', trellis.wire_spacing_inches)
        trellis.num_wires = data.get('numWires', trellis.num_wires)
        trellis.notes = data.get('notes', trellis.notes)
        trellis.garden_bed_id = data.get('gardenBedId', trellis.garden_bed_id)

        # Recalculate length if coordinates changed
        trellis.calculate_length()

        db.session.commit()

    return jsonify(trellis.to_dict())


@trellis_bp.route('/trellis-structures/<int:trellis_id>/capacity', methods=['GET'])
@login_required
def trellis_capacity(trellis_id):
    """Calculate and return trellis capacity information"""
    trellis = TrellisStructure.query.get_or_404(trellis_id)

    # Verify ownership
    if trellis.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    # Get all plants allocated to this trellis
    allocated_plants = PlantingEvent.query.filter_by(
        trellis_structure_id=trellis_id,
        user_id=current_user.id
    ).order_by(PlantingEvent.trellis_position_start_inches).all()

    # Calculate total allocated space
    total_allocated_feet = sum(
        (p.linear_feet_allocated or 0) for p in allocated_plants
    )

    # Build occupied segments list
    occupied_segments = []
    for plant in allocated_plants:
        occupied_segments.append({
            'id': plant.id,
            'plantId': plant.plant_id,
            'variety': plant.variety,
            'startInches': plant.trellis_position_start_inches,
            'endInches': plant.trellis_position_end_inches,
            'linearFeet': plant.linear_feet_allocated
        })

    # Calculate available space
    total_length_feet = trellis.total_length_feet
    available_feet = total_length_feet - total_allocated_feet
    percent_occupied = (total_allocated_feet / total_length_feet * 100) if total_length_feet > 0 else 0

    return jsonify({
        'trellisId': trellis_id,
        'totalLengthFeet': total_length_feet,
        'allocatedFeet': round(total_allocated_feet, 2),
        'availableFeet': round(available_feet, 2),
        'occupiedSegments': occupied_segments,
        'percentOccupied': round(percent_occupied, 1)
    })
