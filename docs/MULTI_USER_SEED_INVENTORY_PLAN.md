# Multi-User Seed Inventory System Implementation Plan

## Overview

Transform the current single-user seed inventory into a multi-user system with two distinct tiers:

1. **Global Seed Catalog** (Admin-managed via CSV import)
2. **Personal Seed Inventory** (User-controlled, can select from catalog or add custom varieties)

---

## User Requirements (Confirmed)

- ✅ **Full multi-user authentication** with login/register system
- ✅ **CSV import only** for global catalog management (admin feature)
- ✅ **Choose from catalog OR add custom** varieties in personal inventory
- ✅ **Keep all existing data** and migrate automatically

---

## Implementation Phases

### Phase 1: User Authentication System (8-10 hours)

#### Status: 🔄 IN PROGRESS (Backend Complete)

#### Backend Tasks

- ✅ Install Flask-Login library
- ✅ Create `User` model with:
  - username, email, password_hash, is_admin fields
  - Password hashing with bcrypt/werkzeug
  - `set_password()` and `check_password()` methods
  - `to_dict()` serialization method
- ✅ Add authentication endpoints:
  - `POST /api/auth/register` - Register new users
  - `POST /api/auth/login` - Login with username/password
  - `POST /api/auth/logout` - Logout (requires auth)
  - `GET /api/auth/me` - Get current user info (requires auth)
  - `GET /api/auth/check` - Check authentication status (public)
- ✅ Add `@login_required` and `@admin_required` decorators
- ✅ Create migration script for users table
- ✅ Create default admin user (username: `admin`, password: `admin123`)

#### Frontend Tasks

- ⏳ Create `AuthContext` provider for global auth state
- ⏳ Create `LoginModal.tsx` component
- ⏳ Create `RegisterModal.tsx` component
- ⏳ Add login/register buttons to header
- ⏳ Add user menu with logout option
- ⏳ Store auth session in cookies (Flask-Login handles this)
- ⏳ Create `ProtectedRoute` wrapper component
- ⏳ Add loading states for auth checks

#### Testing Phase 1

- ⏳ Register new user → verify user created in DB
- ⏳ Login → verify session created
- ⏳ Logout → verify session cleared
- ⏳ Access protected endpoint → verify 401 without auth

---

### Phase 2: Database Refactoring (6-8 hours)

#### Backend Models

**Create `SeedCatalog` Model** (Global varieties, admin-only)
```python
class SeedCatalog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    plant_id = db.Column(db.String(50), nullable=False)
    variety = db.Column(db.String(100), nullable=False)
    supplier = db.Column(db.String(100))

    # Agronomic data (variety-specific overrides)
    days_to_maturity = db.Column(db.Integer)
    germination_days = db.Column(db.Integer)
    plant_spacing = db.Column(db.Integer)
    row_spacing = db.Column(db.Integer)
    planting_depth = db.Column(db.Float)
    germination_temp_min = db.Column(db.Integer)
    germination_temp_max = db.Column(db.Integer)
    soil_temp_min = db.Column(db.Integer)
    heat_tolerance = db.Column(db.String(20))
    cold_tolerance = db.Column(db.String(20))
    bolt_resistance = db.Column(db.String(20))
    ideal_seasons = db.Column(db.String(100))
    flavor_profile = db.Column(db.Text)
    storage_rating = db.Column(db.String(20))

    # Metadata
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('plant_id', 'variety'),)
```

**Create `UserSeedInventory` Model** (Personal inventory)
```python
class UserSeedInventory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Can reference catalog OR be custom variety
    seed_catalog_id = db.Column(db.Integer, db.ForeignKey('seed_catalog.id'))
    variety_custom = db.Column(db.String(100))  # Used when seed_catalog_id is null

    # User-specific inventory fields
    quantity = db.Column(db.Integer, default=0)
    purchase_date = db.Column(db.DateTime)
    expiration_date = db.Column(db.DateTime)
    germination_rate = db.Column(db.Float)  # User's observed rate
    location = db.Column(db.String(100))  # Storage location
    price = db.Column(db.Float)
    notes = db.Column(db.Text)  # User's personal notes

    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='seed_inventory')
    seed_catalog = db.relationship('SeedCatalog', backref='user_inventories')
```

#### Migration Strategy

**Migration 1: Create Seed Catalog Table**
```python
# create_seed_catalog_table.py
def upgrade():
    op.create_table('seed_catalog',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('plant_id', sa.String(50), nullable=False),
        sa.Column('variety', sa.String(100), nullable=False),
        # ... all other fields ...
        sa.UniqueConstraint('plant_id', 'variety')
    )

    # Migrate is_global=True entries from seed_inventory
    op.execute("""
        INSERT INTO seed_catalog (plant_id, variety, supplier, ...)
        SELECT plant_id, variety, supplier, ...
        FROM seed_inventory
        WHERE is_global = 1
    """)
```

