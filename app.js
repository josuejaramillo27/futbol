import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, deleteDoc, runTransaction, updateDoc, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 2. CONFIGURACIÓN E INICIALIZACIÓN
const firebaseConfig = {
    apiKey: "AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",
    authDomain: "app-futbol-acd0f.firebaseapp.com",
    projectId: "app-futbol-acd0f",
    storageBucket: "app-futbol-acd0f.firebasestorage.app",
    messagingSenderId: "223446110165",
    appId: "1:223446110165:web:219afce6a9dac03203f75c"
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig), db = getFirestore(app), auth = getAuth(app);
window.auth = auth;
let canchasGlobales = [], ubicacionUsuario = null, usuarioActual = null;

// ==========================================
// SISTEMA DE NOTIFICACIONES ELEGANTES
// ==========================================
window.toast = function (mensaje, tipo = 'success') {
    let container = document.getElementById('toast-container-global');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container-global';
        document.body.appendChild(container);
    }
    const toastEl = document.createElement('div');
    toastEl.className = `custom-toast toast-${tipo}`;
    const iconClass = tipo === 'success' ? 'ph-check-circle' : tipo === 'error' ? 'ph-warning-circle' : 'ph-info';
    toastEl.innerHTML = `<i class="ph-bold ${iconClass}"></i><span>${mensaje}</span>`;
    container.appendChild(toastEl);
    setTimeout(() => {
        toastEl.classList.add('toast-out');
        setTimeout(() => toastEl.remove(), 300);
    }, 3200);
};
window.alert = function (mensaje) { window.toast(mensaje, 'info'); };

