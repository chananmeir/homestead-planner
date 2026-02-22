from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import json

db = SQLAlchemy()

class User(UserMixin, db.Model):
    """
    User model for authentication and multi-user support.
    Each user has their own seed inventory and planting data.
    """
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False, index=True)
    email = db.Column(db.String(200), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_login = db.Column(db.DateTime)

    # Relationships will be added when UserSeedInventory model is created in Phase 2
    # seed_inventory = db.relationship('UserSeedInventory', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        """Hash and set the user's password"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verify a password against the hash"""
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        """Convert user to dictionary (password_hash never exposed)"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'isAdmin': self.is_admin,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'lastLogin': self.last_login.isoformat() if self.last_login else None
        }

    def __repr__(self):
        return f'<User {self.username}>'

class GardenBed(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    width = db.Column(db.Float, nullable=False)
    length = db.Column(db.Float, nullable=False)
    height = db.Column(db.Float, default=12.0)  # inches - raised bed height (default 12" standard)
    location = db.Column(db.String(200))
    sun_exposure = db.Column(db.String(20))  # full, partial, shade
    planning_method = db.Column(db.String(50), default='square-foot')  # square-foot, row, intensive, raised-bed, permaculture, container
    grid_size = db.Column(db.Integer, default=12)  # inches per grid cell (NOT cell count) - e.g., 12 = 1 foot squares
    season_extension = db.Column(db.Text)  # JSON: {type, layers, material, notes} - protection structure for season extension
    soil_type = db.Column(db.String(20), default='loamy')  # sandy, loamy, clay
    mulch_type = db.Column(db.String(20), default='none')  # none, straw, wood-chips, leaves, grass, compost, black-plastic, clear-plastic
    zone = db.Column(db.String(10))  # Permaculture zone: zone0, zone1, zone2, zone3, zone4, zone5
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='garden_beds')
    planted_items = db.relationship('PlantedItem', backref='garden_bed', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        # Parse season_extension JSON if present
        season_ext = None
        if self.season_extension:
            try:
                season_ext = json.loads(self.season_extension)
            except json.JSONDecodeError:
                season_ext = None

        return {
            'id': self.id,
            'name': self.name,
            'width': self.width,
            'length': self.length,
            'height': self.height,
            'location': self.location,
            'sunExposure': self.sun_exposure,
            'planningMethod': self.planning_method,
            'gridSize': self.grid_size,
            'seasonExtension': season_ext,
            'soilType': self.soil_type,
            'mulchType': self.mulch_type,
            'zone': self.zone,
            'plantedItems': [item.to_dict() for item in self.planted_items]
        }

class PlantedItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    plant_id = db.Column(db.String(50), nullable=False)  # Reference to plant in database
    variety = db.Column(db.String(100))  # Specific variety (e.g., "Buttercrunch", "Romaine", "Red Leaf")
    garden_bed_id = db.Column(db.Integer, db.ForeignKey('garden_bed.id'), nullable=False)
    planted_date = db.Column(db.DateTime, default=datetime.utcnow)
    transplant_date = db.Column(db.DateTime)
    harvest_date = db.Column(db.DateTime)
    position_x = db.Column(db.Integer, default=0)
    position_y = db.Column(db.Integer, default=0)
    quantity = db.Column(db.Integer, default=1)
    status = db.Column(db.String(20), default='planned')  # planned, seeded, transplanted, growing, harvested, saving-seed
    notes = db.Column(db.Text)

    # Seed saving fields
    save_for_seed = db.Column(db.Boolean, default=False, nullable=False)
    seed_maturity_date = db.Column(db.DateTime, nullable=True)
    seeds_collected = db.Column(db.Boolean, default=False, nullable=False)
    seeds_collected_date = db.Column(db.DateTime, nullable=True)

    # Link to season plan item for progress tracking
    source_plan_item_id = db.Column(
        db.Integer,
        db.ForeignKey('garden_plan_item.id', ondelete='SET NULL'),
        nullable=True,
        index=True
    )

    # Relationships
    user = db.relationship('User', backref='planted_items')
    source_plan_item = db.relationship('GardenPlanItem',
        backref=db.backref('placed_items', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'plantId': self.plant_id,
            'variety': self.variety,
            'plantedDate': self.planted_date.isoformat() if self.planted_date else None,
            'transplantDate': self.transplant_date.isoformat() if self.transplant_date else None,
            'harvestDate': self.harvest_date.isoformat() if self.harvest_date else None,
            'position': {'x': self.position_x, 'y': self.position_y},
            'quantity': self.quantity,
            'status': self.status,
            'notes': self.notes,
            'sourcePlanItemId': self.source_plan_item_id,
            'saveForSeed': self.save_for_seed,
            'seedMaturityDate': self.seed_maturity_date.isoformat() if self.seed_maturity_date else None,
            'seedsCollected': self.seeds_collected,
            'seedsCollectedDate': self.seeds_collected_date.isoformat() if self.seeds_collected_date else None
        }

class PlantingEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Event type discriminator - supports different types of garden events
    event_type = db.Column(db.String(50), default='planting')  # 'planting', 'mulch', 'fertilizing', 'irrigation', etc.
    event_details = db.Column(db.Text)  # JSON string with event-specific data

    # Plant-specific fields (nullable for non-planting events like mulch)
    plant_id = db.Column(db.String(50))  # Required for 'planting' events, null for others
    variety = db.Column(db.String(100))  # Specific variety (e.g., "Brandywine", "Roma", "Red Leaf")
    garden_bed_id = db.Column(db.Integer, db.ForeignKey('garden_bed.id'))
    seed_start_date = db.Column(db.DateTime)
    transplant_date = db.Column(db.DateTime)
    direct_seed_date = db.Column(db.DateTime)
    expected_harvest_date = db.Column(db.DateTime)
    actual_harvest_date = db.Column(db.DateTime)
    succession_planting = db.Column(db.Boolean, default=False)
    succession_interval = db.Column(db.Integer)  # days
    succession_group_id = db.Column(db.String(50))  # UUID linking events in succession series
    position_x = db.Column(db.Integer)  # Grid X coordinate (nullable)
    position_y = db.Column(db.Integer)  # Grid Y coordinate (nullable)
    space_required = db.Column(db.Integer)  # Grid cells needed (nullable)
    conflict_override = db.Column(db.Boolean, default=False)  # User allowed conflict

    # Planting method: determines which fields are used
    planting_method = db.Column(db.String(50), default='individual_plants')  # 'individual_plants' or 'seed_density'

    # For individual_plants method (Square-Foot, Row, Intensive, etc.)
    quantity = db.Column(db.Integer)  # Number of individual plants
    spacing = db.Column(db.Float)  # Spacing between plants (inches)

    # Seed density fields for MIGardener method (row-based, broadcast, or plant-spacing)
    # MIGardener supports three planting styles:
    # 1. Row-based: Continuous rows with dense seeding along rows
    # 2. Broadcast: Area-based dense seeding (no rows)
    # 3. Plant-spacing: Multi-seed spots with thinning (e.g., beans: 3 seeds → thin to 1)

    # Row-based seed density fields
    seed_count = db.Column(db.Integer)  # Number of seeds sown in segment/cell/spot
    seed_density = db.Column(db.Float)  # Seeds per linear inch of row (row-based only)
    ui_segment_length_inches = db.Column(db.Float)  # UI grid segment size (row-based only)

    # Broadcast seed density fields
    seed_density_per_sq_ft = db.Column(db.Float)  # Seeds per square foot (broadcast only)
    grid_cell_area_inches = db.Column(db.Float)  # Grid cell area in sq inches (broadcast only)

    # Plant-spacing seed density fields
    seeds_per_spot = db.Column(db.Integer)  # Seeds planted per spot (plant-spacing only, e.g., 3)
    plants_kept_per_spot = db.Column(db.Integer)  # Plants kept after thinning (plant-spacing only, e.g., 1)

    planting_style = db.Column(db.String(20))  # 'row_based', 'broadcast', 'dense_patch', or 'plant_spacing'

    # Common seed density fields
    expected_germination_rate = db.Column(db.Float)  # 0.0-1.0 (e.g., 0.85 = 85%)
    expected_survival_rate = db.Column(db.Float)  # 0.0-1.0 (e.g., 0.35 = 35% after self-thinning)
    expected_final_count = db.Column(db.Integer)  # Calculated: seedCount × germination × survival
    harvest_method = db.Column(db.String(50))  # 'individual_head', 'cut_and_come_again', 'leaf_mass'

    # Row continuity tracking (links adjacent segments into continuous rows - row-based only)
    row_group_id = db.Column(db.String(50))  # UUID linking adjacent segments into continuous rows
    row_segment_index = db.Column(db.Integer)  # Position within continuous row (0, 1, 2...)
    total_row_segments = db.Column(db.Integer)  # How many segments in this continuous row

    # MIGardener physical row number (independent of grid position)
    row_number = db.Column(db.Integer)  # Physical row index (1, 2, 3...) for MIGardener methodology

    # Trellis-based planting fields (for trellis_linear style crops like grapes, pole beans)
    trellis_structure_id = db.Column(db.Integer, db.ForeignKey('trellis_structure.id'))  # Link to trellis
    trellis_position_start_inches = db.Column(db.Float)  # Start position along trellis (inches from start)
    trellis_position_end_inches = db.Column(db.Float)    # End position along trellis (inches from start)
    linear_feet_allocated = db.Column(db.Float)          # Linear feet used on trellis

    completed = db.Column(db.Boolean, default=False)
    quantity_completed = db.Column(db.Integer, nullable=True, default=None)  # How many actually planted (None=not started, 0-quantity=partial, >=quantity=complete)
    notes = db.Column(db.Text)
    export_key = db.Column(db.String(100), nullable=True, index=True)  # Idempotency key for preventing duplicate exports
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='planting_events')

    def to_dict(self):
        return {
            'id': self.id,
            'eventType': self.event_type or 'planting',  # Default to 'planting' for backward compatibility
            'eventDetails': self.event_details,
            'plantId': self.plant_id,
            'variety': self.variety,
            'gardenBedId': self.garden_bed_id,
            'seedStartDate': self.seed_start_date.isoformat() if self.seed_start_date else None,
            'transplantDate': self.transplant_date.isoformat() if self.transplant_date else None,
            'directSeedDate': self.direct_seed_date.isoformat() if self.direct_seed_date else None,
            'expectedHarvestDate': self.expected_harvest_date.isoformat() if self.expected_harvest_date else None,
            'actualHarvestDate': self.actual_harvest_date.isoformat() if self.actual_harvest_date else None,
            'successionPlanting': self.succession_planting,
            'successionInterval': self.succession_interval,
            'successionGroupId': self.succession_group_id,
            'positionX': self.position_x,
            'positionY': self.position_y,
            'spaceRequired': self.space_required,
            'conflictOverride': self.conflict_override,
            'completed': self.completed,
            'quantityCompleted': self.quantity_completed,
            'notes': self.notes,
            # NEW: Seed density fields
            'plantingMethod': self.planting_method,
            'quantity': self.quantity,
            'spacing': self.spacing,
            'seedCount': self.seed_count,
            'seedDensity': self.seed_density,
            'uiSegmentLengthInches': self.ui_segment_length_inches,
            'expectedGerminationRate': self.expected_germination_rate,
            'expectedSurvivalRate': self.expected_survival_rate,
            'expectedFinalCount': self.expected_final_count,
            'harvestMethod': self.harvest_method,
            # Row continuity fields
            'rowGroupId': self.row_group_id,
            'rowSegmentIndex': self.row_segment_index,
            'totalRowSegments': self.total_row_segments,
            # MIGardener row number
            'rowNumber': self.row_number,
            # Trellis fields
            'trellisStructureId': self.trellis_structure_id,
            'trellisPositionStartInches': self.trellis_position_start_inches,
            'trellisPositionEndInches': self.trellis_position_end_inches,
            'linearFeetAllocated': self.linear_feet_allocated,
            'exportKey': self.export_key
        }

class CompostPile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    start_date = db.Column(db.DateTime, default=datetime.utcnow)
    location = db.Column(db.String(200))
    width = db.Column(db.Float)
    length = db.Column(db.Float)
    height = db.Column(db.Float)
    last_turned = db.Column(db.DateTime)
    estimated_ready_date = db.Column(db.DateTime)
    temperature = db.Column(db.Float)
    moisture = db.Column(db.String(20), default='ideal')  # dry, ideal, wet
    cn_ratio = db.Column(db.Float, default=30.0)
    status = db.Column(db.String(20), default='building')  # building, cooking, curing, ready
    notes = db.Column(db.Text)

    # Relationships
    user = db.relationship('User', backref='compost_piles')
    ingredients = db.relationship('CompostIngredient', backref='compost_pile', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'startDate': self.start_date.isoformat() if self.start_date else None,
            'location': self.location,
            'size': {'width': self.width, 'length': self.length, 'height': self.height},
            'lastTurned': self.last_turned.isoformat() if self.last_turned else None,
            'estimatedReadyDate': self.estimated_ready_date.isoformat() if self.estimated_ready_date else None,
            'temperature': self.temperature,
            'moisture': self.moisture,
            'carbonNitrogenRatio': self.cn_ratio,
            'status': self.status,
            'notes': self.notes,
            'ingredients': [ing.to_dict() for ing in self.ingredients]
        }

class CompostIngredient(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    compost_pile_id = db.Column(db.Integer, db.ForeignKey('compost_pile.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)  # cubic feet
    type = db.Column(db.String(10))  # green or brown
    added_date = db.Column(db.DateTime, default=datetime.utcnow)
    cn_ratio = db.Column(db.Float)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'amount': self.amount,
            'type': self.type,
            'addedDate': self.added_date.isoformat() if self.added_date else None,
            'carbonNitrogenRatio': self.cn_ratio
        }

class Settings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    key = db.Column(db.String(50), nullable=False)
    value = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='settings')

    # Note: Changed 'key' to no longer be unique globally, as it should be unique per-user
    __table_args__ = (db.UniqueConstraint('user_id', 'key', name='_user_key_uc'),)

    @staticmethod
    def get_setting(key, default=None, user_id=None):
        filters = {'key': key}
        if user_id is not None:
            filters['user_id'] = user_id
        setting = Settings.query.filter_by(**filters).first()
        return setting.value if setting else default

    @staticmethod
    def set_setting(key, value, user_id=None):
        filters = {'key': key}
        if user_id is not None:
            filters['user_id'] = user_id
        setting = Settings.query.filter_by(**filters).first()
        if setting:
            setting.value = value
        else:
            setting = Settings(key=key, value=value, user_id=user_id)
            db.session.add(setting)
        db.session.commit()

class Photo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    filepath = db.Column(db.String(500), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    plant_id = db.Column(db.String(50))  # Optional: link to plant
    garden_bed_id = db.Column(db.Integer, db.ForeignKey('garden_bed.id'))
    planted_item_id = db.Column(db.Integer, db.ForeignKey('planted_item.id'))
    caption = db.Column(db.Text)
    category = db.Column(db.String(50))  # 'garden', 'plant', 'harvest', 'pest'

    # Relationships
    user = db.relationship('User', backref='photos')

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'filepath': self.filepath,
            'uploadedAt': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'plantId': self.plant_id,
            'gardenBedId': self.garden_bed_id,
            'plantedItemId': self.planted_item_id,
            'caption': self.caption,
            'category': self.category
        }

class HarvestRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    plant_id = db.Column(db.String(50), nullable=False)
    planted_item_id = db.Column(db.Integer, db.ForeignKey('planted_item.id'))
    harvest_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    quantity = db.Column(db.Float, nullable=False)  # Weight in lbs or count
    unit = db.Column(db.String(20), default='lbs')  # lbs, oz, count
    notes = db.Column(db.Text)
    quality = db.Column(db.String(20))  # excellent, good, fair, poor

    # Relationships
    user = db.relationship('User', backref='harvest_records')

    def to_dict(self):
        return {
            'id': self.id,
            'plantId': self.plant_id,
            'plantedItemId': self.planted_item_id,
            'harvestDate': self.harvest_date.isoformat() if self.harvest_date else None,
            'quantity': self.quantity,
            'unit': self.unit,
            'notes': self.notes,
            'quality': self.quality
        }

class SeedInventory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # NULL for global catalog seeds
    plant_id = db.Column(db.String(50), nullable=False)
    variety = db.Column(db.String(100), nullable=False)
    brand = db.Column(db.String(100))
    quantity = db.Column(db.Integer)  # Number of seeds/packets
    purchase_date = db.Column(db.DateTime)
    expiration_date = db.Column(db.DateTime)
    germination_rate = db.Column(db.Float)  # Percentage
    location = db.Column(db.String(100))  # Storage location
    price = db.Column(db.Float)
    seeds_per_packet = db.Column(db.Integer, default=50)  # Seeds per packet (default 50)
    notes = db.Column(db.Text)
    is_global = db.Column(db.Boolean, default=False, index=True)  # Shared catalog for all users
    catalog_seed_id = db.Column(db.Integer, db.ForeignKey('seed_inventory.id'), nullable=True, index=True)  # Reference to catalog seed if cloned from catalog
    last_synced_at = db.Column(db.DateTime, nullable=True)  # Last time agronomic data was synced from catalog
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Seed provenance (homegrown seed tracking)
    source_planted_item_id = db.Column(db.Integer, db.ForeignKey('planted_item.id', ondelete='SET NULL'), nullable=True, index=True)
    is_homegrown = db.Column(db.Boolean, default=False, nullable=False)

    # Relationships
    user = db.relationship('User', backref='seed_inventory')

    # Variety-specific agronomic overrides (nullable - NULL means "use plant_id defaults")
    # Core agronomic fields
    days_to_maturity = db.Column(db.Integer)  # Override DTM for this variety
    germination_days = db.Column(db.Integer)  # Days from planting to emergence
    plant_spacing = db.Column(db.Integer)  # Inches between plants
    row_spacing = db.Column(db.Integer)  # Inches between rows
    planting_depth = db.Column(db.Float)  # Inches

    # Temperature overrides
    germination_temp_min = db.Column(db.Integer)  # Min germination temp (F)
    germination_temp_max = db.Column(db.Integer)  # Max germination temp (F)
    soil_temp_min = db.Column(db.Integer)  # Min soil temp for planting (F)

    # Qualitative overrides
    heat_tolerance = db.Column(db.String(20))  # low/medium/high/excellent
    cold_tolerance = db.Column(db.String(20))  # tender/hardy/very-hardy
    bolt_resistance = db.Column(db.String(20))  # low/medium/high
    ideal_seasons = db.Column(db.String(100))  # Comma-separated: spring,summer,fall,winter

    # Additional variety-specific data
    flavor_profile = db.Column(db.Text)  # e.g., "Sweet, crisp, nutty"
    storage_rating = db.Column(db.String(20))  # poor/fair/good/excellent

    def get_seeds_used(self):
        """Calculate total seeds used by linked IndoorSeedStart records."""
        result = db.session.query(db.func.coalesce(db.func.sum(IndoorSeedStart.seeds_started), 0)).filter(
            IndoorSeedStart.seed_inventory_id == self.id
        ).scalar()
        return result

    def to_dict(self):
        seeds_used = self.get_seeds_used()
        total_seeds = (self.quantity or 0) * (self.seeds_per_packet or 50)

        result = {
            'id': self.id,
            'plantId': self.plant_id,
            'variety': self.variety,
            'brand': self.brand,
            'quantity': self.quantity,
            'purchaseDate': self.purchase_date.isoformat() if self.purchase_date else None,
            'expirationDate': self.expiration_date.isoformat() if self.expiration_date else None,
            'germinationRate': self.germination_rate,
            'location': self.location,
            'price': self.price,
            'seedsPerPacket': self.seeds_per_packet,
            'notes': self.notes,
            'isGlobal': self.is_global,
            'catalogSeedId': self.catalog_seed_id,
            'lastSyncedAt': self.last_synced_at.isoformat() if self.last_synced_at else None,
            'seedsUsed': seeds_used,
            'seedsAvailable': total_seeds - seeds_used,
            'totalSeeds': total_seeds,
            'sourcePlantedItemId': self.source_planted_item_id,
            'isHomegrown': self.is_homegrown
        }

        # Only include variety-specific agronomic overrides if they have values
        if self.days_to_maturity is not None:
            result['daysToMaturity'] = self.days_to_maturity
        if self.germination_days is not None:
            result['germinationDays'] = self.germination_days
        if self.plant_spacing is not None:
            result['plantSpacing'] = self.plant_spacing
        if self.row_spacing is not None:
            result['rowSpacing'] = self.row_spacing
        if self.planting_depth is not None:
            result['plantingDepth'] = self.planting_depth
        if self.germination_temp_min is not None:
            result['germinationTempMin'] = self.germination_temp_min
        if self.germination_temp_max is not None:
            result['germinationTempMax'] = self.germination_temp_max
        if self.soil_temp_min is not None:
            result['soilTempMin'] = self.soil_temp_min
        if self.heat_tolerance is not None:
            result['heatTolerance'] = self.heat_tolerance
        if self.cold_tolerance is not None:
            result['coldTolerance'] = self.cold_tolerance
        if self.bolt_resistance is not None:
            result['boltResistance'] = self.bolt_resistance
        if self.ideal_seasons is not None:
            result['idealSeasons'] = self.ideal_seasons
        if self.flavor_profile is not None:
            result['flavorProfile'] = self.flavor_profile
        if self.storage_rating is not None:
            result['storageRating'] = self.storage_rating

        return result

class Property(db.Model):
    """Represents the entire homestead property/lot"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    width = db.Column(db.Float, nullable=False)  # Width in feet
    length = db.Column(db.Float, nullable=False)  # Length in feet
    address = db.Column(db.String(200))
    latitude = db.Column(db.Float)  # Geographic latitude
    longitude = db.Column(db.Float)  # Geographic longitude
    zone = db.Column(db.String(10))  # USDA hardiness zone
    soil_type = db.Column(db.String(50))  # clay, loam, sandy, etc.
    slope = db.Column(db.String(20))  # flat, gentle, steep
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='properties')
    structures = db.relationship('PlacedStructure', backref='property', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'width': self.width,
            'length': self.length,
            'address': self.address,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'zone': self.zone,
            'soilType': self.soil_type,
            'slope': self.slope,
            'notes': self.notes,
            'acreage': round((self.width * self.length) / 43560, 2),  # Convert sq ft to acres
            'placedStructures': [s.to_dict() for s in self.structures]
        }

