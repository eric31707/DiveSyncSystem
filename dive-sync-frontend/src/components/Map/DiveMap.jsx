import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leafet default icon issue
delete L.Icon.Default.prototype._getIconUrl;

const createIcon = (color) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const entryIcon = createIcon('green');
const exitIcon = createIcon('red');
const defaultIcon = createIcon('blue');

export default function DiveMap({ entryLat, entryLng, exitLat, exitLng, site, telemetryData }) {
  const routePositions = [];
  if (telemetryData?.points) {
    telemetryData.points.forEach(p => {
      if (p.lat && p.lng) {
        routePositions.push([p.lat, p.lng]);
      }
    });
  }

  // Build the list of available explicit summary checkpoints
  const finalSummaryPositions = [];
  if (entryLat && entryLng) {
    finalSummaryPositions.push([entryLat, entryLng]);
  }
  if (exitLat && exitLng) {
    finalSummaryPositions.push([exitLat, exitLng]);
  }
  
  const finalPositions = routePositions.length > 0 
    ? routePositions 
    : finalSummaryPositions;

  if (finalPositions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        無 GPS 座標資料
      </div>
    );
  }

  // Choose center
  // Choose center
  const centerLat = finalPositions[0][0];
  const centerLng = finalPositions[0][1];

  // Identiy explicit start and end positions for the markers (0m equivalents)
  const mapEntryPos = (entryLat && entryLng) ? [entryLat, entryLng] : finalPositions[0];
  const mapExitPos = (exitLat && exitLng) ? [exitLat, exitLng] : finalPositions[finalPositions.length - 1];

  return (
    <MapContainer 
      center={[centerLat, centerLng]} 
      zoom={15} 
      style={{ height: '100%', width: '100%', border: 'none', borderRadius: '0.75rem' }}
    >
      <TileLayer
        url="https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
        attribution="&copy; Google"
      />
      
      <Marker position={mapEntryPos} icon={entryIcon}>
        <Popup>🟢 <b>入水點</b><br/>{site}</Popup>
      </Marker>

      <Marker position={mapExitPos} icon={exitIcon}>
        <Popup>🔴 <b>出水點</b><br/>{site}</Popup>
      </Marker>

      {finalPositions.length > 1 && (
        <Polyline 
          positions={finalPositions} 
          color="#06b6d4" 
          weight={4}
          opacity={0.9}
        />
      )}
    </MapContainer>
  );
}