// MODAL PARA PEDIR WHATSAPP
window.customPrompt = function (mensaje, placeholder) {
    return new Promise((resolve) => {
        let overlay = document.getElementById('custom-prompt-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'custom-prompt-overlay';
            overlay.innerHTML = `
                <style>
                    #custom-prompt-overlay { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; }
                    #custom-prompt-overlay.show { display:flex; }
                    .prompt-box { background:#111; padding:25px; border-radius:16px; width:100%; max-width:350px; border:1px solid #f1c40f; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
                </style>
                <div class="prompt-box">
                    <i class="ph-fill ph-whatsapp-logo" style="font-size:3rem; color:#25D366; margin-bottom:10px;"></i>
                    <p id="custom-prompt-msg" style="margin:0 0 15px; font-size:0.95rem; color:#fff; line-height:1.4;"></p>
                    <input type="tel" id="custom-prompt-input" maxlength="9" oninput="this.value=this.value.replace(/[^0-9]/g,'');" style="width:100%; padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.5); color:#fff; margin-bottom:20px; text-align:center; font-size:1.2rem; font-weight:bold; letter-spacing:2px;" placeholder="">
                    <div style="display:flex; gap:10px;">
                        <button id="btn-prompt-cancel" class="btn" style="flex:1; background:rgba(255,255,255,0.1); color:#fff; border:none;">Cancelar</button>
                        <button id="btn-prompt-ok" class="btn" style="flex:1; background:#f1c40f; color:#000; font-weight:bold; border:none;">Enviar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        document.getElementById('custom-prompt-msg').textContent = mensaje;
        document.getElementById('custom-prompt-input').placeholder = placeholder || '';
        document.getElementById('custom-prompt-input').value = '';
        overlay.classList.add('show');

        document.getElementById('btn-prompt-ok').onclick = () => {
            const val = document.getElementById('custom-prompt-input').value.trim();
            if (val.length !== 9) { window.toast('El número debe tener 9 dígitos.', 'warning'); return; }
            if (confirm(`¿Tu número es ${val}?\nVerifica que esté correcto antes de enviarlo.`)) {
                overlay.classList.remove('show');
                resolve(val);
            }
        };
        document.getElementById('btn-prompt-cancel').onclick = () => {
            overlay.classList.remove('show');
            resolve(null);
        };
    });
};

// ==========================================
// UTILIDADES Y FUNCIONES BÁSICAS
// ==========================================
function formatWsp(num) {
    if (!num) return '';
    let n = String(num).replace(/\D/g, '');
    if (n.length === 9) return '51' + n;
    return n;
}

function normalizar(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() }
function obtenerCiudad(c) { return c.ciudad || c.provincia || c.departamento || '' } function obtenerTipo(c) { return c.tipoCancha || c.tipo || c.modalidad || '' }
function precioNumero(c) { const p = Number(String(c.precio ?? '').replace(',', '.').replace(/[^0-9.]/g, '')); return Number.isFinite(p) ? p : 0 }
function normalizarDiaKey(str) { return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

function obtenerHorarioCancha(c, fechaReq) {
    if (!c) return { activo: false, apertura: null, cierre: null, step: 60 };
    const fStr = fechaReq || fechaHoy();
    const [y, m, d] = String(fStr).split('-').map(Number);
    const dt = (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) ? new Date(y, m - 1, d, 12, 0, 0) : new Date();
    const diasCon = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const diasSin = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const idx = dt.getDay();
    const diaCon = diasCon[idx], diaSin = diasSin[idx];
    
    let horarioDia = null;
    if (c.horariosSemana && typeof c.horariosSemana === 'object') {
        horarioDia = c.horariosSemana[diaCon] || c.horariosSemana[diaSin];
        if (!horarioDia) {
            for (const [k, v] of Object.entries(c.horariosSemana)) {
                if (normalizarDiaKey(k) === diaSin) { horarioDia = v; break; }
            }
        }
    }
    
    if (horarioDia && horarioDia.activo === false) {
        return { activo: false, apertura: null, cierre: null, step: Number(c.intervaloMinutos || c.duracionReserva || 60) || 60 };
    }
    
    const apertura = horarioDia?.apertura || horarioDia?.inicio || c.horaApertura || c.horaInicio || '08:00';
    const cierre = horarioDia?.cierre || horarioDia?.fin || c.horaCierre || c.horaFin || '23:00';
    const step = Number(c.intervaloMinutos || c.duracionReserva || 60) || 60;
    return { activo: true, apertura, cierre, step };
}

function canchaEstaAbierta(c) {
    if (!c) return false;
    const now = new Date();
    const h = obtenerHorarioCancha(c, fechaHoy());
    if (!h || !h.activo || !h.apertura || !h.cierre) return false;
    const actual = now.getHours() * 60 + now.getMinutes();
    const a = minutos(h.apertura), b = minutos(h.cierre);
    if (a === null || b === null) return false;
    return b > a ? (actual >= a && actual <= b) : (actual >= a || actual <= b);
}
function distanciaKm(lat1, lon1, lat2, lon2) { const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180, a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) }
function distanciaCerca(c) { if (ubicacionUsuario && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng))) return distanciaKm(ubicacionUsuario.lat, ubicacionUsuario.lng, Number(c.lat), Number(c.lng)); return Number(c.distanciaKm ?? c.distancia ?? 999999) }
const esInicio = () => { const p = window.location.pathname.replace(/\/$/, ''); return p === '' || p.endsWith('/index.html') || p.endsWith('/futbol') || p.endsWith('/futbol/index.html') };
const fechaHoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
const minutos = t => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null };

const slotsDeCancha = (c, reservas = [], bloqueos = [], fechaReq = null) => {
    let fReq = fechaReq;
    let res = reservas;
    let blk = bloqueos;
    if (typeof bloqueos === 'string') {
        fReq = bloqueos;
        blk = [];
    }
    fReq = fReq || fechaHoy();
    const h = obtenerHorarioCancha(c, fReq);
    if (!h || !h.activo || !h.apertura || !h.cierre) return [];
    const a = minutos(h.apertura), b0 = minutos(h.cierre), step = h.step;
    if (a === null || b0 === null || !Number.isFinite(step) || step <= 0) return [];
    let b = b0 <= a ? b0 + 1440 : b0;

    const cid = String(c?.id || '');
    const ocupadas = new Set(
        (Array.isArray(res) ? res : [])
            .filter(r => String(r?.canchaId) === cid && String(r?.fecha) === fReq && !['cancelada', 'cancelado', 'cancelled', 'rejected'].includes(normalizar(r?.estado)))
            .map(r => minutos(r?.horaInicio || r?.hora))
            .filter(Number.isFinite)
    );

    const bloqueadas = new Set(
        (Array.isArray(blk) ? blk : [])
            .filter(bk => String(bk?.canchaId) === cid && String(bk?.fecha) === fReq)
            .map(bk => minutos(bk?.horaInicio || bk?.hora))
            .filter(Number.isFinite)
    );

    const hoy = fechaHoy();
    const isPastDay = fReq < hoy;
    const isToday = fReq === hoy;
    const now = new Date();
    const actual = now.getHours() * 60 + now.getMinutes();

    const out = [];
    for (let t = a; t < b; t += step) {
        const real = t % 1440;
        const label = `${String(Math.floor(real / 60)).padStart(2, '0')}:${String(real % 60).padStart(2, '0')}`;
        const isBlocked = isPastDay || ocupadas.has(real) || bloqueadas.has(real) || (isToday && real <= actual);
        out.push({ label, blocked: isBlocked });
    }
    return out;
};

// ==========================================
// PÁGINA PRINCIPAL (INDEX)
// ==========================================
if (esInicio()) {
    const contenedor = document.getElementById('lista-canchas');
    const inputBusqueda = document.getElementById('filtro-busqueda');
    const filtroCiudad = document.getElementById('filtro-ciudad');
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroPrecio = document.getElementById('filtro-precio');
    const filtroOrden = document.getElementById('filtro-orden');
    const contador = document.getElementById('contador-canchas');
    const filtroActivo = document.getElementById('filtro-activo');
    let soloAbiertas = false, soloCerca = false, soloTop = false;

    // Restaurar departamento memorizado desde localStorage si existe
    const deptoGuardado = localStorage.getItem('departamentoSeleccionado');
    if (deptoGuardado && filtroCiudad) {
        filtroCiudad.value = deptoGuardado;
    }

    // Función para poblar el filtro de tipos deduplicando sin distinguir mayúsculas/minúsculas
    function llenarSelectTipos(canchas) {
        if (!filtroTipo) return;
        const actual = (filtroTipo.value || '').toLowerCase().trim();
        const tiposMap = new Map();

        (canchas || []).forEach(c => {
            const candidatos = [];
            if (c?.tipo) candidatos.push(c.tipo);
            if (c?.tipoCancha) candidatos.push(c.tipoCancha);
            if (c?.modalidad) candidatos.push(c.modalidad);
            if (Array.isArray(c?.canchasDelComplejo)) {
                c.canchasDelComplejo.forEach(sub => {
                    if (sub?.tipo) candidatos.push(sub.tipo);
                    if (sub?.tipoCancha) candidatos.push(sub.tipoCancha);
                });
            }
            candidatos.forEach(raw => {
                if (!raw) return;
                String(raw).split(',').forEach(item => {
                    const limpio = item.trim();
                    if (!limpio) return;
                    const clave = limpio.toLowerCase();
                    if (!tiposMap.has(clave)) {
                        tiposMap.set(clave, limpio);
                    }
                });
            });
        });

        const tiposOrdenados = Array.from(tiposMap.values()).sort((a, b) => a.localeCompare(b, 'es'));
        filtroTipo.innerHTML = '<option value="">Todos los tipos</option>';
        tiposOrdenados.forEach(tipoNombre => {
            const opt = document.createElement('option');
            opt.value = tipoNombre;
            opt.textContent = tipoNombre;
            if (actual && tipoNombre.toLowerCase().trim() === actual) {
                opt.selected = true;
            }
            filtroTipo.appendChild(opt);
        });
    }

    function renderizarCanchas() {
        if (!contenedor) return;
        const texto = normalizar(inputBusqueda?.value);
        const deptoFiltro = normalizar(filtroCiudad?.value);
        const tipoFiltro = normalizar(filtroTipo?.value);
        const rango = filtroPrecio?.value || '';
        const orden = filtroOrden?.value || 'recomendadas';

        let resultados = canchasGlobales.filter(c => {
            const buscable = normalizar(`${c.nombre || ''} ${c.ubicacionTexto || ''} ${c.distrito || ''} ${c.ciudad || ''} ${c.departamento || ''} ${c.tipo || ''} ${c.tipoCancha || ''} ${c.tiposMulti || ''}`);
            const precio = precioNumero(c);
            let rp = true;
            if (rango) {
                const [min, max] = rango.split('-').map(Number);
                rp = precio >= min && precio <= max;
            }

            // Filtro Departamento: coincidencia defensiva con departamento, ciudad o provincia
            const matchDepto = !deptoFiltro || 
                normalizar(c.departamento) === deptoFiltro || 
                normalizar(c.ciudad) === deptoFiltro || 
                normalizar(c.provincia) === deptoFiltro;

            // Filtro Tipo: insensible a mayúsculas/minúsculas
            const matchTipo = !tipoFiltro || 
                normalizar(c.tipo) === tipoFiltro || 
                normalizar(c.tipoCancha) === tipoFiltro || 
                normalizar(c.modalidad) === tipoFiltro || 
                normalizar(c.tiposMulti || '').includes(tipoFiltro);

            return (!texto || buscable.includes(texto)) && 
                   matchDepto && 
                   matchTipo && 
                   rp && 
                   (!soloAbiertas || c.isOpen) && 
                   (!soloTop || c.rating >= 4.5) && 
                   (!soloCerca || distanciaCerca(c) <= 10);
        });

        resultados.sort((a, b) => orden === 'rating' ? b.rating - a.rating : orden === 'precio-asc' ? precioNumero(a) - precioNumero(b) : orden === 'precio-desc' ? precioNumero(b) - precioNumero(a) : orden === 'cerca' ? distanciaCerca(a) - distanciaCerca(b) : a.isOpen !== b.isOpen ? (a.isOpen ? -1 : 1) : b.rating - a.rating);
        if (contador) contador.textContent = `${resultados.length} ${resultados.length === 1 ? 'complejo encontrado' : 'complejos encontrados'}`;
        if (filtroActivo) {
            const a = [];
            if (deptoFiltro && filtroCiudad) a.push(filtroCiudad.value);
            if (tipoFiltro && filtroTipo) a.push(filtroTipo.value);
            if (rango) a.push(filtroPrecio.options[filtroPrecio.selectedIndex].text);
            if (soloAbiertas) a.push('Abiertas ahora');
            if (soloTop) a.push('4.5+ estrellas');
            if (soloCerca) a.push(ubicacionUsuario ? 'Cerca de mí' : 'Cerca de mí*');
            filtroActivo.textContent = a.length ? a.join(' · ') : '';
        }

        contenedor.innerHTML = '';
        if (!resultados.length) {
            contenedor.innerHTML = '<div class="card empty-results" style="grid-column:1/-1;text-align:center"><i class="ph ph-magnifying-glass" style="font-size:34px;color:var(--primary-green)"></i><h3>No encontramos canchas</h3><p>Prueba quitando algún filtro o buscando otra zona.</p><button type="button" class="btn btn-outline" style="width:auto;margin:15px auto 0" id="btn-reset-empty">Limpiar filtros</button></div>';
            document.getElementById('btn-reset-empty')?.addEventListener('click', limpiarFiltros);
        } else {
            resultados.forEach(c => {
                const estado = c.isOpen ? '<span class="badge-estado badge-abierto"><i class="ph-fill ph-circle"></i> Abierto ahora</span>' : '<span class="badge-estado badge-cerrado"><i class="ph-fill ph-circle"></i> Cerrado</span>';
                const logo = c.logo || 'https://via.placeholder.com/100';
                const portada = c.fotos?.length ? c.fotos[0] : 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=1000&q=85';
                const d = distanciaCerca(c);
                const dist = Number.isFinite(d) && d < 999999 ? ` · ${d.toFixed(1)} km` : '';

                // Subtítulo dinámico con turnos libres hoy
                let textoTurnos = '';
                if (typeof c.totalTurnosLibres === 'number' && Number.isFinite(c.totalTurnosLibres)) {
                    if (c.totalTurnosLibres > 0) {
                        textoTurnos = `<span style="color:var(--primary-green); font-weight:800;"><i class="ph-bold ph-clock"></i> 🟢 ${c.totalTurnosLibres} ${c.totalTurnosLibres === 1 ? 'turno libre hoy' : 'turnos libres hoy'}</span>`;
                    } else {
                        textoTurnos = `<span style="color:#e74c3c; font-weight:700;"><i class="ph-bold ph-x-circle"></i> 🔴 Sin turnos libres hoy</span>`;
                    }
                } else {
                    textoTurnos = c.isOpen
                        ? `<span style="color:var(--primary-green); font-weight:800;">🟢 Abierto hoy</span>`
                        : `<span style="color:#e74c3c; font-weight:700;">🔴 Cerrado</span>`;
                }
                const infoCanchas = c.cantidadCanchas > 1 ? ` · <span style="color:#aaa; font-weight:normal;">${c.cantidadCanchas} canchas${c.tiposMulti ? ` (${c.tiposMulti})` : ''}</span>` : (c.tiposMulti ? ` · <span style="color:#aaa; font-weight:normal;">${c.tiposMulti}</span>` : '');
                const subtituloCanchas = `<p class="court-canchas-subtitulo" style="margin: 6px 0 0 0; font-size: 0.84rem;">${textoTurnos}${infoCanchas}</p>`;

                const linkCancha = c.slug ? `cancha.html?slug=${encodeURIComponent(c.slug)}` : `cancha.html?id=${c.id}`;
                contenedor.innerHTML += `<article class="card court-card"><div class="court-cover" style="background-image:url('${portada}')"><div class="court-status">${estado}</div><div class="court-cover-gradient"></div></div><div class="court-body"><img src="${logo}" alt="Logo" loading="lazy" class="court-logo" style="aspect-ratio:1/1;object-fit:cover;"><div class="court-content"><div class="court-title-line"><a href="${linkCancha}" style="text-decoration:none; color:inherit;"><h3>${c.nombre || 'Cancha'}</h3></a><span class="court-rating"><i class="ph-fill ph-star"></i> ${c.rating > 0 ? c.rating.toFixed(1) : 'Nuevo'}</span></div><p class="court-location"><i class="ph-bold ph-map-pin"></i> ${c.ubicacionTexto || 'Ubicación'}${c.departamento ? ` · ${c.departamento}` : (obtenerCiudad(c) ? ` · ${obtenerCiudad(c)}` : '')}${dist}</p>
             ${subtituloCanchas}
             <div class="court-meta" style="margin-top:8px;"><span><i class="ph-bold ph-soccer-ball"></i> ${c.multiCancha ? 'Múltiples' : (obtenerTipo(c) || 'Fútbol')}</span><strong>S/ ${c.precio ?? 'Consultar'} <small>/ hr</small></strong></div><button class="court-action" data-court-id="${c.id}"><span>Ver Horarios y Reservar</span><i class="ph-bold ph-calendar-plus"></i></button></div></div></article>`;
            });

            contenedor.querySelectorAll('[data-court-id]').forEach(b => b.addEventListener('click', () => {
                if (window.abrirModal) window.abrirModal(b.dataset.courtId);
            }));
        }

        // Sincronizar reactivamente con el mapa Leaflet
        window.canchasFiltradasActuales = resultados;
        if (typeof window.actualizarMapaCanchas === 'function') {
            window.actualizarMapaCanchas(resultados);
        }
        window.dispatchEvent(new CustomEvent('canchasActualizadas', { detail: resultados }));
    }

    function limpiarFiltros() {
        if (inputBusqueda) inputBusqueda.value = '';
        if (filtroCiudad) filtroCiudad.value = '';
        if (filtroTipo) filtroTipo.value = '';
        if (filtroPrecio) filtroPrecio.value = '';
        if (filtroOrden) filtroOrden.value = 'recomendadas';
        soloAbiertas = soloCerca = soloTop = false;
        localStorage.removeItem('departamentoSeleccionado');
        document.querySelectorAll('.quick-filter').forEach(b => b.classList.remove('active'));
        renderizarCanchas();
    }

    // Escuchar cambios de departamento para guardar en memoria localStorage
    filtroCiudad?.addEventListener('change', () => {
        const sel = filtroCiudad.value;
        if (sel) {
            localStorage.setItem('departamentoSeleccionado', sel);
        } else {
            localStorage.removeItem('departamentoSeleccionado');
        }
        localStorage.setItem('gpsPreguntado', 'true');
        renderizarCanchas();
    });

    async function cargar() {
        if (!contenedor) return;
        contenedor.innerHTML = '<div class="card loading-card" style="grid-column:1/-1;text-align:center;color:var(--text-muted)"><i class="ph-bold ph-spinner-gap ph-spin"></i> Buscando canchas...</div>';
        try {
            const [s, sRes, sBloq] = await Promise.all([
                Promise.race([getDocs(collection(db, 'canchas')), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 12000))]),
                getDocs(query(collection(db, 'reservas'), where('fecha', '==', fechaHoy()))).catch(() => ({ docs: [] })),
                getDocs(query(collection(db, 'bloqueos'), where('fecha', '==', fechaHoy()))).catch(() => ({ docs: [] }))
            ]);
            const reservasHoy = sRes && sRes.docs ? sRes.docs.map(d => d.data()) : [];
            const bloqueosHoy = sBloq && sBloq.docs ? sBloq.docs.map(d => d.data()) : [];

            const agrupados = {};
            s.forEach(ds => {
                const d = ds.data();
                if (d.estadoPublicacion === 'published' || (d.configurado === true && !d.estadoPublicacion)) {
                    const uid = d.usuarioUid || d.ownerUid || ds.id;
                    if (!agrupados[uid]) agrupados[uid] = [];
                    let turnosLibres = 0;
                    let estaAbierta = false;
                    try {
                        const slots = slotsDeCancha(d, reservasHoy, bloqueosHoy, fechaHoy());
                        turnosLibres = slots.filter(sl => !sl.blocked).length;
                    } catch (errSlots) {
                        turnosLibres = 0;
                    }
                    try {
                        estaAbierta = canchaEstaAbierta(d);
                    } catch (errOpen) {
                        estaAbierta = false;
                    }
                    agrupados[uid].push({ 
                        id: ds.id, 
                        ...d, 
                        isOpen: estaAbierta, 
                        turnosLibres,
                        rating: Number(d.ratingPromedio || d.rating || 0) 
                    });
                }
            });

            canchasGlobales = Object.values(agrupados).map(grupo => {
                const main = { ...grupo[0] };
                main.canchasDelComplejo = grupo;
                main.cantidadCanchas = grupo.length;
                const tiposUnicos = [...new Set(grupo.map(c => c.tipo || c.tipoCancha).filter(Boolean))];
                main.tiposMulti = tiposUnicos.join(', ');
                main.multiCancha = grupo.length > 1;
                main.isOpen = grupo.some(g => g.isOpen);
                const totalTurnos = grupo.reduce((acc, subC) => acc + (subC.turnosLibres || 0), 0);
                main.totalTurnosLibres = totalTurnos;
                main.subtituloDinamico = totalTurnos > 0 
                    ? `🟢 ${totalTurnos} ${totalTurnos === 1 ? 'turno libre hoy' : 'turnos libres hoy'}`
                    : (main.isOpen ? '🟢 Abierto hoy' : '🔴 Cerrado');
                return main;
            });

            window.canchasGlobales = canchasGlobales;

            // Llenar dinámicamente los tipos deduplicados a partir de las canchas descargadas
            llenarSelectTipos(canchasGlobales);

            // Sincronizar valor guardado si coincide
            if (deptoGuardado && filtroCiudad) {
                filtroCiudad.value = deptoGuardado;
            }

            renderizarCanchas();
        } catch (e) {
            console.error("Error al cargar canchas:", e);
            contenedor.innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center;color:var(--danger);padding:28px">Error cargando las canchas.</div>`;
        }
    }

    [inputBusqueda, filtroTipo, filtroPrecio, filtroOrden].forEach(e => e?.addEventListener('input', renderizarCanchas));
    document.querySelectorAll('.quick-filter').forEach(b => b.addEventListener('click', () => { 
        const f = b.dataset.filter; 
        if (f === 'limpiar') return limpiarFiltros(); 
        if (f === 'abiertas') soloAbiertas = !soloAbiertas; 
        if (f === 'cerca') { 
            if (!navigator.geolocation) return window.toast('Tu navegador no permite geolocalización.', 'error'); 
            navigator.geolocation.getCurrentPosition(p => { 
                ubicacionUsuario = { lat: p.coords.latitude, lng: p.coords.longitude }; 
                soloCerca = true; 
                b.classList.add('active'); 
                renderizarCanchas();
            }, () => window.toast('Activa la ubicación.', 'warning')); 
            return;
        } 
        if (f === 'top') soloTop = !soloTop; 
        b.classList.toggle('active'); 
        renderizarCanchas();
    }));

    cargar();
}

// ==========================================
// MODAL DE RESERVA Y DISPONIBILIDAD
// ==========================================
window.abrirModal = async id => {
    let c = canchasGlobales.find(x => String(x.id) === String(id));
    if (!c) {
        try {
            const docSnap = await getDoc(doc(db, 'canchas', id));
            if (docSnap.exists()) {
                c = { id: docSnap.id, ...docSnap.data() };
            }
        } catch (e) {
            console.warn("No se pudo cargar cancha por ID:", e);
        }
    }
    if (!c) return;
    const nombre = c.nombreCancha || c.nombre || 'Cancha';
    const titleEl = document.getElementById('modal-nombre-interno');
    if (titleEl) titleEl.innerText = nombre;
    await pintarDisponibilidadModal(c);
    const modalEl = document.getElementById('modal-cancha');
    if (modalEl) modalEl.classList.add('mostrar');
    document.body.style.overflow = 'hidden';
};

async function pintarDisponibilidadModal(c, fechaElegida) {
    const box = document.getElementById('modal-disponibilidad');
    if (!box) return;
    const fReq = fechaElegida || fechaHoy();
    box.innerHTML = '<div style="text-align:center; padding:20px;"><i class="ph-bold ph-spinner-gap ph-spin"></i></div>';
    try {
        const [snapRes, snapBloq] = await Promise.all([
            getDocs(query(collection(db, 'reservas'), where('canchaId', '==', c.id), where('fecha', '==', fReq))),
            getDocs(query(collection(db, 'bloqueos'), where('canchaId', '==', c.id), where('fecha', '==', fReq)))
        ]);
        const slots = slotsDeCancha(c, snapRes.docs.map(d => d.data()), snapBloq.docs.map(d => d.data()), fReq);
        const libres = slots.filter(s => !s.blocked).length;
        const targetId = c.id;

        // Botón secundario para visitar el perfil completo de la cancha (Link en Bio / cancha.html)
        const linkCanchaModal = c.slug ? `cancha.html?slug=${encodeURIComponent(c.slug)}` : `cancha.html?id=${targetId}`;
        const botonPerfilCompleto = !window.location.pathname.includes('cancha.html') ? `
            <div style="margin-top: 20px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px;">
                <a href="${linkCanchaModal}" class="btn btn-outline" style="width: 100%; font-size: 0.85rem; padding: 11px 16px; border-color: rgba(46, 204, 113, 0.35); color: #fff; display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; border-radius: 10px; transition: all 0.2s ease;">
                    Ver perfil completo, reseñas y mapa <i class="ph-bold ph-arrow-right"></i>
                </a>
            </div>
        ` : '';

        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:rgba(255,255,255,0.03); padding:10px 15px; border-radius:10px; border:1px solid var(--border-color);">
                <label style="display:flex; flex-direction:column; font-size:0.8rem; color:var(--text-muted); font-weight:bold;">FECHA DE RESERVA<input type="date" id="input-fecha-modal" value="${fReq}" min="${fechaHoy()}" style="background:transparent; border:none; color:#fff; font-size:1.1rem; font-weight:bold; outline:none; margin-top:4px; font-family:inherit; color-scheme:dark; cursor:pointer;"></label>
                <div style="text-align:right;"><span style="font-size:0.75rem; color:var(--text-muted); font-weight:bold;">DISPONIBLES</span><strong style="font-size:1.3rem; color:var(--primary-green); display:block;">${libres}</strong></div>
            </div>
            <div class="modal-slots">${slots.length ? slots.map(s => `<button type="button" class="modal-slot ${s.blocked ? 'blocked' : ''}" data-book-court="${c.id}" data-book-time="${s.label}" data-book-date="${fReq}" ${s.blocked ? 'disabled' : ''}>${s.label}</button>`).join('') : '<span style="color:var(--text-muted);">El dueño aún no configuró sus horarios.</span>'}</div>
            ${botonPerfilCompleto}
        `;
        document.getElementById('input-fecha-modal')?.addEventListener('change', (e) => pintarDisponibilidadModal(c, e.target.value));
        box.querySelectorAll('.modal-slot:not(.blocked)').forEach(b => b.addEventListener('click', () => abrirReserva(c, b.dataset.bookTime, b.dataset.bookDate)));
    } catch (e) {
        console.error("Error cargando horarios:", e);
        box.innerHTML = '<span style="color:var(--danger)">Error cargando horarios.</span>';
    }
}

function abrirReserva(c, hora, fechaElegida) {
    const modal = document.getElementById('modal-reserva');
    if (!modal) return;

    document.getElementById('booking-cancha-nombre').textContent = c.nombreCancha || c.nombre || 'Cancha';
    const dateObj = new Date(`${fechaElegida}T12:00:00`);
    document.getElementById('booking-hora').textContent = `${new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'short' }).format(dateObj).toUpperCase()} · ${hora}`;
    document.getElementById('booking-nombre').value = usuarioActual?.displayName ? (usuarioActual.displayName.split(' ')[0]) : '';

    // 🔥 LÓGICA DEL AVISO DE ADELANTO Y MÉTODOS DE PAGO (CON MAYOR ESPACIO)
    const metodos = c.metodosPago || {};
    let avisoHTML = '';

    // Le añadimos margin-bottom: 25px al bloque del aviso para darle más aire respecto al botón de confirmar
    if (metodos.requiereSena && metodos.montoSena > 0) {
        avisoHTML = `
            <div style="background:rgba(241,196,15,0.1); border:1px solid rgba(241,196,15,0.3); padding:15px; border-radius:10px; margin-top:25px; margin-bottom:15px; color:#f1c40f;">
                <b style="display:block; margin-bottom:8px; font-size:1.05rem;"><i class="ph-bold ph-warning-circle"></i> Esta cancha exige un adelanto de S/ ${metodos.montoSena}</b>
                <span style="font-size:0.9rem; color:#ccc; line-height:1.5;">Al confirmar, deberás transferir este monto al dueño a través de: <b>${metodos.textoMetodos || 'Yape/Plin'}</b> (Cuenta/Número: <b>${metodos.numero || 'No especificado'}</b> a nombre de <b>${metodos.titular || 'el dueño'}</b>) y enviarle el comprobante por WhatsApp para validar tu reserva.</span>
            </div>
        `;
    } else {
        avisoHTML = `
            <div style="background:rgba(46,204,113,0.1); border:1px solid rgba(46,204,113,0.3); padding:12px; border-radius:10px; margin-top:25px; margin-bottom:15px; color:#2ecc71; font-size:0.9rem; text-align:center;">
                <i class="ph-bold ph-check-circle"></i> <b>Reserva Directa:</b> El pago total se realiza en el local.
            </div>
        `;
    }

    // Invertimos el orden en el HTML del modal para asegurar que el botón vaya ABAJO del mensaje
    const bookingStatus = document.getElementById('booking-status');
    const btnConfirmar = document.getElementById('btn-confirmar-reserva');

    if (bookingStatus && btnConfirmar) {
        bookingStatus.innerHTML = avisoHTML;
        const modalInner = bookingStatus.parentNode;
        modalInner.appendChild(bookingStatus);
        modalInner.appendChild(btnConfirmar);
        btnConfirmar.style.marginTop = '15px';
    }

    modal.dataset.courtId = c.id;
    modal.dataset.time = hora;
    modal.dataset.date = fechaElegida;
    modal.classList.add('mostrar');
    modal.setAttribute('aria-hidden', 'false');
}

async function confirmarReserva() {
    const modal = document.getElementById('modal-reserva');
    const id = modal?.dataset.courtId, hora = modal?.dataset.time, fechaReq = modal?.dataset.date;
    const nombre = document.getElementById('booking-nombre')?.value.trim(), telefono = document.getElementById('booking-telefono')?.value.trim(), btn = document.getElementById('btn-confirmar-reserva');

    if (!id || !hora || !fechaReq || !nombre || !telefono) {
        window.toast('Completa tu nombre y teléfono para continuar.', 'warning');
        return;
    }

    // Validación contra fechas y horarios pasados
    const hoy = fechaHoy();
    if (fechaReq < hoy) {
        window.toast('No puedes reservar en fechas pasadas.', 'warning');
        return;
    }
    const now = new Date();
    const actualMins = now.getHours() * 60 + now.getMinutes();
    const slotMins = minutos(hora);
    if (fechaReq === hoy && slotMins !== null && slotMins <= actualMins) {
        window.toast('Este horario ya ha pasado. Selecciona un horario futuro.', 'warning');
        return;
    }

    if (!usuarioActual) {
        window.toast('Inicia sesión con Google para reservar.', 'warning');
        try { 
            const prov = new GoogleAuthProvider();
            prov.setCustomParameters({ prompt: 'select_account' });
            const r = await signInWithPopup(auth, prov); 
            usuarioActual = r.user; 
        } catch (e) { return; }
    }

    const c = canchasGlobales.find(x => x.id === id);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Confirmando horario...';
    }
    window.toast('Confirmando horario...', 'info');
    const key = `${id}_${fechaReq}_${hora.replace(':', '')}`;

    try {
        // Verificar si existe bloqueo manual de administración
        const snapBloq = await getDocs(query(collection(db, 'bloqueos'), where('canchaId', '==', id), where('fecha', '==', fechaReq)));
        const estaBloqueado = snapBloq.docs.some(d => d.data().horaInicio === hora);
        if (estaBloqueado) {
            throw new Error('SLOT_BLOQUEADO');
        }

        await runTransaction(db, async tx => {
            const ref = doc(db, 'reservas', key), existing = await tx.get(ref);
            if (existing.exists() && !['cancelada', 'cancelado', 'cancelled', 'rejected'].includes(normalizar(existing.data().estado))) throw new Error('SLOT_OCUPADO');
            tx.set(ref, {
                id: key,
                canchaId: id,
                canchaNombre: c?.nombre || c?.nombreCancha || '',
                usuarioUid: usuarioActual.uid,
                nombre: nombre,
                usuarioNombre: nombre,
                telefono: telefono,
                usuarioTelefono: telefono,
                fecha: fechaReq,
                horaInicio: hora,
                horaFin: hora,
                estado: 'pendiente',
                precio: Number(c?.precio || 0),
                metodoPago: 'pendiente',
                senaPagada: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        });

        document.getElementById('booking-status').innerHTML = `
            <div style="background:rgba(241,196,15,0.15); border:1px solid #f1c40f; padding:15px; border-radius:8px; color:#f1c40f; margin-top:15px; text-align:center;">
                <i class="ph-fill ph-hourglass-high" style="font-size: 2rem;"></i><br>
                <b style="font-size:1.1rem; display:block; margin:5px 0;">Reserva en estado PENDIENTE</b>
                <span>Abre WhatsApp, envía la foto del pago/seña y espera que la cancha valide tu reserva.</span>
            </div>`;

        await pintarDisponibilidadModal(c, fechaReq);
        const telOwner = formatWsp(c?.whatsapp);

        if (telOwner) {
            const mensajeWa = `Hola *${c?.nombre || 'Cancha'}*, acabo de reservar en la APP:\n*Nombre:* ${nombre}\n*Fecha:* ${fechaReq}\n*Hora:* ${hora}\n\n*Te adjunto la seña para que puedas VALIDAR la reserva:*`;
            setTimeout(() => { window.open(`https://wa.me/${telOwner}?text=${encodeURIComponent(mensajeWa)}`, '_blank'); }, 2500);
        }
    } catch (e) {
        if (e.message === 'SLOT_BLOQUEADO') {
            window.toast('El horario fue bloqueado por mantenimiento o administración.', 'error');
        } else if (e.message === 'SLOT_OCUPADO') {
            window.toast('Ese horario acaba de ser reservado.', 'error');
        } else {
            console.error("Error al registrar reserva:", e);
            window.toast('No pudimos registrar la reserva. Intenta de nuevo.', 'error');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph-bold ph-check-circle"></i> Solicitar Reserva';
        }
    }
}

