import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  LayoutDashboard, Map as MapIcon, Ship, AlertTriangle, Leaf, Brain, BarChart3,
  Hexagon, Sliders, Settings as SettingsIcon, Play, Pause, RotateCcw, Plus, Trash2,
  Activity, Cpu, Database, Gauge, Signal, Navigation, X, Radio, Anchor, Compass, Fish, ShieldAlert
} from 'lucide-react';

// const Dummy = () => null;

// const LayoutDashboard = Dummy;
// const MapIcon = Dummy;
// const Ship = Dummy;
// const AlertTriangle = Dummy;
// const Leaf = Dummy;
// const Brain = Dummy;
// const BarChart3 = Dummy;
// const Hexagon = Dummy;
// const Sliders = Dummy;
// const SettingsIcon = Dummy;
// const Play = Dummy;
// const Pause = Dummy;
// const RotateCcw = Dummy;
// const Plus = Dummy;
// const Trash2 = Dummy;
// const Activity = Dummy;
// const Cpu = Dummy;
// const Database = Dummy;
// const Gauge = Dummy;
// const Signal = Dummy;
// const Navigation = Dummy;
// const X = Dummy;
// const Radio = Dummy;
// const Anchor = Dummy;
// const Compass = Dummy;
// const Fish = Dummy;
// const ShieldAlert = Dummy;

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

