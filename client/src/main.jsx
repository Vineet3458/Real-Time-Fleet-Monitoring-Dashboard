import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { Activity, Truck, Wifi, MapPin, Clock3, Zap } from 'lucide-react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const socket = io(API);

const statusLabel = { ON_TRIP: 'On Trip', IDLE: 'Idle', OFFLINE: 'Offline' };

function App() {
  const [drivers, setDrivers] = useState([]);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    Promise.all([fetch(`${API}/api/drivers`).then(r => r.json()), fetch(`${API}/api/events?limit=30`).then(r => r.json())])
      .then(([d, e]) => { setDrivers(d); setEvents(e); });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('fleet:event', ({ driver, message, timestamp, type }) => {
      setDrivers(prev => prev.map(d => d.id === driver.id ? driver : d));
      setEvents(prev => [{ id: `${Date.now()}-${driver.id}`, driver_name: driver.name, type, message, created_at: timestamp }, ...prev].slice(0, 30));
    });
    return () => { socket.off('connect'); socket.off('disconnect'); socket.off('fleet:event'); };
  }, []);

  const filtered = useMemo(() => filter === 'ALL' ? drivers : drivers.filter(d => d.status === filter), [drivers, filter]);
  const counts = useMemo(() => drivers.reduce((a, d) => ({ ...a, [d.status]: (a[d.status] || 0) + 1 }), {}), [drivers]);

  return <div className="app">
    <header className="topbar">
      <div><div className="eyebrow">OPERATIONS CENTER</div><h1>FleetPulse</h1><p>Real-time fleet monitoring dashboard</p></div>
      <div className={`live ${connected ? 'online' : ''}`}><span></span>{connected ? 'LIVE CONNECTION' : 'CONNECTING...'}</div>
    </header>

    <main>
      <section className="stats">
        <Stat icon={<Truck />} title="Total Drivers" value={drivers.length} detail="Tracked vehicles" />
        <Stat icon={<Activity />} title="On Trip" value={counts.ON_TRIP || 0} detail="Currently moving" />
        <Stat icon={<Clock3 />} title="Idle" value={counts.IDLE || 0} detail="Awaiting assignment" />
        <Stat icon={<Wifi />} title="Stream" value={connected ? 'Active' : 'Offline'} detail="Socket.io updates" />
      </section>

      <section className="content-grid">
        <div className="panel fleet-panel">
          <div className="panel-head"><div><h2>Live Fleet</h2><span>{filtered.length} drivers shown</span></div><div className="filters">{['ALL','ON_TRIP','IDLE','OFFLINE'].map(s => <button className={filter === s ? 'active' : ''} onClick={() => setFilter(s)} key={s}>{s === 'ALL' ? 'All' : statusLabel[s]}</button>)}</div></div>
          <div className="driver-list">{filtered.map(d => <DriverCard key={d.id} driver={d} />)}</div>
        </div>

        <aside className="panel events-panel">
          <div className="panel-head"><div><h2>Live Events</h2><span>Latest activity</span></div><Zap size={18}/></div>
          <div className="events">{events.map((e, i) => <div className="event" key={e.id || i}><div className="event-dot"></div><div><strong>{e.driver_name || 'Fleet'}</strong><p>{e.message}</p><small>{new Date(e.created_at).toLocaleTimeString()}</small></div></div>)}</div>
        </aside>
      </section>
    </main>
    <footer>FleetPulse demo · React + Express + Socket.io + PostgreSQL + Redis</footer>
  </div>
}

function Stat({ icon, title, value, detail }) { return <div className="stat"><div className="icon">{icon}</div><div><span>{title}</span><strong>{value}</strong><small>{detail}</small></div></div> }

function DriverCard({ driver: d }) { return <div className="driver"><div className="avatar">{d.name.split(' ').map(x => x[0]).join('').slice(0,2)}</div><div className="driver-main"><div className="driver-title"><strong>{d.name}</strong><span className={`badge ${d.status.toLowerCase()}`}>{statusLabel[d.status]}</span></div><div className="meta">{d.vehicle} · {d.speed} km/h</div><div className="location"><MapPin size={14}/> {Number(d.latitude).toFixed(4)}, {Number(d.longitude).toFixed(4)}</div></div><div className="updated">{new Date(d.updated_at).toLocaleTimeString()}</div></div> }

createRoot(document.getElementById('root')).render(<App />);
