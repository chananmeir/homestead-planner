# 🌱 Homestead Tracker

A comprehensive web application for tracking and managing your homestead garden, featuring winter gardening techniques, weather alerts, and compost management.

![Version](https://img.shields.io/badge/version-1.0.0-green)
![React](https://img.shields.io/badge/React-18.3.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-blue)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

### 🌿 Garden Planner
- Create and manage multiple garden beds
- Visual bed layout with dimensions
- Comprehensive plant database with 35+ varieties
- Track planting status (planned, seeded, transplanted, growing, harvested)
- Companion planting information
- Winter-hardy plant indicators
- Frost tolerance ratings

### 📅 Planting Calendar
- Automatic planting schedule calculation based on frost dates
- Support for both direct seeding and transplanting
- Expected harvest date predictions
- Succession planting tracker
- Month-by-month planting timeline
- Customizable frost dates for your zone

### ❄️ Winter Garden Planning
**Inspired by Eliot Coleman & Nico Jabour's techniques:**
- Multiple season extension methods:
  - Quick Hoops (Low Tunnels)
  - Caterpillar Tunnels
  - Cold Frames
  - Four-Season Harvest System
- Temperature protection calculator
- Winter-hardy plant recommendations
- Multi-layer protection planning
- Harvest window scheduling
- Coleman's "Persephone Period" guidance

### 🌤️ Weather & Alerts
- 7-day weather forecast display
- Frost and freeze warnings
- Temperature and precipitation tracking
- Growing Degree Days (GDD) calculator
- Garden-specific weather tips
- Location-based alerts (configurable)

### ♻️ Compost Tracker
- Multiple compost pile management
- Carbon:Nitrogen ratio calculator (ideal 25-35:1)
- Ingredient tracking with automatic C:N calculations
- Turn schedule reminders
- Moisture level monitoring
- Status tracking (building, cooking, curing, ready)
- Ready date estimations
- 12+ pre-configured compost materials

## 🎯 Key Highlights

- **35+ Plant Varieties** with detailed growing information
- **Winter-Hardy Plants** specially marked for season extension
- **Frost Tolerance Ratings** for each plant
- **Companion Planting Guide** built-in
- **Smart Date Calculations** based on your frost dates
- **C:N Ratio Calculator** for perfect compost
- **Weather Integration** ready (API configuration needed)

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd homestead-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## 📱 Usage Guide

### Setting Up Your Garden

1. **Configure Frost Dates**: Navigate to the Planting Calendar tab and set your last spring frost and first fall frost dates for accurate scheduling.

2. **Create Garden Beds**: In the Garden Planner, add your garden beds with dimensions and sun exposure.

3. **Add Plants**: Browse the comprehensive plant database and add plants to your beds. The database includes:
   - Vegetables (tomatoes, peppers, leafy greens, root vegetables)
   - Herbs (basil, parsley, cilantro, dill)
   - Winter-hardy varieties (spinach, kale, mâche, claytonia)
   - Cover crops

### Winter Gardening

The Winter Garden tab provides season extension techniques based on proven methods from Eliot Coleman and Nico Jabour:

- **Layer System**: Each protection layer adds ~10-15°F of frost protection
- **Best Winter Crops**: Pre-selected list of cold-hardy varieties
- **Harvest Planning**: Schedule your winter harvest window
- **Protection Methods**: Choose from quick hoops, cold frames, caterpillar tunnels, or the full four-season system

### Managing Compost

1. **Create Piles**: Add compost piles with location and size
2. **Track Ingredients**: Add green (nitrogen) and brown (carbon) materials
3. **Monitor C:N Ratio**: The app automatically calculates and displays your carbon-to-nitrogen ratio
4. **Turn Schedule**: Track when you last turned the pile
5. **Ready Date**: Get estimated completion dates

## 🛠️ Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Date Management**: date-fns
- **Icons**: lucide-react
- **Build Tool**: Create React App

## 🌐 API Integration (Future)

The Weather Alerts feature is designed to integrate with weather APIs:

### Recommended APIs:
- **OpenWeatherMap** (openweathermap.org)
  - Free tier: 1000 calls/day
  - Provides forecasts, alerts, and current conditions

- **Weather.gov API**
  - Free, no API key required (US only)
  - NOAA data with detailed forecasts

To integrate, update `src/components/WeatherAlerts.tsx` with your API calls.

## 📚 Plant Database

The app includes a comprehensive database with:
- **35+ Plant Varieties**
- Scientific names
- Days to maturity
- Frost tolerance levels
- Companion/incompatible plants
- Spacing requirements
- Water and sun needs
- Soil pH preferences
- Germination temperatures
- Winter hardiness indicators

### Winter-Hardy Varieties Include:
- Spinach (very-hardy, -10°F with protection)
- Kale (very-hardy, sweetens after frost)
- Mâche/Corn Salad (very-hardy, Eliot Coleman's favorite)
- Claytonia/Miner's Lettuce
- Leeks (extremely hardy)
- Carrots (can overwinter)
- And more!

## 🎓 Educational Content

The app includes gardening wisdom from:

### Eliot Coleman
- Four-Season Harvest principles
- The "Persephone Period" concept
- Multi-layer protection system
- Best winter crop recommendations

### Nico Jabour
- Quick hoops construction
- Snow as insulation technique
- Season extension timing
- Harvest methods for continuous production

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Add more plants to the database
- Improve the UI/UX
- Add new features
- Fix bugs
- Improve documentation

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Inspired by the pioneering work of **Eliot Coleman** (The Winter Harvest Handbook, Four-Season Harvest)
- Techniques from **Nico Jabour** (The Market Gardener's Toolkit)
- Plant data compiled from various agricultural extension services

## 🐛 Known Limitations

- Weather data currently uses mock data (API integration needed)
- Garden bed visualization is list-based (visual grid layout can be added)
- Compost temperature tracking is manual entry
- No data persistence (localStorage/backend can be added)

## 🔮 Future Enhancements

- [ ] Visual drag-and-drop garden bed designer
- [ ] Data persistence with localStorage or backend
- [ ] Live weather API integration
- [ ] Mobile app version
- [ ] Photo upload for plants
- [ ] Harvest tracking and yield records
- [ ] Pest and disease tracking
- [ ] Growing journal/notes
- [ ] Print-friendly garden plans
- [ ] Seed inventory management

## 📞 Support

For questions or issues, please open an issue on GitHub.

---

**Happy Gardening! 🌱🥬🥕**