class PlacedStructure(db.Model):
    """Represents a structure placed on the property"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    property_id = db.Column(db.Integer, db.ForeignKey('property.id'), nullable=False)
    structure_id = db.Column(db.String(50), nullable=False)  # Reference to structures_database or 'garden-bed-{id}'
    garden_bed_id = db.Column(db.Integer, db.ForeignKey('garden_bed.id'))  # Link to garden bed if this is a placed bed
    name = db.Column(db.String(100))  # Custom name for this instance
    position_x = db.Column(db.Float, nullable=False)  # X position on property (feet from left)
    position_y = db.Column(db.Float, nullable=False)  # Y position on property (feet from top)
    rotation = db.Column(db.Integer, default=0)  # 0, 90, 180, 270 degrees
    notes = db.Column(db.Text)
    built_date = db.Column(db.DateTime)
    cost = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Custom dimensions (nullable - NULL means use structure definition defaults)
    custom_width = db.Column(db.Float)   # Override width in feet
    custom_length = db.Column(db.Float)  # Override length in feet

    # Shape type ('rectangle' or 'circle')
    shape_type = db.Column(db.String(20), default='rectangle')  # 'rectangle' or 'circle'

    # Relationships
    user = db.relationship('User', backref='placed_structures')

    def get_width(self):
        """
        Get effective width for this placed structure.
        Returns custom_width if set, otherwise falls back to structure definition.
        """
        if self.custom_width is not None:
            return self.custom_width

        # Import here to avoid circular dependency
        from structures_database import get_structure_by_id
        structure = get_structure_by_id(self.structure_id)
        return structure['width'] if structure else 0

    def get_length(self):
        """
        Get effective length for this placed structure.
        Returns custom_length if set, otherwise falls back to structure definition.
        For circles, length is not used.
        """
        if self.custom_length is not None:
            return self.custom_length

        # Import here to avoid circular dependency
        from structures_database import get_structure_by_id
        structure = get_structure_by_id(self.structure_id)
        return structure['length'] if structure else 0

    def get_diameter(self):
        """
        Get diameter for circular structures.
        For circles, width represents diameter.
        """
        return self.get_width()

    def to_dict(self):
        return {
            'id': self.id,
            'propertyId': self.property_id,
            'structureId': self.structure_id,
            'gardenBedId': self.garden_bed_id,
            'name': self.name,
            'positionX': self.position_x,
            'positionY': self.position_y,
            'rotation': self.rotation,
            'notes': self.notes,
            'builtDate': self.built_date.isoformat() if self.built_date else None,
            'cost': self.cost,
            # Custom dimension support
            'customWidth': self.custom_width,
            'customLength': self.custom_length,
            'width': self.get_width(),    # Computed effective width
            'length': self.get_length(),  # Computed effective length
            # Shape support
            'shapeType': self.shape_type or 'rectangle',  # 'rectangle' or 'circle'
            'diameter': self.get_diameter() if (self.shape_type == 'circle' and self.get_width() > 0) else None
        }

class TrellisStructure(db.Model):
    """Represents a trellis structure for linear vine crop allocation"""
    __tablename__ = 'trellis_structure'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    property_id = db.Column(db.Integer, db.ForeignKey('property.id'))  # Optional: only needed if using Property Designer
    garden_bed_id = db.Column(db.Integer, db.ForeignKey('garden_bed.id'))  # Optional: link to bed
    name = db.Column(db.String(100), nullable=False)
    trellis_type = db.Column(db.String(50), default='post_wire')  # fence, arbor, a-frame, post_wire, espalier

    # Line geometry (start and end points)
    start_x = db.Column(db.Float, nullable=False)  # X coordinate in feet
    start_y = db.Column(db.Float, nullable=False)  # Y coordinate in feet
    end_x = db.Column(db.Float, nullable=False)    # X coordinate in feet
    end_y = db.Column(db.Float, nullable=False)    # Y coordinate in feet

    # Calculated lengths
    total_length_feet = db.Column(db.Float, nullable=False)
    total_length_inches = db.Column(db.Float, nullable=False)

    # Physical specifications
    height_inches = db.Column(db.Float, default=72.0)  # Default 6 feet tall
    wire_spacing_inches = db.Column(db.Float)  # Optional: spacing between horizontal wires
    num_wires = db.Column(db.Integer)  # Optional: number of horizontal wires

    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='trellis_structures')

    def calculate_length(self):
        """Calculate trellis length using Pythagorean theorem"""
        import math
        dx = self.end_x - self.start_x
        dy = self.end_y - self.start_y
        length_feet = math.sqrt(dx**2 + dy**2)
        self.total_length_feet = round(length_feet, 2)
        self.total_length_inches = round(length_feet * 12, 2)

    def to_dict(self):
        return {
            'id': self.id,
            'propertyId': self.property_id,
            'gardenBedId': self.garden_bed_id,
            'name': self.name,
            'trellisType': self.trellis_type,
            'startX': self.start_x,
            'startY': self.start_y,
            'endX': self.end_x,
            'endY': self.end_y,
            'totalLengthFeet': self.total_length_feet,
            'totalLengthInches': self.total_length_inches,
            'heightInches': self.height_inches,
            'wireSpacingInches': self.wire_spacing_inches,
            'numWires': self.num_wires,
            'notes': self.notes,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }

class Chicken(db.Model):
    """Track individual chickens or flocks"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100))  # Name or flock ID
    breed = db.Column(db.String(100))
    quantity = db.Column(db.Integer, default=1)  # Number of birds
    hatch_date = db.Column(db.DateTime)
    purpose = db.Column(db.String(50))  # eggs, meat, dual-purpose
    sex = db.Column(db.String(20))  # hen, rooster, mixed
    status = db.Column(db.String(20), default='active')  # active, sold, deceased

    # Relationships
    user = db.relationship('User', backref='chickens')
    coop_location = db.Column(db.String(100))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    egg_records = db.relationship('EggProduction', backref='flock', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'breed': self.breed,
            'quantity': self.quantity,
            'hatchDate': self.hatch_date.isoformat() if self.hatch_date else None,
            'purpose': self.purpose,
            'sex': self.sex,
            'status': self.status,
            'coopLocation': self.coop_location,
            'notes': self.notes,
            'ageWeeks': self.get_age_weeks()
        }

    def get_age_weeks(self):
        if not self.hatch_date:
            return None
        delta = datetime.utcnow() - self.hatch_date
        return int(delta.days / 7)