**Migration 2: Create User Seed Inventory Table**
```python
# create_user_seed_inventory_table.py
def upgrade():
    op.create_table('user_seed_inventory',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('seed_catalog_id', sa.Integer(), sa.ForeignKey('seed_catalog.id')),
        sa.Column('variety_custom', sa.String(100)),
        # ... inventory fields ...
    )

    # Migrate is_global=False entries (assign to admin user)
    admin_id = db.session.query(User).filter_by(is_admin=True).first().id

    op.execute(f"""
        INSERT INTO user_seed_inventory (user_id, quantity, ...)
        SELECT {admin_id}, quantity, ...
        FROM seed_inventory
        WHERE is_global = 0
    """)
```

**Migration 3: Drop Old Table** (after verification)
```python
# drop_old_seed_inventory.py
def upgrade():
    # Backup data first!
    op.drop_table('seed_inventory')
```

#### Testing Phase 2

- ⏳ Run migrations on test database
- ⏳ Verify all existing data preserved
- ⏳ Verify seed_catalog has global entries
- ⏳ Verify user_seed_inventory has personal entries
- ⏳ Check foreign key relationships work correctly

---

### Phase 3: API Refactoring (6-8 hours)

#### Admin Endpoints (require `@admin_required`)

```python
@app.route('/api/admin/seed-catalog', methods=['GET', 'POST'])
@admin_required
def admin_seed_catalog():
    """Admin-only: Manage global seed catalog"""
    if request.method == 'GET':
        catalog = SeedCatalog.query.all()
        return jsonify([seed.to_dict() for seed in catalog])

    if request.method == 'POST':
        data = request.get_json()
        seed = SeedCatalog(**data)
        db.session.add(seed)
        db.session.commit()
        return jsonify(seed.to_dict()), 201

@app.route('/api/admin/seed-catalog/<int:id>', methods=['PUT', 'DELETE'])
@admin_required
def admin_seed_catalog_item(id):
    """Admin-only: Update/delete catalog entry"""
    # Implementation...

@app.route('/api/admin/varieties/import', methods=['POST'])
@admin_required
def admin_import_varieties():
    """Admin-only: CSV import to global catalog"""
    # Update existing CSV import to use SeedCatalog model
```

#### User Endpoints (require `@login_required`)

```python
@app.route('/api/my-seeds', methods=['GET', 'POST'])
@login_required
def my_seed_inventory():
    """Get or add to current user's seed inventory"""
    if request.method == 'GET':
        inventory = UserSeedInventory.query.filter_by(
            user_id=current_user.id
        ).all()
        return jsonify([item.to_dict() for item in inventory])

    if request.method == 'POST':
        data = request.get_json()
        data['user_id'] = current_user.id

        # Can reference catalog OR be custom variety
        if data.get('seed_catalog_id'):
            item = UserSeedInventory(
                user_id=current_user.id,
                seed_catalog_id=data['seed_catalog_id'],
                quantity=data['quantity'],
                # ... other fields ...
            )
        else:
            item = UserSeedInventory(
                user_id=current_user.id,
                variety_custom=data['variety_custom'],
                quantity=data['quantity'],
                # ... other fields ...
            )

        db.session.add(item)
        db.session.commit()
        return jsonify(item.to_dict()), 201

@app.route('/api/my-seeds/<int:id>', methods=['PUT', 'DELETE'])
@login_required
def my_seed_inventory_item(id):
    """Update/delete personal inventory item"""
    item = UserSeedInventory.query.get_or_404(id)

    # Security: Ensure user owns this inventory item
    if item.user_id != current_user.id:
        return jsonify({'error': 'Forbidden'}), 403

    # Implementation...

@app.route('/api/seed-catalog/varieties/<plant_id>', methods=['GET'])
def get_catalog_varieties(plant_id):
    """Public: Get catalog varieties for dropdown (no auth required)"""
    varieties = SeedCatalog.query.filter_by(plant_id=plant_id).all()
    return jsonify([v.to_dict() for v in varieties])
```

#### Data Filtering

- ALL user inventory queries filtered by `user_id = current_user.id`
- Return `403 Forbidden` if user tries to access/modify other user's inventory
- Global catalog is read-only for non-admins

#### Testing Phase 3

