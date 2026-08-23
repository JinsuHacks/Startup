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