class EggProduction(db.Model):
    """Daily egg production records"""
    id = db.Column(db.Integer, primary_key=True)
    chicken_id = db.Column(db.Integer, db.ForeignKey('chicken.id'), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    eggs_collected = db.Column(db.Integer, nullable=False)
    eggs_sold = db.Column(db.Integer, default=0)
    eggs_eaten = db.Column(db.Integer, default=0)
    eggs_incubated = db.Column(db.Integer, default=0)
    notes = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'chickenId': self.chicken_id,
            'date': self.date.isoformat() if self.date else None,
            'eggsCollected': self.eggs_collected,
            'eggsSold': self.eggs_sold,
            'eggsEaten': self.eggs_eaten,
            'eggsIncubated': self.eggs_incubated,
            'notes': self.notes
        }

class Duck(db.Model):
    """Track ducks, geese, and other waterfowl flocks"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100))  # Name or flock ID
    breed = db.Column(db.String(100))  # Can include 'duck' or 'goose' type
    quantity = db.Column(db.Integer, default=1)  # Number of birds
    hatch_date = db.Column(db.DateTime)

    # Relationships
    user = db.relationship('User', backref='ducks')
    purpose = db.Column(db.String(50))  # eggs, meat, dual-purpose, pet
    sex = db.Column(db.String(20))  # hens, drakes, mixed
    status = db.Column(db.String(20), default='active')  # active, sold, deceased
    coop_location = db.Column(db.String(100))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    egg_records = db.relationship('DuckEggProduction', backref='flock', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'breed': self.breed,
            'quantity': self.quantity,
            'hatchDate': self.hatch_date.isoformat() if self.hatch_date else None,
            'purpose': self.purpose,
            'sex': self.sex,
            'status': self.status,
            'coopLocation': self.coop_location,
            'notes': self.notes,
            'ageWeeks': self.get_age_weeks()
        }

    def get_age_weeks(self):
        if not self.hatch_date:
            return None
        delta = datetime.utcnow() - self.hatch_date
        return int(delta.days / 7)

class DuckEggProduction(db.Model):
    """Daily duck/waterfowl egg production records"""
    id = db.Column(db.Integer, primary_key=True)
    chicken_id = db.Column(db.Integer, db.ForeignKey('duck.id'), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    eggs_collected = db.Column(db.Integer, nullable=False)
    eggs_sold = db.Column(db.Integer, default=0)
    eggs_eaten = db.Column(db.Integer, default=0)
    eggs_incubated = db.Column(db.Integer, default=0)
    notes = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'chickenId': self.chicken_id,  # Keep same name for frontend compatibility
            'date': self.date.isoformat() if self.date else None,
            'eggsCollected': self.eggs_collected,
            'eggsSold': self.eggs_sold,
            'eggsEaten': self.eggs_eaten,
            'eggsIncubated': self.eggs_incubated,
            'notes': self.notes
        }

class Beehive(db.Model):
    """Track beehives and honey production"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # Hive name/number
    type = db.Column(db.String(50))  # Langstroth, Top Bar, Warre, etc.
    install_date = db.Column(db.DateTime)
    queen_marked = db.Column(db.Boolean, default=False)
    queen_color = db.Column(db.String(20))  # Year color marking
    status = db.Column(db.String(20), default='active')  # active, swarmed, dead, combined
    location = db.Column(db.String(100))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='beehives')
    inspections = db.relationship('HiveInspection', backref='hive', lazy=True, cascade='all, delete-orphan')
    harvests = db.relationship('HoneyHarvest', backref='hive', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'installDate': self.install_date.isoformat() if self.install_date else None,
            'queenMarked': self.queen_marked,
            'queenColor': self.queen_color,
            'status': self.status,
            'location': self.location,
            'notes': self.notes
        }

