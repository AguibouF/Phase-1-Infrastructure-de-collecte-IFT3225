import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ambianceApi } from '../api/ambianceApi';

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

  // Créer une icône personnalisée avec la couleur
  const createCustomIcon = (color) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
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
        {locationsWithAmbiance.map((location) => (
          location.latitude && location.longitude && (
            <Marker
              key={location.slug}
              position={[location.latitude, location.longitude]}
              icon={createCustomIcon(getMarkerColor(location.ambiance))}
              eventHandlers={{
                click: () => onLocationClick(location),
              }}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h3 style={{ margin: '0 0 10px 0' }}>{location.displayName}</h3>
                  <p style={{ margin: '0 0 10px 0', color: '#666' }}>{location.type}</p>
                  {location.ambiance && (
                    <div>
                      <strong>Ambiance actuelle:</strong>{' '}
                      <span 
                        style={{ 
                          padding: '2px 8px', 
                          borderRadius: '10px', 
                          color: 'white',
                          backgroundColor: getMarkerColor(location.ambiance)
                        }}
                      >
                        {location.ambiance.classification || location.ambiance.ambianceLabel || 'Non définie'}
                      </span>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        ))}
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
      </div>
    </div>
  );
};

export default MapView;
