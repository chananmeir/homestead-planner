from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class GardenBed(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    width = db.Column(db.Float, nullable=False)
    length = db.Column(db.Float, nullable=False)
    location = db.Column(db.String(200))
    sun_exposure = db.Column(db.String(20))  # full, partial, shade
    planning_method = db.Column(db.String(50), default='square-foot')  # square-foot, row, intensive, raised-bed, permaculture, container
    grid_size = db.Column(db.Integer, default=12)  # inches per grid cell
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    planted_items = db.relationship('PlantedItem', backref='garden_bed', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'width': self.width,
            'length': self.length,
            'location': self.location,
            'sunExposure': self.sun_exposure,
            'planningMethod': self.planning_method,
            'gridSize': self.grid_size,
            'plants': [item.to_dict() for item in self.planted_items]
        }

class PlantedItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    plant_id = db.Column(db.String(50), nullable=False)  # Reference to plant in database
    garden_bed_id = db.Column(db.Integer, db.ForeignKey('garden_bed.id'), nullable=False)
    planted_date = db.Column(db.DateTime, default=datetime.utcnow)
    transplant_date = db.Column(db.DateTime)
    harvest_date = db.Column(db.DateTime)
    position_x = db.Column(db.Integer, default=0)
    position_y = db.Column(db.Integer, default=0)
    quantity = db.Column(db.Integer, default=1)
    status = db.Column(db.String(20), default='planned')  # planned, seeded, transplanted, growing, harvested
    notes = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'plantId': self.plant_id,
            'plantedDate': self.planted_date.isoformat() if self.planted_date else None,
            'transplantDate': self.transplant_date.isoformat() if self.transplant_date else None,
            'harvestDate': self.harvest_date.isoformat() if self.harvest_date else None,
            'position': {'x': self.position_x, 'y': self.position_y},
            'quantity': self.quantity,
            'status': self.status,
            'notes': self.notes
        }

class PlantingEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    plant_id = db.Column(db.String(50), nullable=False)
    garden_bed_id = db.Column(db.Integer)
    seed_start_date = db.Column(db.DateTime)
    transplant_date = db.Column(db.DateTime)
    direct_seed_date = db.Column(db.DateTime)
    expected_harvest_date = db.Column(db.DateTime)
    succession_planting = db.Column(db.Boolean, default=False)
    succession_interval = db.Column(db.Integer)  # days
    completed = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'plantId': self.plant_id,
            'gardenBedId': self.garden_bed_id,
            'seedStartDate': self.seed_start_date.isoformat() if self.seed_start_date else None,
            'transplantDate': self.transplant_date.isoformat() if self.transplant_date else None,
            'directSeedDate': self.direct_seed_date.isoformat() if self.direct_seed_date else None,
            'expectedHarvestDate': self.expected_harvest_date.isoformat() if self.expected_harvest_date else None,
            'successionPlanting': self.succession_planting,
            'successionInterval': self.succession_interval,
            'completed': self.completed,
            'notes': self.notes
        }

class WinterPlan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    garden_bed_id = db.Column(db.String(50))
    technique = db.Column(db.String(50))  # quick-hoops, cold-frame, etc.
    plant_list = db.Column(db.Text)  # JSON array of plant IDs
    protection_layers = db.Column(db.Integer, default=1)
    harvest_window_start = db.Column(db.DateTime)
    harvest_window_end = db.Column(db.DateTime)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def get_plant_list(self):
        return json.loads(self.plant_list) if self.plant_list else []

    def set_plant_list(self, plants):
        self.plant_list = json.dumps(plants)

    def to_dict(self):
        return {
            'id': self.id,
            'gardenBedId': self.garden_bed_id,
            'technique': self.technique,
            'plantList': self.get_plant_list(),
            'protectionLayers': self.protection_layers,
            'harvestWindow': {
                'start': self.harvest_window_start.isoformat() if self.harvest_window_start else None,
                'end': self.harvest_window_end.isoformat() if self.harvest_window_end else None
            },
            'notes': self.notes
        }

