# 🌱 Homestead Tracker - Flask Version

A Python Flask web application for tracking and managing your homestead garden with **full database persistence**.

Perfect for building a **subscription-based SaaS product**!

## ✨ Features

### 🌿 Garden Planner
- Create and manage multiple garden beds
- Add plants from comprehensive database
- Track planting status (planned → seeded → growing → harvested)
- All data saved to SQLite database

### 📅 Planting Calendar
- Set your frost dates
- Schedule seed starting and transplanting
- Automatic date calculations
- Track all planting events

### ❄️ Winter Garden Planning
- Eliot Coleman & Nico Jabour techniques
- Season extension methods (quick hoops, cold frames, etc.)
- Temperature protection calculator
- Winter-hardy plant recommendations

### 🌤️ Weather & Alerts
- Weather monitoring interface
- Frost warnings and alerts
- 7-day forecast display
- Ready for API integration

### ♻️ Compost Tracker
- Manage multiple compost piles
- **Automatic C:N ratio calculator**
- Track ingredients (greens and browns)
- Turn schedule reminders
- Moisture level monitoring

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd homestead-flask
pip install -r requirements.txt
```

### 2. Run the App

```bash
python app.py
```

### 3. Open in Browser

Visit: **http://localhost:5000**

That's it! The database is created automatically.

## 📂 Project Structure

```
homestead-flask/
├── app.py                 # Main Flask application
├── models.py              # Database models (SQLAlchemy)
├── plant_database.py      # Plant data (35+ varieties)
├── requirements.txt       # Python dependencies
├── templates/             # HTML templates
│   ├── base.html
│   ├── index.html
│   ├── garden_planner.html
│   ├── planting_calendar.html
│   ├── winter_garden.html
│   ├── weather.html
│   └── compost_tracker.html
└── homestead.db          # SQLite database (auto-created)
```

## 💾 Database Features

**All data persists permanently!**

- Garden beds and planted items
- Planting calendar events
- Winter garden plans
- Compost piles and ingredients
- User settings (frost dates)

Uses **SQLite** - a single file database that's perfect for:
- Development
- Single-user deployments
- Easy backups (just copy the .db file)
- Later migration to PostgreSQL/MySQL for production

## 🔧 Technology Stack

- **Backend**: Flask 3.0 (Python)
- **Database**: SQLAlchemy + SQLite
- **Frontend**: Bootstrap 5 + jQuery
- **Icons**: Bootstrap Icons
- **Date Handling**: python-dateutil

## 📊 Database Models

### GardenBed
- name, dimensions, location, sun exposure
- Relationship: many planted items

### PlantedItem
- plant_id, garden_bed_id, dates, status, notes

### PlantingEvent
- Seed start, transplant, direct seed dates
- Expected harvest date

### CompostPile
- name, location, size, C:N ratio
- Moisture level, status, turn dates

### CompostIngredient
- Material name, amount, type (green/brown)
- C:N ratio for automatic calculations

## 🌱 Plant Database

**10+ Varieties Included** (expandable):
- Winter-hardy greens (spinach, kale, lettuce)
- Root vegetables (carrots, beets, radishes)
- Summer crops (tomatoes, peppers)
- Herbs (basil, parsley)
- Alliums (onions)

Each plant includes:
- Scientific name
- Days to maturity
- Frost tolerance
- Companion planting info
- Growing requirements

## 🔮 Ready for SaaS

This Flask version is designed for easy extension to a subscription-based service:

### Later Add-ons:

1. **User Authentication**
   ```python
   from flask_login import LoginManager, UserMixin
   # Add User model, login/signup routes
   ```

2. **Stripe Integration**
   ```python
   import stripe
   # Add subscription plans, payment processing
   ```

3. **Multi-tenancy**
   ```python
   # Add user_id to all models
   # Filter queries by current_user.id
   ```

4. **PostgreSQL for Production**
   ```python
   # Change DATABASE_URI in app.py
   # Everything else works the same!
   ```

## 📈 Planned Features for SaaS

- [ ] User authentication (Flask-Login)
- [ ] Subscription plans ($30-50/year)
- [ ] 14-day free trial
- [ ] Payment processing (Stripe)
- [ ] Email notifications
- [ ] Data export (CSV, PDF)
- [ ] Mobile-responsive design
- [ ] Weather API integration
- [ ] Harvest tracking
- [ ] Seed inventory management

## 🛠️ Development

### Add New Plants

Edit `plant_database.py`:

```python
PLANT_DATABASE.append({
    'id': 'cucumber-1',
    'name': 'Cucumber',
    'category': 'vegetable',
    'daysToMaturity': 55,
    'winterHardy': False,
    # ...more fields
})
```

### Modify Database Schema

1. Edit `models.py`
2. Delete `homestead.db`
3. Restart app (auto-creates new schema)

For production, use Flask-Migrate for database migrations.

## 📝 API Endpoints

### Garden Beds
- `GET /api/garden-beds` - List all beds
- `POST /api/garden-beds` - Create bed
- `GET /api/garden-beds/<id>` - Get specific bed
- `PUT /api/garden-beds/<id>` - Update bed
- `DELETE /api/garden-beds/<id>` - Delete bed

### Planted Items
- `POST /api/planted-items` - Add plant to bed
- `PUT /api/planted-items/<id>` - Update plant
- `DELETE /api/planted-items/<id>` - Remove plant

### Planting Calendar
- `GET /api/planting-events` - List events
- `POST /api/planting-events` - Create event
- `PUT /api/planting-events/<id>` - Update event
- `DELETE /api/planting-events/<id>` - Delete event

### Compost
- `GET /api/compost-piles` - List piles
- `POST /api/compost-piles` - Create pile
- `POST /api/compost-piles/<id>/ingredients` - Add material

## 🎓 Educational Content

### Eliot Coleman Techniques
- Four-Season Harvest principles
- Persephone Period concept (< 10 hours daylight)
- Multi-layer protection system
- Best winter crops

### Nico Jabour Methods
- Quick hoops construction
- Snow as insulation
- Timing for season extension
- Harvest techniques for regeneration

## 🐛 Troubleshooting

**Port already in use?**
```bash
python app.py --port 5001
```

**Database locked?**
Close all connections and restart the app.

**Module not found?**
```bash
pip install -r requirements.txt
```

## 📦 Deployment

### For Testing (Local Network)
```bash
python app.py
# Access from other devices: http://YOUR-IP:5000
```

### For Production
1. Use Gunicorn: `gunicorn app:app`
2. Set up Nginx reverse proxy
3. Use PostgreSQL instead of SQLite
4. Enable HTTPS
5. Set secure SECRET_KEY in environment variables

## 📄 License

MIT License - Free to use and modify

## 🙏 Credits

- Inspired by **Eliot Coleman** (Winter Harvest Handbook)
- Techniques from **Nico Jabour** (Season Extension)
- Plant data from agricultural extension services

---

**Built with Flask for easy customization and SaaS deployment!** 🌱

Ready to run: `python app.py`
