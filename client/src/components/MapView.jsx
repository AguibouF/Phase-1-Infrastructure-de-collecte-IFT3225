import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const MapView = ({ locations, onLocationClick }) => {
  // Position par défaut : centre de Montréal
  const centerPosition = [45.5017, -73.5673];

  return (
    <div className="map-container">
      <MapContainer center={centerPosition} zoom={13} style={{ height: '500px', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {locations.map((location) => (
          location.latitude && location.longitude && (
            <Marker
              key={location.slug}
              position={[location.latitude, location.longitude]}
              eventHandlers={{
                click: () => onLocationClick(location),
              }}
            >
              <Popup>
                <div>
                  <h3>{location.displayName}</h3>
                  <p>{location.type}</p>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;
