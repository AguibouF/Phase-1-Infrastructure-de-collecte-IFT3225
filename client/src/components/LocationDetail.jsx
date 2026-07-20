import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { ambianceApi } from '../api/ambianceApi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const LocationDetail = ({ location, onBack, user, token, isFavorite, onToggleFavorite }) => {
  const [ambiance, setAmbiance] = useState(null);
  const [history, setHistory] = useState(null);
  const [quietHours, setQuietHours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // État pour le formulaire d'observation
  const [showObservationForm, setShowObservationForm] = useState(false);
  const [observationData, setObservationData] = useState({
    density: '',
    proximity: '',
    vibe: '',
    notes: ''
  });
  const [observationError, setObservationError] = useState('');
  const [observationSuccess, setObservationSuccess] = useState(false);

  useEffect(() => {
    const fetchLocationData = async () => {
      try {
        setLoading(true);
        const [currentAmbiance, historyData, quietHoursData] = await Promise.all([
          ambianceApi.getCurrentAmbiance(location.slug),
          ambianceApi.getHistory(location.slug, { last: '24h', bucket: '1h' }),
          ambianceApi.getQuietHours(location.slug, { days: 7 }),
        ]);
        setAmbiance(currentAmbiance.data);
        setHistory(historyData.data);
        setQuietHours(quietHoursData.data);
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

  // Préparer les données pour le graphique
  const prepareChartData = () => {
    if (!history || !history.series || history.series.length === 0) return null;

    const labels = history.series.map((bucket) => {
      const date = new Date(bucket.bucketStart);
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    });

    const data = history.series.map((bucket) => bucket.avgNoise ?? 0);

    return {
      labels,
      datasets: [
        {
          label: 'Niveau sonore moyen (dB)',
          data,
          borderColor: '#3498db',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    };
  };

  const chartData = prepareChartData();

  const handleObservationSubmit = async (e) => {
    e.preventDefault();
    setObservationError('');
    setObservationSuccess(false);

    try {
      await ambianceApi.submitObservation(token, {
        locationSlug: location.slug,
        ...observationData
      });
      setObservationSuccess(true);
      setObservationData({ density: '', proximity: '', vibe: '', notes: '' });
      setTimeout(() => setShowObservationForm(false), 2000);
    } catch (err) {
      setObservationError(err.response?.data?.error?.message || 'Erreur lors de la soumission');
    }
  };

  if (loading) return <div className="loading">Chargement...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="location-detail">
      <button onClick={onBack} className="back-button">← Retour à la carte</button>
      
      <div className="location-header">
        <h1>{location.displayName}</h1>
        <p className="location-meta">{location.type} • {location.city}</p>
        {user && (
          <button 
            onClick={onToggleFavorite} 
            className={`favorite-button ${isFavorite ? 'active' : ''}`}
          >
            {isFavorite ? '★ Favori' : '☆ Ajouter aux favoris'}
          </button>
        )}
      </div>

      {ambiance && (
        <div className="ambiance-section">
          <h2>Ambiance actuelle</h2>
          <div className="ambiance-badge">
            <span className={`badge ${(ambiance.classification || ambiance.ambianceLabel || '')?.toLowerCase() || 'default'}`}>
              {ambiance.classification || ambiance.ambianceLabel || 'Non classifié'}
            </span>
          </div>
          {ambiance.sampleSize && (
            <div className="ambiance-metadata">
              <p><strong>Fenêtre:</strong> {ambiance.window || '30m'}</p>
              <p><strong>Mesures:</strong> {ambiance.sampleSize.measurements || 0}</p>
              <p><strong>Observations:</strong> {ambiance.sampleSize.observations || 0}</p>
            </div>
          )}
        </div>
      )}

      <div className="history-section">
        <h2>Historique (24h)</h2>
        {!chartData ? (
          <p className="no-data">Aucune mesure disponible sur les dernières 24 heures</p>
        ) : (
          <div className="chart-container">
            <Line
              data={chartData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                  title: {
                    display: true,
                    text: 'Évolution du niveau sonore',
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 140, // borne supérieure alignée sur la plage validée par l'API (0–140 dB)
                    title: {
                      display: true,
                      text: 'Niveau sonore (dB)',
                    },
                  },
                  x: {
                    title: {
                      display: true,
                      text: 'Heure',
                    },
                  },
                },
              }}
            />
          </div>
        )}
      </div>

      {quietHours && (
        <div className="quiet-hours-section">
          <h2>Créneaux calmes (7 derniers jours)</h2>
          {quietHours.quietSlots && quietHours.quietSlots.length > 0 ? (
            <div className="quiet-hours-list">
              {quietHours.quietSlots.map((slot, index) => (
                <div key={index} className="quiet-hour-item">
                  <span className="quiet-hour-day">{slot.dayOfWeek}</span>
                  <span className="quiet-hour-range">
                    {slot.from} - {slot.to}
                  </span>
                  <span className="quiet-hour-noise">{slot.avgNoise} dB</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">Aucun créneau calme détecté</p>
          )}
          <div className="quiet-hours-metadata">
            <p><strong>Seuil:</strong> {quietHours.threshold} dB</p>
            <p><strong>Période:</strong> {quietHours.analysisPeriodDays} jours</p>
          </div>
        </div>
      )}

      {user && (
        <div className="observation-section">
          <h2>Ajouter une observation</h2>
          {!showObservationForm ? (
            <button 
              onClick={() => setShowObservationForm(true)} 
              className="add-observation-button"
            >
              + Nouvelle observation
            </button>
          ) : (
            <form onSubmit={handleObservationSubmit} className="observation-form">
              {observationError && <div className="error-message">{observationError}</div>}
              {observationSuccess && <div className="success-message">Observation soumise avec succès !</div>}
              
              <div className="form-group">
                <label>Densité</label>
                <select 
                  value={observationData.density}
                  onChange={(e) => setObservationData({...observationData, density: e.target.value})}
                  required
                >
                  <option value="">Sélectionner...</option>
                  <option value="Vide">Vide</option>
                  <option value="Modéré">Modéré</option>
                  <option value="Fréquenté">Fréquenté</option>
                  <option value="Bondé">Bondé</option>
                </select>
              </div>

              <div className="form-group">
                <label>Proximité</label>
                <select 
                  value={observationData.proximity}
                  onChange={(e) => setObservationData({...observationData, proximity: e.target.value})}
                  required
                >
                  <option value="">Sélectionner...</option>
                  <option value="Isolé">Isolé</option>
                  <option value="Espacé">Espacé</option>
                  <option value="Fréquenté">Fréquenté</option>
                  <option value="Serré">Serré</option>
                </select>
              </div>

              <div className="form-group">
                <label>Ambiance</label>
                <select 
                  value={observationData.vibe}
                  onChange={(e) => setObservationData({...observationData, vibe: e.target.value})}
                  required
                >
                  <option value="">Sélectionner...</option>
                  <option value="Calme">Calme</option>
                  <option value="Concentré">Concentré</option>
                  <option value="Sociable">Sociable</option>
                  <option value="Bruyante">Bruyante</option>
                  <option value="Festive">Festive</option>
                  <option value="Tendue">Tendue</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notes (optionnel)</label>
                <textarea 
                  value={observationData.notes}
                  onChange={(e) => setObservationData({...observationData, notes: e.target.value})}
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div className="form-buttons">
                <button type="submit" className="submit-button">Soumettre</button>
                <button 
                  type="button" 
                  onClick={() => setShowObservationForm(false)}
                  className="cancel-button"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationDetail;
