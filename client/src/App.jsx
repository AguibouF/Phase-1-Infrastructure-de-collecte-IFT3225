import { lazy, Suspense } from 'react';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import { Loading, ErrorMessage } from './components/common/StateMessage';

// Composants lourds chargés à la demande (code-splitting) : la carte embarque
// Leaflet, le détail embarque Chart.js. Les séparer allège le bundle initial et
// ne charge Chart.js que lorsqu'un lieu est ouvert.
const MapView = lazy(() => import('./components/MapView'));
const LocationDetail = lazy(() => import('./components/LocationDetail'));
const MyLocations = lazy(() => import('./components/MyLocations'));
const WhereToGo = lazy(() => import('./components/WhereToGo'));
import { useLocations } from './hooks/useLocations';
import { useAuth } from './context/AuthContext';
import { useFavorites } from './context/FavoritesContext';
import { useUIStore } from './store/uiStore';
import './App.css';

// En-tête réutilisé par toutes les vues (carte + écrans d'authentification).
function AppHeader({ children }) {
  return (
    <header className="app-header">
      <h1>Ambiance des Lieux</h1>
      <p>Consultez l'ambiance en temps réel des lieux de Montréal</p>
      {children}
    </header>
  );
}

function App() {
  const { user, isAuthenticated, logout } = useAuth();
  const { favorites } = useFavorites();
  const { locations, loading, error } = useLocations();

  const view = useUIStore((s) => s.view);
  const selectedLocation = useUIStore((s) => s.selectedLocation);
  const showFavoritesOnly = useUIStore((s) => s.showFavoritesOnly);
  const authView = useUIStore((s) => s.authView);
  const notice = useUIStore((s) => s.notice);
  const setView = useUIStore((s) => s.setView);
  const selectLocation = useUIStore((s) => s.selectLocation);
  const clearLocation = useUIStore((s) => s.clearLocation);
  const toggleFavoritesOnly = useUIStore((s) => s.toggleFavoritesOnly);
  const openAuth = useUIStore((s) => s.openAuth);
  const closeAuth = useUIStore((s) => s.closeAuth);

  if (loading) return <Loading message="Chargement…" />;
  if (error) return <ErrorMessage message={error} />;

  // Écrans d'authentification (login / inscription).
  if (authView === 'login' || authView === 'register') {
    return (
      <div className="app">
        <AppHeader>{notice && <div className="notice-banner">{notice}</div>}</AppHeader>
        {authView === 'login' ? <LoginForm /> : <RegisterForm />}
        <div className="auth-back">
          <button onClick={closeAuth} className="back-button">← Retour à la carte</button>
        </div>
      </div>
    );
  }

  const filteredLocations = showFavoritesOnly
    ? locations.filter((loc) => favorites.includes(loc.slug))
    : locations;

  const openLocationBySlug = (slug) => {
    const loc = locations.find((l) => l.slug === slug);
    if (loc) selectLocation(loc);
  };

  return (
    <div className="app">
      <AppHeader>
        <div className="auth-buttons">
          {user ? (
            <div className="user-info">
              <span>Bonjour, {user.username}</span>
              <button onClick={logout} className="logout-button">Déconnexion</button>
            </div>
          ) : (
            <button onClick={() => openAuth('login')} className="login-button">Connexion</button>
          )}
        </div>
        <div className="filter-buttons">
          <button
            onClick={() => setView(view === 'where-to-go' ? 'map' : 'where-to-go')}
            className={`filter-button ${view === 'where-to-go' ? 'active' : ''}`}
          >
            {view === 'where-to-go' ? 'Retour à la carte' : 'Où aller ?'}
          </button>
          {isAuthenticated && (
            <>
              <button
                onClick={toggleFavoritesOnly}
                className={`filter-button ${showFavoritesOnly ? 'active' : ''}`}
              >
                {showFavoritesOnly ? 'Tous les lieux' : 'Mes favoris'}
              </button>
              <button
                onClick={() => setView(view === 'my-locations' ? 'map' : 'my-locations')}
                className={`filter-button ${view === 'my-locations' ? 'active' : ''}`}
              >
                {view === 'my-locations' ? 'Retour à la carte' : 'Mes lieux'}
              </button>
            </>
          )}
        </div>
      </AppHeader>

      {notice && <div className="notice-banner">{notice}</div>}

      <Suspense fallback={<Loading message="Chargement…" />}>
        {selectedLocation ? (
          <LocationDetail location={selectedLocation} onBack={clearLocation} />
        ) : view === 'where-to-go' ? (
          <WhereToGo locations={locations} onLocationClick={selectLocation} />
        ) : view === 'my-locations' && isAuthenticated ? (
          <MyLocations onLocationSelect={openLocationBySlug} />
        ) : (
          <div className="map-section">
            <h2>Carte des lieux {showFavoritesOnly ? '(Favoris)' : ''}</h2>
            <MapView locations={filteredLocations} onLocationClick={selectLocation} />
          </div>
        )}
      </Suspense>
    </div>
  );
}

export default App;
