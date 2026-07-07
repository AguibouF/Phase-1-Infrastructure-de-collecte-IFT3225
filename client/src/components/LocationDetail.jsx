import React, { useState, useEffect } from 'react';
import { ambianceApi } from '../api/ambianceApi';

const LocationDetail = ({ location, onBack }) => {
  const [ambiance, setAmbiance] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLocationData = async () => {
      try {
        setLoading(true);
        const [currentAmbiance, historyData] = await Promise.all([
          ambianceApi.getCurrentAmbiance(location.slug),
          ambianceApi.getHistory(location.slug, { last: '24h', bucket: '1h' }),
        ]);
        setAmbiance(currentAmbiance.data);
        setHistory(historyData.data);
      } catch (err) {
        setError('Erreur lors du chargement des données');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (location) {
      fetchLocationData();
    }
  }, [location]);

  if (loading) return <div className="loading">Chargement...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="location-detail">
      <button onClick={onBack} className="back-button">← Retour à la carte</button>
      
      <div className="location-header">
        <h1>{location.displayName}</h1>
        <p className="location-meta">{location.type} • {location.city}</p>
      </div>

      {ambiance && (
        <div className="ambiance-badge">
          <span className={`badge ${ambiance.classification?.toLowerCase()}`}>
            {ambiance.classification || 'Non classifié'}
          </span>
        </div>
      )}

      {history && (
        <div className="history-section">
          <h2>Historique (24h)</h2>
          <div className="history-placeholder">
            <p>Graphique d'historique à implémenter</p>
            <pre>{JSON.stringify(history, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationDetail;