const btnCerrar = document.getElementById('cerrar-modal'), modalCancha = document.getElementById('modal-cancha'); if (btnCerrar) btnCerrar.addEventListener('click', cerrarModal); if (modalCancha) modalCancha.addEventListener('click', e => { if (e.target === modalCancha) cerrarModal() }); document.addEventListener('keydown', e => { if (e.key === 'Escape') { cerrarModal(); cerrarReserva() } }); function cerrarModal() { if (!modalCancha) return; modalCancha.classList.remove('mostrar'); document.body.style.overflow = '' }
function cerrarReserva() { const m = document.getElementById('modal-reserva'); if (m) { m.classList.remove('mostrar'); m.setAttribute('aria-hidden', 'true') } }
const cr = document.getElementById('cerrar-reserva'); cr?.addEventListener('click', cerrarReserva); document.getElementById('modal-reserva')?.addEventListener('click', e => { if (e.target.id === 'modal-reserva') cerrarReserva() }); document.getElementById('btn-confirmar-reserva')?.addEventListener('click', confirmarReserva);
onAuthStateChanged(auth, u => { usuarioActual = u || null });

window.cerrarSesionChalacapp = async function () {
    if (!confirm('¿Seguro que deseas cerrar sesión en CHALACAPP?')) return;
    try {
        await auth.signOut();
        usuarioActual = null;
        if (window.toast) window.toast('Sesión cerrada correctamente', 'info');
        setTimeout(() => window.location.reload(), 300);
    } catch (e) {
        console.error('Error al cerrar sesión:', e);
    }
};