class HiveInspection(db.Model):
    """Beehive inspection records"""
    id = db.Column(db.Integer, primary_key=True)
    beehive_id = db.Column(db.Integer, db.ForeignKey('beehive.id'), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    queen_seen = db.Column(db.Boolean)
    eggs_seen = db.Column(db.Boolean)
    brood_pattern = db.Column(db.String(20))  # excellent, good, spotty, poor
    temperament = db.Column(db.String(20))  # calm, defensive, aggressive
    population = db.Column(db.String(20))  # strong, medium, weak
    honey_stores = db.Column(db.String(20))  # full, medium, low
    pests_diseases = db.Column(db.Text)
    actions_taken = db.Column(db.Text)
    notes = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'beehiveId': self.beehive_id,
            'date': self.date.isoformat() if self.date else None,
            'queenSeen': self.queen_seen,
            'eggsSeen': self.eggs_seen,
            'broodPattern': self.brood_pattern,
            'temperament': self.temperament,
            'population': self.population,
            'honeyStores': self.honey_stores,
            'pestsDiseas': self.pests_diseases,
            'actionsTaken': self.actions_taken,
            'notes': self.notes
        }

class HoneyHarvest(db.Model):
    """Honey harvest records"""
    id = db.Column(db.Integer, primary_key=True)
    beehive_id = db.Column(db.Integer, db.ForeignKey('beehive.id'), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    frames_harvested = db.Column(db.Integer)
    honey_weight = db.Column(db.Float)  # in pounds
    wax_weight = db.Column(db.Float)  # in pounds
    notes = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'beehiveId': self.beehive_id,
            'date': self.date.isoformat() if self.date else None,
            'framesHarvested': self.frames_harvested,
            'honeyWeight': self.honey_weight,
            'waxWeight': self.wax_weight,
            'notes': self.notes
        }

