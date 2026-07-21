import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ambianceApi } from '../api/ambianceApi';

// Tous les marqueurs utilisent une icône personnalisée (L.divIcon, voir
// createCustomIcon) : inutile de charger les icônes Leaflet par défaut,
// ce qui évite au passage toute requête vers un CDN externe.

const MapView = ({ locations, onLocationClick }) => {
  const [locationsWithAmbiance, setLocationsWithAmbiance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAmbianceForLocations = async () => {
      try {
        const locationsWithData = await Promise.all(
          locations.map(async (location) => {
            try {
              const response = await ambianceApi.getCurrentAmbiance(location.slug);
              return {
                ...location,
                ambiance: response.data,
              };
            } catch (error) {
              console.error(`Erreur ambiance pour ${location.slug}:`, error);
              return {
                ...location,
                ambiance: null,
              };
            }
          })
        );
        setLocationsWithAmbiance(locationsWithData);
      } catch (error) {
        console.error('Erreur récupération ambiance:', error);
        setLocationsWithAmbiance(locations);
      } finally {
        setLoading(false);
      }
    };

    if (locations.length > 0) {
      fetchAmbianceForLocations();
    }
  }, [locations]);

  // Temps réel (SSE, bonus) : à chaque nouvelle mesure/observation, seul le
  // marqueur du lieu concerné est rafraîchi, sans recharger la page.
  useEffect(() => {
    const source = ambianceApi.subscribeToAmbianceEvents(async ({ locationSlug }) => {
      try {
        const response = await ambianceApi.getCurrentAmbiance(locationSlug);
        setLocationsWithAmbiance((prev) =>
          prev.map((loc) => (loc.slug === locationSlug ? { ...loc, ambiance: response.data } : loc))
        );
      } catch {
        // Échec du rafraîchissement : le marqueur garde son dernier état connu
      }
    });
    return () => source.close();
  }, []);

  // Fonction pour déterminer la couleur du marqueur selon la classification
  const getMarkerColor = (ambiance) => {
    if (!ambiance) return '#7f8c8d'; // Gris par défaut
    const classification = (ambiance.classification || ambiance.ambianceLabel || '').toLowerCase();
    switch (classification) {
      case 'calme':
        return '#27ae60'; // Vert
      case 'modéré':
        return '#f39c12'; // Orange
      case 'animé':
        return '#e74c3c'; // Rouge
      case 'bruyant':
        return '#8e44ad'; // Violet
      case 'inconnu':
        return '#7f8c8d'; // Gris
      default:
        return '#7f8c8d'; // Gris
    }
  };

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

  // Créer une icône personnalisée avec la couleur (estompée si l'info est périmée)
  const createCustomIcon = (color, stale = false) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px ${stale ? 'dashed' : 'solid'} white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); opacity: ${stale ? 0.55 : 1};"></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    });
  };

  // Position par défaut : centre de Montréal
  const centerPosition = [45.5017, -73.5673];

  if (loading) return <div className="loading">Chargement de la carte...</div>;

  return (
    <div className="map-container">
      <MapContainer center={centerPosition} zoom={13} style={{ height: '500px', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {locationsWithAmbiance.map((location) => {
          const display = getDisplayAmbiance(location.ambiance);
          return location.latitude && location.longitude && (
            <Marker
              key={location.slug}
              position={[location.latitude, location.longitude]}
              icon={createCustomIcon(getMarkerColor(display.ambiance), display.stale)}
              eventHandlers={{
                click: () => onLocationClick(location),
              }}
            >
              <Tooltip direction="top" offset={[0, -15]}>
                {location.displayName}
                {display.stale && ` — dernière ambiance ${timeAgo(display.asOf)}`}
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