- ⏳ Login as User A, add seed → verify only User A sees it
- ⏳ Login as User B → verify cannot see User A's seeds
- ⏳ Try to edit User A's seed as User B → verify 403 error
- ⏳ Admin can access catalog endpoints, non-admin gets 403
- ⏳ Test CSV import as admin → verify entries in catalog

---

### Phase 4: Frontend Refactoring (8-10 hours)

#### Component Restructure

**Keep** `SeedInventory.tsx` → Rename to `MySeedInventory.tsx`
- Personal inventory view for logged-in user
- Add variety selection dropdown from catalog
- Add "Custom variety" checkbox
- Filter API calls to `/api/my-seeds`
- Remove `is_global` badge (no longer relevant)

**Create** `AdminSeedCatalog.tsx` (New component)
- Admin-only page (check `user.is_admin`)
- Display global seed catalog
- CSV import button → existing CSVImportModal
- No quantity tracking (that's in personal inventory)
- Edit/delete controls for catalog entries

#### MySeedInventory.tsx Updates

```typescript
// Add variety selection logic
const [selectedPlant, setSelectedPlant] = useState('');
const [catalogVarieties, setCatalogVarieties] = useState([]);
const [isCustomVariety, setIsCustomVariety] = useState(false);

// Fetch catalog varieties when plant selected
useEffect(() => {
  if (selectedPlant && !isCustomVariety) {
    fetch(`${API_BASE_URL}/api/seed-catalog/varieties/${selectedPlant}`)
      .then(res => res.json())
      .then(data => setCatalogVarieties(data));
  }
}, [selectedPlant, isCustomVariety]);

// In the form JSX:
{!isCustomVariety ? (
  <select
    value={selectedVariety}
    onChange={(e) => setSelectedVariety(e.target.value)}
  >
    <option value="">Select variety...</option>
    {catalogVarieties.map(v => (
      <option key={v.id} value={v.id}>{v.variety}</option>
    ))}
  </select>
) : (
  <input
    type="text"
    value={customVariety}
    onChange={(e) => setCustomVariety(e.target.value)}
    placeholder="Enter custom variety name"
  />
)}

<label>
  <input
    type="checkbox"
    checked={isCustomVariety}
    onChange={(e) => setIsCustomVariety(e.target.checked)}
  />
  Custom variety (not in catalog)
</label>
```

#### Navigation Updates

```typescript
// In App.tsx - Add admin menu
{user?.isAdmin && (
  <div className="admin-menu">
    <Link to="/admin/seed-catalog">Manage Seed Catalog</Link>
  </div>
)}

// User menu
<div className="user-menu">
  <Link to="/my-seeds">My Seed Inventory</Link>
  <button onClick={handleLogout}>Logout</button>
</div>
```

#### Testing Phase 4

- ⏳ Login as regular user → verify can only see "My Seed Inventory"
- ⏳ Login as admin → verify sees both "My Seed Inventory" and "Manage Seed Catalog"
- ⏳ Add seed from catalog → verify dropdown works
- ⏳ Add custom variety → verify custom field saves correctly
- ⏳ Multiple users → verify complete data isolation

---

### Phase 5: CSV Import Integration (2-3 hours)

#### Update CSV Import Service

```python
# In csv_import_service.py
def import_varieties_to_database(csv_data, mapping, plant_id):
    """Import CSV varieties to SeedCatalog (admin only)"""
    # Change from SeedInventory to SeedCatalog model
    # Remove is_global parameter (all imports go to catalog)
    for row in csv_data:
        seed = SeedCatalog(
            plant_id=plant_id,
            variety=row[mapping['variety']],
            # ... map other fields ...
        )
        db.session.add(seed)

    db.session.commit()
```

#### Update Frontend CSV Import

- Modify CSVImportModal to only be accessible to admins
- Update API endpoint to `/api/admin/varieties/import`
- Keep existing CSV format and mapping logic
- Remove `isGlobal` checkbox (all imports to catalog)

#### Testing Phase 5

- ⏳ Admin imports CSV → verify entries in seed_catalog table
- ⏳ User adds seed → verify imported varieties appear in dropdown
- ⏳ Non-admin tries to import → verify 403 error

---

### Phase 6: Data Migration & Testing (3-4 hours)

#### Pre-Migration Checklist

- ⏳ **Backup production database** to `homestead.db.backup`
- ⏳ Test migration on copy of production data
- ⏳ Verify row counts match original data
- ⏳ Document rollback procedure

#### Migration Execution

```bash
# 1. Backup database
cp instance/homestead.db instance/homestead.db.backup

# 2. Run migrations in order
python backend/create_seed_catalog_table.py
python backend/create_user_seed_inventory_table.py

# 3. Verify data migration
python backend/verify_migration.py

# 4. Only after verification - drop old table
python backend/drop_old_seed_inventory.py
```

#### Post-Migration Validation

- ⏳ Test login with multiple users
- ⏳ Verify complete data isolation between users
- ⏳ Verify admin can manage catalog
- ⏳ Verify users can add from catalog and custom
- ⏳ Test CSV import workflow end-to-end
- ⏳ Test all CRUD operations (Create, Read, Update, Delete)
- ⏳ Verify no cross-user data leakage
- ⏳ Test edge cases (deleted catalog entries, etc.)

---

## Technical Architecture

### Database Schema

```sql
-- Phase 1: Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login DATETIME
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Phase 2: Global seed catalog (admin-managed)
CREATE TABLE seed_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id VARCHAR(50) NOT NULL,
    variety VARCHAR(100) NOT NULL,
    supplier VARCHAR(100),
    -- Agronomic fields --
    days_to_maturity INTEGER,
    germination_days INTEGER,
    plant_spacing INTEGER,
    row_spacing INTEGER,
    planting_depth FLOAT,
    germination_temp_min INTEGER,
    germination_temp_max INTEGER,
    soil_temp_min INTEGER,
    heat_tolerance VARCHAR(20),
    cold_tolerance VARCHAR(20),
    bolt_resistance VARCHAR(20),
    ideal_seasons VARCHAR(100),
    flavor_profile TEXT,
    storage_rating VARCHAR(20),
    -- Metadata --
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(plant_id, variety)
);

-- Phase 2: User seed inventory (personal tracking)
CREATE TABLE user_seed_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    seed_catalog_id INTEGER,  -- Nullable for custom varieties
    variety_custom VARCHAR(100),  -- Used when seed_catalog_id is null
    -- Inventory fields --
    quantity INTEGER DEFAULT 0,
    purchase_date DATETIME,
    expiration_date DATETIME,
    germination_rate FLOAT,
    location VARCHAR(100),
    price FLOAT,
    notes TEXT,
    -- Metadata --
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(seed_catalog_id) REFERENCES seed_catalog(id) ON DELETE RESTRICT
);

CREATE INDEX idx_user_seed_inventory_user_id ON user_seed_inventory(user_id);
```

### API Flow Examples

#### Example 1: User Adds Seed from Catalog

```
1. User opens "Add Seed" modal in MySeedInventory
2. Selects plant: "Basil"
3. Frontend fetches: GET /api/seed-catalog/varieties/basil
4. Backend returns: [
     {id: 5, variety: "Genovese"},
     {id: 6, variety: "Thai"},
     {id: 7, variety: "Lemon"}
   ]
5. User selects "Genovese", enters quantity=50
6. Frontend POSTs to /api/my-seeds:
   {
     plant_id: "basil",
     seed_catalog_id: 5,
     quantity: 50,
     purchase_date: "2025-11-21"
   }
7. Backend creates: user_seed_inventory(
     user_id=current_user.id,
     seed_catalog_id=5,
     quantity=50
   )
8. Response: {id: 42, ...}
```

#### Example 2: User Adds Custom Variety

```
1. User opens "Add Seed" modal
2. Checks "Custom variety" checkbox
3. Types: "My Homegrown Heirloom"
4. Frontend POSTs to /api/my-seeds:
   {
     plant_id: "basil",
     variety_custom: "My Homegrown Heirloom",
     quantity: 25
   }
5. Backend creates: user_seed_inventory(
     user_id=current_user.id,
     seed_catalog_id=NULL,
     variety_custom="My Homegrown Heirloom",
     quantity=25
   )
6. Response: {id: 43, ...}
```

#### Example 3: Admin Imports CSV to Catalog

```
1. Admin navigates to "Manage Seed Catalog"
2. Clicks "Import CSV"
3. Uploads tomatoes.csv with 50 varieties
4. Frontend POSTs to /api/admin/varieties/import
5. Backend validates admin privileges
6. Backend parses CSV and creates 50 SeedCatalog entries
7. All users can now select these varieties in their inventory
```

---

## Timeline Estimate

| Phase | Description | Estimated Hours | Status |
|-------|-------------|----------------|--------|
| Phase 1 | User Authentication (Backend) | 4-5 hours | ✅ **COMPLETED** |
| Phase 1 | User Authentication (Frontend) | 4-5 hours | ⏳ In Progress |
| Phase 2 | Database Refactoring | 6-8 hours | ⏳ Pending |
| Phase 3 | API Refactoring | 6-8 hours | ⏳ Pending |
| Phase 4 | Frontend Refactoring | 8-10 hours | ⏳ Pending |
| Phase 5 | CSV Import Integration | 2-3 hours | ⏳ Pending |
| Phase 6 | Data Migration & Testing | 3-4 hours | ⏳ Pending |
| **TOTAL** | **Complete Implementation** | **33-43 hours** | **15% Complete** |

---

## Key Benefits

✅ **Complete user data isolation** - Each user has their own private inventory
✅ **Admin-controlled global catalog** - Centralized variety management
✅ **Users can track personal quantities** - Know exactly what seeds they own
✅ **CSV import for bulk catalog management** - Efficient data entry
✅ **Support for custom varieties** - Flexibility for heirloom/unusual seeds
✅ **Existing data preserved and migrated** - No data loss
✅ **Scalable multi-user architecture** - Ready for production deployment

---

## Risk Mitigation Strategies

### Database Risks

- **Risk**: Data loss during migration
- **Mitigation**:
  - Full database backup before migrations
  - Test migrations on copy first
  - Verify row counts match before/after
  - Keep old table until verified

### Authentication Risks

- **Risk**: Security vulnerabilities
- **Mitigation**:
  - Use Flask-Login (battle-tested library)
  - Password hashing with bcrypt
  - CSRF protection enabled
  - Session cookies with HttpOnly flag

### User Experience Risks

- **Risk**: Confusing UI during transition
- **Mitigation**:
  - Clear labels ("My Seeds" vs "Seed Catalog")
  - Tooltips explaining custom varieties
  - Admin badge visible in UI
  - Progressive enhancement (old features still work)

### Performance Risks

- **Risk**: Slow queries with user filtering
- **Mitigation**:
  - Indexes on user_id and seed_catalog_id
  - Query optimization with proper JOINs
  - Consider pagination for large inventories

---

## Default Admin Credentials

**⚠️ IMPORTANT: Change after first login!**

```
Username: admin
Password: admin123
Email: admin@homestead.local
```

---

## Rollback Plan

If major issues occur after deployment:

```bash
# 1. Stop the application
# 2. Restore database backup
cp instance/homestead.db.backup instance/homestead.db

# 3. Checkout previous git commit
git checkout <previous-commit-hash>

# 4. Restart application
```

---

## Current Implementation Status

### ✅ Completed (Phase 1 - Backend)

1. **User Model Created** - Full authentication support
2. **Flask-Login Integrated** - Session management configured
3. **Authentication Endpoints** - Register, login, logout, check auth
4. **Database Migration** - Users table created with admin user
5. **Security Decorators** - @login_required and @admin_required ready
6. **Backend Server Running** - Port 5000, all auth endpoints live

### 🔄 In Progress

- Frontend authentication UI components

### ⏳ Pending

- Seed catalog model and user inventory model
- Data migration from old structure
- API refactoring with auth protection
- Frontend inventory component updates
- CSV import integration
- Full system testing

---

## File Locations

### Backend Files

- `backend/models.py` - User, SeedCatalog, UserSeedInventory models
- `backend/app.py` - Authentication routes and API endpoints
- `backend/create_users_table.py` - User table migration
- `backend/create_seed_catalog_table.py` - Catalog migration (to be created)
- `backend/create_user_seed_inventory_table.py` - Inventory migration (to be created)
- `backend/services/csv_import_service.py` - CSV import logic

### Frontend Files

- `frontend/src/contexts/AuthContext.tsx` - Authentication state (to be created)
- `frontend/src/components/Auth/LoginModal.tsx` - Login UI (to be created)
- `frontend/src/components/Auth/RegisterModal.tsx` - Register UI (to be created)
- `frontend/src/components/MySeedInventory.tsx` - Personal inventory (rename from SeedInventory.tsx)
- `frontend/src/components/Admin/SeedCatalog.tsx` - Admin catalog management (to be created)

---

## Questions & Answers

**Q: Can users see other users' seed inventories?**
A: No. All queries are filtered by `user_id = current_user.id`. Complete data isolation.

**Q: What if a catalog entry is deleted?**
A: User inventory references are preserved (RESTRICT on foreign key). Admin must reassign or users must update their inventory.

**Q: Can users edit the global catalog?**
A: No. Only admins can modify the global catalog. Users can only add custom varieties to their own inventory.

**Q: What happens to seeds when a user is deleted?**
A: CASCADE delete - all their inventory items are automatically removed from the database.

**Q: How do we handle duplicate varieties?**
A: UNIQUE constraint on (plant_id, variety) in seed_catalog prevents duplicates in global catalog.

---

**Last Updated**: 2025-11-21
**Plan Version**: 1.0
**Author**: Claude Code Assistant
**Status**: Implementation in Progress (Phase 1 Backend Complete)
