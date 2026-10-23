const mapEl = document.getElementById('map-canchas');

// Controles del Modal de Mapa
const modalMapa = document.getElementById('modal-mapa');
const btnAbrirMapa = document.getElementById('btn-abrir-mapa');
const btnCerrarMapa = document.getElementById('cerrar-mapa');

if (mapEl && window.L) {
    const map = L.map(mapEl, { zoomControl: false, scrollWheelZoom: true, fadeAnimation: true }).setView([-9.1899, -75.0152], 6);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        maxZoom: 19, 
        attribution: '&copy; OpenStreetMap contributors' 
    });
    osm.addTo(map);
    
    const markers = L.layerGroup().addTo(map);
    const userLayer = L.layerGroup().addTo(map);
    const status = document.getElementById('map-status');
    const btnUbicacion = document.getElementById('btn-mi-ubicacion');
    
    const icon = L.divIcon({ 
        className: 'premium-map-marker', 
        html: '<div><i class="ph-fill ph-soccer-ball"></i></div>', 
        iconSize: [40, 40], 
        iconAnchor: [20, 38], 
        popupAnchor: [0, -38] 
    });

    const userIcon = L.divIcon({ 
        className: 'user-map-marker', 
        html: '<div><span></span></div>', 
        iconSize: [24, 24], 
        iconAnchor: [12, 12] 
    });
    
    const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
    
    // Función defensiva para extraer coordenadas en cualquier formato
    function coords(c) {
        if (!c) return null;
        let lat = Number(c.lat ?? c.latitud ?? c.latitude);
        let lng = Number(c.lng ?? c.longitud ?? c.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
            return [lat, lng];
        }
        const u = String(c.ubicacionLink || c.mapa || '');
        let m = u.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
        if (!m) m = u.match(/[?&](?:q|ll)=(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/);
        if (m) {
            const mLat = Number(m[1]), mLng = Number(m[2]);
            if (Number.isFinite(mLat) && Number.isFinite(mLng)) return [mLat, mLng];
        }
        return null;
    }

    function popup(c) {
        const nombre = escapeHtml(c.nombreCancha || c.nombre || 'Cancha');
        const precio = c.precio != null && c.precio !== '' ? `S/ ${escapeHtml(c.precio)} <small>/ hora</small>` : 'Consultar precio';
        const rating = Number(c.ratingPromedio || c.rating || 0);
        const tipo = escapeHtml(c.tipoCancha || c.tipo || 'Fútbol');
        const ubicacion = escapeHtml(c.departamento || c.ciudad || c.ubicacionTexto || 'Ubicación disponible');
        const foto = c.fotos?.[0] || 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=500&q=80';
        const targetId = encodeURIComponent(c.id || '');
        const estaAbierta = c.isOpen === true;

        return `
            <div class="map-popup premium-popup">
                <div class="map-popup-cover" style="background-image:url('${escapeHtml(foto)}')">
                    <span class="map-popup-status ${estaAbierta ? 'open' : 'closed'}">
                        <i class="ph-fill ph-circle"></i> ${estaAbierta ? 'Abierto ahora' : 'Cerrado'}
                    </span>
                </div>
                <div class="map-popup-body">
                    <strong>${nombre}</strong>
                    <span class="map-popup-rating">
                        <i class="ph-fill ph-star"></i> ${rating > 0 ? rating.toFixed(1) : 'Nuevo'} · ${tipo}
                    </span>
                    <span><i class="ph-bold ph-map-pin"></i> ${ubicacion}</span>
                    <div class="map-popup-price">${precio}</div>
                    <div class="map-popup-actions" style="margin-top: 10px; display: flex; gap: 8px;">
                        <a href="cancha.html?id=${targetId}" style="display:flex; align-items:center; justify-content:center; gap:6px; background:var(--primary-green, #00D968); color:#03150B; font-weight:800; font-size:11px; padding:9px 12px; border-radius:8px; text-decoration:none; flex:1; text-align:center;">
                            Ver perfil completo <i class="ph-bold ph-arrow-right"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    // Renderizado reactivo de marcadores en el mapa Leaflet
    function renderizarMarcadores(lista) {
        if (!markers) return;
        markers.clearLayers();

        const canchas = Array.isArray(lista) ? lista : (window.canchasFiltradasActuales || window.canchasGlobales || []);
        const bounds = [];

        canchas.forEach(c => {
            if (!c) return;
            const pos = coords(c);
            if (!pos) return;

            const marker = L.marker(pos, { icon }).bindPopup(popup(c), { maxWidth: 290, minWidth: 230 });
            marker.addTo(markers);
            bounds.push(pos);
        });

        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
            if (status) status.textContent = `${bounds.length} cancha${bounds.length === 1 ? '' : 's'} en el mapa.`;
        } else {
            if (status) status.textContent = 'Aún no hay canchas con ubicación registrada.';
        }
    }

    // Exponer globalmente para sincronización con app.js y filtros
    window.renderizarMarcadoresMapa = renderizarMarcadores;
    window.actualizarMapaCanchas = renderizarMarcadores;

    // Escuchar evento personalizado emitido por app.js cuando cambien filtros o carguen canchas
    window.addEventListener('canchasActualizadas', (e) => {
        if (e.detail) renderizarMarcadores(e.detail);
    });

    // Ubicar al usuario
    function ubicarUsuario() {
        if (!navigator.geolocation) { 
            if (status) status.textContent = 'Tu navegador no admite geolocalización.'; 
            return; 
        }
        if (btnUbicacion) btnUbicacion.setAttribute('disabled', 'disabled');
        if (status) status.textContent = 'Obteniendo tu ubicación…';
        
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude, lng = pos.coords.longitude;
            userLayer.clearLayers();
            L.marker([lat, lng], { icon: userIcon }).addTo(userLayer).bindPopup('<strong>Estás aquí</strong>').openPopup();
            L.circle([lat, lng], { radius: 1000, color: '#00D968', fillColor: '#00D968', fillOpacity: .08, weight: 1 }).addTo(userLayer);
            map.setView([lat, lng], 14);
            if (status) status.textContent = 'Ubicación activada. Explora las canchas cercanas.';
            if (btnUbicacion) btnUbicacion.removeAttribute('disabled');
        }, () => {
            if (status) status.textContent = 'No pudimos acceder a tu ubicación. Revisa permisos.';
            if (btnUbicacion) btnUbicacion.removeAttribute('disabled');
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
    }

    if (btnUbicacion) btnUbicacion.addEventListener('click', ubicarUsuario);
    
    // Controles de Apertura y Cierre del Mapa
    if (btnAbrirMapa && modalMapa) {
        btnAbrirMapa.addEventListener('click', () => {
            modalMapa.classList.add('mostrar');
            setTimeout(() => {
                map.invalidateSize(true);
                const actuales = window.canchasFiltradasActuales || window.canchasGlobales;
                if (actuales && actuales.length > 0) {
                    renderizarMarcadores(actuales);
                }
            }, 250); 
        });
    }

    if (btnCerrarMapa && modalMapa) {
        btnCerrarMapa.addEventListener('click', () => {
            modalMapa.classList.remove('mostrar');
        });
    }

    modalMapa?.addEventListener('click', (e) => {
        if (e.target === modalMapa) modalMapa.classList.remove('mostrar');
    });

    // Render inicial si las canchas ya fueron descargadas
    if (window.canchasGlobales && window.canchasGlobales.length > 0) {
        renderizarMarcadores(window.canchasGlobales);
    }
}

