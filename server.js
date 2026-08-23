const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '335Jp077';
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
  socialLinks: [],
  social: {
    followers: 0,
    messages: []
  },
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
      social: { ...DEFAULT_CONFIG.social, ...(parsed.social || {}) },
      socialLinks: Array.isArray(parsed.socialLinks) ? parsed.socialLinks : DEFAULT_CONFIG.socialLinks,
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
  const dataDirectory = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
  const persistPath = options.persistPath || path.join(dataDirectory, 'site-config.json');
  const app = express();

  app.use(express.json({ limit: '100mb', strict: true }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));
  app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    return next(error);
  });
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

  app.get('/api/social', (req, res) => {
    config = readConfig(persistPath);
    const social = config.social || { followers: 0, messages: [] };
    res.json({
      followers: Number(social.followers || 0),
      messages: Array.isArray(social.messages) ? social.messages : []
    });
  });

  app.post('/api/social', (req, res) => {
    config = readConfig(persistPath);
    const social = config.social || { followers: 0, messages: [] };
    const current = {
      followers: Number(social.followers || 0),
      messages: Array.isArray(social.messages) ? social.messages : []
    };

    const payload = req.body || {};
    const socialPayload = payload.social || payload;
    let nextFollowers = current.followers;
    let nextMessages = current.messages;

    if (typeof socialPayload.followers === 'number') {
      nextFollowers = socialPayload.followers;
    } else if (payload.action === 'follow') {
      nextFollowers += 1;
    }

    if (Array.isArray(socialPayload.messages)) {
      nextMessages = socialPayload.messages;
    } else if (payload.action === 'message' && payload.message) {
      nextMessages = [...nextMessages, {
        sender: payload.sender || 'Guest',
        text: String(payload.message).slice(0, 220),
        time: payload.time || new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      }];
    }

    config.social = {
      followers: nextFollowers,
      messages: nextMessages
    };

    saveConfig(persistPath, config);
    res.json({ followers: nextFollowers, messages: nextMessages });
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
      social: { ...config.social, ...(incoming.social || {}) },
      socialLinks: Array.isArray(incoming.socialLinks) ? incoming.socialLinks : config.socialLinks,
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
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`Personal profile site running on http://localhost:${port}`);
  });
}

module.exports = { createApp, DEFAULT_CONFIG, ADMIN_PASSWORD };
