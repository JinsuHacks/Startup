const state = {
  config: null,
  adminOpen: false,
  adminAuthenticated: false,
  currentTrackIndex: 0,
  followers: 0,
  hasFollowed: false,
  visitorName: '',
  chatMessages: []
};

function getLocalStorageValue(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function setLocalStorageValue(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (error) {
    // no-op if storage is unavailable
  }
}

async function fetchSocialState() {
  try {
    const response = await fetch('/api/social');
    if (!response.ok) return { followers: 0, messages: [] };
    const data = await response.json();
    return {
      followers: Number(data.followers || 0),
      messages: Array.isArray(data.messages) ? data.messages : []
    };
  } catch (error) {
    return { followers: 0, messages: [] };
  }
}

async function saveSocialState(update) {
  try {
    const response = await fetch('/api/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

function getFollowerCount() {
  const value = Number(getLocalStorageValue('profile-follow-count', '0'));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function getChatMessages() {
  try {
    const saved = JSON.parse(getLocalStorageValue('profile-chat-board', '[]'));
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

function saveChatMessages(messages) {
  setLocalStorageValue('profile-chat-board', JSON.stringify(messages));
}

function randomVisitorName() {
  return `Guest #${Math.floor(1000 + Math.random() * 9000)}`;
}

function getCurrentChatName() {
  if (state.adminAuthenticated) return 'Jinsu 👑';
  if (!state.visitorName) state.visitorName = randomVisitorName();
  return state.visitorName;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeLibraryTracks(records) {
  const trackList = Array.isArray(records) ? records : [];
  return Array.from({ length: 5 }, (_, index) => {
    const item = trackList[index] || {};
    return {
      title: item.title || `Track ${index + 1}`,
      artist: item.artist || 'Artist',
      cover: item.cover || '',
      src: item.src || '',
      genre: item.genre || 'Upload',
      slot: index + 1
    };
  });
}

function applyTrackToPlayer(track) {
  if (!track) return;

  const titleEl = document.querySelector('.now-playing h3');
  const artistEl = document.querySelector('.now-playing p');
  const albumArt = document.querySelector('.album-art');
  const audio = document.querySelector('audio');

  if (titleEl) titleEl.textContent = track.title || 'Now Playing';
  if (artistEl) artistEl.textContent = track.artist || 'Your favorite artist';

  if (albumArt) {
    albumArt.innerHTML = track.cover
      ? `<img src="${track.cover}" alt="album cover" />`
      : '';
  }

  if (audio && track.src) {
    audio.src = track.src;
    audio.load();
    audio.play().catch(() => {});
  }
}

function playTrack(index) {
  const tracks = normalizeLibraryTracks((state.config || {}).records);
  const track = tracks[index];
  if (!track || !track.src) return;

  state.currentTrackIndex = index;
  applyTrackToPlayer(track);
}

async function fetchSite() {
  const response = await fetch('/api/site');
  const data = await response.json();
  state.config = data;
  render();
}

function updateTheme(config) {
  const root = document.documentElement;
  const theme = config.theme || {};
  const backgroundColor = theme.background || '#09090f';
  const backgroundImage = theme.backgroundImage ? `url("${theme.backgroundImage}")` : 'none';

  root.style.setProperty('--primary', theme.primary || '#8a2be2');
  root.style.setProperty('--accent', theme.accent || '#f72585');
  root.style.setProperty('--background', backgroundColor);
  root.style.setProperty('--surface', theme.surface || '#171827');
  root.style.setProperty('--text', theme.text || '#f5f5f7');

  document.body.style.background = backgroundImage !== 'none'
    ? `radial-gradient(circle at top, rgba(138,43,226,0.25), transparent 35%), linear-gradient(135deg, ${backgroundColor}, #10131d 35%, #0b0c12 100%), url("${theme.backgroundImage}") center/cover fixed no-repeat`
    : `radial-gradient(circle at top, rgba(138,43,226,0.25), transparent 35%), linear-gradient(135deg, ${backgroundColor}, #10131d 35%, #0b0c12 100%)`;

  if (config.cursor && config.cursor.enabled && config.cursor.url) {
    document.body.style.cursor = `url('${config.cursor.url}'), auto`;
  } else {
    document.body.style.cursor = 'auto';
  }

  if (config.customCss) {
    const existing = document.getElementById('custom-theme-style');
    if (existing) existing.remove();
    const tag = document.createElement('style');
    tag.id = 'custom-theme-style';
    tag.textContent = config.customCss;
    document.head.appendChild(tag);
  }
}

async function syncSocialState() {
  const socialState = await fetchSocialState();
  state.followers = Number(socialState.followers || 0);
  state.chatMessages = Array.isArray(socialState.messages) ? socialState.messages : [];
  saveChatMessages(state.chatMessages);

  const followButton = document.querySelector('[data-follow-button]');
  if (followButton) {
    followButton.textContent = `${state.hasFollowed ? 'Following' : 'Follow'} • ${state.followers}`;
  }
}

async function render() {
  state.hasFollowed = getLocalStorageValue('profile-followed-by-me', 'false') === 'true';
  await syncSocialState();
  state.visitorName = state.visitorName || randomVisitorName();

  const config = state.config || {};
  updateTheme(config);

  const sections = config.sections || {};
  const tracks = normalizeLibraryTracks(config.records);
  const bannerStyle = config.profile?.banner ? `style="background-image: linear-gradient(135deg, rgba(16,18,21,0.15), rgba(16,18,21,0.5)), url('${config.profile.banner}'); background-size: cover; background-position: center;"` : '';

  document.getElementById('app').innerHTML = `
    <div class="profile-shell">
      <header class="hero card">
        <div class="hero-banner" ${bannerStyle}></div>
        <div class="hero-content">
          <div class="avatar-wrap">
            ${config.profile?.avatar ? `<img src="${config.profile.avatar}" alt="avatar" />` : '<div style="font-size: 2rem;">★</div>'}
          </div>
          <div class="hero-meta">
            <div class="tag">${config.profile?.tagline || 'Creative profile'}</div>
            <h1>${config.profile?.name || 'Your Name'}</h1>
            <p>${config.profile?.bio || 'A personal site for sharing your art, music, and vibe.'}</p>
            <div class="stats-row">
              <span class="stat-pill">Views: ${config.stats?.viewCount || 1}</span>
              <span class="stat-pill">${config.profile?.location || 'Somewhere online'}</span>
              <span class="stat-pill status-pill">${config.profile?.status || 'Available'}</span>
            </div>
          </div>
        </div>
      </header>

      <div class="grid">
        <main>
          <section class="content-card card ${sections.about === false ? 'hidden' : ''}">
            <h2>About</h2>
            <div class="bio">${config.profile?.bio || 'This profile is ready for a personal story, social links, creative projects, and a deeper look into who you are.'}</div>
          </section>

          <section class="content-card card ${sections.music === false ? 'hidden' : ''}">
            <div class="music-panel">
              <h2>Now Playing</h2>
              <div class="record-player">
                <div class="album-art pulse-ring">
                  ${config.music?.cover ? `<img src="${config.music.cover}" alt="album cover" />` : ''}
                </div>
                <div class="now-playing">
                  <h3>${config.music?.title || 'Now Playing'}</h3>
                  <p>${config.music?.artist || 'Your favorite artist'}</p>
                  <div class="audio-controls">
                    <audio controls ${config.music?.src ? `src="${config.music.src}"` : ''}></audio>
                  </div>
                </div>
              </div>
            </div>
            <div class="library">
              ${tracks.map((track) => `
                <button class="track-item animated-track" type="button" data-track-src="${track.src || ''}" data-slot-index="${track.slot - 1}" style="display:flex; align-items:center; gap:12px; text-align:left;">
                  <div class="album-mini" style="width:52px; height:52px; border-radius:50%; overflow:hidden; background: rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    ${track.cover ? `<img src="${track.cover}" alt="${track.title || 'track cover'}" style="width:100%; height:100%; object-fit:cover;" />` : '<span style="font-size: 1.2rem;">♫</span>'}
                  </div>
                  <div class="track-meta" style="flex:1; min-width:0;">
                    <strong>${track.title || 'Empty slot'}</strong>
                    <small>${track.artist || 'Artist'}</small>
                  </div>
                  <span>${track.genre || 'Slot ' + track.slot}</span>
                </button>
              `).join('') || '<div class="widget-item">No tracks in the library yet.</div>'}
            </div>
          </section>

          <section class="content-card card ${sections.widgets === false ? 'hidden' : ''}">
            <h2>Widgets</h2>
            <div class="widget-list">
              ${(config.widgets || []).map((widget) => `
                <div class="widget-item floating-widget">
                  <strong>${widget.title || 'Widget'}</strong>
                  ${widget.content || 'Fresh update'}
                </div>
              `).join('') || '<div class="widget-item">No widgets added yet.</div>'}
            </div>
          </section>
        </main>

        <aside class="sidebar">
          <section class="content-card card ${sections.contact === false ? 'hidden' : ''}">
            <h2>Quick Info</h2>
            <div class="bio">
              <div>Location: ${config.profile?.location || 'Somewhere online'}</div>
              <div style="margin-top: 8px;">Status: ${config.profile?.status || 'Available'}</div>
              <div style="margin-top: 8px;">Favorite vibe: ${config.profile?.tagline || 'Creative profile'}</div>
            </div>
            <div class="profile-links">
              <button class="action-button" type="button" data-follow-button>
                ${state.hasFollowed ? `Following • ${state.followers}` : `Follow • ${state.followers}`}
              </button>
              <button class="action-button" type="button" data-message-button>Message</button>
            </div>
          </section>

          <section class="content-card card ${sections.library === false ? 'hidden' : ''}">
            <h2>Library</h2>
            <div class="library">
              ${tracks.map((track) => `
                <div class="track-item">
                  <div class="track-meta">
                    <strong>${track.title || 'Empty slot'}</strong>
                    <small>${track.artist || 'Artist'}</small>
                  </div>
                  <span>${track.genre || 'Slot ' + track.slot}</span>
                </div>
              `).join('') || '<div class="widget-item">The library is empty.</div>'}
            </div>
          </section>
        </aside>
      </div>

      <div class="footer-note">Personal profile • Built for a public-facing identity with private editing controls.</div>
    </div>
  `;

  const buttons = document.querySelectorAll('[data-track-src]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const url = button.getAttribute('data-track-src');
      if (!url) return;
      const index = Number(button.dataset.slotIndex || 0);
      playTrack(index);
    });
  });

  const audio = document.querySelector('audio');
  if (audio) {
    const albumArt = document.querySelector('.album-art');
    const activateAlbumArt = () => {
      if (albumArt) albumArt.classList.add('is-playing');
    };
    const deactivateAlbumArt = () => {
      if (albumArt) albumArt.classList.remove('is-playing');
    };

    audio.addEventListener('play', activateAlbumArt);
    audio.addEventListener('pause', deactivateAlbumArt);
    audio.addEventListener('ended', deactivateAlbumArt);

    const firstAvailableTrack = tracks.findIndex((track) => Boolean(track.src));
    if (firstAvailableTrack >= 0) {
      const firstTrack = tracks[firstAvailableTrack];
      state.currentTrackIndex = firstAvailableTrack;
      applyTrackToPlayer(firstTrack);
    }
  }

  const adminButton = document.getElementById('admin-button');
  if (adminButton) {
    adminButton.addEventListener('click', () => {
      if (!state.adminAuthenticated) {
        showAdminPasswordModal();
        return;
      }

      state.adminOpen = true;
      const panel = document.getElementById('admin-panel');
      if (panel) panel.classList.remove('hidden');
    });
  }

  const followButton = document.querySelector('[data-follow-button]');
  if (followButton) {
    followButton.addEventListener('click', async () => {
      if (state.hasFollowed) {
        followButton.textContent = `Following • ${state.followers}`;
        return;
      }

      state.hasFollowed = true;
      const next = await saveSocialState({ action: 'follow' });
      if (next && Number.isFinite(Number(next.followers))) {
        state.followers = Number(next.followers);
      } else {
        state.followers += 1;
      }
      setLocalStorageValue('profile-followed-by-me', 'true');
      setLocalStorageValue('profile-follow-count', String(state.followers));
      followButton.textContent = `Following • ${state.followers}`;
    });
  }

  const messageButton = document.querySelector('[data-message-button]');
  if (messageButton) {
    messageButton.addEventListener('click', () => openChatBoard());
  }

  // trigger first visit counter on public page load
  fetch('/api/view').then((res) => res.json()).catch(() => {});
}

async function openChatBoard() {
  const overlay = document.createElement('div');
  overlay.className = 'admin-modal';

  const socialState = await fetchSocialState();
  const messages = Array.isArray(socialState.messages) ? socialState.messages : [];
  const currentUser = getCurrentChatName();
  const isAdminUser = currentUser === 'Jinsu 👑';

  overlay.innerHTML = `
    <div class="admin-modal-card chatboard-modal">
      <div class="chatboard-header">
        <div>
          <h2>Community Chat</h2>
          <p>Visitors chat here.</p>
        </div>
        <button class="action-button" type="button" id="chat-close">Close</button>
      </div>
      <div class="chat-window">
        ${messages.length ? messages.map((message) => {
          const isSelf = message.sender === currentUser;
          const senderColor = message.sender === 'Jinsu 👑' ? '#f4d35e' : isSelf ? '#8ecae6' : '#d7d9e8';
          return `
            <div class="chat-message ${isSelf ? 'self' : ''}">
              <div class="chat-meta">
                <span style="color: ${senderColor};">${escapeHtml(message.sender)}</span>
                <small>${escapeHtml(message.time)}</small>
              </div>
              <div class="chat-body">${escapeHtml(message.text)}</div>
            </div>
          `;
        }).join('') : '<div class="chat-empty">No messages yet. Say hi.</div>'}
      </div>
      <form id="chat-form" class="chat-form">
        <input id="chat-input" type="text" maxlength="220" placeholder="Type a message..." />
        <button class="action-button" type="submit">Send</button>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const form = overlay.querySelector('#chat-form');
  const input = overlay.querySelector('#chat-input');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const payload = {
      action: 'message',
      sender: currentUser,
      message: text,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    };

    const next = await saveSocialState(payload);
    if (next && Array.isArray(next.messages)) {
      state.chatMessages = next.messages;
      saveChatMessages(next.messages);
    } else {
      const nextMessages = [...getChatMessages(), {
        sender: currentUser,
        text,
        time: payload.time
      }];
      state.chatMessages = nextMessages;
      saveChatMessages(nextMessages);
    }
    overlay.remove();
    openChatBoard();
  });

  overlay.querySelector('#chat-close').addEventListener('click', () => overlay.remove());
  input.focus();
}

function showAdminPasswordModal() {
  const modal = document.getElementById('password-modal');
  if (modal) {
    modal.classList.remove('hidden');
    const input = modal.querySelector('input');
    if (input) input.focus();
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'password-modal';
  overlay.className = 'admin-modal';
  overlay.innerHTML = `
    <div class="admin-modal-card card">
      <h2>Private access</h2>
      <p>Enter your private admin password to unlock customization.</p>
      <input id="admin-password-input" type="password" placeholder="Password" />
      <div class="admin-modal-actions">
        <button class="action-button" type="button" id="password-submit">Unlock</button>
        <button class="action-button" type="button" id="password-cancel">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = overlay.querySelector('#admin-password-input');
  input.focus();

  overlay.querySelector('#password-submit').addEventListener('click', () => {
    const value = input.value.trim();
    if (value === '335Jp077') {
      state.adminAuthenticated = true;
      state.adminOpen = true;
      overlay.classList.add('hidden');
      const panel = document.getElementById('admin-panel');
      if (panel) panel.classList.remove('hidden');
      return;
    }
    input.value = '';
    input.placeholder = 'Incorrect password';
    input.style.borderColor = '#ff6b6b';
  });

  overlay.querySelector('#password-cancel').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      overlay.querySelector('#password-submit').click();
    }
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function createImageEditor(file, { aspect = 1, outputName, onApply }) {
  if (!file) return;

  const overlay = document.createElement('div');
  overlay.className = 'admin-modal';

  const modal = document.createElement('div');
  modal.className = 'admin-modal-card card';
  modal.innerHTML = `
    <h2>Crop & rotate</h2>
    <p>Adjust the crop and rotation before applying.</p>
    <div style="display:grid; gap:10px; margin-bottom: 14px;">
      <canvas id="edit-canvas" style="width:100%; max-height:300px; border-radius: 14px; background: rgba(255,255,255,0.03);"></canvas>
      <label>Rotate: <input id="rotate-range" type="range" min="-180" max="180" value="0" /></label>
      <label>Zoom: <input id="zoom-range" type="range" min="0.8" max="2" step="0.01" value="1" /></label>
      <label>Horizontal crop: <input id="crop-x-range" type="range" min="0" max="100" value="50" /></label>
      <label>Vertical crop: <input id="crop-y-range" type="range" min="0" max="100" value="50" /></label>
    </div>
    <div class="admin-modal-actions">
      <button class="action-button" type="button" id="apply-image-edit">Apply</button>
      <button class="action-button" type="button" id="cancel-image-edit">Cancel</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const canvas = modal.querySelector('#edit-canvas');
  const ctx = canvas.getContext('2d');
  const rotateRange = modal.querySelector('#rotate-range');
  const zoomRange = modal.querySelector('#zoom-range');
  const cropXRange = modal.querySelector('#crop-x-range');
  const cropYRange = modal.querySelector('#crop-y-range');

  const image = new Image();
  image.onload = () => {
    const render = () => {
      const targetWidth = 700;
      const targetHeight = Math.round(targetWidth / aspect);
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#131824';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const zoom = Number(zoomRange.value);
      const rotate = Number(rotateRange.value);
      const cropX = Number(cropXRange.value) / 100;
      const cropY = Number(cropYRange.value) / 100;

      const sourceWidth = image.width / zoom;
      const sourceHeight = image.height / zoom;
      const x = (image.width - sourceWidth) * cropX;
      const y = (image.height - sourceHeight) * cropY;
      const drawScale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
      const drawW = sourceWidth * drawScale;
      const drawH = sourceHeight * drawScale;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.drawImage(image, x, y, sourceWidth, sourceHeight, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    };

    [rotateRange, zoomRange, cropXRange, cropYRange].forEach((input) => {
      input.addEventListener('input', render);
    });

    render();
  };

  image.src = URL.createObjectURL(file);

  modal.querySelector('#apply-image-edit').addEventListener('click', () => {
    const dataUrl = canvas.toDataURL(file.type || 'image/png');
    if (typeof onApply === 'function') {
      onApply(dataUrl, outputName);
    }
    overlay.remove();
  });

  modal.querySelector('#cancel-image-edit').addEventListener('click', () => {
    overlay.remove();
  });
}

async function loadAdmin() {
  const panel = document.createElement('div');
  panel.id = 'admin-panel';
  panel.className = state.adminOpen ? '' : 'hidden';
  panel.innerHTML = `
    <div class="card content-card" style="margin-top: 24px; max-width: 900px; margin-inline: auto;">
      <h2>Customize Your Profile</h2>
      <form id="admin-form">
        <div style="display:grid; gap:14px;">
          <label>Name <input name="profile.name" value="${state.config?.profile?.name || ''}" /></label>
          <label>Tagline <input name="profile.tagline" value="${state.config?.profile?.tagline || ''}" /></label>
          <label>Bio <textarea name="profile.bio">${state.config?.profile?.bio || ''}</textarea></label>
          <label>Location <input name="profile.location" value="${state.config?.profile?.location || ''}" /></label>
          <label>Status <input name="profile.status" value="${state.config?.profile?.status || 'Available'}" /></label>
          <label>Avatar image <input type="file" data-edit-target="profile.avatar" data-aspect="1" name="profile.avatarFile" accept="image/*" /></label>
          <label>Avatar URL <input name="profile.avatar" value="${state.config?.profile?.avatar || ''}" /></label>
          <label>Banner image <input type="file" data-edit-target="profile.banner" data-aspect="1.8" name="profile.bannerFile" accept="image/*" /></label>
          <label>Banner URL <input name="profile.banner" value="${state.config?.profile?.banner || ''}" /></label>
          <label>Primary Color <input type="color" name="theme.primary" value="${state.config?.theme?.primary || '#8a2be2'}" /></label>
          <label>Accent Color <input type="color" name="theme.accent" value="${state.config?.theme?.accent || '#f72585'}" /></label>
          <label>Background Color <input type="color" name="theme.background" value="${state.config?.theme?.background || '#09090f'}" /></label>
          <label>Background Image URL <input name="theme.backgroundImage" value="${state.config?.theme?.backgroundImage || ''}" /></label>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">
            <label><input type="checkbox" name="sections.about" ${state.config?.sections?.about !== false ? 'checked' : ''} /> About</label>
            <label><input type="checkbox" name="sections.music" ${state.config?.sections?.music !== false ? 'checked' : ''} /> Music</label>
            <label><input type="checkbox" name="sections.library" ${state.config?.sections?.library !== false ? 'checked' : ''} /> Library</label>
            <label><input type="checkbox" name="sections.widgets" ${state.config?.sections?.widgets !== false ? 'checked' : ''} /> Widgets</label>
            <label><input type="checkbox" name="sections.contact" ${state.config?.sections?.contact !== false ? 'checked' : ''} /> Contact</label>
          </div>
          <label>Music Title <input name="music.title" value="${state.config?.music?.title || ''}" /></label>
          <label>Artist <input name="music.artist" value="${state.config?.music?.artist || ''}" /></label>
          <label>Music cover image <input type="file" data-edit-target="music.cover" data-aspect="1" name="music.coverFile" accept="image/*" /></label>
          <label>Music cover URL <input name="music.cover" value="${state.config?.music?.cover || ''}" /></label>
          <label>Music file <input type="file" name="music.srcFile" accept="audio/*" /></label>
          <label>Music source URL <input name="music.src" value="${state.config?.music?.src || ''}" /></label>
          ${Array.from({ length: 5 }, (_, index) => {
            const track = normalizeLibraryTracks(state.config?.records)[index] || {};
            return `
              <div style="border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 14px; background: rgba(255,255,255,0.02);">
                <h3 style="margin: 0 0 12px;">Slot ${index + 1}</h3>
                <label>Track ${index + 1} name <input name="slot${index + 1}.title" value="${track.title || ''}" /></label>
                <label>Artist <input name="slot${index + 1}.artist" value="${track.artist || ''}" /></label>
                <label>Cover image <input type="file" data-edit-target="slot${index + 1}.cover" data-aspect="1" name="slot${index + 1}.coverFile" accept="image/*" /></label>
                <label>Cover URL <input name="slot${index + 1}.cover" value="${track.cover || ''}" /></label>
                <label>Audio file <input type="file" name="slot${index + 1}.file" accept="audio/*" /></label>
                <label>Audio URL <input name="slot${index + 1}.src" value="${track.src || ''}" /></label>
              </div>
            `;
          }).join('')}
          <label>Cursor file <input type="file" name="cursor.file" accept="image/*,.cur,.ico" /></label>
          <label>Cursor URL <input name="cursor.url" value="${state.config?.cursor?.url || ''}" /></label>
          <label>Widgets JSON <textarea name="widgets">${JSON.stringify(state.config?.widgets || [], null, 2)}</textarea></label>
          <label>Custom CSS <textarea name="customCss">${state.config?.customCss || ''}</textarea></label>
          <label>Private password <input name="password" type="password" value="335Jp077" /></label>
          <div style="display:flex; gap:12px; flex-wrap: wrap;">
            <button class="action-button" type="submit">Save changes</button>
            <button class="action-button" type="button" id="close-admin">Close</button>
          </div>
        </div>
      </form>
    </div>
  `;

  const oldPanel = document.getElementById('admin-panel');
  if (oldPanel) oldPanel.remove();
  document.getElementById('app').appendChild(panel);

  const closeButton = document.getElementById('close-admin');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      state.adminOpen = false;
      panel.classList.add('hidden');
    });
  }

  panel.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) return;
      const target = input.dataset.editTarget || '';
      if (!target) return;

      const aspect = Number(input.dataset.aspect || 1);
      createImageEditor(file, {
        aspect,
        outputName: target,
        onApply: (dataUrl) => {
          const field = panel.querySelector(`[name="${target}"]`);
          if (field) field.value = dataUrl;
        }
      });
    });
  });

  panel.querySelector('#admin-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const password = formData.get('password') || '';
    const profileAvatarFile = formData.get('profile.avatarFile');
    const bannerFile = formData.get('profile.bannerFile');
    const musicCoverFile = formData.get('music.coverFile');
    const musicSrcFile = formData.get('music.srcFile');
    const cursorFile = formData.get('cursor.file');

    try {
      const [profileAvatar, profileBanner, musicCover, musicSrc, cursorData] = await Promise.all([
        readFileAsDataUrl(profileAvatarFile && profileAvatarFile.size ? profileAvatarFile : null),
        readFileAsDataUrl(bannerFile && bannerFile.size ? bannerFile : null),
        readFileAsDataUrl(musicCoverFile && musicCoverFile.size ? musicCoverFile : null),
        readFileAsDataUrl(musicSrcFile && musicSrcFile.size ? musicSrcFile : null),
        readFileAsDataUrl(cursorFile && cursorFile.size ? cursorFile : null)
      ]);

      const records = [];
      for (let index = 1; index <= 5; index += 1) {
        const file = formData.get(`slot${index}.file`);
        const coverFile = formData.get(`slot${index}.coverFile`);
        const title = formData.get(`slot${index}.title`) || '';
        const artist = formData.get(`slot${index}.artist`) || '';
        const coverSource = formData.get(`slot${index}.cover`) || '';
        const srcSource = formData.get(`slot${index}.src`) || '';

        const coverValue = coverFile && coverFile.size ? await readFileAsDataUrl(coverFile) : coverSource;
        const srcValue = file && file.size ? await readFileAsDataUrl(file) : srcSource;

        if (!srcValue && !coverValue && !title && !artist) {
          continue;
        }

        records.push({
          title: title || `Track ${index}`,
          artist: artist || 'Artist',
          cover: coverValue || '',
          src: srcValue || '',
          genre: 'Upload'
        });
      }

      if (!records.length && state.config?.records?.length) {
        records.push(...state.config.records.filter((item) => item && (item.src || item.cover || item.title || item.artist)));
      }

      const existingProfile = state.config?.profile || {};
      const existingTheme = state.config?.theme || {};
      const existingMusic = state.config?.music || {};
      const existingCursor = state.config?.cursor || {};
      const existingWidgets = Array.isArray(state.config?.widgets) ? state.config.widgets : [];

      const profilePayload = {
        name: formData.get('profile.name') || existingProfile.name || '',
        tagline: formData.get('profile.tagline') || existingProfile.tagline || '',
        bio: formData.get('profile.bio') || existingProfile.bio || '',
        location: formData.get('profile.location') || existingProfile.location || '',
        status: formData.get('profile.status') || existingProfile.status || 'Available'
      };

      if (profileAvatarFile && profileAvatarFile.size) {
        profilePayload.avatar = profileAvatar;
      } else if (String(formData.get('profile.avatar') || '').trim() && String(formData.get('profile.avatar')) !== (existingProfile.avatar || '')) {
        profilePayload.avatar = String(formData.get('profile.avatar'));
      }

      if (bannerFile && bannerFile.size) {
        profilePayload.banner = profileBanner;
      } else if (String(formData.get('profile.banner') || '').trim() && String(formData.get('profile.banner')) !== (existingProfile.banner || '')) {
        profilePayload.banner = String(formData.get('profile.banner'));
      }

      const themePayload = {
        primary: formData.get('theme.primary') || existingTheme.primary || '#8a2be2',
        accent: formData.get('theme.accent') || existingTheme.accent || '#f72585',
        background: formData.get('theme.background') || existingTheme.background || '#09090f',
        backgroundImage: formData.get('theme.backgroundImage') || existingTheme.backgroundImage || ''
      };

      const musicPayload = {
        title: formData.get('music.title') || existingMusic.title || '',
        artist: formData.get('music.artist') || existingMusic.artist || ''
      };

      if (musicCoverFile && musicCoverFile.size) {
        musicPayload.cover = musicCover;
      } else if (String(formData.get('music.cover') || '').trim() && String(formData.get('music.cover')) !== (existingMusic.cover || '')) {
        musicPayload.cover = String(formData.get('music.cover'));
      }

      if (musicSrcFile && musicSrcFile.size) {
        musicPayload.src = musicSrc;
      } else if (String(formData.get('music.src') || '').trim() && String(formData.get('music.src')) !== (existingMusic.src || '')) {
        musicPayload.src = String(formData.get('music.src'));
      }

      const cursorPayload = {
        enabled: Boolean(cursorData || formData.get('cursor.url')),
        url: cursorData || String(formData.get('cursor.url') || existingCursor.url || '')
      };

      const payload = {
        profile: profilePayload,
        theme: themePayload,
        music: musicPayload,
        cursor: cursorPayload,
        sections: {
          about: formData.get('sections.about') !== null,
          music: formData.get('sections.music') !== null,
          library: formData.get('sections.library') !== null,
          widgets: formData.get('sections.widgets') !== null,
          contact: formData.get('sections.contact') !== null
        },
        customCss: formData.get('customCss') || state.config?.customCss || '',
        password
      };

      if (records.length) {
        payload.records = records;
      }

      const widgetsInput = String(formData.get('widgets') || '').trim();
      if (widgetsInput) {
        payload.widgets = sanitizeJson(widgetsInput, existingWidgets);
      }

      const response = await fetch('/api/site', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let data = null;
      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch (error) {
        throw new Error(responseText || 'Saving failed');
      }

      if (!response.ok) {
        alert(data?.error || 'Saving failed');
        return;
      }

      state.config = data;
      state.adminOpen = false;
      render();
      loadAdmin();
    } catch (error) {
      alert(error.message || 'File upload failed');
    }
  });
}

function sanitizeJson(value, fallback) {
  try {
    if (!value || !String(value).trim()) return fallback;
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
}

(async function init() {
  await fetchSite();
  const adminButton = document.createElement('button');
  adminButton.id = 'admin-button';
  adminButton.className = 'action-button';
  adminButton.style.position = 'fixed';
  adminButton.style.right = '20px';
  adminButton.style.bottom = '20px';
  adminButton.textContent = 'Private Edit';
  adminButton.addEventListener('click', () => {
    if (!state.adminAuthenticated) {
      showAdminPasswordModal();
      return;
    }

    state.adminOpen = true;
    const panel = document.getElementById('admin-panel');
    if (panel) panel.classList.remove('hidden');
    else loadAdmin();
  });
  document.body.appendChild(adminButton);
  loadAdmin();
  setInterval(() => {
    syncSocialState();
  }, 4000);
})();
