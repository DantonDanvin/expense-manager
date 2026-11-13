// Google Drive as the database: OAuth (Google Identity Services) + Drive REST v3.
// Scope `drive.file` = the app can only see files it created itself.

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const FOLDER_NAME = 'Kharcha';
const FILE_NAME = 'kharcha-data.json';
const SS_TOKEN = 'kharcha:token';
const LS_USER = 'kharcha:user';

let clientId = '';
let tokenClient = null;
let token = null;
let tokenExp = 0;
let user = null;
let fileId = null;
let folderId = null;
let status = 'off'; // off | connecting | connected | syncing | error | reconnect
let statusDetail = '';
const listeners = new Set();

const setStatus = (s, detail = '') => { status = s; statusDetail = detail; listeners.forEach((fn) => fn(s, detail)); };
export const onStatus = (fn) => { listeners.add(fn); fn(status, statusDetail); return () => listeners.delete(fn); };
export const getStatus = () => status;
export const getStatusDetail = () => statusDetail;
export const getUser = () => user;
export const isConfigured = () => !!clientId;
export const isConnected = () => !!token && Date.now() < tokenExp;
export const wasConnected = () => !!localStorage.getItem(LS_USER);
export const fileName = () => `${FOLDER_NAME}/${FILE_NAME}`;

export function configure(id) {
  clientId = (id || '').trim();
  tokenClient = null;
}

export function restoreSession() {
  try { const u = localStorage.getItem(LS_USER); if (u) user = JSON.parse(u); } catch { /* ignore */ }
  try {
    const t = JSON.parse(sessionStorage.getItem(SS_TOKEN) || 'null');
    if (t && t.tokenExp > Date.now() + 30000) { token = t.token; tokenExp = t.tokenExp; setStatus('connected'); return true; }
  } catch { /* ignore */ }
  if (user) setStatus('reconnect');
  return false;
}

const gis = () => window.google?.accounts?.oauth2;
export function waitForGIS(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function poll() {
      if (gis()) return resolve(gis());
      if (Date.now() - t0 > timeout) return reject(new Error('Google sign-in library did not load. Check your internet connection or ad blocker.'));
      setTimeout(poll, 100);
    })();
  });
}

export async function signIn({ silent = false } = {}) {
  if (!clientId) throw new Error('Google Client ID is not set. Add it in Settings → Google Drive.');
  await waitForGIS();
  setStatus('connecting');
  return new Promise((resolve, reject) => {
    tokenClient = gis().initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) { setStatus(user ? 'reconnect' : 'off', resp.error); return reject(new Error(resp.error_description || resp.error)); }
        token = resp.access_token;
        tokenExp = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
        sessionStorage.setItem(SS_TOKEN, JSON.stringify({ token, tokenExp }));
        try { user = await fetchUser(); localStorage.setItem(LS_USER, JSON.stringify(user)); } catch { /* profile is optional */ }
        setStatus('connected');
        resolve(token);
      },
      error_callback: (e) => {
        const msg = e?.type === 'popup_closed' ? 'Sign-in popup was closed' : e?.type === 'popup_failed_to_open' ? 'Popup blocked — allow popups for this site' : (e?.message || e?.type || 'Sign-in failed');
        setStatus(user ? 'reconnect' : 'off', msg);
        reject(new Error(msg));
      },
    });
    tokenClient.requestAccessToken({ prompt: silent ? '' : 'consent', hint: user?.email || undefined });
  });
}

export function signOut() {
  try { if (token && gis()) gis().revoke(token, () => {}); } catch { /* ignore */ }
  token = null; tokenExp = 0; user = null; fileId = null; folderId = null;
  sessionStorage.removeItem(SS_TOKEN); localStorage.removeItem(LS_USER);
  setStatus('off');
}

async function ensureToken() {
  if (isConnected()) return token;
  await signIn({ silent: true });
  return token;
}
async function errText(r) {
  try { const j = await r.json(); return j.error?.message || `${r.status} ${r.statusText}`; } catch { return `${r.status} ${r.statusText}`; }
}
async function api(url, opts = {}, retry = true) {
  const t = await ensureToken();
  const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${t}` } });
  if (r.status === 401 && retry) { token = null; return api(url, opts, false); }
  if (!r.ok) throw new Error(await errText(r));
  return r;
}
async function fetchUser() {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('userinfo failed');
  const j = await r.json();
  return { name: j.name || j.email, email: j.email, picture: j.picture };
}

async function ensureFolder() {
  if (folderId) return folderId;
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const r = await api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`);
  const j = await r.json();
  if (j.files?.length) { folderId = j.files[0].id; return folderId; }
  const c = await api('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  folderId = (await c.json()).id;
  return folderId;
}
async function findFile() {
  if (fileId) return fileId;
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const r = await api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&spaces=drive`);
  const j = await r.json();
  fileId = j.files?.[0]?.id || null;
  return fileId;
}

/** Download the data file from Drive. Returns null when it does not exist yet. */
export async function pull() {
  setStatus('syncing');
  try {
    const id = await findFile();
    if (!id) { setStatus('connected'); return null; }
    const r = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
    const text = await r.text();
    setStatus('connected');
    return text ? JSON.parse(text) : null;
  } catch (e) { setStatus('error', e.message); throw e; }
}

/** Upload (create or overwrite) the data file in Drive. */
export async function push(data) {
  setStatus('syncing');
  try {
    const body = JSON.stringify(data);
    const id = await findFile();
    if (id) {
      await api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    } else {
      const parent = await ensureFolder();
      const meta = { name: FILE_NAME, mimeType: 'application/json', parents: [parent] };
      const boundary = `kharcha_${Date.now()}`;
      const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
      const r = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart,
      });
      fileId = (await r.json()).id;
    }
    setStatus('connected');
  } catch (e) { setStatus('error', e.message); throw e; }
}

export async function fileLink() {
  const id = await findFile();
  return id ? `https://drive.google.com/file/d/${id}/view` : null;
}