// ==========================================
// FASE 26: BOLSA DE JUGADORES (MOTOR RECONSTRUIDO)
// ==========================================
if (window.location.pathname.includes('jugadores.html')) {
    const btnLogin = document.getElementById('btn-login-google');
    const formAnuncio = document.getElementById('form-anuncio');
    const lista = document.getElementById('lista-jugadores');
    const hint = document.getElementById('login-hint');

    let docsBolsa = [];

    function renderizarBolsa() {
        if (!lista) return;
        if (!docsBolsa.length) {
            lista.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px; grid-column:1/-1;"><i class=\"ph-bold ph-users-three\" style=\"font-size:40px;color:var(--primary-green)\"></i><p style=\"margin-top:10px;\">No hay partidos abiertos todavía. Sé el primero.</p></div>';
            return;
        }

        // 🔥 REQUERIMIENTO 4: Los anuncios urgentes (SOS) se muestran primero en el feed
        docsBolsa.sort((a, b) => {
            const aUrg = a.urgente ? 1 : 0;
            const bUrg = b.urgente ? 1 : 0;
            if (aUrg !== bUrg) return bUrg - aUrg;
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return bTime - aTime;
        });

        let bufferHTML = '';

        docsBolsa.forEach(d => {
            const esMio = usuarioActual && d.uid === usuarioActual.uid;
            const borrar = esMio ? `<button class="btn btn-borrar-anuncio" data-id="${d.id}" style="width:100%; padding:8px 12px; font-size:0.8rem; border-radius:8px; margin-top:10px; background:rgba(231,76,60,0.1); color:#e74c3c; border:1px dashed rgba(231,76,60,0.3);"><i class="ph-bold ph-trash"></i> Borrar Anuncio</button>` : '';
            const fechaTexto = d.createdAt?.toDate ? new Date(d.createdAt.toDate()).toLocaleDateString('es-PE') : 'Reciente';

            const esUrgente = Boolean(d.urgente);
            const badgeUrgente = esUrgente 
                ? `<div style="background:linear-gradient(135deg, #e74c3c, #e67e22); color:#fff; font-size:0.75rem; font-weight:900; padding:4px 10px; border-radius:20px; display:inline-flex; align-items:center; gap:5px; margin-bottom:10px; box-shadow:0 2px 10px rgba(231,76,60,0.45);"><i class="ph-fill ph-siren"></i> ¡URGENTE · FALTA 1 YA!</div>`
                : '';
            const estiloCard = esUrgente
                ? 'background:rgba(231,76,60,0.06); border:1.5px solid #e74c3c; box-shadow:0 0 20px rgba(231,76,60,0.25); border-radius:12px; padding:20px;'
                : 'background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.2);';

            let interaccionHTML = '';
            const postulantes = d.postulantes || {};
            const listaPostulantes = Object.values(postulantes);
            const yaPostulo = usuarioActual ? !!postulantes[usuarioActual.uid] : false;
            const miPostulacion = yaPostulo ? postulantes[usuarioActual.uid] : null;

            if (esMio) {
                let htmlPost = listaPostulantes.map(p => {
                    if (p.estado === 'aceptado') {
                        return `<div style="background:rgba(46,204,113,0.1); border:1px solid #2ecc71; padding:10px; border-radius:8px; margin-top:8px;">
                            <span style="color:#2ecc71; font-size:0.85rem;"><i class="ph-fill ph-handshake"></i> Fichaste a <b>${p.nombre}</b></span>
                            <a href="https://wa.me/${formatWsp(p.telefono)}" target="_blank" style="display:flex; justify-content:center; align-items:center; gap:5px; margin-top:8px; color:#000; background:#25D366; padding:6px 10px; border-radius:6px; font-weight:bold; font-size:0.8rem; text-decoration:none;"><i class="ph-bold ph-whatsapp-logo" style="font-size:1.1rem;"></i> Escribir a ${p.nombre}</a>
                        </div>`;
                    } else {
                        return `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; margin-top:8px; border: 1px solid rgba(255,255,255,0.1);">
                            <span onclick="abrirPerfilJugador('${p.uid}')" style="cursor:pointer; color:#f1c40f; text-decoration:underline; font-size:0.85rem;" title="Ver perfil"><i class="ph-fill ph-user-circle"></i> ${p.nombre}</span>
                            <button class="btn-aceptar-postulante" data-anuncio="${d.id}" data-uid="${p.uid}" style="padding:6px 12px; font-size:0.75rem; background:#2ecc71; color:#000; border:none; border-radius:6px; font-weight:bold; cursor:pointer;"><i class="ph-bold ph-check"></i> Fichar</button>
                        </div>`;
                    }
                }).join('');

                interaccionHTML = `<div style="margin-top:15px; border-top:1px dashed rgba(255,255,255,0.2); padding-top:15px;">
                    <strong style="color:#aaa; font-size:0.85rem;">Candidatos postulados (${listaPostulantes.length}):</strong>
                    ${htmlPost || '<div style="color:#666; font-size:0.8rem; margin-top:8px; font-style:italic;">Nadie se ha postulado aún.</div>'}
                </div>`;
            } else {
                if (!usuarioActual) {
                    interaccionHTML = `<button class="btn" style="width:100%; margin-top:15px; background:rgba(255,255,255,0.1); color:#aaa; border:1px dashed #555;" onclick="window.toast('Inicia sesión con Google para postularte','warning')">Inicia sesión para apuntarte</button>`;
                } else if (yaPostulo) {
                    if (miPostulacion.estado === 'aceptado') {
                        interaccionHTML = `<div style="margin-top:15px; padding:15px; background:rgba(46,204,113,0.1); border:1px solid #2ecc71; border-radius:8px; text-align:center;">
                            <span style="color:var(--primary-green); font-weight:bold; font-size:0.95rem; display:inline-flex; align-items:center; gap:6px; margin-bottom:8px;"><i class="ph-bold ph-check-circle"></i> ¡Has sido fichado!</span>
                            <a href="https://wa.me/${formatWsp(d.contacto)}" target="_blank" style="display:inline-flex; align-items:center; gap:5px; background:#25D366; color:#000; font-weight:bold; padding:8px 15px; border-radius:6px; text-decoration:none; font-size:0.85rem;"><i class="ph-bold ph-whatsapp-logo" style="font-size:1.1rem;"></i> Escribir al Capitán</a>
                        </div>`;
                    } else {
                        interaccionHTML = `<div style="margin-top:15px; padding:12px; background:rgba(241,196,15,0.1); border:1px dashed rgba(241,196,15,0.4); border-radius:8px; color:#f1c40f; text-align:center; font-size:0.85rem; font-weight:bold;">
                            <i class="ph-bold ph-hourglass-high"></i> Postulación enviada. Esperando que te acepte...
                        </div>`;
                    }
                } else {
                    interaccionHTML = `<button class="btn btn-postular" data-anuncio="${d.id}" style="width:100%; margin-top:15px; background:linear-gradient(45deg, #f1c40f, #e67e22); color:#000; font-weight:bold; border:none; box-shadow: 0 4px 15px rgba(241,196,15,0.2);"><i class="ph-bold ph-hand-palm" style="font-size:1.2rem;"></i> ¡Me Apunto!</button>`;
                }
            }

            bufferHTML += `
            <article style="${estiloCard}">
                ${badgeUrgente}
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px; flex-wrap:wrap;">
                    <strong onclick="abrirPerfilJugador('${d.uid}')" style="display:flex; align-items:center; gap:8px; color:#fff; font-size:1.1rem; cursor:pointer; transition: color 0.3s;" onmouseover="this.style.color='var(--primary-green)'" onmouseout="this.style.color='#fff'" title="Ver Tarjeta FUT">
                        <i class="ph-fill ph-user-circle" style="font-size:1.8rem; color:var(--primary-green);"></i> 
                        ${d.nombreJugador || d.nombre || 'Jugador'}
                    </strong>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button type="button" class="btn btn-comparar-bolsa" data-uid="${d.uid}" style="padding:4px 9px; font-size:0.75rem; font-weight:800; background:rgba(241,196,15,0.12); color:#f1c40f; border:1px solid rgba(241,196,15,0.35); border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:all 0.2s;" title="Comparar Cara a Cara con este jugador">
                            <i class="ph-bold ph-scales"></i> ⚖️ Comparar
                        </button>
                        <span style="font-size:0.75rem; color:var(--text-muted); background:rgba(255,255,255,0.05); padding:3px 8px; border-radius:12px;">${fechaTexto}</span>
                    </div>
                </div>
                <p style="margin:5px 0; font-size:0.95rem; color:#ddd;">Busco: <b style="color:#f1c40f;">${d.tipo || 'jugador'}</b> · <b style="color:#f1c40f;">${d.modalidad || 'Fútbol 7'}</b></p>
                ${d.texto ? `<p style="margin:12px 0; font-size:0.95rem; color:#eee; background:rgba(0,0,0,0.3); padding:12px; border-radius:8px; border-left:3px solid var(--primary-green); font-style:italic;">"${d.texto}"</p>` : ''}
                
                ${interaccionHTML}
                ${borrar}
            </article>`;
        });

        lista.innerHTML = bufferHTML;

        // Fricción de teléfono: interceptar postulación ("Me Apunto")
        lista.querySelectorAll('.btn-postular').forEach(b => {
            b.addEventListener('click', async () => {
                if (!usuarioActual) {
                    window.toast('Inicia sesión con Google para postularte.', 'warning');
                    try {
                        const prov = new GoogleAuthProvider();
                        prov.setCustomParameters({ prompt: 'select_account' });
                        const r = await signInWithPopup(auth, prov);
                        usuarioActual = r.user;
                    } catch (e) { return; }
                }

                // Fricción de teléfono obligatoria
                const tieneTel = await verificarTelefonoFUT(usuarioActual);
                if (!tieneTel) return;

                const anuncioId = b.dataset.anuncio;
                b.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i>'; b.disabled = true;
                try {
                    let perfil = null;
                    try {
                        const snap = await getDoc(doc(db, "jugadores_perfiles", usuarioActual.uid));
                        if (snap.exists()) perfil = snap.data();
                    } catch (err) {}

                    const telContacto = perfil?.telefono || usuarioActual.phoneNumber || '';
                    await updateDoc(doc(db, 'bolsa_jugadores', anuncioId), {
                        [`postulantes.${usuarioActual.uid}`]: {
                            uid: usuarioActual.uid,
                            nombre: perfil?.nombre || usuarioActual.displayName || 'Jugador',
                            telefono: telContacto ? formatWsp(telContacto) : '',
                            estado: 'pendiente'
                        }
                    });
                    window.toast('¡Te has apuntado con éxito!', 'success');
                } catch (e) { 
                    window.toast('Error al apuntarse.', 'error'); 
                    b.innerHTML = '<i class="ph-bold ph-hand-palm"></i> ¡Me Apunto!'; 
                    b.disabled = false; 
                }
            });
        });

        // Fricción de teléfono: interceptar clics en "Contactar" (enlaces a WhatsApp)
        lista.querySelectorAll('a[href*="wa.me"]').forEach(link => {
            link.addEventListener('click', async (e) => {
                if (!usuarioActual) {
                    e.preventDefault();
                    window.toast('Inicia sesión con Google para contactar.', 'warning');
                    return;
                }
                const tieneTel = await verificarTelefonoFUT(usuarioActual);
                if (!tieneTel) {
                    e.preventDefault();
                }
            });
        });

        // Conectar botones de Cara a Cara ("⚖️ Comparar")
        lista.querySelectorAll('.btn-comparar-bolsa').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetUid = btn.dataset.uid;
                if (window.abrirComparativaJugadores) {
                    window.abrirComparativaJugadores(targetUid);
                }
            });
        });

        lista.querySelectorAll('.btn-aceptar-postulante').forEach(b => {
            b.addEventListener('click', async () => {
                if (!confirm('¿Aceptar a este jugador y mostrarle tu WhatsApp?')) return;
                const anuncioId = b.dataset.anuncio;
                const postUid = b.dataset.uid;
                b.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i>'; b.disabled = true;
                try {
                    await updateDoc(doc(db, 'bolsa_jugadores', anuncioId), {
                        [`postulantes.${postUid}.estado`]: 'aceptado'
                    });
                    window.toast('¡Fichaje completado!', 'success');
                } catch (e) { window.toast('Error al aceptar.', 'error'); b.innerHTML = '<i class="ph-bold ph-check"></i> Fichar'; b.disabled = false; }
            });
        });

        lista.querySelectorAll('.btn-borrar-anuncio').forEach(b => {
            b.addEventListener('click', async () => {
                if (confirm('¿Borrar tu anuncio definitivamente?')) {
                    try {
                        await deleteDoc(doc(db, 'bolsa_jugadores', b.dataset.id));
                        window.toast('Anuncio eliminado.', 'success');
                    } catch (e) { window.toast('Error al eliminar.', 'error'); }
                }
            });
        });
    }

    // HELPER GLOBAL: FRICCIÓN DE TELÉFONO OBLIGATORIA
    async function verificarTelefonoFUT(user) {
        if (!user) return false;
        try {
            const docSnap = await getDoc(doc(db, "jugadores_perfiles", user.uid));
            if (docSnap.exists()) {
                const data = docSnap.data();
                const telLimpio = String(data?.telefono || '').replace(/\D/g, '');
                if (telLimpio.length >= 7) {
                    return true;
                }
            }
        } catch (e) {
            console.error("Error validando teléfono:", e);
        }

        // Si no tiene teléfono guardado, bloquear y forzar registro
        if (window.toast) {
            window.toast("¡Teléfono obligatorio! Registra tu WhatsApp para poder contactarte.", "warning");
        } else {
            alert("¡Teléfono obligatorio! Registra tu WhatsApp para continuar.");
        }

        const modalPerfil = document.getElementById('modal-perfil-jugador');
        if (modalPerfil) {
            modalPerfil.classList.add('mostrar');
            setTimeout(() => {
                const inpTel = document.getElementById('perfil-telefono');
                if (inpTel) {
                    inpTel.focus();
                    inpTel.style.borderColor = '#e74c3c';
                }
            }, 300);
        }
        return false;
    }
    window.verificarTelefonoFUT = verificarTelefonoFUT;

    onAuthStateChanged(auth, u => {
        usuarioActual = u || null;
        if (btnLogin) btnLogin.style.display = u ? 'none' : 'flex';
        if (formAnuncio) formAnuncio.style.display = u ? 'flex' : 'none';
        if (hint) hint.style.display = u ? 'none' : 'block';

        renderizarBolsa();
    });

    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            try { 
                const prov = new GoogleAuthProvider();
                prov.setCustomParameters({ prompt: 'select_account' });
                await signInWithPopup(auth, prov); 
            }
            catch (e) { window.toast('No se pudo iniciar sesión.', 'error'); }
        });
    }

    if (lista) {
        const q = query(collection(db, 'bolsa_jugadores'), orderBy('createdAt', 'desc'));
        onSnapshot(q, s => {
            docsBolsa = [];
            s.forEach(ds => docsBolsa.push({ id: ds.id, ...ds.data() }));
            renderizarBolsa();
        }, e => {
            console.error('Error cargando bolsa:', e);
            lista.innerHTML = '<p style="color:var(--danger); text-align:center;">Error de conexión. No pudimos cargar los partidos.</p>';
        });
    }

    // FORMULARIO DE PUBLICACIÓN ESTÁNDAR
    if (formAnuncio) {
        formAnuncio.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!usuarioActual) { window.toast('Inicia sesión con Google para publicar.', 'warning'); return; }

            // 🔥 FRICCIÓN DE TELÉFONO OBLIGATORIA
            const tieneTel = await verificarTelefonoFUT(usuarioActual);
            if (!tieneTel) return;

            let perfil = null;
            try {
                const docSnap = await getDoc(doc(db, "jugadores_perfiles", usuarioActual.uid));
                if (docSnap.exists()) perfil = docSnap.data();
            } catch (err) { console.error(err); }

            const btn = formAnuncio.querySelector('button[type="submit"]');
            const textOriginal = btn ? btn.innerHTML : 'Publicar';
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Publicando...'; }

            try {
                const qCheck = query(collection(db, 'bolsa_jugadores'), where('uid', '==', usuarioActual.uid));
                const snapCheck = await getDocs(qCheck);

                if (!snapCheck.empty) {
                    window.toast("Ya tienes un anuncio activo. Bórralo para crear uno nuevo.", "warning");
                    if (btn) { btn.disabled = false; btn.innerHTML = textOriginal; }
                    return;
                }

                const telContacto = perfil.telefono || usuarioActual.phoneNumber || '';
                await addDoc(collection(db, 'bolsa_jugadores'), {
                    uid: usuarioActual.uid,
                    nombreJugador: perfil.nombre || usuarioActual.displayName || 'Jugador',
                    nombre: perfil.nombre || usuarioActual.displayName || 'Jugador',
                    tipo: document.getElementById('tipo-anuncio')?.value || 'jugador',
                    modalidad: document.getElementById('modalidad-anuncio')?.value || 'Fútbol 7',
                    contacto: telContacto ? formatWsp(telContacto) : '',
                    texto: document.getElementById('texto-anuncio')?.value || '',
                    urgente: false,
                    postulantes: {},
                    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
                });

                window.toast('¡Anuncio publicado con éxito!', 'success');
                formAnuncio.reset();
            } catch (error) { window.toast('Error al publicar.', 'error'); } finally { if (btn) { btn.disabled = false; btn.innerHTML = textOriginal; } }
        });
    }

    // 🔥 REQUERIMIENTO 4: FORMULARIO DE PUBLICACIÓN SOS (FALTA 1 YA)
    const formSos = document.getElementById('form-sos-anuncio');
    if (formSos) {
        formSos.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!usuarioActual) {
                window.toast('Inicia sesión con Google para lanzar una alerta SOS.', 'warning');
                try {
                    const res = await signInWithPopup(auth, new GoogleAuthProvider());
                    usuarioActual = res.user;
                } catch(err) { return; }
            }

            // 🔥 FRICCIÓN DE TELÉFONO OBLIGATORIA
            const tieneTel = await verificarTelefonoFUT(usuarioActual);
            if (!tieneTel) {
                document.getElementById('modal-sos-anuncio')?.classList.remove('mostrar');
                return;
            }

            let perfil = null;
            try {
                const docSnap = await getDoc(doc(db, "jugadores_perfiles", usuarioActual.uid));
                if (docSnap.exists()) perfil = docSnap.data();
            } catch (err) { console.error(err); }

            const btn = formSos.querySelector('button[type="submit"]');
            const textOriginal = btn ? btn.innerHTML : 'Publicar SOS';
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Lanzando SOS...'; }

            try {
                const telContacto = perfil.telefono || usuarioActual.phoneNumber || '';
                const modalidad = document.getElementById('sos-modalidad')?.value || 'Fútbol 7';
                const detalle = document.getElementById('sos-texto')?.value.trim() || '¡Nos falta 1 jugador urgente para completar el partido!';

                await addDoc(collection(db, 'bolsa_jugadores'), {
                    uid: usuarioActual.uid,
                    nombreJugador: perfil.nombre || usuarioActual.displayName || 'Jugador',
                    nombre: perfil.nombre || usuarioActual.displayName || 'Jugador',
                    tipo: 'jugador',
                    modalidad: modalidad,
                    contacto: telContacto ? formatWsp(telContacto) : '',
                    texto: `🚨 SOS (Falta 1 Ya): ${detalle}`,
                    urgente: true,
                    postulantes: {},
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                window.toast('¡Alerta SOS publicada con éxito! Aparecerá al inicio de la bolsa.', 'success');
                formSos.reset();
                document.getElementById('modal-sos-anuncio')?.classList.remove('mostrar');
            } catch (err) {
                console.error('Error al publicar SOS:', err);
                window.toast('No se pudo publicar la alerta SOS.', 'error');
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = textOriginal; }
            }
        });
    }
}

