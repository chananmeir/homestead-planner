import React, { useState, useEffect } from 'react';
import './App.css';
import GardenPlanner from './components/GardenPlanner';
import GrowingHub from './components/GrowingHub';
import WeatherAlerts from './components/WeatherAlerts';
import CompostTracker from './components/CompostTracker';
import GardenDesigner from './components/GardenDesigner';
import PropertyDesigner from './components/PropertyDesigner';
import Livestock from './components/Livestock';
import HarvestTracker from './components/HarvestTracker';
import PhotoGallery from './components/PhotoGallery';
import SeedsHub from './components/SeedsHub';
import NutritionalDashboard from './components/NutritionalDashboard';
import AdminUserManagement from './components/AdminUserManagement';
import { ToastProvider, ErrorBoundary } from './components/common';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ActivePlanProvider } from './contexts/ActivePlanContext';
import { LoginModal } from './components/Auth/LoginModal';
import { RegisterModal } from './components/Auth/RegisterModal';
import { LoginRequiredMessage } from './components/Auth/LoginRequiredMessage';
import { API_BASE_URL } from './config';

type Tab = 'garden' | 'designer' | 'property' | 'livestock' | 'growing' | 'weather' | 'compost' | 'harvests' | 'photos' | 'seeds' | 'nutrition' | 'admin';

// Inner component that uses auth context
function AppContent() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('garden');
  const [locationInfo, setLocationInfo] = useState<{ zipCode: string; zone: string; city: string } | null>(null);
  const [designerBedId, setDesignerBedId] = useState<number | null>(null);
  const [designerDate, setDesignerDate] = useState<string | null>(null);
  const [transplantSeedStartId, setTransplantSeedStartId] = useState<number | null>(null);
  const [plantingEventId, setPlantingEventId] = useState<number | null>(null);

  // Load zip code and growing zone for header display — re-runs on user change
  useEffect(() => {
    if (!user) {
      setLocationInfo(null);
      return;
    }

    const zipCode = localStorage.getItem('weatherZipCode');
    if (!zipCode) {
      setLocationInfo(null);
      return;
    }

    const fetchZone = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/weather/current?zipcode=${zipCode}`,
          { credentials: 'include' }
        );
        if (response.ok) {
          const data = await response.json();
          setLocationInfo({
            zipCode,
            zone: data.location?.zone || '',
            city: data.location?.city || '',
          });
        }
      } catch {
        // Still show zip even if zone fetch fails
        setLocationInfo({ zipCode, zone: '', city: '' });
      }
    };

    fetchZone();

    // Listen for localStorage changes (cross-tab via StorageEvent)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'weatherZipCode' && e.newValue) {
        setLocationInfo(prev => prev ? { ...prev, zipCode: e.newValue! } : null);
      }
    };
    // Listen for same-tab zip changes (StorageEvent doesn't fire in the originating tab)
    const handleZipChanged = async (e: Event) => {
      const newZip = (e as CustomEvent).detail;
      if (newZip) {
        setLocationInfo({ zipCode: newZip, zone: '', city: '' });
        try {
          const resp = await fetch(
            `${API_BASE_URL}/api/weather/current?zipcode=${newZip}`,
            { credentials: 'include' }
          );
          if (resp.ok) {
            const data = await resp.json();
            setLocationInfo({
              zipCode: newZip,
              zone: data.location?.zone || '',
              city: data.location?.city || '',
            });
          }
        } catch { /* zip already shown */ }
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('weatherZipCodeChanged', handleZipChanged);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('weatherZipCodeChanged', handleZipChanged);
    };
  }, [user]);

  const tabs = [
    { id: 'garden' as Tab, name: 'Garden Planner', icon: '🌱' },
    { id: 'designer' as Tab, name: 'Garden Designer', icon: '🎨' },
    { id: 'property' as Tab, name: 'Property Designer', icon: '🗺️' },
    { id: 'seeds' as Tab, name: 'Seeds', icon: '🌾' },
    { id: 'livestock' as Tab, name: 'Livestock', icon: '🐔' },
    { id: 'growing' as Tab, name: 'Growing', icon: '🌿' },
    { id: 'weather' as Tab, name: 'Weather', icon: '🌤️' },
    { id: 'nutrition' as Tab, name: 'Nutrition', icon: '🥗' },
    { id: 'compost' as Tab, name: 'Compost', icon: '♻️' },
    { id: 'harvests' as Tab, name: 'Harvests', icon: '🧺' },
    { id: 'photos' as Tab, name: 'Photos', icon: '📷' },
    ...(user?.isAdmin ? [{ id: 'admin' as Tab, name: 'Admin', icon: '⚙️' }] : []),
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-green-700">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-green-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Homestead Tracker</h1>
            <p className="text-green-100 mt-1">
              Complete Homestead Planning • Garden Design • Livestock • Year-Round Growing
            </p>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <div className="text-right">
                  <span className="text-green-100">Welcome, {user?.username}</span>
                  {locationInfo && (
                    <p className="text-green-200 text-xs">
                      {locationInfo.city && `${locationInfo.city} · `}
                      {locationInfo.zipCode}
                      {locationInfo.zone && ` · Zone ${locationInfo.zone}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowLogin(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={() => setShowRegister(true)}
                  className="px-4 py-2 bg-white text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white shadow-md border-b">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  // Clear designer navigation intent when manually switching tabs
                  if (tab.id !== 'designer') {
                    setDesignerBedId(null);
                    setDesignerDate(null);
                    setTransplantSeedStartId(null);
                  }
                }}
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
        {!isAuthenticated ? (
          <LoginRequiredMessage onLoginClick={() => setShowLogin(true)} />
        ) : (
          <>
            {activeTab === 'garden' && <GardenPlanner />}
            {activeTab === 'designer' && <GardenDesigner initialBedId={designerBedId} initialDate={designerDate} transplantSeedStartId={transplantSeedStartId} onTransplantComplete={() => setTransplantSeedStartId(null)} plantingEventId={plantingEventId} onPlantingComplete={() => setPlantingEventId(null)} />}
            {activeTab === 'property' && <PropertyDesigner />}
            {activeTab === 'seeds' && <SeedsHub />}
            {activeTab === 'livestock' && <Livestock />}
            {activeTab === 'growing' && <GrowingHub onNavigateToBed={(bedId, date, seedStartId, eventId) => {
              setDesignerBedId(bedId);
              setDesignerDate(date || null);
              setTransplantSeedStartId(seedStartId || null);
              setPlantingEventId(eventId || null);
              setActiveTab('designer');
            }} />}
            {activeTab === 'weather' && <WeatherAlerts />}
            {activeTab === 'nutrition' && <NutritionalDashboard />}
            {activeTab === 'compost' && <CompostTracker />}
            {activeTab === 'harvests' && <HarvestTracker />}
            {activeTab === 'photos' && <PhotoGallery />}
            {activeTab === 'admin' && user?.isAdmin && <AdminUserManagement />}
          </>
        )}
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

      {/* Auth Modals */}
      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onSwitchToRegister={() => {
          setShowLogin(false);
          setShowRegister(true);
        }}
      />
      <RegisterModal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        onSwitchToLogin={() => {
          setShowRegister(false);
          setShowLogin(true);
        }}
      />
    </>
  );
}

// Main App component wraps everything with providers
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <ActivePlanProvider>
            <AppContent />
          </ActivePlanProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
