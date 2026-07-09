import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { ambianceApi } from '../api/ambianceApi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const LocationDetail = ({ location, onBack }) => {
  const [ambiance, setAmbiance] = useState(null);
  const [history, setHistory] = useState(null);
  const [quietHours, setQuietHours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    if (!history || !history.buckets) return null;

    const labels = history.buckets.map((bucket) => {
      const date = new Date(bucket.timestamp);
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    });

    const data = history.buckets.map((bucket) => bucket.avgNoiseLevel || bucket.avgNoise || 0);

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

      {chartData && (
        <div className="history-section">
          <h2>Historique (24h)</h2>
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
                    max: 100,
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
        </div>
      )}

      {quietHours && (
        <div className="quiet-hours-section">
          <h2>Créneaux calmes (7 derniers jours)</h2>
          {quietHours.quietHours && quietHours.quietHours.length > 0 ? (
            <div className="quiet-hours-list">
              {quietHours.quietHours.map((period, index) => (
                <div key={index} className="quiet-hour-item">
                  <span className="quiet-hour-day">{period.dayOfWeek}</span>
                  <span className="quiet-hour-range">
                    {period.start} - {period.end}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">Aucun créneau calme détecté</p>
          )}
          {quietHours.metadata && (
            <div className="quiet-hours-metadata">
              <p><strong>Seuil:</strong> {quietHours.metadata.threshold} dB</p>
              <p><strong>Période:</strong> {quietHours.metadata.days} jours</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationDetail;
