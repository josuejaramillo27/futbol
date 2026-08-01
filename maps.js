import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",
    authDomain: "app-futbol-acd0f.firebaseapp.com",
    projectId: "app-futbol-acd0f",
    storageBucket: "app-futbol-acd0f.firebasestorage.app",
    messagingSenderId: "223446110165",
    appId: "1:223446110165:web:219afce6a9dac03203f75c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const mapEl = document.getElementById('map-canchas');

if (mapEl && window.L) {
    const map = L.map(mapEl, { zoomControl: false, scrollWheelZoom: true, fadeAnimation: true }).setView([-5.1945, -80.6328], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    
    const carto = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 20, attribution: '&copy; OpenStreetMap contributors &copy; CARTO' });
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' });
    
    let fallback = false;
    carto.on('tileerror', () => { if (!fallback) { fallback = true; map.removeLayer(carto); osm.addTo(map); } });
    carto.addTo(map);
    
    const markers = L.layerGroup().addTo(map);
    const userLayer = L.layerGroup().addTo(map);
    const status = document.getElementById('map-status');
    const btn = document.getElementById('btn-mi-ubicacion');
    
    const icon = L.divIcon({ className: 'premium-map-marker', html: '<div><i class="ph-fill ph-soccer-ball"></i></div>', iconSize: [40, 40], iconAnchor: [20, 38], popupAnchor: [0, -38] });
    const userIcon = L.divIcon({ className: 'user-map-marker', html: '<div><span></span></div>', iconSize: [24, 24], iconAnchor: [12, 12] });
    
    const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
    const pad = n => String(n).padStart(2, '0');
    const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
    
    function coords(c) {
        let lat = Number(c.lat), lng = Number(c.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
        const u = String(c.ubicacionLink || '');
        let m = u.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
        if (!m) m = u.match(/[?&](?:q|ll)=(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/);
        return m ? [Number(m[1]), Number(m[2])] : null;
    }
    
    function isOpen(c) {
        if (!c.horaApertura || !c.horaCierre) return false;
        const n = new Date(), now = n.getHours() * 60 + n.getMinutes();
        const [ha, ma] = c.horaApertura.split(':').map(Number), [hc, mc] = c.horaCierre.split(':').map(Number);
        const a = ha * 60 + ma, b = hc * 60 + mc;
        return b > a ? now >= a && now <= b : now >= a || now <= b;
    }
    
    function toMinutes(v) {
        if (typeof v === 'number') return v;
        const m = String(v || '').match(/(\d{1,2}):?(\d{2})?/);
        return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null;
    }
    
    function reservationMatches(r, c) { return String(r.canchaId ?? r.canchaID ?? r.courtId ?? r.cancha ?? '') === String(c.id); }
    function reservationDate(r) { return r.fecha?.toDate ? r.fecha.toDate().toISOString().slice(0, 10) : String(r.fecha ?? r.fechaReserva ?? r.date ?? '').slice(0, 10); }
    function reservationTime(r) { return toMinutes(r.horaInicio ?? r.hora ?? r.horaReserva ?? r.time); }
    
    function buildSlots(c, reservas) {
        const start = toMinutes(c.horaApertura), end = toMinutes(c.horaCierre), step = Number(c.intervaloMinutos || c.duracionReserva || 60);
        if (start === null || end === null || !Number.isFinite(step) || step <= 0) return { html: '<span class="availability-empty">Horario no configurado</span>', count: 0 };
        
        let final = end; if (final <= start) final += 1440;
        const occupied = new Set();
        reservas.filter(r => reservationMatches(r, c) && reservationDate(r) === todayKey() && !['cancelada', 'cancelado', 'cancelled'].includes(String(r.estado || r.status || '').toLowerCase())).forEach(r => { const t = reservationTime(r); if (t !== null) occupied.add(t % 1440); });
        
        const now = new Date(), current = now.getHours() * 60 + now.getMinutes();
        let html = '', available = 0;
        
        for (let t = start; t < final; t += step) {
            const real = t % 1440, label = `${pad(Math.floor(real / 60))}:${pad(real % 60)}`, past = real < current, blocked = occupied.has(real) || past, cls = blocked ? 'busy' : 'free';
            if (!blocked) available++;
            html += `<button type="button" class="availability-slot ${cls}" data-time="${label}" data-id="${escapeHtml(c.id)}" ${blocked ? 'disabled' : ''}>${label}</button>`;
        }
        return { html, count: available };
    }
    
    function popup(c, reservas) {
        const open = isOpen(c), rating = Number(c.ratingPromedio || c.rating || 0), foto = c.fotos?.[0] || 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=500&q=80', slots = buildSlots(c, reservas);
        return `<div class="map-popup premium-popup"><div class="map-popup-cover" style="background-image:url('${escapeHtml(foto)}')"><span class="map-popup-status ${open ? 'open' : 'closed'}"><i class="ph-fill ph-circle"></i> ${open ? 'Abierto ahora' : 'Cerrado'}</span></div><div class="map-popup-body"><strong>${escapeHtml(c.nombre || 'Cancha')}</strong><span class="map-popup-rating"><i class="ph-fill ph-star"></i> ${rating ? rating.toFixed(1) : 'Nuevo'} · ${escapeHtml(c.tipoCancha || c.tipo || 'Fútbol')}</span><span><i class="ph-bold ph-map-pin"></i> ${escapeHtml(c.ubicacionTexto || c.ciudad || 'Ubicación disponible')}</span><div class="map-popup-price">${c.precio != null ? `S/ ${escapeHtml(c.precio)} <small>/ hora</small>` : 'Consultar precio'}</div><div class="availability-head"><span>Horarios de hoy</span><b>${slots.count} disponibles</b></div><div class="availability-grid">${slots.html}</div><small class="availability-note"><i class="ph-bold ph-info"></i> Verde = disponible · Gris = ocupado o ya pasó</small><div class="map-popup-actions"><button type="button" class="map-open-card" data-id="${escapeHtml(c.id)}">Ver cancha</button>${c.ubicacionLink ? `<a href="${escapeHtml(c.ubicacionLink)}" target="_blank" rel="noopener">Ruta <i class="ph-bold ph-arrow-up-right"></i></a>` : ''}</div></div></div>`;
    }
    
    function bindSlots(c) {
        document.querySelectorAll(`.availability-slot.free[data-id="${CSS.escape(c.id)}"]`).forEach(el => el.addEventListener('click', () => {
            const time = el.dataset.time, tel = String(c.whatsapp || '').replace(/\D/g, '');
            if (!tel) { window.abrirModal?.(c.id); return; }
            // ACTUALIZADO PARA CHALACAPP
            const msg = `Hola ${c.nombre}, vengo de CHALACAPP. Quiero reservar la cancha hoy a las ${time}. ¿Está disponible?`;
            window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
        }));
    }

    async function cargar() {
        try { // <- ¡AQUÍ ESTÁ EL TRY QUE INICIA!
            const [snap, resSnap] = await Promise.all([getDocs(collection(db, 'canchas')), getDocs(collection(db, 'reservas')).catch(() => null)]);
            const reservas = resSnap ? resSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
            const bounds = [];
            
            snap.forEach(ds => {
                const c = { id: ds.id, ...ds.data() };
                if (c.estadoPublicacion !== 'published' && c.configurado !== true) return;
                const pos = coords(c);
                if (!pos) return;
                
                const marker = L.marker(pos, { icon }).bindPopup(popup(c, reservas), { maxWidth: 290, minWidth: 240 });
                marker.on('popupopen', () => {
                    bindSlots(c);
                    const el = document.querySelector(`.map-open-card[data-id="${CSS.escape(c.id)}"]`);
                    el?.addEventListener('click', () => window.abrirModal?.(c.id));
                });
                marker.addTo(markers);
                bounds.push(pos);
            });
            
            if(bounds.length > 0) {
                map.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 });
                if(status) status.textContent = `${bounds.length} cancha${bounds.length === 1 ? '' : 's'} en el mapa.`;
            } else {
                if(status) status.textContent = 'Aún no hay canchas en el mapa.';
            }
        } catch (error) { // <- ¡Y AQUÍ ESTÁ EL CATCH QUE FALTABA!
            console.error("Error cargando el mapa:", error);
            if(status) status.textContent = 'No pudimos cargar el mapa.';
        }
    }

    function ubicarUsuario() {
        if (!navigator.geolocation) { if(status) status.textContent = 'Tu navegador no admite geolocalización.'; return; }
        if(btn) btn.setAttribute('disabled', 'disabled');
        if(status) status.textContent = 'Obteniendo tu ubicación…';
        
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude, lng = pos.coords.longitude;
            userLayer.clearLayers();
            L.marker([lat, lng], { icon: userIcon }).addTo(userLayer).bindPopup('<strong>Estás aquí</strong>').openPopup();
            L.circle([lat, lng], { radius: 1000, color: '#00D968', fillColor: '#00D968', fillOpacity: .08, weight: 1 }).addTo(userLayer);
            map.setView([lat, lng], 14);
            if(status) status.textContent = 'Ubicación activada. Explora las canchas cercanas.';
            if(btn) btn.removeAttribute('disabled');
        }, () => {
            if(status) status.textContent = 'No pudimos acceder a tu ubicación. Revisa el permiso del navegador.';
            if(btn) btn.removeAttribute('disabled');
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
    }

    if(btn) btn.addEventListener('click', ubicarUsuario);
    cargar();
    window.addEventListener('resize', () => map.invalidateSize(true));
}
