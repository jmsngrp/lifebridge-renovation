const express      = require('express');
const session      = require('express-session');
const bcrypt       = require('bcryptjs');
const { Pool }     = require('pg');
const pgSession    = require('connect-pg-simple')(session);
const path         = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database ──────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// ── Init DB tables ────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracker_data (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS session (
      sid    VARCHAR NOT NULL COLLATE "default",
      sess   JSON    NOT NULL,
      expire TIMESTAMP(6) NOT NULL,
      CONSTRAINT session_pkey PRIMARY KEY (sid)
    );
    CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
  `).catch(() => {}); // ignore if already exists
  console.log('DB tables ready');
}

// ── Middleware ────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new pgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'lifebridge-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    secure: process.env.NODE_ENV === 'production'
  }
}));

// ── Auth middleware ───────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/login');
}

// ── Password hash (set via env var APP_PASSWORD) ──────────────────────
// Default password: LifeBridge2026 (change via APP_PASSWORD env var in Railway)
const DEFAULT_PASSWORD = 'LifeBridge2026!';

async function checkPassword(input) {
  const stored = process.env.APP_PASSWORD || DEFAULT_PASSWORD;
  // Support both plain text (env var) and bcrypt hash
  if (stored.startsWith('$2')) {
    return bcrypt.compare(input, stored);
  }
  return input === stored;
}

// ── Routes ────────────────────────────────────────────────────────────

// Login page
app.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LifeBridge Renovation Tracker — Login</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Source Sans 3', sans-serif;
      background: linear-gradient(135deg, #152231 0%, #2b4560 100%);
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      padding: 48px 44px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0,0,0,.3);
      text-align: center;
    }
    .logo-wrap {
      width: 64px; height: 64px;
      background: #152231;
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px;
    }
    .logo-wrap img { width: 52px; height: 52px; object-fit: contain; }
    h1 {
      font-family: 'Montserrat', sans-serif;
      font-size: 1.3rem; font-weight: 800;
      color: #152231; margin-bottom: 4px;
    }
    p.sub { font-size: .88rem; color: #5a7a95; margin-bottom: 32px; }
    label {
      display: block; text-align: left;
      font-family: 'Montserrat', sans-serif;
      font-size: .68rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: .08em;
      color: #5a7a95; margin-bottom: 6px;
    }
    input[type=password] {
      width: 100%; padding: 11px 14px;
      border: 1.5px solid #ccdce9;
      border-radius: 8px;
      font-family: 'Source Sans 3', sans-serif;
      font-size: .95rem;
      outline: none; margin-bottom: 20px;
      transition: border-color .2s;
    }
    input[type=password]:focus { border-color: #4e7499; box-shadow: 0 0 0 3px rgba(78,116,153,.15); }
    button {
      width: 100%; padding: 12px;
      background: #2b4560; color: #fff;
      border: none; border-radius: 8px;
      font-family: 'Montserrat', sans-serif;
      font-size: .82rem; font-weight: 700;
      letter-spacing: .06em; text-transform: uppercase;
      cursor: pointer; transition: background .2s;
    }
    button:hover { background: #3a5a7a; }
    .error {
      background: #fde8e8; color: #b53030;
      border-radius: 7px; padding: 10px 14px;
      font-size: .85rem; margin-bottom: 16px;
      display: ${req.query.error ? 'block' : 'none'};
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-wrap">
      <img src="/logo.jpg" alt="LifeBridge Church" onerror="this.style.display='none'">
    </div>
    <h1>LifeBridge Church</h1>
    <p class="sub">Renovation Tracker — Team Access</p>
    <div class="error">Incorrect password. Please try again.</div>
    <form method="POST" action="/login">
      <label>Password</label>
      <input type="password" name="password" placeholder="Enter team password" autofocus>
      <button type="submit">Sign In</button>
    </form>
  </div>
</body>
</html>`);
});

// Login POST
app.post('/login', async (req, res) => {
  const { password } = req.body;
  const ok = await checkPassword(password);
  if (ok) {
    req.session.authenticated = true;
    res.redirect('/');
  } else {
    res.redirect('/login?error=1');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Main app — serve index.html
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Data API ──────────────────────────────────────────────────────────
// GET all data
app.get('/api/data', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM tracker_data');
    const data = {};
    result.rows.forEach(row => {
      try { data[row.key] = JSON.parse(row.value); }
      catch(e) { data[row.key] = row.value; }
    });
    res.json({ ok: true, data });
  } catch (e) {
    console.error('GET /api/data error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST save a key
app.post('/api/data', requireAuth, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ ok: false, error: 'key required' });
    const val = typeof value === 'string' ? value : JSON.stringify(value);
    await pool.query(`
      INSERT INTO tracker_data (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    `, [key, val]);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/data error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST save all keys at once
app.post('/api/data/bulk', requireAuth, async (req, res) => {
  try {
    const { data } = req.body;
    if (!data || typeof data !== 'object') return res.status(400).json({ ok: false, error: 'data object required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [key, value] of Object.entries(data)) {
        const val = typeof value === 'string' ? value : JSON.stringify(value);
        await client.query(`
          INSERT INTO tracker_data (key, value, updated_at) VALUES ($1, $2, NOW())
          ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
        `, [key, val]);
      }
      await client.query('COMMIT');
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/data/bulk error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Static files (logo, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// ── Start ─────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`LifeBridge Tracker running on port ${PORT}`);
    console.log(`Default password: ${process.env.APP_PASSWORD ? '[set via env]' : DEFAULT_PASSWORD}`);
  });
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});
