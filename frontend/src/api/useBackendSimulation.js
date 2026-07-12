import { useCallback, useEffect, useRef, useState } from 'react';
import { WS_URL, api } from './backendClient';

const RECONNECT_DELAY_MS = 3000;
const MAX_STATS_HISTORY = 40;
const MAX_ALERTS = 250;

// Connects to the real FastAPI backend over WebSocket and mirrors its state
// (zones, ships, alerts, tick, liveStats, statsHistory, running, shipTarget,
// tickRateMs) into React state, reconnecting automatically if the backend
// isn't reachable yet or drops. `connected` tells the caller whether the
// backend is actually driving the simulation right now; if it's false the
// app is expected to fall back to its own in-browser simulator so the UI
// keeps working even with no server running.
export function useBackendSimulation() {
  const [connected, setConnected] = useState(false);
  const [zones, setZones] = useState([]);
  const [ships, setShips] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(true);
  const [shipTarget, setShipTargetState] = useState(1000);
  const [tickRateMs, setTickRateMsState] = useState(800);
  const [liveStats, setLiveStats] = useState({ messagesPerSec: 0, latency: 0, cpu: 0, mem: 0 });
  const [statsHistory, setStatsHistory] = useState([]);

  const wsRef = useRef(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    let reconnectTimer = null;

    const connect = () => {
      if (unmountedRef.current) return;
      let ws;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        switch (msg.type) {
          case 'snapshot':
            setZones(msg.zones);
            setShips(msg.ships);
            setAlerts(msg.alerts);
            setTick(msg.tick);
            setRunning(msg.running);
            setShipTargetState(msg.shipTarget);
            setTickRateMsState(msg.tickRateMs);
            setLiveStats(msg.liveStats);
            setStatsHistory(msg.statsHistory);
            break;
          case 'tick':
            setTick(msg.tick);
            setShips(msg.ships);
            setLiveStats(msg.liveStats);
            setStatsHistory((prev) => {
              const arr = [...prev, msg.statsPoint];
              return arr.length > MAX_STATS_HISTORY ? arr.slice(arr.length - MAX_STATS_HISTORY) : arr;
            });
            if (msg.newAlerts && msg.newAlerts.length) {
              setAlerts((prev) => [...msg.newAlerts, ...prev].slice(0, MAX_ALERTS));
            }
            break;
          case 'zones':
            setZones(msg.zones);
            break;
          case 'status':
            setRunning(msg.running);
            setShipTargetState(msg.shipTarget);
            setTickRateMsState(msg.tickRateMs);
            break;
          case 'alert':
            setAlerts((prev) => [msg.alert, ...prev].slice(0, MAX_ALERTS));
            break;
          default:
            break;
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!unmountedRef.current) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* noop */
        }
      };
    };

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const addZone = useCallback((zone) => api.createZone(zone), []);
  const deleteZone = useCallback((id) => api.deleteZone(id), []);
  const start = useCallback(() => api.start().then(() => setRunning(true)), []);
  const pause = useCallback(() => api.pause().then(() => setRunning(false)), []);
  const reset = useCallback(() => api.reset(), []);
  const setShipTarget = useCallback((target) => {
    setShipTargetState(target);
    return api.setShipTarget(target);
  }, []);
  const setTickRateMs = useCallback((rate) => {
    setTickRateMsState(rate);
    return api.setTickRate(rate);
  }, []);
  const injectEvent = useCallback((type) => api.injectEvent(type), []);
  const runBenchmark = useCallback((numMessages) => api.benchmark(numMessages), []);

  return {
    connected,
    zones,
    ships,
    alerts,
    tick,
    running,
    shipTarget,
    tickRateMs,
    liveStats,
    statsHistory,
    addZone,
    deleteZone,
    start,
    pause,
    reset,
    setShipTarget,
    setTickRateMs,
    injectEvent,
    runBenchmark,
  };
}