// ==========================================
// FASE 27: VISUALIZACIÓN PÚBLICA DE EVENTOS
// ==========================================
async function cargarEventosPublicos() {
    const contenedorEventos = document.getElementById('lista-eventos-publicos');
    if (!contenedorEventos) return;
    contenedorEventos.innerHTML = '<div style="text-align:center; padding:20px;"><i class="ph-bold ph-spinner-gap ph-spin"></i></div>';
    try {
        const q = query(collection(db, 'eventos'), where('estado', '==', 'programado'));
        const snap = await getDocs(q);
        let eventos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const ahora = new Date();
        eventos = eventos.filter(e => new Date(e.fin) >= ahora).sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
        if (eventos.length === 0) {
            contenedorEventos.innerHTML = `<div class="empty-state" style="text-align:center; padding: 30px;"><i class="ph-fill ph-trophy" style="font-size:40px; color:var(--text-muted);"></i><h4>No hay campeonatos próximos</h4></div>`;
            return;
        }
        contenedorEventos.innerHTML = eventos.map(e => {
            const fechaInicio = new Date(e.inicio).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            return `<article class="evento-publico-card" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:15px; margin-bottom:15px;">
                <div><span style="background:var(--primary-green); color:#000; font-size:0.7rem; font-weight:bold; padding:3px 8px; border-radius:4px;">TORNEO</span>
                <h3 style="margin:5px 0;">${e.nombre}</h3><p style="margin:0; color:var(--text-muted); font-size:0.85rem;"><i class="ph-bold ph-calendar"></i> Inicia: ${fechaInicio}</p></div>
                ${e.nota ? `<p style="margin-top:10px; font-size:0.9rem; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">${e.nota}</p>` : ''}
            </article>`;
        }).join('');
    } catch (error) { contenedorEventos.innerHTML = '<p style="color:var(--danger);">Error cargando eventos.</p>'; }
}
document.addEventListener('DOMContentLoaded', cargarEventosPublicos);