class Livestock(db.Model):
    """General livestock tracking (goats, sheep, pigs, etc.)"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100))
    species = db.Column(db.String(50), nullable=False)  # goat, sheep, pig, cow, etc.
    breed = db.Column(db.String(100))
    tag_number = db.Column(db.String(50))  # Ear tag or ID
    birth_date = db.Column(db.DateTime)
    sex = db.Column(db.String(20))  # male, female, wether, etc.
    purpose = db.Column(db.String(50))  # dairy, meat, fiber, breeding, pet
    sire = db.Column(db.String(100))  # Father's name/ID
    dam = db.Column(db.String(100))  # Mother's name/ID
    status = db.Column(db.String(20), default='active')  # active, sold, butchered, deceased
    location = db.Column(db.String(100))
    weight = db.Column(db.Float)  # Current weight in lbs
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='livestock')
    health_records = db.relationship('HealthRecord', backref='animal', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'species': self.species,
            'breed': self.breed,
            'tagNumber': self.tag_number,
            'birthDate': self.birth_date.isoformat() if self.birth_date else None,
            'sex': self.sex,
            'purpose': self.purpose,
            'sire': self.sire,
            'dam': self.dam,
            'status': self.status,
            'location': self.location,
            'weight': self.weight,
            'notes': self.notes,
            'ageMonths': self.get_age_months()
        }

    def get_age_months(self):
        if not self.birth_date:
            return None
        delta = datetime.utcnow() - self.birth_date
        return int(delta.days / 30)

class HealthRecord(db.Model):
    """Health and vet records for livestock"""
    id = db.Column(db.Integer, primary_key=True)
    livestock_id = db.Column(db.Integer, db.ForeignKey('livestock.id'), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    type = db.Column(db.String(50), nullable=False)  # vaccination, deworming, illness, injury, checkup
    treatment = db.Column(db.String(200))
    medication = db.Column(db.String(100))
    dosage = db.Column(db.String(50))
    veterinarian = db.Column(db.String(100))
    cost = db.Column(db.Float)
    next_due_date = db.Column(db.DateTime)  # For vaccinations/dewormings
    notes = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'livestockId': self.livestock_id,
            'date': self.date.isoformat() if self.date else None,
            'type': self.type,
            'treatment': self.treatment,
            'medication': self.medication,
            'dosage': self.dosage,
            'veterinarian': self.veterinarian,
            'cost': self.cost,
            'nextDueDate': self.next_due_date.isoformat() if self.next_due_date else None,
            'notes': self.notes
        }

class IndoorSeedStart(db.Model):
    """
    Track indoor seed starting activities with germination progress
    and growing conditions. Links to outdoor PlantingEvent when transplanted.
    """
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Basic Info
    plant_id = db.Column(db.String(50), nullable=False)  # Reference to plant_database
    variety = db.Column(db.String(100))  # Specific variety from seed inventory
    seed_inventory_id = db.Column(db.Integer, db.ForeignKey('seed_inventory.id'))  # Link to seed packet

    # Dates
    start_date = db.Column(db.DateTime, nullable=False)  # When seeds were started
    expected_germination_date = db.Column(db.DateTime)  # Calculated from germination_days
    expected_transplant_date = db.Column(db.DateTime)  # Calculated from weeksIndoors

    # Relationships
    user = db.relationship('User', backref='indoor_seed_starts')
    actual_transplant_date = db.Column(db.DateTime)  # When actually moved outside

    # Quantity & Germination Tracking
    seeds_started = db.Column(db.Integer, nullable=False)  # Total seeds planted
    seeds_germinated = db.Column(db.Integer, default=0)  # How many sprouted
    expected_germination_rate = db.Column(db.Float)  # From seed packet (percentage)
    actual_germination_rate = db.Column(db.Float)  # Calculated: germinated/started * 100

    # Growing Conditions
    location = db.Column(db.String(100))  # windowsill, grow-lights, heated-mat, greenhouse
    light_hours = db.Column(db.Integer)  # Hours of light per day
    temperature = db.Column(db.Integer)  # Average temperature (F)

    # Status & Readiness
    status = db.Column(db.String(20), default='planned')  # planned, seeded, germinating, growing, ready, transplanted
    hardening_off_started = db.Column(db.DateTime)  # When hardening off began
    transplant_ready = db.Column(db.Boolean, default=False)  # User-marked ready flag

    # Linking to Outdoor Planting
    planting_event_id = db.Column(db.Integer, db.ForeignKey('planting_event.id'))  # Outdoor event created after transplant

    # Metadata
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_current_garden_plan_count(self):
        """
        Calculate how many plants are currently planned in the garden
        for this indoor seed start's plant/variety/transplant date.
        Returns dict with count and sync status.
        """
        if not self.expected_transplant_date:
            return {'count': 0, 'inSync': True, 'warning': None}

        # Find all PlantingEvents with matching plant, variety, and transplant date
        from datetime import timedelta
        transplant_date = self.expected_transplant_date
        # Allow 1-day tolerance for date matching
        date_min = transplant_date - timedelta(days=1)
        date_max = transplant_date + timedelta(days=1)

        matching_events = PlantingEvent.query.filter(
            PlantingEvent.user_id == self.user_id,
            PlantingEvent.plant_id == self.plant_id,
            PlantingEvent.variety == self.variety,
            PlantingEvent.transplant_date.between(date_min, date_max)
        ).all()

        current_count = len(matching_events)

        # Calculate what the seeds_started should be based on current count
        # Using same logic as backend: count / 0.85 * 1.15
        import math
        expected_seeds = math.ceil(current_count / 0.85 * 1.15) if current_count > 0 else 0

        in_sync = (current_count > 0) and (abs(expected_seeds - self.seeds_started) <= 1)

        warning = None
        if current_count == 0:
            warning = f"All {self.plant_id} plantings removed from garden plan"
        elif not in_sync:
            warning = f"Garden plan changed: now {current_count} plants (was ~{math.ceil(self.seeds_started / 1.15 * 0.85)} when created)"

        return {
            'count': current_count,
            'expectedSeeds': expected_seeds,
            'inSync': in_sync,
            'warning': warning
        }

    def to_dict(self):
        garden_sync = self.get_current_garden_plan_count()

        return {
            'id': self.id,
            'plantId': self.plant_id,
            'variety': self.variety,
            'seedInventoryId': self.seed_inventory_id,
            'startDate': self.start_date.isoformat() if self.start_date else None,
            'expectedGerminationDate': self.expected_germination_date.isoformat() if self.expected_germination_date else None,
            'expectedTransplantDate': self.expected_transplant_date.isoformat() if self.expected_transplant_date else None,
            'actualTransplantDate': self.actual_transplant_date.isoformat() if self.actual_transplant_date else None,
            'seedsStarted': self.seeds_started,
            'seedsGerminated': self.seeds_germinated,
            'expectedGerminationRate': self.expected_germination_rate,
            'actualGerminationRate': self.actual_germination_rate,
            'location': self.location,
            'lightHours': self.light_hours,
            'temperature': self.temperature,
            'status': self.status,
            'hardeningOffStarted': self.hardening_off_started.isoformat() if self.hardening_off_started else None,
            'transplantReady': self.transplant_ready,
            'plantingEventId': self.planting_event_id,
            'notes': self.notes,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            # Live sync data
            'gardenPlanCount': garden_sync['count'],
            'gardenPlanExpectedSeeds': garden_sync['expectedSeeds'],
            'gardenPlanInSync': garden_sync['inSync'],
            'gardenPlanWarning': garden_sync['warning']
        }

    def calculate_actual_germination_rate(self):
        """Calculate actual germination percentage"""
        if self.seeds_started and self.seeds_started > 0:
            self.actual_germination_rate = (self.seeds_germinated / self.seeds_started) * 100
        return self.actual_germination_rate

class GardenPlan(db.Model):
    """
    Garden Season Planner - helps users plan their entire growing season
    starting from their seed inventory.
    """
    __tablename__ = 'garden_plan'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)  # User-defined plan name
    season = db.Column(db.String(20))  # 'spring', 'summer', 'fall', 'year-round'
    year = db.Column(db.Integer, nullable=False)
    strategy = db.Column(db.String(50), default='balanced')  # 'maximize_harvest', 'use_all_seeds', 'balanced'
    succession_preference = db.Column(db.String(20), default='4')
    # Format: '0'-'8' (numeric succession count) or legacy: 'none', 'light', 'moderate', 'heavy'
    # '0' = no succession, '1' = 1 succession planting, etc.
    target_total_plants = db.Column(db.Integer)
    target_diversity = db.Column(db.Integer)  # Number of different crops
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = db.Column(db.Text)

    # Relationships
    user = db.relationship('User', backref='garden_plans')
    items = db.relationship('GardenPlanItem', backref='garden_plan', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'name': self.name,
            'season': self.season,
            'year': self.year,
            'strategy': self.strategy,
            'successionPreference': self.succession_preference,
            'targetTotalPlants': self.target_total_plants,
            'targetDiversity': self.target_diversity,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'notes': self.notes,
            'items': [item.to_dict() for item in self.items] if self.items else []
        }

class GardenPlanItem(db.Model):
    """
    Individual crop plan within a garden plan. Represents quantities,
    succession schedule, and space requirements for one crop.
    """
    __tablename__ = 'garden_plan_item'

    id = db.Column(db.Integer, primary_key=True)
    garden_plan_id = db.Column(db.Integer, db.ForeignKey('garden_plan.id'), nullable=False)
    seed_inventory_id = db.Column(db.Integer, db.ForeignKey('seed_inventory.id'))  # Nullable - may not have seeds yet
    plant_id = db.Column(db.String(50), nullable=False)  # From plant database
    variety = db.Column(db.String(100))

    # Quantity representation - dual system (natural units + normalized plant equivalents)
    unit_type = db.Column(db.String(20), default='plants')  # 'plants', 'row_ft', 'area_sqft', 'cells'
    target_value = db.Column(db.Float, nullable=False)  # Quantity in natural units (e.g., 24 plants, 15 row-ft, 10 sqft)
    plant_equivalent = db.Column(db.Integer, nullable=False)  # Normalized plant count for calculations

    # Seed requirements
    seeds_required = db.Column(db.Integer)  # Total seeds needed
    seed_packets_required = db.Column(db.Integer)  # Packets needed to purchase (rounded up)

    # Succession planning
    succession_enabled = db.Column(db.Boolean, default=False)
    succession_count = db.Column(db.Integer, default=1)  # Number of succession plantings
    succession_interval_days = db.Column(db.Integer)  # Days between plantings

    # Timeline
    first_plant_date = db.Column(db.Date)  # Earliest planting date
    last_plant_date = db.Column(db.Date)  # Latest planting date for succession
    harvest_window_start = db.Column(db.Date)
    harvest_window_end = db.Column(db.Date)

    # Space allocation
    beds_allocated = db.Column(db.Text)  # JSON array of bed IDs where this will be planted (legacy)
    bed_assignments = db.Column(db.Text)  # JSON: [{"bedId": 1, "quantity": 25}, ...] - per-bed quantity allocation
    allocation_mode = db.Column(db.String(20), default='even')  # 'even' | 'custom' - how quantity is distributed
    space_required_cells = db.Column(db.Integer)  # Grid cells needed (derived from plant_equivalent)

    # Trellis allocation
    trellis_assignments = db.Column(db.Text)  # JSON array of trellis_structure IDs: [1, 2, 3]

    # Export tracking
    status = db.Column(db.String(20), default='planned')  # 'planned', 'exported', 'completed'
    export_key = db.Column(db.String(100))  # Idempotency key for preventing duplicate exports

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        # Parse bed_assignments (primary) or beds_allocated (legacy)
        bed_assignments_parsed = None
        beds = None

        if self.bed_assignments:
            try:
                bed_assignments_parsed = json.loads(self.bed_assignments)
                # Derive beds from assignments (single source of truth)
                beds = [a['bedId'] for a in bed_assignments_parsed]
            except (json.JSONDecodeError, KeyError, TypeError):
                bed_assignments_parsed = []
                beds = []
        elif self.beds_allocated:
            # Legacy fallback - just bed IDs without quantities
            try:
                beds = json.loads(self.beds_allocated)
            except json.JSONDecodeError:
                beds = []

        # Parse trellis_assignments
        trellis_assignments_parsed = None
        if self.trellis_assignments:
            try:
                trellis_assignments_parsed = json.loads(self.trellis_assignments)
            except (json.JSONDecodeError, TypeError):
                trellis_assignments_parsed = []

        return {
            'id': self.id,
            'gardenPlanId': self.garden_plan_id,
            'seedInventoryId': self.seed_inventory_id,
            'plantId': self.plant_id,
            'variety': self.variety,
            'unitType': self.unit_type,
            'targetValue': self.target_value,
            'plantEquivalent': self.plant_equivalent,
            'seedsRequired': self.seeds_required,
            'seedPacketsRequired': self.seed_packets_required,
            'successionEnabled': self.succession_enabled,
            'successionCount': self.succession_count,
            'successionIntervalDays': self.succession_interval_days,
            'firstPlantDate': self.first_plant_date.isoformat() if self.first_plant_date else None,
            'lastPlantDate': self.last_plant_date.isoformat() if self.last_plant_date else None,
            'harvestWindowStart': self.harvest_window_start.isoformat() if self.harvest_window_start else None,
            'harvestWindowEnd': self.harvest_window_end.isoformat() if self.harvest_window_end else None,
            'bedsAllocated': beds,
            'bedAssignments': bed_assignments_parsed,
            'allocationMode': self.allocation_mode or 'even',
            'spaceRequiredCells': self.space_required_cells,
            'trellisAssignments': trellis_assignments_parsed,
            'status': self.status,
            'exportKey': self.export_key,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }
