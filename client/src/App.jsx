import { useState, useEffect } from 'react';
import MapView from './components/MapView';
import LocationDetail from './components/LocationDetail';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import MyLocations from './components/MyLocations';
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
  
  // État des favoris
  const [favorites, setFavorites] = useState([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Vue « Mes lieux » (lieux où l'utilisateur a soumis des observations)
  const [showMyLocations, setShowMyLocations] = useState(false);

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
    setFavorites([]);
    setShowFavoritesOnly(false);
    setShowMyLocations(false);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setAuthView(null);
  };

  // Charger les favoris quand l'utilisateur se connecte
  useEffect(() => {
    const loadFavorites = async () => {
      if (user && token) {
        try {
          const response = await ambianceApi.getFavorites(token);
          setFavorites(response.data.favoriteLocations || []);
        } catch (err) {
          console.error('Erreur chargement favoris:', err);
        }
      }
    };
    loadFavorites();
  }, [user, token]);

  const handleToggleFavorite = async (locationSlug) => {
    if (!user || !token) return;

    try {
      if (favorites.includes(locationSlug)) {
        await ambianceApi.removeFavorite(token, locationSlug);
        setFavorites(favorites.filter(slug => slug !== locationSlug));
      } else {
        await ambianceApi.addFavorite(token, locationSlug);
        setFavorites([...favorites, locationSlug]);
      }
    } catch (err) {
      console.error('Erreur toggle favori:', err);
    }
  };

  const isLocationFavorite = (locationSlug) => {
    return favorites.includes(locationSlug);
  };

  // Filtrer les lieux selon les favoris
  const filteredLocations = showFavoritesOnly 
    ? locations.filter(loc => favorites.includes(loc.slug))
    : locations;

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
        {user && (
          <div className="filter-buttons">
            <button
              onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setShowMyLocations(false); }}
              className={`filter-button ${showFavoritesOnly ? 'active' : ''}`}
            >
              {showFavoritesOnly ? 'Tous les lieux' : 'Mes favoris'}
            </button>
            <button
              onClick={() => { setShowMyLocations(!showMyLocations); setSelectedLocation(null); }}
              className={`filter-button ${showMyLocations ? 'active' : ''}`}
            >
              {showMyLocations ? 'Retour à la carte' : 'Mes lieux'}
            </button>
          </div>
        )}
      </header>

      {user && showMyLocations && !selectedLocation ? (
        <MyLocations
          token={token}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          onLocationSelect={(slug) => {
            const loc = locations.find((l) => l.slug === slug);
            if (loc) {
              setShowMyLocations(false);
              setSelectedLocation(loc);
            }
          }}
        />
      ) : selectedLocation ? (
        <LocationDetail
          location={selectedLocation} 
          onBack={() => setSelectedLocation(null)} 
          user={user}
          token={token}
          isFavorite={isLocationFavorite(selectedLocation.slug)}
          onToggleFavorite={() => handleToggleFavorite(selectedLocation.slug)}
        />
      ) : (
        <div className="map-section">
          <h2>Carte des lieux {showFavoritesOnly ? '(Favoris)' : ''}</h2>
          <MapView 
            locations={filteredLocations} 
            onLocationClick={setSelectedLocation} 
          />
        </div>
      )}
    </div>
  );
}

export default App;
