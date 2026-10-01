import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import pg from 'pg';
import Redis from 'ioredis';

const { Pool } = pg;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || '*' } });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

const seedDrivers = [
  ['Aarav Sharma', 'DL-01-TR-1042', 'ON_TRIP', 28.6139, 77.2090, 42],
  ['Priya Singh', 'DL-02-TR-8821', 'IDLE', 28.6280, 77.2180, 0],
  ['Rahul Verma', 'UP-16-TR-3412', 'ON_TRIP', 28.4595, 77.0266, 51],
  ['Neha Gupta', 'DL-03-TR-9127', 'OFFLINE', 28.5355, 77.3910, 0],
  ['Vikram Yadav', 'UP-14-TR-5518', 'ON_TRIP', 28.4089, 77.3178, 36],
  ['Ananya Rao', 'HR-26-TR-7710', 'IDLE', 28.7041, 77.1025, 0],
  ['Karan Mehta', 'DL-04-TR-6305', 'ON_TRIP', 28.6508, 77.2330, 47],
  ['Ishita Jain', 'UP-32-TR-4401', 'OFFLINE', 28.5355, 77.3910, 0]
];

async function seed() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM drivers');
  if (rows[0].count > 0) return;
  for (const d of seedDrivers) {
    await pool.query(
      `INSERT INTO drivers(name, vehicle, status, latitude, longitude, speed) VALUES($1,$2,$3,$4,$5,$6)`, d
    );
  }
}

async function publishEvent(event) {
  await redis.publish('fleet.events', JSON.stringify(event));
}

subscriber.subscribe('fleet.events');
subscriber.on('message', (_channel, raw) => {
  try { io.emit('fleet:event', JSON.parse(raw)); } catch {}
});

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); await redis.ping(); res.json({ ok: true, service: 'fleet-api' }); }
  catch (e) { res.status(503).json({ ok: false, error: e.message }); }
});

app.get('/api/drivers', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM drivers ORDER BY id');
  res.json(rows);
});

app.get('/api/events', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const { rows } = await pool.query(
    `SELECT e.*, d.name AS driver_name FROM events e LEFT JOIN drivers d ON d.id=e.driver_id ORDER BY e.created_at DESC LIMIT $1`, [limit]
  );
  res.json(rows);
});

app.patch('/api/drivers/:id/status', async (req, res) => {
  const allowed = ['ON_TRIP', 'IDLE', 'OFFLINE'];
  const status = String(req.body.status || '').toUpperCase();
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const { rows } = await pool.query(
    `UPDATE drivers SET status=$1, speed=CASE WHEN $1='ON_TRIP' THEN GREATEST(speed, 20) ELSE 0 END, updated_at=NOW() WHERE id=$2 RETURNING *`, [status, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Driver not found' });
  const driver = rows[0];
  const event = { type: 'STATUS_CHANGED', driver, message: `${driver.name} is now ${driver.status}`, timestamp: new Date().toISOString() };
  await pool.query('INSERT INTO events(driver_id,type,message,payload) VALUES($1,$2,$3,$4)', [driver.id, event.type, event.message, JSON.stringify(driver)]);
  await publishEvent(event);
  res.json(driver);
});

async function simulate() {
  const { rows } = await pool.query('SELECT * FROM drivers WHERE status <> $1', ['OFFLINE']);
  if (!rows.length) return;
  const driver = rows[Math.floor(Math.random() * rows.length)];
  const moving = driver.status === 'ON_TRIP';
  const latitude = Number(driver.latitude) + (Math.random() - 0.5) * 0.006;
  const longitude = Number(driver.longitude) + (Math.random() - 0.5) * 0.006;
  const speed = moving ? Math.max(15, Math.round(25 + Math.random() * 40)) : 0;
  const statuses = moving && Math.random() < 0.15 ? 'IDLE' : moving ? 'ON_TRIP' : Math.random() < 0.35 ? 'ON_TRIP' : 'IDLE';
  const { rows: updated } = await pool.query(
    `UPDATE drivers SET latitude=$1, longitude=$2, speed=$3, status=$4, updated_at=NOW() WHERE id=$5 RETURNING *`,
    [latitude, longitude, speed, statuses, driver.id]
  );
  const d = updated[0];
  const type = d.status !== driver.status ? 'STATUS_CHANGED' : 'LOCATION_UPDATED';
  const message = type === 'STATUS_CHANGED' ? `${d.name} changed status to ${d.status}` : `${d.name} location updated`;
  await pool.query('INSERT INTO events(driver_id,type,message,payload) VALUES($1,$2,$3,$4)', [d.id, type, message, JSON.stringify(d)]);
  await publishEvent({ type, driver: d, message, timestamp: new Date().toISOString() });
}

io.on('connection', (socket) => {
  socket.emit('fleet:connected', { message: 'Connected to live fleet stream' });
});

const port = Number(process.env.PORT || 4000);
await seed();
setInterval(() => simulate().catch(console.error), 3500);
server.listen(port, () => console.log(`Fleet API listening on :${port}`));
