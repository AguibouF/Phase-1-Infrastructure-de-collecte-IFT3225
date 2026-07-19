import React, { useState, useEffect } from 'react';
import { ambianceApi } from '../api/ambianceApi';

const MyLocations = ({ token, favorites, onLocationSelect, onToggleFavorite }) => {
  const [myLocations, setMyLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMyLocations = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await ambianceApi.getMyLocations(token);
        setMyLocations(response.data.myLocations || []);
      } catch (err) {
        setError('Erreur lors du chargement de vos lieux');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchMyLocations();
    }
  }, [token]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) return <div className="loading">Chargement de vos lieux...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="my-locations-section">
      <h2>Mes lieux</h2>
      <p className="my-locations-intro">
        Récapitulatif des lieux où vous avez soumis des observations.
      </p>

      {myLocations.length === 0 ? (
        <div className="empty-state">
          Vous n'avez encore soumis aucune observation. Ouvrez un lieu sur la
          carte et utilisez le formulaire d'observation pour contribuer.
        </div>
      ) : (
        <div className="my-locations-list">
          {myLocations.map((loc) => {
            const isFavorite = favorites.includes(loc.locationSlug);
            return (
            <div key={loc.locationSlug} className="my-location-card">
              <div className="my-location-info">
                <h3>{loc.displayName}</h3>
                <p className="my-location-meta">
                  {loc.type ? `${loc.type} · ` : ''}
                  {loc.observationCount} observation{loc.observationCount > 1 ? 's' : ''}
                  {' · dernière : '}
                  {formatDate(loc.lastObservationAt)}
                </p>
              </div>
              <div className="my-location-actions">
                <button
                  className={`favorite-toggle ${isFavorite ? 'active' : ''}`}
                  onClick={() => onToggleFavorite(loc.locationSlug)}
                  title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  {isFavorite ? '★' : '☆'}
                </button>
                <button
                  className="detail-button"
                  onClick={() => onLocationSelect(loc.locationSlug)}
                >
                  Voir le détail
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyLocations;
