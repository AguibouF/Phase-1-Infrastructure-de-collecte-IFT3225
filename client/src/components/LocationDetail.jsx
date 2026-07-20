import React, { useState, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { ambianceApi } from '../api/ambianceApi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const LocationDetail = ({ location, onBack, user, token, isFavorite, onToggleFavorite }) => {
  const [ambiance, setAmbiance] = useState(null);
  const [history, setHistory] = useState(null);
  const [quietHours, setQuietHours] = useState(null);
  const [observations, setObservations] = useState([]);
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

  // Horodatage de la dernière mise à jour reçue en direct (SSE)
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(null);

  // silent=true : rafraîchissement en arrière-plan (temps réel), sans écran de chargement
  const fetchLocationData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [currentAmbiance, historyData, quietHoursData, observationsData] = await Promise.all([
        ambianceApi.getCurrentAmbiance(location.slug),
        ambianceApi.getHistory(location.slug, { last: '24h', bucket: '1h' }),
        ambianceApi.getQuietHours(location.slug, { days: 7 }),
        ambianceApi.getObservations(location.slug, { perPage: 5 }),
      ]);
      setAmbiance(currentAmbiance.data);
      setHistory(historyData.data);
      setQuietHours(quietHoursData.data);
      setObservations(observationsData.data || []);
    } catch (err) {
      if (!silent) setError('Erreur lors du chargement des données');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    if (location) {
      fetchLocationData();
    }
  }, [location, fetchLocationData]);

  // Temps réel (SSE, bonus) : le portrait se rafraîchit dès qu'une nouvelle
  // mesure ou observation arrive pour ce lieu, sans recharger la page.
  useEffect(() => {
    if (!location) return;
    const source = ambianceApi.subscribeToAmbianceEvents(() => {
      fetchLocationData(true);
      setLiveUpdatedAt(new Date());
    }, location.slug);
    return () => source.close();
  }, [location, fetchLocationData]);

  // Préparer les données pour le graphique
  const prepareChartData = () => {
    if (!history || !history.series || history.series.length === 0) return null;

    const labels = history.series.map((bucket) => {
      const date = new Date(bucket.bucketStart);
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    });

    // Les tranches sans mesure restent null (trou dans la courbe) : les tracer
    // à 0 dB laisserait croire à un silence total au lieu d'une absence de données.
    const data = history.series.map((bucket) => bucket.avgNoise ?? null);

    // Toutes les tranches vides = aucune donnée exploitable : on affiche
    // l'état vide plutôt qu'un graphique sans courbe.
    if (data.every((value) => value === null)) return null;

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
          spanGaps: false,
        },
      ],
    };
  };

  const chartData = prepareChartData();

  // Échelle adaptative : bornes calées sur les valeurs mesurées (± 5 dB de marge),
  // dans la plage validée par l'API (0–140 dB). Un axe fixe 0–140 écraserait la
  // plage utile (40–80 dB) et rendrait les variations illisibles.
  const measuredValues = chartData
    ? chartData.datasets[0].data.filter((v) => v !== null)
    : [];
  const yMin = measuredValues.length ? Math.max(0, Math.floor(Math.min(...measuredValues) - 5)) : 0;
  const yMax = measuredValues.length ? Math.min(140, Math.ceil(Math.max(...measuredValues) + 5)) : 140;

  // Organise les créneaux calmes de façon lisible : groupés par jour (lundi -> dimanche),
  // triés chronologiquement, et les créneaux de 30 min contigus fusionnés en plages
  // (la moyenne fusionnée est pondérée par le nombre de mesures de chaque créneau).
  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_FR = {
    Monday: 'Lundi', Tuesday: 'Mardi', Wednesday: 'Mercredi', Thursday: 'Jeudi',
    Friday: 'Vendredi', Saturday: 'Samedi', Sunday: 'Dimanche',
  };

  const organizeQuietSlots = () => {
    if (!quietHours || !quietHours.quietSlots) return [];
    const byDay = {};
    for (const slot of quietHours.quietSlots) {
      (byDay[slot.dayOfWeek] = byDay[slot.dayOfWeek] || []).push(slot);
    }
    return DAY_ORDER.filter((day) => byDay[day]).map((day) => {
      const slots = [...byDay[day]].sort((a, b) => a.from.localeCompare(b.from));
      const ranges = [];
      for (const s of slots) {
        const last = ranges[ranges.length - 1];
        if (last && last.to === s.from) {
          last.to = s.to;
          last.noiseSum += s.avgNoise * s.samples;
          last.samples += s.samples;
        } else {
          ranges.push({ from: s.from, to: s.to, noiseSum: s.avgNoise * s.samples, samples: s.samples });
        }
      }
      return {
        day: DAY_FR[day] || day,
        ranges: ranges.map((r) => ({
          from: r.from, to: r.to, samples: r.samples,
          avgNoise: Math.round((r.noiseSum / r.samples) * 10) / 10,
        })),
      };
    });
  };

  const quietDays = organizeQuietSlots();

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
      fetchLocationData(true); // rafraîchit l'historique des observations sans écran de chargement
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
            {(ambiance.ambianceLabel === 'inconnu' && ambiance.lastKnown && ambiance.lastKnown.ambianceLabel !== 'inconnu') ? (
              <>
                <span className={`badge ${ambiance.lastKnown.ambianceLabel.toLowerCase()}`} style={{ opacity: 0.7 }}>
                  {ambiance.lastKnown.ambianceLabel}
                </span>
                <p className="stale-note">
                  Dernière ambiance connue ({new Date(ambiance.lastKnown.asOf).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}) — aucune mesure dans la fenêtre courante.
                </p>
              </>
            ) : (
              <span className={`badge ${(ambiance.classification || ambiance.ambianceLabel || '')?.toLowerCase() || 'default'}`}>
                {ambiance.classification || ambiance.ambianceLabel || 'Non classifié'}
              </span>
            )}
          </div>
          {ambiance.sampleSize && (
            <div className="ambiance-metadata">
              <p><strong>Fenêtre:</strong> {ambiance.window || '30m'}</p>
              <p><strong>Mesures:</strong> {ambiance.sampleSize.measurements || 0}</p>
              <p><strong>Observations:</strong> {ambiance.sampleSize.observations || 0}</p>
            </div>
          )}
          {liveUpdatedAt && (
            <p className="live-indicator">
              ● Mis à jour en direct à {liveUpdatedAt.toLocaleTimeString('fr-FR')}
            </p>
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
                    min: yMin,
                    max: yMax,
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
          {quietDays.length > 0 ? (
            <div className="quiet-hours-list">
              {quietDays.map((dayGroup) => (
                <div key={dayGroup.day} className="quiet-day-group">
                  <h3 className="quiet-day-title">{dayGroup.day}</h3>
                  {dayGroup.ranges.map((range, index) => (
                    <div key={index} className="quiet-hour-item">
                      <span className="quiet-hour-range">
                        {range.from} – {range.to}
                      </span>
                      <span className="quiet-hour-samples">{range.samples} mesure{range.samples > 1 ? 's' : ''}</span>
                      <span className="quiet-hour-noise">{range.avgNoise} dB</span>
                    </div>
                  ))}
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

      <div className="observation-section">
        <h2>Observations récentes</h2>
        {observations.length > 0 ? (
          <div className="observation-history">
            {observations.map((obs) => (
              <div key={obs.id} className="observation-item">
                <div className="observation-item-header">
                  <span className={`badge ${(obs.vibe || '').toLowerCase()}`}>{obs.vibe}</span>
                  <span className="observation-date">
                    {new Date(obs.timestamp).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="observation-details">
                  Densité : {obs.density} • Proximité : {obs.proximity}
                </p>
                {obs.notes && <p className="observation-notes">« {obs.notes} »</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data">Aucune observation pour ce lieu</p>
        )}
      </div>

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