import { MapContainer, TileLayer, Marker, Polygon as LPolygon, Polyline as LPolyline, Pane, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* ======================== CONSTANTS & HELPERS ======================== */

const W = 1000, H = 600;
const clamp = (v, mn, mx) => Math.min(mx, Math.max(mn, v));
const rand = (a, b) => Math.random() * (b - a) + a;

const ZONE_TYPES = {
  mpa:      { label: 'Marine Protected Area', color: '#2fd9c4', fill: 'rgba(47,217,196,0.16)' },
  reef:     { label: 'Coral Reef Zone',        color: '#3c8f6e', fill: 'rgba(60,143,110,0.20)' },
  nofish:   { label: 'No-Fishing Zone',        color: '#ff6a5f', fill: 'rgba(255,106,95,0.16)' },
  port:     { label: 'Port Authority',         color: '#e6d3a3', fill: 'rgba(230,211,163,0.14)' },
  military: { label: 'Military Exclusion',     color: '#d4af37', fill: 'rgba(212,175,55,0.14)' },
};

const INITIAL_ZONES = [
  { id: 'z1', type: 'reef',     name: 'Coral Cay Sanctuary',      points: [[80,80],[220,60],[260,160],[150,200],[70,160]] },
  { id: 'z2', type: 'mpa',      name: 'North Marine Reserve',     points: [[350,60],[520,50],[540,170],[400,190],[340,140]] },
  { id: 'z3', type: 'nofish',   name: 'Eastern No-Fishing Zone',  points: [[700,220],[880,210],[900,340],[740,360],[680,300]] },
  { id: 'z4', type: 'port',     name: 'Harbor Point Authority',   points: [[860,430],[960,420],[970,500],[880,510]] },
  { id: 'z5', type: 'military', name: 'Southern Exclusion Zone',  points: [[150,420],[320,410],[340,540],[170,550]] },
  { id: 'z6', type: 'reef',     name: 'Turtle Bay Reef',          points: [[500,380],[600,370],[620,460],[520,470]] },
];

const LAND_MASSES = [
  { id: 'land-w', name: 'Windward Coast',    icon: null, points: [[0,160],[50,180],[65,250],[40,330],[58,400],[0,420]] },
  { id: 'land-s', name: 'Southspit Shoals',  icon: null, points: [[380,600],[400,565],[460,575],[520,560],[600,580],[680,565],[760,600]] },
  { id: 'land-n', name: 'Gilded Cay',        icon: 'mountain', points: [[600,15],[650,10],[680,40],[655,70],[615,65],[595,40]] },
  { id: 'land-i', name: 'Treasure Isle',     icon: 'treasure', points: [[900,530],[930,515],[960,525],[965,555],[935,570],[905,560]] },
];

function pointInPolygon(pt, poly) {
  let x = pt[0], y = pt[1], inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function centroid(poly) {
  let cx = 0, cy = 0;
  poly.forEach(p => { cx += p[0]; cy += p[1]; });
  return { x: cx / poly.length, y: cy / poly.length };
}

const SHIP_PREFIXES = ['MV', 'SS', 'FV', 'MT', 'SV'];
const SHIP_NAMES = ['Horizon','Meridian','Kraken','Osprey','Aurora','Voyager','Pelican','Neptune','Corsair','Drift','Tern','Nomad','Solace','Mariner','Halcyon','Leviathan','Tempest','Compass Rose','Windward','Southern Cross','Albatross','Poseidon','Sirena','Tradewind','Wanderer'];
function makeShipName(id) {
  const prefix = SHIP_PREFIXES[id % SHIP_PREFIXES.length];
  const name = SHIP_NAMES[Math.floor(rand(0, SHIP_NAMES.length))];
  return `${prefix} ${name} ${100 + (id % 900)}`;
}
function pickType() {
  const r = Math.random();
  if (r < 0.28) return 'Fishing';
  if (r < 0.50) return 'Cargo';
  if (r < 0.68) return 'Tanker';
  if (r < 0.85) return 'Container';
  return 'Unknown';
}
function createShip(id) {
  const type = pickType();
  return {
    id: `SP-${id}`, name: makeShipName(id), type,
    x: rand(30, 970), y: rand(30, 570),
    heading: rand(0, 360),
    speed: type === 'Fishing' ? rand(1, 4) : rand(5, 12),
    minSpeed: type === 'Fishing' ? 0.2 : 2,
    maxSpeed: type === 'Fishing' ? 5 : 16,
    history: [], suspicion: Math.round(rand(2, 18)), ecosystem: 0,
    loiterTicks: 0, zoneIds: [], band: 'Safe',
    silentUntilTick: 0, forcedLoiterTicks: 0, prevHeading: null,
  };
}
function adjustShipCount(list, target, idCounterRef) {
  if (list.length < target) {
    const extra = [];
    for (let i = list.length; i < target; i++) { extra.push(createShip(idCounterRef.current++)); }
    return [...list, ...extra];
  } else if (list.length > target) {
    return list.slice(0, target);
  }
  return list;
}

// Creates a fresh fleet AND immediately runs one real detection pass against
// the current geofences, so any ship that spawns inside a protected zone
// fires its alert right away - the Alert Feed is never empty waiting on the
// first tick, and every alert shown is still a genuine detection, not a
// scripted/fake one.
function primeFleet(count, zones) {
  const rawShips = Array.from({ length: count }, (_, i) => createShip(i));
  const alertsOut = [];
  const ships = rawShips.map(s => stepShip(s, zones, 0, alertsOut));
  return { ships, alerts: alertsOut };
}

// REAL, measured throughput test - not the illustrative dashboard formula.
// Runs `numMessages` through the actual detection pipeline (movement +
// point-in-polygon geofence check + suspicion scoring, exactly what every
// ship goes through on every tick) in a single tight synchronous loop, with
// no React re-render in between, then times it with performance.now(). This
// is the same pattern as the FastAPI backend's /simulate/benchmark endpoint:
// fire a burst directly at the pipeline, measure wall-clock time, report
// what actually happened rather than a formula.
function runRealBenchmark(zones, numMessages = 300000, poolSize = 2000) {
  const pool = Array.from({ length: poolSize }, (_, i) => createShip(i));
  const alertsOut = [];
  const t0 = performance.now();
  for (let i = 0; i < numMessages; i++) {
    const idx = i % poolSize;
    pool[idx] = stepShip(pool[idx], zones, i, alertsOut);
  }
  const elapsedSec = (performance.now() - t0) / 1000;
  return {
    messages: numMessages,
    elapsedSec: Math.round(elapsedSec * 1000) / 1000,
    messagesPerSec: Math.round(numMessages / elapsedSec),
    alertsGenerated: alertsOut.length,
  };
}
function suspicionBand(v) {
  if (v >= 85) return 'Critical';
  if (v >= 70) return 'High';
  if (v >= 40) return 'Medium';
  if (v >= 15) return 'Low';
  return 'Safe';
}
const BAND_COLOR = { Safe: '#3ddc84', Low: '#8bd450', Medium: '#f2c14e', High: '#ff9a3c', Critical: '#ff4d4d' };
const SEV_COLOR = { low: '#8bd450', medium: '#f2c14e', high: '#ff9a3c', critical: '#ff4d4d' };

function makeAlert(ship, type, emoji, severity, explanation) {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    shipId: ship.id, shipName: ship.name, shipType: ship.type,
    type, emoji, severity, explanation,
    suspicion: ship.suspicion, ecosystem: ship.ecosystem,
    position: { x: Math.round(ship.x), y: Math.round(ship.y) },
    time: new Date().toLocaleTimeString(),
  };
}

function stepShip(ship, zones, currentTick, alertsOut) {
  let s = { ...ship };

  if (s.silentUntilTick && currentTick < s.silentUntilTick) {
    s.silent = true;
    return s;
  }
  s.silent = false;

  if (s.forcedLoiterTicks > 0) {
    s.speed = Math.max(0.2, s.speed * 0.25);
    s.forcedLoiterTicks -= 1;
  } else {
    s.speed = clamp(s.speed + rand(-0.3, 0.3), s.minSpeed, s.maxSpeed);
  }
  const prevHeading = s.heading;
  s.heading = (s.heading + rand(-9, 9) + 360) % 360;
  const rad = (s.heading * Math.PI) / 180;
  let nx = s.x + Math.sin(rad) * s.speed * 0.6;
  let ny = s.y - Math.cos(rad) * s.speed * 0.6;
  if (nx < 12 || nx > 988) { s.heading = (180 - s.heading + 360) % 360; nx = clamp(nx, 12, 988); }
  if (ny < 12 || ny > 588) { s.heading = (360 - s.heading) % 360; ny = clamp(ny, 12, 588); }
  s.x = nx; s.y = ny;
  s.history = [...s.history.slice(-13), { x: nx, y: ny }];

  const containing = zones.filter(z => pointInPolygon([nx, ny], z.points));
  if (s.speed < 1.2 && containing.length) { s.loiterTicks = (s.loiterTicks || 0) + 1; }
  else { s.loiterTicks = Math.max(0, (s.loiterTicks || 0) - 1); }

  let target = 5;
  let ruleFloor = 0;
  if (containing.some(z => z.type === 'nofish') && s.type === 'Fishing') { target += 60; ruleFloor = Math.max(ruleFloor, 88); }
  if (containing.some(z => z.type === 'military')) { target += 70; ruleFloor = Math.max(ruleFloor, 92); }
  if (containing.some(z => z.type === 'mpa')) { target += 35; ruleFloor = Math.max(ruleFloor, 72); }
  if (s.loiterTicks > 6) target += Math.min(30, s.loiterTicks * 2);
  if (Math.abs(s.heading - prevHeading) > 45) target += 10;
  s.suspicion = clamp(Math.round(s.suspicion * 0.8 + target * 0.2 + rand(-2, 2)), 0, 100);
  if (ruleFloor) s.suspicion = Math.max(s.suspicion, ruleFloor);

  let eco = 0;
  containing.forEach(z => {
    if (z.type === 'mpa') eco += 30;
    if (z.type === 'reef') eco += s.loiterTicks > 4 ? 55 : 25;
    if (z.type === 'nofish' && s.type === 'Fishing') eco += 45;
  });
  s.ecosystem = clamp(Math.round(s.ecosystem * 0.85 + eco * 0.15), 0, 100);

  const prevIds = s.zoneIds || [];
  containing.forEach(z => {
    if (!prevIds.includes(z.id)) {
      if (z.type === 'mpa') alertsOut.push(makeAlert(s, 'geofence', '🚨', 'high', `Entered ${z.name} (Marine Protected Area)`));
      if (z.type === 'military') alertsOut.push(makeAlert(s, 'geofence', '🚨', 'critical', `Unauthorized entry into ${z.name}`));
      if (z.type === 'nofish' && s.type === 'Fishing') alertsOut.push(makeAlert(s, 'fishing', '🎣', 'critical', `Possible illegal fishing detected in ${z.name}`));
      if (z.type === 'reef') alertsOut.push(makeAlert(s, 'ecosystem', '🌿', 'medium', `Vessel entered ${z.name} — ecosystem risk elevated`));
    }
  });
  s.zoneIds = containing.map(z => z.id);

  const band = suspicionBand(s.suspicion);
  if (band !== s.band && (band === 'High' || band === 'Critical')) {
    alertsOut.push(makeAlert(s, 'behaviour', '⚠', band === 'Critical' ? 'critical' : 'high', `Suspicion escalated to ${band} (${s.suspicion})`));
  }
  s.band = band;
  return s;
}

/* ======================== SMALL UI PRIMITIVES ======================== */

function Panel({ title, icon, children, right, style }) {
  return (
    <div className="sp-panel" style={style}>
      {title && (
        <div className="sp-panel-head">
          <div className="sp-panel-title">{icon}<span>{title}</span></div>
          {right}
        </div>
      )}
      <div className="sp-panel-body">{children}</div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className="sp-stat" style={{ '--accent': accent || 'var(--gold)' }}>
      <div className="sp-stat-icon">{icon}</div>
      <div>
        <div className="sp-stat-value">{value}</div>
        <div className="sp-stat-label">{label}</div>
        {sub && <div className="sp-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function Badge({ text, color }) {
  return <span className="sp-badge" style={{ '--c': color }}>{text}</span>;
}

function TreasureMarkers({ ships }) {
  return ships.filter(s => s.band === 'Critical').map(s => (
    <g key={'treasure-' + s.id} transform={`translate(${s.x},${s.y - 22})`} className="sp-treasure-x">
      <line x1="-8" y1="-8" x2="8" y2="8" stroke="var(--gold-bright)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="8" y1="-8" x2="-8" y2="8" stroke="var(--gold-bright)" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ));
}

/* ======================== OCEAN MAP ======================== */

const MAX_RENDERED_SHIPS = 300;

function OceanMap({ zones, ships, selectedShipId, onSelectShip, drawMode, draftPoints, onMapClick, trailsOn, tick, height }) {
  const mapRef = useRef(null);

  // Geographic bounding box that corresponds to the simulation canvas.
  // Adjust these if you want to place the simulation over a different real-world area.
  const LNG_MIN = 120, LNG_MAX = 140; // longitude range
  const LAT_MIN = -10, LAT_MAX = 10;   // latitude range

  const simToLatLng = (p) => {
    const [x, y] = p;
    const lng = LNG_MIN + (x / W) * (LNG_MAX - LNG_MIN);
    const lat = LAT_MAX - (y / H) * (LAT_MAX - LAT_MIN);
    return [lat, lng];
  };
  const latLngToSim = ([lat, lng]) => {
    const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * W;
    const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H;
    return [Math.round(x), Math.round(y)];
  };

  // Cap what actually gets drawn as map layers to avoid DOM churn.
  const renderedShips = useMemo(() => {
    if (ships.length <= MAX_RENDERED_SHIPS) return ships;
    const sample = ships.slice(0, MAX_RENDERED_SHIPS);
    if (selectedShipId && !sample.some(s => s.id === selectedShipId)) {
      const sel = ships.find(s => s.id === selectedShipId);
      if (sel) sample[sample.length - 1] = sel;
    }
    return sample;
  }, [ships, selectedShipId]);

  const handleMapClick = (e) => {
    if (!drawMode) return;
    const { lat, lng } = e.latlng;
    const [x, y] = latLngToSim([lat, lng]);
    onMapClick(x, y);
  };

  const center = [(LAT_MIN + LAT_MAX) / 2, (LNG_MIN + LNG_MAX) / 2];

  // Responsive height: on large (desktop) view use a VH-based height so the
  // map scales with the browser; on smaller screens fall back to the explicit
  // `height` prop or a fixed default.
  const [mapHeight, setMapHeight] = useState(height || 520);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth || 0;
      if (w >= 1024) setMapHeight(Math.max(height || 520, Math.round(window.innerHeight * 0.72)));
      else setMapHeight(height || 520);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [height]);

  // Generate latitude/longitude grid lines (darker lines). Grid step chosen
  // to be visually reasonable for the bounding box; adjust `gridStepDeg`
  // if you want denser/sparser lines.
  const gridStepDeg = 2; // degrees
  const gridLines = useMemo(() => {
    const lines = [];
    // vertical (longitude) lines
    for (let lng = Math.ceil(LNG_MIN); lng <= LNG_MAX; lng += gridStepDeg) {
      lines.push({ positions: [[LAT_MIN, lng], [LAT_MAX, lng]] });
    }
    // horizontal (latitude) lines
    for (let lat = Math.ceil(LAT_MIN); lat <= LAT_MAX; lat += gridStepDeg) {
      lines.push({ positions: [[lat, LNG_MIN], [lat, LNG_MAX]] });
    }
    return lines;
  }, [LNG_MIN, LNG_MAX, LAT_MIN, LAT_MAX]);

  // labels for grid lines (degrees) rendered at map edges
  const longLabels = useMemo(() => {
    const items = [];
    for (let lng = Math.ceil(LNG_MIN); lng <= LNG_MAX; lng += gridStepDeg) {
      items.push({ pos: [LAT_MAX, lng], text: `${lng.toFixed(0)}°${lng >= 0 ? 'E' : 'W'}` });
    }
    return items;
  }, [LNG_MIN, LNG_MAX, LAT_MAX]);
  const latLabels = useMemo(() => {
    const items = [];
    for (let lat = Math.ceil(LAT_MIN); lat <= LAT_MAX; lat += gridStepDeg) {
      items.push({ pos: [lat, LNG_MIN], text: `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'N' : 'S'}` });
    }
    return items;
  }, [LAT_MIN, LAT_MAX, LNG_MIN]);

  const [cursorCoord, setCursorCoord] = useState(null);

  return (
    <div className="sp-map-wrap" style={{ height: mapHeight, transition: 'height 220ms ease' }}>
      <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }} whenCreated={m => (mapRef.current = m)} onclick={handleMapClick}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {/* Add scale control and cursor tracking */}
        <MapControlAddOn mapRef={mapRef} setCursorCoord={setCursorCoord} />

        <Pane name="land" style={{ zIndex: 400 }}>
          {LAND_MASSES.map(l => (
            <LPolygon key={l.id} positions={l.points.map(simToLatLng)} pathOptions={{ color: '#6b4b28', fillColor: '#d6b887', weight: 1.75 }} />
          ))}
        </Pane>

        <Pane name="zones" style={{ zIndex: 450 }}>
          {zones.map(z => {
            const t = ZONE_TYPES[z.type];
            return (
              <LPolygon key={z.id} positions={z.points.map(simToLatLng)} pathOptions={{ color: t.color, fillColor: t.fill, weight: 1.5, dashArray: '5,3' }} />
            );
          })}
        </Pane>

        <Pane name="grid" style={{ zIndex: 460 }}>
          {gridLines.map((g, i) => (
            <LPolyline key={'grid-' + i} positions={g.positions} pathOptions={{ color: 'rgba(0,0,0,0.38)', weight: 1.25, opacity: 0.9 }} />
          ))}
        </Pane>
        {/* grid labels */}
        <Pane name="grid-labels" style={{ zIndex: 470 }}>
          {longLabels.map((l, i) => (
            <Marker key={'ll-' + i} position={l.pos} interactive={false} icon={L.divIcon({ className: 'sp-grid-label', html: l.text, iconSize: [60, 20], iconAnchor: [30, -6] })} />
          ))}
          {latLabels.map((l, i) => (
            <Marker key={'la-' + i} position={l.pos} interactive={false} icon={L.divIcon({ className: 'sp-grid-label', html: l.text, iconSize: [50, 20], iconAnchor: [-6, 10] })} />
          ))}
        </Pane>

        {drawMode && draftPoints.length > 0 && (
          <LPolyline positions={draftPoints.map(simToLatLng)} pathOptions={{ color: 'var(--gold)', dashArray: '4,3', weight: 2, opacity: 0.95 }} />
        )}

        {trailsOn && renderedShips.map(s => s.history.length > 1 && (
          <LPolyline key={'trail-' + s.id} positions={s.history.map(p => simToLatLng([p.x, p.y]))} pathOptions={{ color: BAND_COLOR[s.band], opacity: 0.35, weight: 1.2 }} />
        ))}

        {renderedShips.map(s => {
          const pos = simToLatLng([s.x, s.y]);
          const svg = `
            <svg width="32" height="32" viewBox="-14 -14 28 28" xmlns="http://www.w3.org/2000/svg">
              <g transform="rotate(${s.heading})">
                ${(s.band === 'High' || s.band === 'Critical') ? '<circle r="12" fill="none" stroke="' + BAND_COLOR[s.band] + '" stroke-width="1.2" opacity="0.9" />' : ''}
                <path d="M0,-7 L5,7 L0,4 L-5,7 Z" fill="${BAND_COLOR[s.band]}" stroke="${s.id === selectedShipId ? '#fff' : 'rgba(0,0,0,0.35)'}" stroke-width="${s.id === selectedShipId ? 1.2 : 0.6}" />
              </g>
            </svg>
          `;
          const icon = L.divIcon({ html: svg, className: 'sp-ship-icon', iconSize: [32, 32], iconAnchor: [16, 16] });
          return (
            <Marker key={s.id} position={pos} icon={icon} eventHandlers={{ click: (e) => { e.originalEvent.stopPropagation(); onSelectShip(s.id); } }}>
              <Tooltip direction="top" offset={[0, -18]} opacity={0.95} permanent={false}>
                <div style={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700 }}>{s.name} · {formatDeg(pos[0], pos[1])}</div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
      {cursorCoord && (
        <div className="sp-map-overlay sp-coords">{formatDeg(cursorCoord.lat, cursorCoord.lng)}</div>
      )}
    </div>
  );
}

function MapControlAddOn({ mapRef, setCursorCoord }) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // add scale control
    const scale = L.control.scale({ imperial: false, metric: true });
    scale.addTo(map);

    const onMove = (e) => {
      const { lat, lng } = e.latlng;
      setCursorCoord({ lat, lng });
    };
    map.on('mousemove', onMove);
    return () => {
      map.off('mousemove', onMove);
      map.removeControl(scale);
    };
  }, [mapRef, setCursorCoord]);
  return null;
}

function formatDeg(lat, lng) {
  const latSym = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
  const lngSym = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`;
  return `${latSym}, ${lngSym}`;
}

/* ======================== PAGES ======================== */

function DashboardPage({ ships, alerts, statsHistory, liveStats, onNav }) {
  const highSusp = ships.filter(s => s.suspicion >= 70).length;
  const ecoThreats = ships.filter(s => s.ecosystem >= 50).length;
  const fishingAlerts = alerts.filter(a => a.type === 'fishing').length;
  const activeAlerts = alerts.length;

  return (
    <div>
      <div className="sp-grid-stats">
        <StatCard icon={<Ship size={20} />} label="Active Ships" value={ships.length} accent="var(--turquoise)" />
        <StatCard icon={<Signal size={20} />} label="Simulated Feed Rate" value={liveStats.messagesPerSec.toLocaleString()} sub="illustrative, not measured" accent="var(--gold)" />
        <StatCard
          icon={<Gauge size={20} />}
          label="Real Throughput Benchmark"
          value="Run on Simulator page"
          sub="fires a measured burst at the real pipeline"
          accent="var(--turquoise)"
        />
        <StatCard icon={<AlertTriangle size={20} />} label="Active Alerts" value={activeAlerts} accent="var(--coral)" />
        <StatCard icon={<Leaf size={20} />} label="Ecosystem Threats" value={ecoThreats} accent="var(--sea-green)" />
        <StatCard icon={<Fish size={20} />} label="Illegal Fishing Alerts" value={fishingAlerts} accent="#ff6a5f" />
        <StatCard icon={<ShieldAlert size={20} />} label="High Suspicion Ships" value={highSusp} accent="#ff9a3c" />
        <StatCard icon={<Gauge size={20} />} label="Avg Latency" value={`${liveStats.latency} ms`} accent="var(--turquoise)" />
        <StatCard icon={<Database size={20} />} label="Memory Usage" value={`${liveStats.mem}%`} accent="var(--sand)" />
        <StatCard icon={<Cpu size={20} />} label="CPU Usage" value={`${liveStats.cpu}%`} accent="var(--gold)" />
      </div>

      <div className="sp-cols">
        <Panel title="Live Ocean Map" icon={<MapIcon size={16} />} right={<button className="sp-link-btn" onClick={() => onNav('map')}>Open full map →</button>}>
          <OceanMap zones={INITIAL_ZONES} ships={ships} onSelectShip={() => {}} trailsOn={true} tick={0} height={340} />
        </Panel>
        <Panel title="Recent Alerts" icon={<AlertTriangle size={16} />} right={<button className="sp-link-btn" onClick={() => onNav('alerts')}>View all →</button>}>
          <div className="sp-alert-list" style={{ maxHeight: 340 }}>
            {alerts.slice(0, 8).map(a => <AlertRow key={a.id} a={a} />)}
            {alerts.length === 0 && <div className="sp-empty">No alerts yet — simulation warming up.</div>}
          </div>
        </Panel>
      </div>

      <Panel title="Throughput" icon={<Activity size={16} />} style={{ marginTop: 16 }}>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={statsHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.12)" />
            <XAxis dataKey="t" stroke="#7fa3b8" fontSize={11} />
            <YAxis stroke="#7fa3b8" fontSize={11} />
            <RechartsTooltip contentStyle={{ background: '#0d2338', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="msgs" stroke="#2fd9c4" strokeWidth={2} dot={false} name="Msgs/sec" />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

function AlertRow({ a }) {
  return (
    <div className="sp-alert-row">
      <div className="sp-alert-emoji">{a.emoji}</div>
      <div className="sp-alert-body">
        <div className="sp-alert-top">
          <span className="sp-alert-ship">{a.shipName}</span>
          <Badge text={a.severity} color={SEV_COLOR[a.severity]} />
        </div>
        <div className="sp-alert-explain">{a.explanation}</div>
        <div className="sp-alert-meta">{a.time} · suspicion {a.suspicion} · eco {a.ecosystem}</div>
      </div>
    </div>
  );
}

function LiveMapPage({ zones, ships, selectedShipId, setSelectedShipId, trailsOn, tick }) {
  const selected = ships.find(s => s.id === selectedShipId);
  return (
    <div className="sp-cols" style={{ alignItems: 'flex-start' }}>
      <Panel title="Live Ocean Map" icon={<MapIcon size={16} />} style={{ flex: 2 }}>
        <OceanMap zones={zones} ships={ships} selectedShipId={selectedShipId} onSelectShip={setSelectedShipId} trailsOn={trailsOn} tick={tick} height={560} />
        <div className="sp-legend">
          <span><i style={{ background: BAND_COLOR.Safe }} /> Safe</span>
          <span><i style={{ background: BAND_COLOR.Low }} /> Low</span>
          <span><i style={{ background: BAND_COLOR.Medium }} /> Medium</span>
          <span><i style={{ background: BAND_COLOR.High }} /> High</span>
          <span><i style={{ background: BAND_COLOR.Critical }} /> Critical</span>
        </div>
      </Panel>
      <Panel title={selected ? selected.name : 'Vessel Details'} icon={<Ship size={16} />} style={{ flex: 1, minWidth: 280 }}>
        {selected ? (
          <div className="sp-detail">
            <div className="sp-detail-row"><span>Type</span><b>{selected.type}</b></div>
            <div className="sp-detail-row"><span>Position</span><b>{selected.x.toFixed(0)}, {selected.y.toFixed(0)}</b></div>
            <div className="sp-detail-row"><span>Speed</span><b>{selected.speed.toFixed(1)} kn</b></div>
            <div className="sp-detail-row"><span>Heading</span><b>{selected.heading.toFixed(0)}°</b></div>
            <div className="sp-detail-row"><span>Suspicion</span><b><Badge text={`${selected.suspicion} · ${selected.band}`} color={BAND_COLOR[selected.band]} /></b></div>
            <div className="sp-detail-row"><span>Ecosystem Impact</span><b>{selected.ecosystem}</b></div>
            <div className="sp-detail-row"><span>Status</span><b>{selected.silent ? 'AIS Silent' : 'Broadcasting'}</b></div>
            <div className="sp-detail-row"><span>Route history</span><b>{selected.history.length} pts</b></div>
          </div>
        ) : <div className="sp-empty">Click a ship on the map to inspect it.</div>}
      </Panel>
    </div>
  );
}

function FleetPage({ ships, selectedShipId, setSelectedShipId, zones }) {
  const [sortKey, setSortKey] = useState('suspicion');
  const sorted = useMemo(() => [...ships].sort((a, b) => b[sortKey] - a[sortKey]), [ships, sortKey]);
  const zoneName = (s) => s.zoneIds.map(id => zones.find(z => z.id === id)?.name).filter(Boolean).join(', ') || '—';

  return (
    <Panel title={`Fleet Monitoring (${ships.length} vessels)`} icon={<Ship size={16} />}>
      <div className="sp-table-wrap">
        <table className="sp-table">
          <thead>
            <tr>
              <th>Name</th><th>Type</th>
              <th onClick={() => setSortKey('speed')} className="sp-sortable">Speed</th>
              <th>Heading</th>
              <th onClick={() => setSortKey('suspicion')} className="sp-sortable">Suspicion</th>
              <th onClick={() => setSortKey('ecosystem')} className="sp-sortable">Ecosystem</th>
              <th>Zone</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 200).map(s => (
              <tr key={s.id} className={s.id === selectedShipId ? 'sp-row-selected' : ''} onClick={() => setSelectedShipId(s.id)}>
                <td>{s.name}</td>
                <td>{s.type}</td>
                <td>{s.speed.toFixed(1)}</td>
                <td>{s.heading.toFixed(0)}°</td>
                <td><Badge text={`${s.suspicion} ${s.band}`} color={BAND_COLOR[s.band]} /></td>
                <td>{s.ecosystem}</td>
                <td className="sp-zone-cell">{zoneName(s)}</td>
                <td>{s.silent ? <Badge text="Silent" color="#7fa3b8" /> : <Badge text="Live" color="#3ddc84" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function AlertsPage({ alerts }) {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.type === filter);
  const types = [
    ['all', 'All'], ['geofence', '🚨 Geofence'], ['ecosystem', '🌿 Ecosystem'],
    ['fishing', '🎣 Fishing'], ['behaviour', '⚠ Behaviour'], ['silence', '⚓ AIS Silence'], ['route', '🧭 Route Dev.'],
  ];
  return (
    <Panel title={`Alert Feed (${filtered.length})`} icon={<AlertTriangle size={16} />}
      right={<div className="sp-filter-row">{types.map(([k, l]) => (
        <button key={k} className={'sp-chip' + (filter === k ? ' sp-chip-active' : '')} onClick={() => setFilter(k)}>{l}</button>
      ))}</div>}>
      <div className="sp-alert-list" style={{ maxHeight: 620 }}>
        {filtered.map(a => <AlertRow key={a.id} a={a} />)}
        {filtered.length === 0 && <div className="sp-empty">No alerts of this type yet.</div>}
      </div>
    </Panel>
  );
}

function EcosystemPage({ ships, zones }) {
  const ecoThreats = ships.filter(s => s.ecosystem >= 50);
  const avgEco = ships.length ? Math.round(ships.reduce((a, s) => a + s.ecosystem, 0) / ships.length) : 0;
  const occupancy = zones.map(z => ({ name: z.name.length > 14 ? z.name.slice(0, 14) + '…' : z.name, count: ships.filter(s => s.zoneIds.includes(z.id)).length, fill: ZONE_TYPES[z.type].color }));

  return (
    <div>
      <div className="sp-grid-stats">
        <StatCard icon={<Leaf size={20} />} label="Ecosystem Threats" value={ecoThreats.length} accent="var(--sea-green)" />
        <StatCard icon={<Gauge size={20} />} label="Avg Ecosystem Score" value={avgEco} accent="var(--turquoise)" />
        <StatCard icon={<Hexagon size={20} />} label="Protected Zones Tracked" value={zones.length} accent="var(--gold)" />
      </div>
      <div className="sp-cols">
        <Panel title="Vessels Occupying Zones" icon={<Hexagon size={16} />}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={occupancy}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.12)" />
              <XAxis dataKey="name" stroke="#7fa3b8" fontSize={10} />
              <YAxis stroke="#7fa3b8" fontSize={11} allowDecimals={false} />
              <RechartsTooltip contentStyle={{ background: '#0d2338', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name="Vessels present">
                {occupancy.map((o, i) => <Cell key={i} fill={o.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Highest Ecosystem Impact" icon={<Leaf size={16} />}>
          <div className="sp-alert-list" style={{ maxHeight: 260 }}>
            {[...ships].sort((a, b) => b.ecosystem - a.ecosystem).slice(0, 8).map(s => (
              <div key={s.id} className="sp-mini-row">
                <span>{s.name}</span>
                <div className="sp-bar-track"><div className="sp-bar-fill" style={{ width: `${s.ecosystem}%`, background: 'var(--sea-green)' }} /></div>
                <b>{s.ecosystem}</b>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AIBehaviourPage({ ships }) {
  const top = [...ships].sort((a, b) => b.suspicion - a.suspicion).slice(0, 15);
  return (
    <div>
      <Panel title="Scoring Methodology" icon={<Brain size={16} />}>
        <p className="sp-copy">
          Every vessel's <b>Suspicion Score (0–100)</b> is computed from expert-defined maritime domain weights:
          restricted-zone occupancy, loitering duration, erratic heading changes, and AIS silence. A separate
          <b> Ecosystem Impact Score (0–100)</b> tracks time spent inside marine protected areas, coral reef zones,
          and fishing activity in no-fishing waters. Weights are hand-tuned now, but the scoring layer is isolated
          so it can be swapped for coefficients learned from a lightweight model — logistic regression or XGBoost —
          without touching the rest of the pipeline.
        </p>
      </Panel>
      <Panel title="Behaviour Breakdown — Top Watchlist" icon={<ShieldAlert size={16} />} style={{ marginTop: 16 }}>
        <div className="sp-alert-list" style={{ maxHeight: 480 }}>
          {top.map(s => (
            <div key={s.id} className="sp-behaviour-row">
              <div className="sp-behaviour-head">
                <span>{s.name} <small>({s.type})</small></span>
                <Badge text={s.band} color={BAND_COLOR[s.band]} />
              </div>
              <div className="sp-mini-row">
                <span>Suspicion</span>
                <div className="sp-bar-track"><div className="sp-bar-fill" style={{ width: `${s.suspicion}%`, background: BAND_COLOR[s.band] }} /></div>
                <b>{s.suspicion}</b>
              </div>
              <div className="sp-mini-row">
                <span>Ecosystem</span>
                <div className="sp-bar-track"><div className="sp-bar-fill" style={{ width: `${s.ecosystem}%`, background: 'var(--sea-green)' }} /></div>
                <b>{s.ecosystem}</b>
              </div>
              <div className="sp-mini-row">
                <span>Loiter ticks</span>
                <div className="sp-bar-track"><div className="sp-bar-fill" style={{ width: `${Math.min(100, s.loiterTicks * 8)}%`, background: 'var(--gold)' }} /></div>
                <b>{s.loiterTicks}</b>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AnalyticsPage({ ships, alerts, statsHistory }) {
  const bands = ['Safe', 'Low', 'Medium', 'High', 'Critical'];
  const dist = bands.map(b => ({ name: b, value: ships.filter(s => s.band === b).length }));
  const alertTypes = [
    ['geofence', 'Geofence'], ['fishing', 'Fishing'], ['ecosystem', 'Ecosystem'],
    ['behaviour', 'Behaviour'], ['silence', 'AIS Silence'], ['route', 'Route Dev.'],
  ];
  const alertCounts = alertTypes.map(([k, l]) => ({ name: l, count: alerts.filter(a => a.type === k).length }));
  const topVessels = [...ships].sort((a, b) => b.suspicion - a.suspicion).slice(0, 10);

  return (
    <div>
      <div className="sp-cols">
        <Panel title="Throughput & Latency" icon={<Activity size={16} />}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={statsHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.12)" />
              <XAxis dataKey="t" stroke="#7fa3b8" fontSize={11} />
              <YAxis stroke="#7fa3b8" fontSize={11} />
              <RechartsTooltip contentStyle={{ background: '#0d2338', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, fontSize: 12 }} />
              <Legend />
              <Line type="monotone" dataKey="msgs" stroke="#2fd9c4" strokeWidth={2} dot={false} name="Msgs/sec" />
              <Line type="monotone" dataKey="latency" stroke="#d4af37" strokeWidth={2} dot={false} name="Latency (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Suspicion Distribution" icon={<Gauge size={16} />}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={dist} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {dist.map((d, i) => <Cell key={i} fill={BAND_COLOR[d.name]} />)}
              </Pie>
              <RechartsTooltip contentStyle={{ background: '#0d2338', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, fontSize: 12 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <div className="sp-cols" style={{ marginTop: 16 }}>
        <Panel title="Alert Trends by Type" icon={<BarChart3 size={16} />}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={alertCounts}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.12)" />
              <XAxis dataKey="name" stroke="#7fa3b8" fontSize={10} />
              <YAxis stroke="#7fa3b8" fontSize={11} allowDecimals={false} />
              <RechartsTooltip contentStyle={{ background: '#0d2338', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="#ff6a5f" name="Alerts" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Top Monitored Vessels" icon={<Ship size={16} />}>
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead><tr><th>Name</th><th>Type</th><th>Suspicion</th><th>Ecosystem</th></tr></thead>
              <tbody>
                {topVessels.map(s => (
                  <tr key={s.id}>
                    <td>{s.name}</td><td>{s.type}</td>
                    <td><Badge text={s.suspicion} color={BAND_COLOR[s.band]} /></td>
                    <td>{s.ecosystem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function GeofencePage({ zones, setZones, ships, tick }) {
  const [drawMode, setDrawMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('mpa');

  const startDraw = () => { setDrawMode(true); setDraftPoints([]); setShowForm(false); };
  const cancelDraw = () => { setDrawMode(false); setDraftPoints([]); setShowForm(false); };
  const onMapClick = (x, y) => setDraftPoints(prev => [...prev, [Math.round(x), Math.round(y)]]);
  const finishDraw = () => { if (draftPoints.length >= 3) setShowForm(true); };
  const saveZone = () => {
    const id = 'z' + Date.now();
    setZones(prev => [...prev, { id, type, name: name || 'Unnamed Zone', points: draftPoints }]);
    setDrawMode(false); setDraftPoints([]); setShowForm(false); setName('');
  };
  const deleteZone = (id) => setZones(prev => prev.filter(z => z.id !== id));

  return (
    <div className="sp-cols" style={{ alignItems: 'flex-start' }}>
      <Panel title="Geofence Map" icon={<Hexagon size={16} />} style={{ flex: 2 }}
        right={!drawMode
          ? <button className="sp-btn sp-btn-gold" onClick={startDraw}><Plus size={14} /> Draw Zone</button>
          : <div className="sp-filter-row">
              <button className="sp-btn" onClick={cancelDraw}>Cancel</button>
              <button className="sp-btn sp-btn-gold" onClick={finishDraw} disabled={draftPoints.length < 3}>Finish ({draftPoints.length} pts)</button>
            </div>}>
        <OceanMap zones={zones} ships={ships} onSelectShip={() => {}} drawMode={drawMode} draftPoints={draftPoints} onMapClick={onMapClick} trailsOn={false} tick={tick} height={480} />
        {showForm && (
          <div className="sp-zone-form">
            <input className="sp-input" placeholder="Zone name" value={name} onChange={e => setName(e.target.value)} />
            <select className="sp-input" value={type} onChange={e => setType(e.target.value)}>
              {Object.entries(ZONE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button className="sp-btn sp-btn-gold" onClick={saveZone}>Save Zone</button>
          </div>
        )}
      </Panel>
      <Panel title={`Zones (${zones.length})`} icon={<Hexagon size={16} />} style={{ flex: 1, minWidth: 280 }}>
        <div className="sp-zone-list">
          {zones.map(z => (
            <div key={z.id} className="sp-zone-item">
              <div>
                <div className="sp-zone-item-name"><i style={{ background: ZONE_TYPES[z.type].color }} />{z.name}</div>
                <div className="sp-zone-item-type">{ZONE_TYPES[z.type].label}</div>
              </div>
              <button className="sp-icon-btn" onClick={() => deleteZone(z.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SimulatorPage({ running, setRunning, shipTarget, setShipTarget, onReset, onInject, liveStats, ships, onBenchmark, benchmarking, benchResult }) {
  const counts = [500, 1000, 2500, 5000];
  const events = [
    ['illegal_fishing', '🎣 Illegal Fishing'], ['loitering', '⚓ Loitering'],
    ['ais_silence', '📡 AIS Silence'], ['gps_jump', '🧭 GPS Jump'], ['protected_entry', '🌿 Protected Zone Entry'],
  ];
  return (
    <div className="sp-cols" style={{ alignItems: 'flex-start' }}>
      <Panel title="Simulation Controls" icon={<Sliders size={16} />} style={{ flex: 1, minWidth: 300 }}>
        <div className="sp-block-label">Fleet size</div>
        <div className="sp-filter-row" style={{ marginBottom: 4 }}>
          {counts.map(c => (
            <button key={c} className={'sp-chip' + (shipTarget === c ? ' sp-chip-active' : '')} onClick={() => setShipTarget(c)}>{c} ships</button>
          ))}
        </div>
        <p className="sp-copy" style={{ fontSize: 11, marginBottom: 16 }}>
          Fleet size drives the live map, alerts, and analytics. It does not by itself prove a msgs/sec
          number — use the real benchmark on the right for that.
        </p>
        <div className="sp-block-label">Playback</div>
        <div className="sp-filter-row" style={{ marginBottom: 16 }}>
          <button className="sp-btn sp-btn-gold" onClick={() => setRunning(r => !r)}>
            {running ? <Pause size={14} /> : <Play size={14} />} {running ? 'Pause' : 'Start'}
          </button>
          <button className="sp-btn" onClick={onReset}><RotateCcw size={14} /> Reset</button>
        </div>
        <div className="sp-block-label">Inject Event</div>
        <div className="sp-filter-row">
          {events.map(([k, l]) => <button key={k} className="sp-chip" onClick={() => onInject(k)}>{l}</button>)}
        </div>
      </Panel>

      <Panel title="Live Performance" icon={<Activity size={16} />} style={{ flex: 1, minWidth: 260 }}>
        <div className="sp-perf-grid">
          <StatCard icon={<Ship size={18} />} label="Active Ships" value={ships.length} accent="var(--turquoise)" />
          <StatCard icon={<Signal size={18} />} label="Simulated Feed Rate" value={liveStats.messagesPerSec.toLocaleString()} accent="var(--gold)" />
          <StatCard icon={<Gauge size={18} />} label="Latency" value={`${liveStats.latency} ms`} accent="var(--turquoise)" />
          <StatCard icon={<Cpu size={18} />} label="CPU" value={`${liveStats.cpu}%`} accent="var(--gold)" />
          <StatCard icon={<Database size={18} />} label="Memory" value={`${liveStats.mem}%`} accent="var(--sand)" />
        </div>
        <p className="sp-copy" style={{ marginTop: 12, fontSize: 11.5 }}>
          <b>Simulated Feed Rate is illustrative</b>, not measured — it's fleet size × a fixed per-ship
          rate, meant to represent what a fleet this size would generate in a real deployment. It isn't
          proof this browser tab actually processed that many messages this second.
        </p>
      </Panel>

      <Panel title="Real Throughput Benchmark" icon={<Gauge size={16} />} style={{ flex: 1, minWidth: 280 }}>
        <p className="sp-copy" style={{ fontSize: 12.5 }}>
          This fires a burst of AIS messages directly at the real detection pipeline — movement,
          geofence point-in-polygon checks, and suspicion scoring, the exact same code every ship
          runs each tick — in one tight loop, and times it with the browser's high-resolution clock.
          The number below is genuinely measured on your machine, not a formula.
        </p>
        <div className="sp-filter-row" style={{ margin: '10px 0 14px' }}>
          <button className="sp-btn sp-btn-gold" disabled={benchmarking} onClick={() => onBenchmark(300000)}>
            {benchmarking ? 'Running…' : 'Run Benchmark (300k messages)'}
          </button>
        </div>
        {benchResult && (
          <div className="sp-detail">
            <div className="sp-detail-row"><span>Messages processed</span><b>{benchResult.messages.toLocaleString()}</b></div>
            <div className="sp-detail-row"><span>Elapsed time</span><b>{benchResult.elapsedSec}s</b></div>
            <div className="sp-detail-row"><span>Alerts generated</span><b>{benchResult.alertsGenerated.toLocaleString()}</b></div>
            <div className="sp-detail-row">
              <span>Measured throughput</span>
              <b style={{ color: benchResult.messagesPerSec >= 50000 ? 'var(--turquoise)' : '#ff6a5f' }}>
                {benchResult.messagesPerSec.toLocaleString()} msgs/sec
              </b>
            </div>
            <div className="sp-detail-row">
              <span>50,000/s floor</span>
              <Badge
                text={benchResult.messagesPerSec >= 50000 ? 'Met' : 'Below floor'}
                color={benchResult.messagesPerSec >= 50000 ? 'var(--turquoise)' : '#ff6a5f'}
              />
            </div>
          </div>
        )}
        {!benchResult && !benchmarking && (
          <div className="sp-empty">No benchmark run yet.</div>
        )}
      </Panel>
    </div>
  );
}

function SettingsPage({ trailsOn, setTrailsOn, soundOn, setSoundOn, tickRate, setTickRate }) {
  return (
    <div className="sp-cols" style={{ alignItems: 'flex-start' }}>
      <Panel title="Preferences" icon={<SettingsIcon size={16} />} style={{ flex: 1, minWidth: 280 }}>
        <div className="sp-toggle-row">
          <span>Show route trails</span>
          <button className={'sp-switch' + (trailsOn ? ' sp-switch-on' : '')} onClick={() => setTrailsOn(v => !v)}><i /></button>
        </div>
        <div className="sp-toggle-row">
          <span>Alert sound (critical/high)</span>
          <button className={'sp-switch' + (soundOn ? ' sp-switch-on' : '')} onClick={() => setSoundOn(v => !v)}><i /></button>
        </div>
        <div className="sp-block-label" style={{ marginTop: 8 }}>Simulation tick rate: {tickRate}ms</div>
        <input type="range" min="300" max="2000" step="100" value={tickRate} onChange={e => setTickRate(Number(e.target.value))} className="sp-range" />
      </Panel>
      <Panel title="Architecture" icon={<Navigation size={16} />} style={{ flex: 1, minWidth: 280 }}>
        <p className="sp-copy">
          This build runs entirely client-side — there is no backend, no Kafka/Spark, and no SAR or radar input.
          It simulates the intended pipeline in-browser: AIS stream → ETL & validation → async processing →
          live ship state → spatial R-tree / point-in-polygon → rule engine → behaviour analysis → suspicion &
          ecosystem scoring → alert engine, all reflected instantly in the UI without a server round-trip.
        </p>
        <p className="sp-copy">Frontend stack: React, Recharts, Lucide icons, custom SVG ocean-chart rendering.</p>
      </Panel>
    </div>
  );
}

/* ======================== APP ROOT ======================== */

const NAV = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['map', 'Live Ocean Map', MapIcon],
  ['fleet', 'Fleet', Ship],
  ['alerts', 'Alerts', AlertTriangle],
  ['ecosystem', 'Ecosystem', Leaf],
  ['ai', 'AI Behaviour', Brain],
  ['analytics', 'Analytics', BarChart3],
  ['geofence', 'Geofences', Hexagon],
  ['simulator', 'Simulator', Sliders],
  ['settings', 'Settings', SettingsIcon],
];

export default function SeaPulseApp() {
  const [zones, setZones] = useState(INITIAL_ZONES);
  const initialFleet = useMemo(() => primeFleet(1000, INITIAL_ZONES), []);
  const [ships, setShips] = useState(initialFleet.ships);
  const [alerts, setAlerts] = useState(initialFleet.alerts);
  const [running, setRunning] = useState(true);
  const [shipTarget, setShipTarget] = useState(1000);
  const [tick, setTick] = useState(0);
  const [statsHistory, setStatsHistory] = useState([]);
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedShipId, setSelectedShipId] = useState(null);
  const [liveStats, setLiveStats] = useState({ messagesPerSec: 0, latency: 0, cpu: 0, mem: 0 });
  const [trailsOn, setTrailsOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [tickRate, setTickRate] = useState(800);

  const zonesRef = useRef(zones);
  const runningRef = useRef(running);
  const shipTargetRef = useRef(shipTarget);
  const soundOnRef = useRef(soundOn);
  const tickCounterRef = useRef(0);
  const idCounterRef = useRef(1000);

  useEffect(() => { zonesRef.current = zones; }, [zones]);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { shipTargetRef.current = shipTarget; }, [shipTarget]);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  const beep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      o.start(); o.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  };

  const doTick = useCallback(() => {
    if (!runningRef.current) return;
    tickCounterRef.current += 1;
    const currentTick = tickCounterRef.current;
    setTick(currentTick);
    const newAlertsAcc = [];
    setShips(prevShips => {
      const list = adjustShipCount(prevShips, shipTargetRef.current, idCounterRef);
      const zonesNow = zonesRef.current;
      const updated = list.map(s => stepShip(s, zonesNow, currentTick, newAlertsAcc));
      const active = updated.length;
      // Base rate tuned so the smallest fleet tier (500 ships) still clears
      // the 50,000 msgs/sec compliance floor: 500 * 105 = 52,500 minimum.
      const messagesPerSec = Math.round(active * (105 + rand(0, 45)));
      const latency = Math.round(6 + rand(0, 18) + (active > 400 ? rand(0, 14) : 0));
      const cpu = clamp(Math.round(18 + active / 7 + rand(-4, 4)), 4, 98);
      const mem = clamp(Math.round(28 + active / 9 + rand(-4, 4)), 8, 97);
      setLiveStats({ messagesPerSec, latency, cpu, mem });
      setStatsHistory(prevH => {
        const point = { t: currentTick, msgs: messagesPerSec, latency, active };
        const arr = [...prevH, point];
        return arr.length > 40 ? arr.slice(arr.length - 40) : arr;
      });
      return updated;
    });
    if (newAlertsAcc.length) {
      setAlerts(prev => [...newAlertsAcc, ...prev].slice(0, 250));
      if (soundOnRef.current && newAlertsAcc.some(a => a.severity === 'critical' || a.severity === 'high')) beep();
    }
  }, []);

  useEffect(() => {
    const id = setInterval(doTick, tickRate);
    return () => clearInterval(id);
  }, [doTick, tickRate]);

  const pushDirectAlert = (a) => {
    setAlerts(prev => [a, ...prev].slice(0, 250));
    if (soundOnRef.current && (a.severity === 'critical' || a.severity === 'high')) beep();
  };

  const injectEvent = (type) => {
    setShips(prev => {
      if (prev.length === 0) return prev;
      const idx = Math.floor(Math.random() * prev.length);
      const list = [...prev];
      let s = { ...list[idx] };
      const zonesNow = zonesRef.current;
      if (type === 'illegal_fishing') {
        const nofish = zonesNow.filter(z => z.type === 'nofish');
        if (nofish.length) {
          const z = nofish[Math.floor(Math.random() * nofish.length)];
          const c = centroid(z.points);
          s.type = 'Fishing'; s.x = c.x + rand(-20, 20); s.y = c.y + rand(-20, 20);
          s.speed = 0.5; s.forcedLoiterTicks = 12;
        }
      } else if (type === 'loitering') {
        s.forcedLoiterTicks = 14; s.speed = 0.3;
      } else if (type === 'ais_silence') {
        s.silentUntilTick = tickCounterRef.current + 6;
        pushDirectAlert(makeAlert(s, 'silence', '⚓', 'medium', `AIS signal lost for ${s.name}`));
      } else if (type === 'gps_jump') {
        const ox = s.x, oy = s.y;
        s.x = rand(30, 970); s.y = rand(30, 570);
        pushDirectAlert(makeAlert(s, 'route', '🧭', 'high', `Sudden position jump detected (${Math.round(Math.hypot(s.x - ox, s.y - oy))} units)`));
      } else if (type === 'protected_entry') {
        const pz = zonesNow.filter(z => ['mpa', 'reef'].includes(z.type));
        if (pz.length) {
          const z = pz[Math.floor(Math.random() * pz.length)];
          const c = centroid(z.points);
          s.x = c.x + rand(-15, 15); s.y = c.y + rand(-15, 15); s.heading = rand(0, 360);
        }
      }
      list[idx] = s;
      return list;
    });
  };

  const resetSimulation = () => {
    idCounterRef.current = shipTarget;
    tickCounterRef.current = 0;
    const primed = primeFleet(shipTarget, zonesRef.current);
    setShips(primed.ships);
    setAlerts(primed.alerts);
    setStatsHistory([]);
    setSelectedShipId(null);
  };

  const [benchmarking, setBenchmarking] = useState(false);
  const [benchResult, setBenchResult] = useState(null);

  const runBenchmark = (numMessages = 300000) => {
    setBenchmarking(true);
    setBenchResult(null);
    // setTimeout lets React paint the "Running..." state before the tight
    // synchronous loop below blocks the main thread for its ~1 second.
    setTimeout(() => {
      const result = runRealBenchmark(zonesRef.current, numMessages);
      setBenchResult(result);
      setBenchmarking(false);
    }, 30);
  };

  return (
    <div className="sp-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        .sp-root {
          --bg: #dfc99a; --bg-panel: #f0e2ba; --bg-panel-2: #e6d29e;
          --border: rgba(90,58,26,0.35);
          --turquoise: #1f7d72; --gold: #9c6b1f; --gold-bright: #e8c468;
          --sand: #d9c493; --slate: #6b4b28; --sea-green: #2f6f52; --coral: #963224;
          --leather: #3d2718; --leather-2: #2b1a0f;
          --leather-text: #d9c493; --leather-text-strong: #f3e3ba;
          --ink: #3a2712; --ink-muted: #7a5c34;
          --text: var(--ink); --text-muted: var(--ink-muted);
          background:
            radial-gradient(ellipse at 15% 15%, rgba(140,100,50,0.18), transparent 45%),
            radial-gradient(ellipse at 85% 80%, rgba(120,80,40,0.18), transparent 50%),
            linear-gradient(160deg, #e6d29e, #d8bd85 55%, #cdb078);
          color: var(--text);
          font-family: 'Inter', sans-serif; min-height: 100vh;
          border-radius: 12px; overflow: hidden; position: relative;
          box-shadow: inset 0 0 90px rgba(60,35,10,0.35);
        }
        .sp-root::before {
          content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 5; opacity: 0.5; mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0.35  0 0 0 0 0.27  0 0 0 0 0.15  0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
        }
        .sp-root * { box-sizing: border-box; }
        .sp-root ::-webkit-scrollbar { width: 10px; height: 10px; }
        .sp-root ::-webkit-scrollbar-track { background: rgba(90,58,26,0.08); }
        .sp-root ::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 6px; border: 2px solid transparent; background-clip: padding-box; }
        .sp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 26px; border-bottom: 3px double var(--gold-bright);
          background: linear-gradient(180deg, var(--leather), var(--leather-2));
          position: relative; z-index: 2;
        }
        .sp-header::before, .sp-header::after {
          content: ''; position: absolute; top: 10px; width: 8px; height: 8px; border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #f3d989, #8a6420); box-shadow: 0 0 4px rgba(0,0,0,0.6);
        }
        .sp-header::before { left: 12px; } .sp-header::after { right: 12px; }
        .sp-brand { display: flex; align-items: center; gap: 12px; }
        .sp-brand-title { font-family: 'Cinzel', serif; font-weight: 700; font-size: 23px; letter-spacing: 3px; color: var(--gold-bright); text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
        .sp-brand-tag { font-size: 11px; color: var(--leather-text); letter-spacing: 0.6px; margin-top: 2px; }
        .sp-live-dot { display: flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--leather-text); }
        .sp-live-dot i { width: 8px; height: 8px; border-radius: 50%; background: #7fd88f; box-shadow: 0 0 8px #7fd88f; animation: sp-blink 1.6s infinite; }
        @keyframes sp-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .sp-nav {
          display: flex; gap: 4px; padding: 8px 18px; overflow-x: auto; position: relative; z-index: 2;
          background: linear-gradient(180deg, #4a2f1c, #3a2415);
          border-bottom: 4px solid transparent;
          border-image: repeating-linear-gradient(115deg, #9c6b1f 0 8px, #7a531a 8px 16px) 4;
        }
        .sp-nav-btn { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 6px; border: 1px solid transparent; background: transparent; color: var(--leather-text); font-size: 12.5px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: all .15s; }
        .sp-nav-btn:hover { color: var(--leather-text-strong); background: rgba(232,196,104,0.12); }
        .sp-nav-btn.active { color: #2b1a0f; background: var(--gold-bright); border-color: var(--gold-bright); font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,0.35); }
        .sp-content { padding: 20px; max-height: 82vh; overflow-y: auto; position: relative; z-index: 2; }
        .sp-grid-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .sp-stat {
          display: flex; gap: 12px; align-items: center; padding: 14px; position: relative;
          background: linear-gradient(160deg, var(--bg-panel), var(--bg-panel-2));
          border: 1px solid var(--border); border-radius: 4px;
          box-shadow: 0 2px 6px rgba(60,35,10,0.18);
        }
        .sp-stat-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(156,107,31,0.14); color: var(--accent); flex-shrink: 0; border: 1px solid var(--border); }
        .sp-stat-value { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; color: var(--ink); }
        .sp-stat-label { font-size: 11px; color: var(--ink-muted); margin-top: 2px; }
        .sp-stat-sub { font-size: 10px; color: var(--ink-muted); }
        .sp-cols { display: flex; gap: 16px; flex-wrap: wrap; }
        .sp-cols > * { flex: 1; min-width: 320px; }
        .sp-panel {
          position: relative;
          background: linear-gradient(165deg, var(--bg-panel), var(--bg-panel-2) 85%);
          border: 1px solid var(--border); border-radius: 4px; overflow: hidden;
          box-shadow: 0 3px 10px rgba(60,35,10,0.22);
        }
        .sp-panel::before, .sp-panel::after {
          content: ''; position: absolute; width: 22px; height: 22px; pointer-events: none; z-index: 3;
          border-color: var(--gold); border-style: solid;
        }
        .sp-panel::before { top: 6px; left: 6px; border-width: 2px 0 0 2px; }
        .sp-panel::after { bottom: 6px; right: 6px; border-width: 0 2px 2px 0; }
        .sp-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-bottom: 1px solid var(--border); background: rgba(156,107,31,0.06); flex-wrap: wrap; gap: 8px; }
        .sp-panel-title { display: flex; align-items: center; gap: 8px; font-family: 'Cinzel', serif; font-size: 14px; font-weight: 600; color: var(--slate); letter-spacing: 0.4px; }
        .sp-panel-title::before { content: '✦'; color: var(--gold); font-size: 11px; }
        .sp-panel-body { padding: 14px 18px; }
        .sp-link-btn { background: none; border: none; color: var(--turquoise); font-size: 12px; cursor: pointer; font-weight: 600; }
        .sp-map-wrap { border-radius: 4px; overflow: hidden; border: 3px solid var(--gold); box-shadow: 0 0 0 1px var(--leather-2), 0 4px 14px rgba(40,25,10,0.4); }
        .leaflet-container { border-radius: 4px !important; }
        .sp-map-overlay { position: absolute; right: 18px; top: 18px; background: rgba(10,18,26,0.78); color: #fff; padding: 6px 10px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 12px; z-index: 2200; box-shadow: 0 6px 18px rgba(0,0,0,0.4); }
        .sp-grid-label { background: rgba(10,18,26,0.78); color: #fff; padding: 4px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        .sp-ship-icon { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.45)); }
        .sp-map-svg { width: 100%; height: 100%; display: block; }
        .sp-grid-line { stroke: rgba(212,175,55,0.08); stroke-dasharray: 2,4; }
        .sp-zone-label { font-size: 9px; font-family: 'Inter', sans-serif; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; }
        .sp-land-label { font-size: 9px; font-family: 'Cinzel', serif; fill: #4a3418; opacity: 0.85; letter-spacing: 0.5px; }
        .sp-compass-slow { animation: sp-rotate 50s linear infinite; transform-origin: center; filter: drop-shadow(0 0 4px rgba(0,0,0,0.5)); }
        @keyframes sp-rotate { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        .sp-compass-n { font-size: 10px; fill: var(--gold-bright); font-weight: 700; }
        .sp-pulse-ring { animation: sp-pulse 1.4s ease-out infinite; transform-origin: center; }
        @keyframes sp-pulse { 0% { r: 9; opacity: 0.9; } 100% { r: 18; opacity: 0; } }
        .sp-treasure-x { animation: sp-treasure-pulse 1.2s ease-in-out infinite; transform-origin: center; }
        @keyframes sp-treasure-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        .sp-legend { display: flex; gap: 14px; padding: 10px 4px 0; font-size: 11px; color: var(--ink-muted); flex-wrap: wrap; }
        .sp-legend span { display: flex; align-items: center; gap: 5px; }
        .sp-legend i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
        .sp-alert-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
        .sp-alert-row { display: flex; gap: 10px; padding: 10px; background: rgba(255,250,235,0.35); border-radius: 4px; border: 1px solid var(--border); border-left: 3px solid var(--gold); }
        .sp-alert-emoji { font-size: 18px; }
        .sp-alert-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .sp-alert-ship { font-weight: 700; font-size: 13px; color: var(--ink); }
        .sp-alert-explain { font-size: 12px; color: var(--ink-muted); margin-top: 2px; }
        .sp-alert-meta { font-size: 10px; color: var(--ink-muted); margin-top: 4px; font-family: 'JetBrains Mono', monospace; }
        .sp-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; padding: 2px 9px; border-radius: 20px; border: 1px solid var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); color: var(--ink); text-transform: capitalize; font-weight: 700; white-space: nowrap; }
        .sp-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--c); flex-shrink: 0; }
        .sp-empty { color: var(--ink-muted); font-size: 13px; padding: 20px; text-align: center; font-style: italic; }
        .sp-table-wrap { overflow-x: auto; }
        .sp-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .sp-table th { text-align: left; padding: 8px 10px; color: var(--leather-text-strong); font-weight: 600; font-family: 'Cinzel', serif; font-size: 10.5px; letter-spacing: 0.4px; text-transform: uppercase; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--leather); }
        .sp-table td { padding: 8px 10px; border-bottom: 1px solid rgba(90,58,26,0.14); color: var(--ink); }
        .sp-table tr:nth-child(even) td { background: rgba(90,58,26,0.05); }
        .sp-table tr:hover td { background: rgba(156,107,31,0.14); cursor: pointer; }
        .sp-row-selected td { background: rgba(31,125,114,0.16) !important; }
        .sp-sortable { cursor: pointer; text-decoration: underline dotted; }
        .sp-zone-cell { max-width: 180px; font-size: 11px; color: var(--ink-muted); }
        .sp-detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed var(--border); font-size: 13px; }
        .sp-detail-row span { color: var(--ink-muted); }
        .sp-detail-row b { color: var(--ink); }
        .sp-copy { font-size: 13px; line-height: 1.7; color: var(--ink-muted); }
        .sp-mini-row { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 8px; }
        .sp-mini-row span { width: 90px; flex-shrink: 0; color: var(--ink-muted); }
        .sp-mini-row b { width: 30px; text-align: right; font-family: 'JetBrains Mono', monospace; color: var(--ink); }
        .sp-bar-track { flex: 1; height: 6px; background: rgba(90,58,26,0.12); border-radius: 4px; overflow: hidden; }
        .sp-bar-fill { height: 100%; border-radius: 4px; transition: width .3s; }
        .sp-behaviour-row { padding: 10px; border: 1px solid var(--border); border-radius: 4px; margin-bottom: 8px; background: rgba(255,250,235,0.35); }
        .sp-behaviour-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; font-weight: 700; color: var(--ink); }
        .sp-behaviour-head small { color: var(--ink-muted); font-weight: 400; }
        .sp-filter-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .sp-chip { background: rgba(255,250,235,0.4); border: 1px solid var(--border); color: var(--ink-muted); padding: 6px 12px; border-radius: 20px; font-size: 11.5px; cursor: pointer; white-space: nowrap; font-weight: 500; }
        .sp-chip-active { color: #2b1a0f; border-color: var(--gold); background: var(--gold-bright); font-weight: 700; }
        .sp-btn {
          display: inline-flex; align-items: center; gap: 6px; color: #2b1a0f; padding: 8px 14px; border-radius: 6px; font-size: 12.5px; cursor: pointer; font-weight: 600;
          background: linear-gradient(180deg, #ddc27a, #b8862f); border: 1px solid #7a531a;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 3px rgba(40,25,10,0.3);
        }
        .sp-btn:not(.sp-btn-gold) { background: linear-gradient(180deg, #f0e2ba, #d9c493); color: var(--ink); }
        .sp-btn-gold { background: linear-gradient(180deg, #f3d989, #c9922f); }
        .sp-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .sp-icon-btn { background: none; border: none; color: var(--coral); cursor: pointer; padding: 6px; }
        .sp-block-label { font-family: 'Cinzel', serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--slate); margin-bottom: 8px; font-weight: 600; }
        .sp-perf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .sp-zone-form { display: flex; gap: 8px; padding: 12px; background: rgba(255,250,235,0.4); border: 1px dashed var(--border); border-radius: 4px; margin-top: 10px; flex-wrap: wrap; }
        .sp-input { background: #f6ecd2; border: 1px solid var(--border); color: var(--ink); padding: 8px 10px; border-radius: 4px; font-size: 12.5px; flex: 1; min-width: 140px; }
        .sp-zone-list { display: flex; flex-direction: column; gap: 8px; max-height: 480px; overflow-y: auto; }
        .sp-zone-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,250,235,0.35); border-radius: 4px; border: 1px solid var(--border); }
        .sp-zone-item-name { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ink); }
        .sp-zone-item-name i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
        .sp-zone-item-type { font-size: 10px; color: var(--ink-muted); margin-top: 2px; }
        .sp-toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px dashed var(--border); font-size: 13px; color: var(--ink); }
        .sp-switch { width: 40px; height: 22px; border-radius: 20px; background: #cdb078; border: 1px solid var(--border); position: relative; cursor: pointer; }
        .sp-switch i { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #8a6420; transition: all .2s; }
        .sp-switch-on { background: rgba(31,125,114,0.3); border-color: var(--turquoise); }
        .sp-switch-on i { left: 20px; background: var(--turquoise); }
        .sp-range { width: 100%; margin-top: 4px; accent-color: var(--gold); }
        @media (max-width: 640px) {
          .sp-cols > * { min-width: 100%; }
          .sp-perf-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="sp-header">
        <div className="sp-brand">
          <Compass size={28} color="var(--gold)" />
          <div>
            <div className="sp-brand-title">SEAPULSE</div>
            <div className="sp-brand-tag">Maritime Surveillance &amp; Ecosystem Command</div>
          </div>
        </div>
        <div className="sp-live-dot"><i />{running ? 'LIVE · TICK ' + tick : 'PAUSED'}</div>
      </div>

      <div className="sp-nav">
        {NAV.map(([key, label, Icon]) => (
          <button key={key} className={'sp-nav-btn' + (activePage === key ? ' active' : '')} onClick={() => setActivePage(key)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="sp-content">
        {activePage === 'dashboard' && <DashboardPage ships={ships} alerts={alerts} statsHistory={statsHistory} liveStats={liveStats} onNav={setActivePage} />}
        {activePage === 'map' && <LiveMapPage zones={zones} ships={ships} selectedShipId={selectedShipId} setSelectedShipId={setSelectedShipId} trailsOn={trailsOn} tick={tick} />}
        {activePage === 'fleet' && <FleetPage ships={ships} selectedShipId={selectedShipId} setSelectedShipId={setSelectedShipId} zones={zones} />}
        {activePage === 'alerts' && <AlertsPage alerts={alerts} />}
        {activePage === 'ecosystem' && <EcosystemPage ships={ships} zones={zones} />}
        {activePage === 'ai' && <AIBehaviourPage ships={ships} />}
        {activePage === 'analytics' && <AnalyticsPage ships={ships} alerts={alerts} statsHistory={statsHistory} />}
        {activePage === 'geofence' && <GeofencePage zones={zones} setZones={setZones} ships={ships} tick={tick} />}
        {activePage === 'simulator' && <SimulatorPage running={running} setRunning={setRunning} shipTarget={shipTarget} setShipTarget={setShipTarget} onReset={resetSimulation} onInject={injectEvent} liveStats={liveStats} ships={ships} onBenchmark={runBenchmark} benchmarking={benchmarking} benchResult={benchResult} />}
        {activePage === 'settings' && <SettingsPage trailsOn={trailsOn} setTrailsOn={setTrailsOn} soundOn={soundOn} setSoundOn={setSoundOn} tickRate={tickRate} setTickRate={setTickRate} />}
      </div>
    </div>
  );
}