// ==========================================
// FASE 29: LINK EN BIO & CALIFICACIÓN (cancha.html)
// ==========================================
if (window.location.pathname.includes('cancha.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const slugParam = urlParams.get('slug');
    const idParam = urlParams.get('id');
    const fallbackParam = (!slugParam && !idParam && window.location.search.length > 1) 
        ? window.location.search.substring(1).split('&')[0].split('=')[0] 
        : null;
    let canchaId = idParam || null;
    let ratingSeleccionado = 0;
    let etiquetasSeleccionadas = new Map();
    let cPrincipalActual = null;

    const TAGS_POR_RATING = {
        5: [{ icon: "ph-leaf", text: "Césped impecable" }, { icon: "ph-lightbulb", text: "Buena iluminación" }, { icon: "ph-handshake", text: "Excelente atención" }, { icon: "ph-soccer-ball", text: "Pelotas buenas" }, { icon: "ph-shower", text: "Vestuarios limpios" }, { icon: "ph-car", text: "Estacionamiento" }],
        4: [{ icon: "ph-thumbs-up", text: "Buena experiencia" }, { icon: "ph-lightbulb", text: "Luz aceptable" }, { icon: "ph-buildings", text: "Buenas instalaciones" }, { icon: "ph-handshake", text: "Atención amable" }, { icon: "ph-map-pin", text: "Fácil acceso" }],
        3: [{ icon: "ph-scales", text: "Regular" }, { icon: "ph-leaf", text: "Césped desgastado" }, { icon: "ph-lightbulb", text: "Luz media" }, { icon: "ph-clock", text: "Demora en hora" }],
        2: [{ icon: "ph-warning-circle", text: "Mala iluminación" }, { icon: "ph-leaf", text: "Césped muy usado" }, { icon: "ph-shower", text: "Vestuarios descuidados" }, { icon: "ph-thumbs-down", text: "Mala atención" }],
        1: [{ icon: "ph-prohibit", text: "Pésimo estado" }, { icon: "ph-lightbulb", text: "Luces quemadas" }, { icon: "ph-clock", text: "Impuntualidad" }, { icon: "ph-smiley-sad", text: "Mala atención" }]
    };

    async function cargarDetalleCancha() {
        const identifier = slugParam || idParam || fallbackParam;
        if (!identifier) {
            const titleEl = document.getElementById('bio-title');
            if (titleEl) titleEl.textContent = 'Cancha no encontrada';
            return;
        }

        try {
            // 1. Intentar primero buscar por campo 'slug' (ej. 'fundo-excalibur')
            let docSnap = null;
            try {
                const qSlug = query(collection(db, 'canchas'), where('slug', '==', identifier), limit(1));
                const snapSlug = await getDocs(qSlug);
                if (!snapSlug.empty) {
                    docSnap = snapSlug.docs[0];
                }
            } catch (eSlug) {
                console.warn("Búsqueda por slug:", eSlug);
            }

            // Si no se encontró por slug, intentar por ID tradicional de Firestore
            if (!docSnap) {
                try {
                    const snapId = await getDoc(doc(db, 'canchas', identifier));
                    if (snapId.exists()) {
                        docSnap = snapId;
                    }
                } catch (eId) {
                    console.warn("Búsqueda por id:", eId);
                }
            }

            if (!docSnap || !docSnap.exists()) {
                const titleEl = document.getElementById('bio-title');
                if (titleEl) titleEl.textContent = 'Cancha no encontrada';
                return;
            }

            const cPrincipal = docSnap.data();
            cPrincipal.id = docSnap.id;
            canchaId = docSnap.id;
            window.canchaIdActual = canchaId;
            cPrincipalActual = cPrincipal;

            // Mantener la URL lo más limpia posible si existe slug
            if (cPrincipal.slug) {
                const queryLimpia = `?slug=${encodeURIComponent(cPrincipal.slug)}`;
                if (!window.location.search.includes(`slug=${cPrincipal.slug}`)) {
                    try {
                        window.history.replaceState({ slug: cPrincipal.slug }, '', `cancha.html${queryLimpia}`);
                    } catch (eH) {}
                }
            }

            // Determinar el UID del dueño
            const ownerUid = cPrincipal.usuarioUid || cPrincipal.ownerUid || cPrincipal.uid || docSnap.id;

            // 2. Pintar cabecera e información general del complejo
            const coverEl = document.getElementById('bio-cover');
            if (coverEl) coverEl.src = cPrincipal.fotos?.length ? cPrincipal.fotos[0] : 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=1000&q=85';

            const logoEl = document.getElementById('bio-logo');
            if (logoEl) logoEl.src = cPrincipal.logo || 'https://via.placeholder.com/100';

            const titleEl = document.getElementById('bio-title');
            if (titleEl) titleEl.textContent = cPrincipal.nombre || 'Complejo Deportivo';

            const locEl = document.getElementById('bio-location');
            if (locEl) locEl.innerHTML = `<i class="ph-bold ph-map-pin"></i> ${cPrincipal.ubicacionTexto || cPrincipal.distrito || 'Ubicación'}`;

            const descEl = document.getElementById('bio-desc');
            if (descEl) descEl.textContent = cPrincipal.descripcion || 'Sin descripción disponible.';

            const btnMapa = document.getElementById('btn-mapa-bio');
            if (btnMapa) {
                if (cPrincipal.ubicacionLink) {
                    btnMapa.href = cPrincipal.ubicacionLink;
                    btnMapa.style.display = 'inline-flex';
                } else {
                    btnMapa.style.display = 'none';
                }
            }

            // Configurar botón de Compartir Complejo
            const btnCompartir = document.getElementById('btn-compartir-bio');
            if (btnCompartir) {
                btnCompartir.onclick = async () => {
                    const baseOrigin = window.location.href.split('?')[0];
                    const cleanUrl = cPrincipal.slug 
                        ? `${baseOrigin}?slug=${encodeURIComponent(cPrincipal.slug)}` 
                        : `${baseOrigin}?id=${encodeURIComponent(canchaId)}`;
                    
                    const shareData = {
                        title: `${cPrincipal.nombre || 'Cancha'} | CHALACAPP`,
                        text: `¡Mira ${cPrincipal.nombre || 'este complejo'} en CHALACAPP y reserva tu cancha!`,
                        url: cleanUrl
                    };

                    if (navigator.share) {
                        try {
                            await navigator.share(shareData);
                            return;
                        } catch (errShare) {
                            if (errShare?.name !== 'AbortError') console.warn('Error en share:', errShare);
                        }
                    }

                    // Fallback portapapeles
                    try {
                        await navigator.clipboard.writeText(cleanUrl);
                        if (window.toast) window.toast("¡Enlace copiado al portapapeles!", "success");
                        else alert("¡Enlace copiado al portapapeles!");
                    } catch (eClip) {
                        prompt("Copia el enlace de este complejo:", cleanUrl);
                    }
                };
            }

            // 3. CONSULTAR CANCHAS PRINCIPALES Y SECUNDARIAS (ESPACIOS) DEL DUEÑO
            const mapCanchas = new Map();

            // A) Agregar la cancha principal con sus horarios
            const aperturaBase = cPrincipal.horaApertura || cPrincipal.horaInicio || '08:00';
            const cierreBase = cPrincipal.horaCierre || cPrincipal.horaFin || '23:00';

            mapCanchas.set(cPrincipal.id, {
                id: cPrincipal.id,
                nombreCancha: cPrincipal.nombreCancha || cPrincipal.nombre || 'Cancha Principal',
                tipo: cPrincipal.tipo || (Array.isArray(cPrincipal.tiposCancha) ? cPrincipal.tiposCancha[0] : cPrincipal.tipoCancha) || 'Fútbol',
                precio: Number(cPrincipal.precio || 0),
                horaApertura: aperturaBase,
                horaCierre: cierreBase,
                isOpen: canchaEstaAbierta(cPrincipal),
                ...cPrincipal
            });

            // B) Buscar en la colección 'espacios' asignando herencia de horarios
            if (ownerUid) {
                try {
                    const qEspacios = query(collection(db, 'espacios'), where('ownerUid', '==', ownerUid));
                    const snapEspacios = await getDocs(qEspacios);
                    snapEspacios.forEach(d => {
                        const data = d.data();
                        mapCanchas.set(d.id, {
                            id: d.id,
                            nombreCancha: data.nombre || 'Cancha Individual',
                            tipo: data.tipo || 'Fútbol',
                            precio: Number(data.precio || cPrincipal.precio || 0),
                            // 🔥 HERENCIA AUTOMÁTICA DE HORARIOS: Si el espacio no especifica, usa los del complejo
                            horaApertura: data.horaApertura || aperturaBase,
                            horaCierre: data.horaCierre || cierreBase,
                            precioNoche: data.precioNoche,
                            tienePrecioNoche: data.tienePrecioNoche,
                            horaInicioNoche: data.horaInicioNoche,
                            isOpen: true,
                            ...data,
                            nombreComplejo: cPrincipal.nombre,
                            usuarioUid: ownerUid
                        });
                    });
                } catch (eEspacios) {
                    console.warn("Error al consultar espacios:", eEspacios);
                }
            }
            // C) Buscar en la colección 'canchas' por si hay otras secundarias
            try {
                const qCanchas = query(collection(db, 'canchas'), where('usuarioUid', '==', ownerUid));
                const snapCanchas = await getDocs(qCanchas);
                snapCanchas.forEach(d => {
                    const data = d.data();
                    if (!mapCanchas.has(d.id)) {
                        mapCanchas.set(d.id, {
                            id: d.id,
                            nombreCancha: data.nombreCancha || data.nombre || 'Cancha',
                            tipo: data.tipo || 'Fútbol',
                            precio: Number(data.precio || 0),
                            isOpen: canchaEstaAbierta(data),
                            ...data
                        });
                    }
                });
            } catch (eCanchas) {
                console.warn("Error al consultar canchas secundarias:", eCanchas);
            }

            // Convertir a Array global para el modal de reservas
            canchasGlobales = Array.from(mapCanchas.values());
            window.canchasGlobales = canchasGlobales;

            // 4. DIBUJAR LA LISTA COMPLETA DE CANCHAS DISPONIBLES EN #lista-canchas-complejo
            const contenedorLista = document.getElementById('lista-canchas-complejo');
            if (contenedorLista) {
                let htmlLista = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
                        <div>
                            <span class="mini-label" style="color:var(--primary-green); font-size:0.75rem; font-weight:800; letter-spacing:1px;">ESPACIOS DEL COMPLEJO</span>
                            <h3 style="color:#fff; margin:4px 0 0 0; font-size:1.3rem; font-weight:800;">Canchas Disponibles</h3>
                        </div>
                        <span style="background:rgba(46,204,113,0.1); color:var(--primary-green); border:1px solid rgba(46,204,113,0.3); border-radius:20px; padding:4px 12px; font-size:0.78rem; font-weight:800;">
                            ${canchasGlobales.length} ${canchasGlobales.length === 1 ? 'Cancha' : 'Canchas'}
                        </span>
                    </div>
                `;

                canchasGlobales.forEach((c) => {
                    const nombreMostrar = c.nombreCancha || c.nombre || 'Cancha';
                    const deporteMostrar = c.tipo || 'Fútbol';
                    const precioMostrar = c.precio ? `S/ ${c.precio}` : 'Consultar';
                    const deporteIcono = deporteMostrar.toLowerCase().includes('voley') || deporteMostrar.toLowerCase().includes('vóley')
                        ? 'ph-volleyball'
                        : deporteMostrar.toLowerCase().includes('basket') || deporteMostrar.toLowerCase().includes('básquet')
                        ? 'ph-basketball'
                        : 'ph-soccer-ball';

                    htmlLista += `
                    <div class="card subcancha-card" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.09); border-radius:14px; padding:18px 20px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; transition:border-color 0.2s, background 0.2s;">
                        <div style="flex:1; min-width:180px;">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                                <span style="display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:10px; background:rgba(46,204,113,0.12); color:var(--primary-green); font-size:1.2rem;">
                                    <i class="ph-bold ${deporteIcono}"></i>
                                </span>
                                <h4 style="margin:0; color:#fff; font-size:1.1rem; font-weight:700;">${nombreMostrar}</h4>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px; font-size:0.88rem; color:#aaa;">
                                <span>${deporteMostrar}</span>
                                <span>·</span>
                                <span style="color:var(--primary-green); font-weight:800; font-size:0.95rem;">${precioMostrar}</span>
                                <small style="color:#777;">/ hr</small>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <button class="btn btn-reservar-dinamico" data-id="${c.id}" style="padding:10px 18px; font-weight:800; font-size:0.88rem; display:inline-flex; align-items:center; gap:6px;">
                                <i class="ph-bold ph-calendar-plus"></i> Reservar
                            </button>
                        </div>
                    </div>
                    `;
                });

                contenedorLista.innerHTML = htmlLista;

                // Conectar botones de reservar con el modal de horarios
                contenedorLista.querySelectorAll('.btn-reservar-dinamico').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const targetId = btn.dataset.id;
                        if (window.abrirModal) {
                            window.abrirModal(targetId);
                        }
                    });
                });
            }

        } catch (e) {
            console.error("Error cargando detalle:", e);
        }

        // Carga defensiva de reseñas
        try {
            await refrescarPromedio();
            setupRatingForm();
        } catch (eResenas) {
            console.warn("Carga defensiva: no se pudieron cargar reseñas pero el complejo sigue cargando:", eResenas);
        }
    }
    async function refrescarPromedio() {
        try {
            const q = query(collection(db, 'resenas'), where('canchaId', '==', canchaId));
            const resenasSnap = await getDocs(q);
            const resenasLista = resenasSnap.docs.map(d => d.data());
            const total = resenasLista.length;
            const sum = resenasLista.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
            const prom = total > 0 ? (sum / total).toFixed(1) : "0.0";
            const ratingEl = document.getElementById('court-rating');
            if (ratingEl) {
                ratingEl.innerHTML = `<div class="rating-badge-minimal" style="font-size:1.5rem; padding: 5px 15px;"><span style="font-weight:900;">${prom}</span><i class="ph-fill ph-star"></i></div><small style="color:var(--text-muted); margin-top:8px; display:block;">Basado en ${total} calificaciones</small>`;
            }
        } catch (e) { console.error(e); }
    }

    function setupRatingForm() {
        const stars = document.querySelectorAll('#star-picker i');
        const starLabel = document.getElementById('star-label');
        const tagsBox = document.getElementById('quick-tags-box');
        const tagsContainer = document.getElementById('quick-tags-container');
        const btnSubmit = document.getElementById('btn-submit-review');

        stars.forEach(star => {
            star.onclick = () => {
                ratingSeleccionado = Number(star.dataset.val);
                etiquetasSeleccionadas.clear();
                stars.forEach(s => {
                    if (Number(s.dataset.val) <= ratingSeleccionado) {
                        s.style.color = '#f1c40f'; s.classList.add('selected');
                    } else {
                        s.style.color = '#333'; s.classList.remove('selected');
                    }
                });

                const labels = { 1: "Pésimo", 2: "Malo", 3: "Regular", 4: "Bueno", 5: "¡Excelente!" };
                starLabel.textContent = labels[ratingSeleccionado];
                starLabel.style.color = '#f1c40f';

                const tagsDisponibles = TAGS_POR_RATING[ratingSeleccionado] || [];
                tagsContainer.innerHTML = tagsDisponibles.map(t => `<div class="tag-chip" data-icon="${t.icon}" data-text="${t.text}" style="border:1px solid #555; padding:6px 12px; border-radius:20px; font-size:0.8rem; cursor:pointer;"><i class="ph-bold ${t.icon}"></i> ${t.text}</div>`).join('');
                tagsBox.style.display = 'block';

                tagsContainer.querySelectorAll('.tag-chip').forEach(chip => {
                    chip.onclick = () => {
                        const icon = chip.dataset.icon, text = chip.dataset.text, key = `${icon}|${text}`;
                        if (etiquetasSeleccionadas.has(key)) {
                            etiquetasSeleccionadas.delete(key);
                            chip.style.background = 'transparent'; chip.style.color = '#fff'; chip.style.borderColor = '#555';
                        } else {
                            etiquetasSeleccionadas.set(key, true);
                            chip.style.background = 'rgba(241,196,15,0.1)'; chip.style.color = '#f1c40f'; chip.style.borderColor = '#f1c40f';
                        }
                    };
                });
                btnSubmit.disabled = false;
                btnSubmit.style.background = 'linear-gradient(45deg, #f1c40f, #e67e22)';
                btnSubmit.style.color = '#000';
                btnSubmit.style.fontWeight = 'bold';
            };
        });

        btnSubmit.onclick = async () => {
            if (!ratingSeleccionado) return;
            if (!usuarioActual) {
                window.toast("Debes iniciar sesión con Google para calificar.", "warning");
                try { await signInWithPopup(auth, new GoogleAuthProvider()); if (!auth.currentUser) return; } catch (e) { return; }
            }
            btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Publicando...';

            try {
                const resenaUnicaId = `${canchaId}_${auth.currentUser.uid}`;
                const refResena = doc(db, 'resenas', resenaUnicaId);

                // 🔥 MAGIA AQUÍ: Verificamos si ya existe antes de que Firebase nos bloquee
                const snapResena = await getDoc(refResena);
                if (snapResena.exists()) {
                    window.toast("Ya calificaste esta cancha anteriormente.", "warning");
                    btnSubmit.textContent = 'Publicar Calificación'; btnSubmit.disabled = true;
                    btnSubmit.style.background = 'rgba(255,255,255,0.05)'; btnSubmit.style.color = '#888';
                    return;
                }

                // SI NO EXISTÍA, GUARDAMOS
                await setDoc(refResena, {
                    canchaId: canchaId, usuarioUid: auth.currentUser.uid, nombre: auth.currentUser.displayName || 'Jugador',
                    rating: ratingSeleccionado, tags: Array.from(etiquetasSeleccionadas.keys()), createdAt: serverTimestamp()
                });

                window.toast("¡Calificación registrada con éxito!", "success");
                ratingSeleccionado = 0; etiquetasSeleccionadas.clear();
                stars.forEach(s => { s.style.color = '#333'; s.classList.remove('selected'); });
                tagsBox.style.display = 'none'; starLabel.textContent = "Toca las estrellas para calificar"; starLabel.style.color = 'var(--text-muted)';
                btnSubmit.textContent = 'Publicar Calificación'; btnSubmit.disabled = true;
                btnSubmit.style.background = 'rgba(255,255,255,0.05)'; btnSubmit.style.color = '#888';
                await refrescarPromedio();

            } catch (e) {
                console.error(e);
                // Si aún así Firebase rechaza por reglas de seguridad
                if (e.code === 'permission-denied') {
                    window.toast("Ya calificaste esta cancha.", "warning");
                } else {
                    window.toast("Ocurrió un error al publicar.", "error");
                }
                btnSubmit.disabled = false; btnSubmit.textContent = 'Publicar Calificación';
            }
        };
    }
    document.addEventListener('DOMContentLoaded', cargarDetalleCancha);
}

// ==========================================
// MÓDULO INTELIGENTE: GPS, SLIDER Y MEMORIA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // 1. EFECTO DESENFOQUE (BLUR) PARA EL CARRUSEL
    const sliderLista = document.getElementById('lista-canchas');
    if (sliderLista) {
        const blurObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.filter = 'blur(0px)';
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'scale(1)';
                } else {
                    entry.target.style.filter = 'blur(4px)';
                    entry.target.style.opacity = '0.4';
                    entry.target.style.transform = 'scale(0.92)';
                }
            });
        }, { root: sliderLista, threshold: 0.6 });

        const domObserver = new MutationObserver((mutations) => {
            mutations.forEach(mut => {
                mut.addedNodes.forEach(node => {
                    if (node.classList && node.classList.contains('card')) {
                        blurObserver.observe(node);
                    }
                });
            });
        });
        domObserver.observe(sliderLista, { childList: true });

        // BOTONES DE NAVEGACIÓN DEL CARRUSEL
        const btnPrev = document.getElementById('slider-prev');
        const btnNext = document.getElementById('slider-next');
        const scrollAmount = 320;

        if (btnNext && btnPrev) {
            btnNext.onclick = () => sliderLista.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            btnPrev.onclick = () => sliderLista.scrollBy({ left: -scrollAmount, behavior: 'smooth' });

            sliderLista.addEventListener('scroll', () => {
                btnPrev.style.display = sliderLista.scrollLeft <= 10 ? 'none' : 'flex';
                const maxScroll = sliderLista.scrollWidth - sliderLista.clientWidth;
                btnNext.style.display = sliderLista.scrollLeft >= (maxScroll - 10) ? 'none' : 'flex';
            });
            setTimeout(() => sliderLista.dispatchEvent(new Event('scroll')), 500);
        }
    }

    // 2. MODAL GPS (GEOLOCALIZACIÓN DEL DEPARTAMENTO CON MEMORIA LOCALSTORAGE)
    const modalGps = document.getElementById('modal-ubicacion');
    const yaTieneDepto = localStorage.getItem('departamentoSeleccionado');
    const yaPreguntado = localStorage.getItem('gpsPreguntado');

    // No mostrar el modal si ya existe un departamento memorizado o ya se preguntó
    if (modalGps && !yaTieneDepto && !yaPreguntado) {
        setTimeout(() => { 
            modalGps.style.display = 'flex'; 
        }, 1200);
    }

    const cerrarModalGps = () => {
        localStorage.setItem('gpsPreguntado', 'true');
        if (modalGps) modalGps.style.display = 'none';
    };

    document.getElementById('btn-cerrar-gps')?.addEventListener('click', cerrarModalGps);

    document.getElementById('btn-detectar-gps')?.addEventListener('click', () => {
        const btn = document.getElementById('btn-detectar-gps');
        const textoOriginal = btn ? btn.innerHTML : '';
        if (btn) btn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Ubicando...';

        if (!navigator.geolocation) {
            cerrarModalGps();
            return;
        }

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const lat = pos?.coords?.latitude;
            const lon = pos?.coords?.longitude;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const data = await res.json();
                let dpto = data?.address?.state || data?.address?.region || '';
                dpto = dpto.replace(' Department', '').replace(' Región', '').replace(' Region', '').trim();

                const selectDept = document.getElementById('filtro-ciudad');
                let deptoEncontrado = null;
                if (selectDept && dpto) {
                    const dptoNorm = normalizar(dpto);
                    for (let i = 0; i < selectDept.options.length; i++) {
                        if (normalizar(selectDept.options[i].value) === dptoNorm) {
                            selectDept.selectedIndex = i;
                            deptoEncontrado = selectDept.options[i].value;
                            selectDept.dispatchEvent(new Event('change'));
                            break;
                        }
                    }
                }

                if (deptoEncontrado) {
                    localStorage.setItem('departamentoSeleccionado', deptoEncontrado);
                    window.toast?.(`Ubicación detectada: ${deptoEncontrado}`, 'success');
                }
            } catch (e) {
                console.warn("Geolocalización inversa no disponible:", e);
            } finally {
                cerrarModalGps();
                if (btn) btn.innerHTML = textoOriginal;
            }
        }, (err) => {
            // Usuario rechaza permisos o falla la API: NO BLOQUEAR LA APP
            console.warn("Ubicación rechazada o no disponible:", err);
            cerrarModalGps();
            if (btn) btn.innerHTML = textoOriginal;
        }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
    });
});