class CompostPile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
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
    key = db.Column(db.String(50), unique=True, nullable=False)
    value = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @staticmethod
    def get_setting(key, default=None):
        setting = Settings.query.filter_by(key=key).first()
        return setting.value if setting else default

    @staticmethod
    def set_setting(key, value):
        setting = Settings.query.filter_by(key=key).first()
        if setting:
            setting.value = value
        else:
            setting = Settings(key=key, value=value)
            db.session.add(setting)
        db.session.commit()

class Photo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    filepath = db.Column(db.String(500), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    plant_id = db.Column(db.String(50))  # Optional: link to plant
    garden_bed_id = db.Column(db.Integer, db.ForeignKey('garden_bed.id'))
    planted_item_id = db.Column(db.Integer, db.ForeignKey('planted_item.id'))
    caption = db.Column(db.Text)
    category = db.Column(db.String(50))  # 'garden', 'plant', 'harvest', 'pest'

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
    plant_id = db.Column(db.String(50), nullable=False)
    planted_item_id = db.Column(db.Integer, db.ForeignKey('planted_item.id'))
    harvest_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    quantity = db.Column(db.Float, nullable=False)  # Weight in lbs or count
    unit = db.Column(db.String(20), default='lbs')  # lbs, oz, count
    notes = db.Column(db.Text)
    quality = db.Column(db.String(20))  # excellent, good, fair, poor

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
    plant_id = db.Column(db.String(50), nullable=False)
    variety = db.Column(db.String(100), nullable=False)
    brand = db.Column(db.String(100))
    quantity = db.Column(db.Integer)  # Number of seeds/packets
    purchase_date = db.Column(db.DateTime)
    expiration_date = db.Column(db.DateTime)
    germination_rate = db.Column(db.Float)  # Percentage
    location = db.Column(db.String(100))  # Storage location
    price = db.Column(db.Float)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
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
            'notes': self.notes
        }

class Property(db.Model):
    """Represents the entire homestead property/lot"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    width = db.Column(db.Float, nullable=False)  # Width in feet
    length = db.Column(db.Float, nullable=False)  # Length in feet
    address = db.Column(db.String(200))
    zone = db.Column(db.String(10))  # USDA hardiness zone
    soil_type = db.Column(db.String(50))  # clay, loam, sandy, etc.
    slope = db.Column(db.String(20))  # flat, gentle, steep
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    structures = db.relationship('PlacedStructure', backref='property', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'width': self.width,
            'length': self.length,
            'address': self.address,
            'zone': self.zone,
            'soilType': self.soil_type,
            'slope': self.slope,
            'notes': self.notes,
            'acreage': round((self.width * self.length) / 43560, 2),  # Convert sq ft to acres
            'structures': [s.to_dict() for s in self.structures]
        }

class PlacedStructure(db.Model):
    """Represents a structure placed on the property"""
    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('property.id'), nullable=False)
    structure_id = db.Column(db.String(50), nullable=False)  # Reference to structures_database
    name = db.Column(db.String(100))  # Custom name for this instance
    position_x = db.Column(db.Float, nullable=False)  # X position on property (feet from left)
    position_y = db.Column(db.Float, nullable=False)  # Y position on property (feet from top)
    rotation = db.Column(db.Integer, default=0)  # 0, 90, 180, 270 degrees
    notes = db.Column(db.Text)
    built_date = db.Column(db.DateTime)
    cost = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'propertyId': self.property_id,
            'structureId': self.structure_id,
            'name': self.name,
            'position': {'x': self.position_x, 'y': self.position_y},
            'rotation': self.rotation,
            'notes': self.notes,
            'builtDate': self.built_date.isoformat() if self.built_date else None,
            'cost': self.cost
        }

class Chicken(db.Model):
    """Track individual chickens or flocks"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))  # Name or flock ID
    breed = db.Column(db.String(100))
    quantity = db.Column(db.Integer, default=1)  # Number of birds
    hatch_date = db.Column(db.DateTime)
    purpose = db.Column(db.String(50))  # eggs, meat, dual-purpose
    sex = db.Column(db.String(20))  # hen, rooster, mixed
    status = db.Column(db.String(20), default='active')  # active, sold, deceased
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
    name = db.Column(db.String(100))  # Name or flock ID
    breed = db.Column(db.String(100))  # Can include 'duck' or 'goose' type
    quantity = db.Column(db.Integer, default=1)  # Number of birds
    hatch_date = db.Column(db.DateTime)
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
