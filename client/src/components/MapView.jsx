import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ambianceApi } from '../api/ambianceApi';
import { Loading } from './common/StateMessage';
import { ambianceColor } from '../utils/ambiance';

// Durée pendant laquelle un lieu reste signalé « en direct » après une mesure.
const LIVE_MS = 4000;

// Fix pour les icônes Leaflet dans React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapView = ({ locations, onLocationClick }) => {
  const [locationsWithAmbiance, setLocationsWithAmbiance] = useState([]);
  const [loading, setLoading] = useState(true);
  // Vrai si l'ambiance d'au moins un lieu n'a pas pu être chargée (échec réseau/serveur).
  const [ambianceError, setAmbianceError] = useState(false);
  // Lieux ayant reçu une mesure en direct très récemment (effet « prise live »).
  const [liveSlugs, setLiveSlugs] = useState(() => new Set());
  const liveTimers = useRef({});

  const fetchAmbianceForLocations = useCallback(async () => {
    let failures = 0;
    try {
      const locationsWithData = await Promise.all(
        locations.map(async (location) => {
          try {
            const response = await ambianceApi.getCurrentAmbiance(location.slug);
            return { ...location, ambiance: response.data };
          } catch (error) {
            failures += 1;
            console.error(`Erreur ambiance pour ${location.slug}:`, error);
            return { ...location, ambiance: null };
          }
        })
      );
      setLocationsWithAmbiance(locationsWithData);
      setAmbianceError(failures > 0);
    } catch (error) {
      console.error('Erreur récupération ambiance:', error);
      setLocationsWithAmbiance(locations);
      setAmbianceError(true);
    } finally {
      setLoading(false);
    }
  }, [locations]);

  useEffect(() => {
    if (locations.length > 0) fetchAmbianceForLocations();
  }, [locations, fetchAmbianceForLocations]);

  // Temps réel (SSE) : à chaque nouvelle mesure/observation, le marqueur du lieu
  // concerné est rafraîchi ET signalé « en direct » (anneau pulsant + légère
  // vibration + retour haptique sur mobile) pendant quelques secondes, pour
  // matérialiser une prise de mesure live pendant une collecte.
  useEffect(() => {
    // Marque un lieu comme « en direct » puis programme son extinction.
    const markLive = (slug) => {
      setLiveSlugs((prev) => new Set(prev).add(slug));
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(120);
      clearTimeout(liveTimers.current[slug]);
      liveTimers.current[slug] = setTimeout(() => {
        setLiveSlugs((prev) => {
          const next = new Set(prev);
          next.delete(slug);
          return next;
        });
      }, LIVE_MS);
    };

    const source = ambianceApi.subscribeToAmbianceEvents(async ({ locationSlug }) => {
      markLive(locationSlug);
      try {
        const response = await ambianceApi.getCurrentAmbiance(locationSlug);
        setLocationsWithAmbiance((prev) =>
          prev.map((loc) => (loc.slug === locationSlug ? { ...loc, ambiance: response.data } : loc))
        );
      } catch {
        // Échec du rafraîchissement : le marqueur garde son dernier état connu
      }
    });

    const timers = liveTimers.current;
    return () => {
      source.close();
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // Couleur du marqueur selon la classification (utilitaire partagé avec la
  // recommandation « Où aller ? » — voir utils/ambiance.js).
  const getMarkerColor = (ambiance) =>
    ambianceColor(ambiance?.classification || ambiance?.ambianceLabel);

  // Résout ce que le marqueur doit montrer : l'ambiance actuelle si la fenêtre
  // de 30 min contient des mesures, sinon la dernière ambiance connue (fournie
  // par le serveur), affichée comme périmée (stale).
  const getDisplayAmbiance = (ambiance) => {
    const label = (ambiance?.classification || ambiance?.ambianceLabel || '').toLowerCase();
    if (label && label !== 'inconnu') return { ambiance, stale: false };
    if (ambiance?.lastKnown && ambiance.lastKnown.ambianceLabel !== 'inconnu') {
      return { ambiance: ambiance.lastKnown, stale: true, asOf: ambiance.lastKnown.asOf };
    }
    return { ambiance: null, stale: false };
  };

  // Ancienneté lisible d'un horodatage ISO.
  const timeAgo = (iso) => {
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `il y a ${hours} h`;
    return `il y a ${Math.round(hours / 24)} j`;
  };

  // Créer une icône personnalisée avec la couleur (estompée si l'info est
  // périmée ; anneau pulsant + vibration si une mesure vient d'arriver en direct)
  const createCustomIcon = (color, stale = false, live = false) => {
    const dot = `<div class="marker-dot" style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px ${stale ? 'dashed' : 'solid'} white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); opacity: ${stale ? 0.55 : 1};"></div>`;
    const ripple = live ? `<span class="marker-ripple" style="border-color: ${color};"></span>` : '';
    return L.divIcon({
      className: `custom-marker${live ? ' marker-live' : ''}`,
      html: dot + ripple,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    });
  };

  // Position par défaut : centre de Montréal
  const centerPosition = [45.5017, -73.5673];

  if (loading) return <Loading message="Chargement de la carte…" />;

  const liveLocations = locationsWithAmbiance.filter((loc) => liveSlugs.has(loc.slug));

  return (
    <div className="map-container">
      {ambianceError && (
        <div className="map-notice" role="alert">
          <span>Impossible de charger l'ambiance en direct de certains lieux.</span>
          <button onClick={() => { setAmbianceError(false); fetchAmbianceForLocations(); }}>Réessayer</button>
        </div>
      )}
      {liveLocations.length > 0 && (
        <div className="map-live-badge" role="status">
          <span className="live-dot" />
          Prise en direct : {liveLocations.map((loc) => loc.displayName).join(', ')}
        </div>
      )}
      <MapContainer center={centerPosition} zoom={13} style={{ width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {locationsWithAmbiance.map((location) => {
          const display = getDisplayAmbiance(location.ambiance);
          const live = liveSlugs.has(location.slug);
          return location.latitude && location.longitude && (
            <Marker
              key={location.slug}
              position={[location.latitude, location.longitude]}
              icon={createCustomIcon(getMarkerColor(display.ambiance), display.stale, live)}
              eventHandlers={{
                click: () => onLocationClick(location),
              }}
            >
              <Tooltip direction="top" offset={[0, -15]}>
                {location.displayName}
                {live && ' — ● prise en direct'}
                {!live && display.stale && ` — dernière ambiance ${timeAgo(display.asOf)}`}
              </Tooltip>
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h3 style={{ margin: '0 0 10px 0' }}>{location.displayName}</h3>
                  <p style={{ margin: '0 0 10px 0', color: '#666' }}>{location.type}</p>
                  {display.ambiance ? (
                    <div>
                      <strong>{display.stale ? 'Dernière ambiance connue :' : 'Ambiance actuelle :'}</strong>{' '}
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          color: 'white',
                          backgroundColor: getMarkerColor(display.ambiance),
                          opacity: display.stale ? 0.7 : 1,
                        }}
                      >
                        {display.ambiance.classification || display.ambiance.ambianceLabel}
                      </span>
                      {display.stale && (
                        <p style={{ margin: '6px 0 0', color: '#888', fontSize: '12px' }}>
                          Mesurée {timeAgo(display.asOf)} — aucune mesure depuis.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: '#888' }}>Aucune donnée disponible pour ce lieu.</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      <div className="map-legend">
        <h4>Légende</h4>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#27ae60' }}></span>
          <span>Calme</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#f39c12' }}></span>
          <span>Modéré</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#e74c3c' }}></span>
          <span>Animé</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#8e44ad' }}></span>
          <span>Bruyant</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#7f8c8d' }}></span>
          <span>Données non disponibles</span>
        </div>
        <p className="legend-note">
          L'ambiance affichée reflète les mesures des <strong>30 dernières minutes</strong>.
          Sans mesure récente, le lieu affiche sa <strong>dernière ambiance connue</strong> en
          couleur estompée (contour pointillé), avec son ancienneté — pendant
          <strong> 2 heures au maximum</strong>. Au-delà de 2 heures sans mesure, l'information
          est jugée trop ancienne et le lieu passe en gris « Données non disponibles ».
          L'historique complet reste consultable dans la vue détaillée.
        </p>
      </div>
    </div>
  );
};

export default MapView;
