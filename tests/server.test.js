const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../server');

const app = createApp({ persistPath: './tmp-site.json' });

test('GET /api/view increments the public view counter', async () => {
  const first = await request(app).get('/api/view');
  assert.equal(first.status, 200);
  assert.ok(Number.isInteger(first.body.viewCount));
  assert.ok(first.body.viewCount >= 1);

  const second = await request(app).get('/api/view');
  assert.equal(second.status, 200);
  assert.ok(second.body.viewCount >= first.body.viewCount);
});

test('POST /api/site saves custom site settings with the right password', async () => {
  const payload = {
    profile: {
      name: 'Nova Vale',
      tagline: 'Sound + style'
    },
    theme: {
      primary: '#ff4d6d',
      accent: '#f7b801'
    }
  };

  const res = await request(app)
    .post('/api/site')
    .set('x-admin-password', '335Jp077')
    .send(payload);

  assert.equal(res.status, 200);
  assert.equal(res.body.profile.name, 'Nova Vale');
  assert.equal(res.body.theme.primary, '#ff4d6d');
});

test('POST /api/site returns a JSON error for malformed request bodies', async () => {
  const res = await request(app)
    .post('/api/site')
    .set('x-admin-password', '335Jp077')
    .set('Content-Type', 'application/json')
    .send('{bad json');

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Invalid JSON payload');
});

test('POST /api/social persists shared followers and chat messages', async () => {
  const payload = {
    social: {
      followers: 42,
      messages: [{ sender: 'Guest #1234', text: 'hello world', time: '9:00 PM' }]
    }
  };

  const res = await request(app)
    .post('/api/social')
    .send(payload);

  assert.equal(res.status, 200);
  assert.equal(res.body.followers, 42);
  assert.equal(res.body.messages.length, 1);

  const site = await request(app).get('/api/site');
  assert.equal(site.status, 200);
  assert.equal(site.body.social.followers, 42);
  assert.equal(site.body.social.messages[0].text, 'hello world');
});
