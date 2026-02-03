import React, { useState } from 'react';
import './App.css';
import GardenPlanner from './components/GardenPlanner';
import PlantingCalendar from './components/PlantingCalendar';
import ErrorBoundary from './components/PlantingCalendar/ErrorBoundary';
import WeatherAlerts from './components/WeatherAlerts';
import CompostTracker from './components/CompostTracker';
import GardenDesigner from './components/GardenDesigner';
import PropertyDesigner from './components/PropertyDesigner';
import Livestock from './components/Livestock';
import HarvestTracker from './components/HarvestTracker';
import PhotoGallery from './components/PhotoGallery';
import { ToastProvider } from './components/common';

type Tab = 'garden' | 'designer' | 'property' | 'livestock' | 'calendar' | 'weather' | 'compost' | 'harvests' | 'photos';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('garden');

  const tabs = [
    { id: 'garden' as Tab, name: 'Garden Planner', icon: '🌱' },
    { id: 'designer' as Tab, name: 'Garden Designer', icon: '🎨' },
    { id: 'property' as Tab, name: 'Property Designer', icon: '🗺️' },
    { id: 'livestock' as Tab, name: 'Livestock', icon: '🐔' },
    { id: 'calendar' as Tab, name: 'Planting Calendar', icon: '📅' },
    { id: 'weather' as Tab, name: 'Weather', icon: '🌤️' },
    { id: 'compost' as Tab, name: 'Compost', icon: '♻️' },
    { id: 'harvests' as Tab, name: 'Harvests', icon: '🧺' },
    { id: 'photos' as Tab, name: 'Photos', icon: '📷' },
  ];

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-green-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Homestead Tracker</h1>
          <p className="text-green-100 mt-1">
            Complete Homestead Planning • Garden Design • Livestock • Year-Round Growing
          </p>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white shadow-md border-b">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-700 bg-green-50'
                    : 'border-transparent text-gray-600 hover:text-green-600 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'garden' && <GardenPlanner />}
        {activeTab === 'designer' && <GardenDesigner />}
        {activeTab === 'property' && <PropertyDesigner />}
        {activeTab === 'livestock' && <Livestock />}
        {activeTab === 'calendar' && (
          <ErrorBoundary>
            <PlantingCalendar />
          </ErrorBoundary>
        )}
        {activeTab === 'weather' && <WeatherAlerts />}
        {activeTab === 'compost' && <CompostTracker />}
        {activeTab === 'harvests' && <HarvestTracker />}
        {activeTab === 'photos' && <PhotoGallery />}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 mt-12">
        <div className="container mx-auto px-4 py-6 text-center">
          <p>
            Inspired by the techniques of Eliot Coleman & Nico Jabour
          </p>
        </div>
      </footer>
      </div>
    </ToastProvider>
  );
}

export default App;
