const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const ADMIN_PASSWORD = '335Jp077';
const DEFAULT_CONFIG = {
  profile: {
    name: 'Your Name',
    tagline: 'Creative profile',
    bio: 'A personal site for sharing your art, music, and vibe.',
    location: 'Somewhere online',
    status: 'Available',
    avatar: '',
    banner: ''
  },
  theme: {
    primary: '#8a2be2',
    accent: '#f72585',
    background: '#09090f',
    backgroundImage: '',
    surface: '#171827',
    text: '#f5f5f7'
  },
  stats: {
    viewCount: 1
  },
  music: {
    enabled: true,
    title: 'Now Playing',
    artist: 'Your favorite artist',
    cover: '',
    src: '',
    volume: 0.45
  },
  widgets: [],
  records: [],
  cursor: {
    enabled: false,
    url: ''
  },
  customCss: '',
  sections: {
    about: true,
    music: true,
    library: true,
    widgets: true,
    contact: true
  }
};

function readConfig(persistPath) {
  const basePath = path.resolve(persistPath);
  const dir = path.dirname(basePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(basePath)) {
    fs.writeFileSync(basePath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  try {
    const raw = fs.readFileSync(basePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      ...parsed,
      profile: { ...DEFAULT_CONFIG.profile, ...(parsed.profile || {}) },
      theme: { ...DEFAULT_CONFIG.theme, ...(parsed.theme || {}) },
      stats: { ...DEFAULT_CONFIG.stats, ...(parsed.stats || {}) },
      music: { ...DEFAULT_CONFIG.music, ...(parsed.music || {}) },
      cursor: { ...DEFAULT_CONFIG.cursor, ...(parsed.cursor || {}) },
      sections: { ...DEFAULT_CONFIG.sections, ...(parsed.sections || {}) }
    };
  } catch (error) {
    fs.writeFileSync(basePath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

function saveConfig(persistPath, config) {
  const basePath = path.resolve(persistPath);
  const dir = path.dirname(basePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(basePath, JSON.stringify(config, null, 2));
}

function createApp(options = {}) {
  const persistPath = options.persistPath || './site-config.json';
  const app = express();

  app.use(express.json({ limit: '25mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  let config = readConfig(persistPath);

  app.get('/api/view', (req, res) => {
    config = readConfig(persistPath);
    config.stats = config.stats || {};
    config.stats.viewCount = Number(config.stats.viewCount || 0) + 1;
    saveConfig(persistPath, config);
    res.json({ viewCount: config.stats.viewCount });
  });

  app.get('/api/site', (req, res) => {
    config = readConfig(persistPath);
    res.json(config);
  });

  app.post('/api/site', (req, res) => {
    const password = req.get('x-admin-password') || req.body.password || '';
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const incoming = req.body || {};
    config = {
      ...config,
      ...incoming,
      profile: { ...config.profile, ...(incoming.profile || {}) },
      theme: { ...config.theme, ...(incoming.theme || {}) },
      stats: { ...config.stats, ...(incoming.stats || {}) },
      music: { ...config.music, ...(incoming.music || {}) },
      cursor: { ...config.cursor, ...(incoming.cursor || {}) },
      sections: { ...config.sections, ...(incoming.sections || {}) },
      widgets: Array.isArray(incoming.widgets) ? incoming.widgets : config.widgets,
      records: Array.isArray(incoming.records) ? incoming.records : config.records
    };

    saveConfig(persistPath, config);
    res.json(config);
  });

  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Personal profile site running on http://localhost:${port}`);
  });
}

module.exports = { createApp, DEFAULT_CONFIG, ADMIN_PASSWORD };
