import { useState, useEffect } from 'react';
import MapView from './components/MapView';
import LocationDetail from './components/LocationDetail';
import { ambianceApi } from './api/ambianceApi';
import './App.css';

function App() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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

    fetchLocations();
  }, []);

  if (loading) return <div className="loading">Chargement...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Ambiance des Lieux</h1>
        <p>Consultez l'ambiance en temps réel des lieux de Montréal</p>
      </header>

      {selectedLocation ? (
        <LocationDetail 
          location={selectedLocation} 
          onBack={() => setSelectedLocation(null)} 
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
