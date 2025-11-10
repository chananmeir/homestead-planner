# Homestead Planner

A comprehensive garden and homestead planning application with both backend and frontend components.

## Project Structure

```
homestead-planner/
├── backend/          # Flask backend API
│   ├── app.py
│   ├── models.py
│   ├── garden_methods.py
│   ├── plant_database.py
│   ├── structures_database.py
│   └── requirements.txt
└── frontend/         # React/TypeScript frontend
    ├── src/
    ├── public/
    └── package.json
```

## Features

- **Garden Planning**: Design and plan your garden layout
- **Plant Database**: Comprehensive database of plants with growing information
- **Structure Management**: Track garden structures (greenhouses, beds, etc.)
- **Garden Methods**: Various gardening methodologies and techniques
- **Database Migrations**: Safe database schema management

## Setup Instructions

### Backend Setup (Flask)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up the database (see `SETUP_MIGRATIONS.md` for detailed instructions):
   ```bash
   flask db init
   flask db migrate -m "Initial migration"
   flask db upgrade
   ```

5. Run the Flask app:
   ```bash
   python app.py
   ```

   The backend will be available at `http://localhost:5000`

### Frontend Setup (React)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

   The frontend will be available at `http://localhost:3000`

## Documentation

- **Backend Documentation**: See `backend/README.md`
- **Migration Guide**: See `backend/SETUP_MIGRATIONS.md`
- **Database Migrations**: See `backend/MIGRATIONS.md`
- **Frontend Documentation**: See `frontend/README.md`

## Tech Stack

### Backend
- Python 3.x
- Flask
- Flask-SQLAlchemy
- Flask-Migrate

### Frontend
- React
- TypeScript
- Tailwind CSS
- Modern React patterns

## Development

Both frontend and backend need to be running simultaneously for full functionality:

1. Start backend server (port 5000)
2. Start frontend development server (port 3000)
3. Frontend will proxy API requests to the backend

## Contributing

This project is part of a homestead planning and management system. Feel free to contribute improvements!

## License

[Add your license here]
