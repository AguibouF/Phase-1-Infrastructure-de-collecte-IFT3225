import { useState, useEffect } from 'react';
import MapView from './components/MapView';
import LocationDetail from './components/LocationDetail';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import { ambianceApi } from './api/ambianceApi';
import './App.css';

function App() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // État d'authentification
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authView, setAuthView] = useState(null); // 'login' ou 'register'

  // Charger l'utilisateur depuis localStorage au démarrage
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await ambianceApi.getLocations();
      setLocations(response.data);
    } catch (err) {
      setError('Erreur lors du chargement des lieux');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
    setAuthView(null);
  };

  const handleRegister = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
    setAuthView(null);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setAuthView(null);
  };

  if (loading) return <div className="loading">Chargement...</div>;
  if (error) return <div className="error">{error}</div>;

  // Afficher le formulaire d'authentification si demandé
  if (authView === 'login') {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Ambiance des Lieux</h1>
          <p>Consultez l'ambiance en temps réel des lieux de Montréal</p>
        </header>
        <LoginForm 
          onLogin={handleLogin} 
          onSwitchToRegister={() => setAuthView('register')} 
        />
      </div>
    );
  }

  if (authView === 'register') {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Ambiance des Lieux</h1>
          <p>Consultez l'ambiance en temps réel des lieux de Montréal</p>
        </header>
        <RegisterForm 
          onRegister={handleRegister} 
          onSwitchToLogin={() => setAuthView('login')} 
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Ambiance des Lieux</h1>
        <p>Consultez l'ambiance en temps réel des lieux de Montréal</p>
        <div className="auth-buttons">
          {user ? (
            <div className="user-info">
              <span>Bonjour, {user.username}</span>
              <button onClick={handleLogout} className="logout-button">Déconnexion</button>
            </div>
          ) : (
            <button onClick={() => setAuthView('login')} className="login-button">Connexion</button>
          )}
        </div>
      </header>

      {selectedLocation ? (
        <LocationDetail 
          location={selectedLocation} 
          onBack={() => setSelectedLocation(null)} 
          user={user}
          token={token}
        />
      ) : (
        <div className="map-section">
          <h2>Carte des lieux</h2>
          <MapView 
            locations={locations} 
            onLocationClick={setSelectedLocation} 
          />
        </div>
      )}
    </div>
  );
}

export default App;
