import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { calcularDisponibilidad, fechaISO } from './availability.js';
let bloqueosDia = [];

function escapeHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function minutosHora(h) {
    const m = String(h || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
}

function calcularPrecioTurnoAdmin(espacio, hora) {
    const baseDia = Number(espacio?.precio ?? canchaActual?.precio ?? 0);
    const tieneNoche = espacio?.tienePrecioNoche !== undefined ? !!espacio.tienePrecioNoche : !!canchaActual?.tienePrecioNoche;
    const precioNoche = Number(espacio?.precioNoche || canchaActual?.precioNoche || 0);
    const horaInicioNoche = espacio?.horaInicioNoche || canchaActual?.horaInicioNoche || '18:00';
    if (tieneNoche && precioNoche > 0 && hora) {
        const minSlot = minutosHora(hora);
        const minNoche = minutosHora(horaInicioNoche);
        if (minSlot !== null && minNoche !== null && minSlot >= minNoche) {
            return precioNoche;
        }
    }
    return baseDia;
}

window.customConfirm = function (mensaje) {
    return new Promise((resolve) => {
        let overlay = document.getElementById('custom-confirm-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'custom-confirm-overlay';
            overlay.innerHTML = `
                <div class="custom-confirm-box">
                    <i class="ph-fill ph-warning-circle"></i>
                    <p id="custom-confirm-msg" style="margin:0; font-size:1.05rem; color:#fff; line-height:1.4;"></p>
                    <div class="custom-confirm-buttons">
                        <button id="btn-confirm-no" class="btn-confirm-no">Cancelar</button>
                        <button id="btn-confirm-yes" class="btn-confirm-yes">Aceptar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        document.getElementById('custom-confirm-msg').textContent = mensaje;
        overlay.classList.add('show');
        document.getElementById('btn-confirm-yes').onclick = () => { overlay.classList.remove('show'); resolve(true); };
        document.getElementById('btn-confirm-no').onclick = () => { overlay.classList.remove('show'); resolve(false); };
    });
};

const firebaseConfig = { apiKey: "AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk", authDomain: "app-futbol-acd0f.firebaseapp.com", projectId: "app-futbol-acd0f", storageBucket: "app-futbol-acd0f.firebasestorage.app", messagingSenderId: "223446110165", appId: "1:223446110165:web:219afce6a9dac03203f75c" };
const app = getApps().length ? getApp() : initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app), storage = getStorage(app);
let usuarioActual = null, canchaActual = null, reservasDia = [], espacios = [], espacioSeleccionado = null;
let fechaSeleccionada = new Date(); const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']; const fechaHoy = () => fechaISO(new Date()); const normalizar = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); const money = n => `S/ ${Number(n || 0).toFixed(2)}`; const toast = (msg, error = false) => { const el = document.getElementById('toast-admin'); if (!el) return; el.textContent = msg; el.className = `admin-toast show ${error ? 'error' : ''}`; clearTimeout(window.__toast); window.__toast = setTimeout(() => el.className = 'admin-toast', 2800) }; const horaActual = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }; const fechaTexto = d => new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }).format(d); const horarioDefault = () => Object.fromEntries(dias.map((dia, i) => [dia, { activo: i > 0 && i < 6, apertura: '16:00', cierre: '23:00' }]));

function horarioDelDia() { const nombre = dias[fechaSeleccionada.getDay()], semanal = espacioSeleccionado?.horariosSemana?.[nombre] || canchaActual?.horariosSemana?.[nombre]; if (semanal) return semanal; return { activo: true, apertura: espacioSeleccionado?.horaApertura || canchaActual?.horaApertura || '16:00', cierre: espacioSeleccionado?.horaCierre || canchaActual?.horaCierre || '23:00' } }
function renderWeekDays() { const box = document.getElementById('week-days'); if (!box) return; const base = new Date(); base.setHours(0, 0, 0, 0); box.innerHTML = Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); const active = fechaISO(d) === fechaISO(fechaSeleccionada); return `<button type="button" class="week-day ${active ? 'active' : ''}" data-date="${fechaISO(d)}"><small>${new Intl.DateTimeFormat('es-PE', { weekday: 'short' }).format(d).replace('.', '')}</small><strong>${d.getDate()}</strong><span>${i === 0 ? 'HOY' : new Intl.DateTimeFormat('es-PE', { month: 'short' }).format(d).replace('.', '')}</span></button>` }).join(''); box.querySelectorAll('.week-day').forEach(b => b.addEventListener('click', () => { const [y, m, day] = b.dataset.date.split('-').map(Number); fechaSeleccionada = new Date(y, m - 1, day); fechaSeleccionada.setHours(0, 0, 0, 0); renderWeekDays(); actualizarDia() })) }
async function actualizarDia() { const texto = fechaTexto(fechaSeleccionada); document.getElementById('fecha-hoy').textContent = texto; document.getElementById('schedule-title').textContent = `Horarios · ${texto}`; document.getElementById('reservas-title').textContent = `Reservas · ${texto}`; const box = document.getElementById('admin-schedule'), list = document.getElementById('lista-reservas'); if (box) box.innerHTML = '<div class="admin-loading"><i class="ph-bold ph-spinner-gap"></i> Cargando horarios...</div>'; if (list) list.innerHTML = '<div class="admin-loading"><i class="ph-bold ph-spinner-gap"></i> Cargando reservas...</div>'; try { await cargarReservas(); renderSchedule(); renderReservas() } catch (e) { console.error(e); reservasDia = []; renderSchedule(); renderReservas(); toast('No pudimos leer las reservas. Mostramos los horarios disponibles.', true) } }

function normalizarSuperficie(s) {
    if (!s) return 'Sintética';
    const str = String(s).trim();
    if (/losa|futsal|cemento/i.test(str)) return 'Losa / Cemento';
    if (/pasto\s*natural/i.test(str)) return 'Pasto Natural';
    if (/parquet|coliseo/i.test(str)) return 'Parquet / Coliseo';
    if (/arena/i.test(str)) return 'Arena';
    if (/sint[eé]tica/i.test(str)) return 'Sintética';
    const validas = ['Sintética', 'Losa / Cemento', 'Pasto Natural', 'Parquet / Coliseo', 'Arena'];
    return validas.includes(str) ? str : 'Sintética';
}

function parsearTipoCancha(data) {
    let formato = 7;
    let superficie = 'Sintética';

    if (data?.formatoJugadores != null || data?.formato != null) {
        const f = parseInt(data.formatoJugadores ?? data.formato, 10);
        if (!isNaN(f)) formato = Math.min(11, Math.max(5, f));
    }
    if (data?.superficie) {
        superficie = data.superficie;
    }

    if ((data?.formatoJugadores == null && data?.formato == null) || !data?.superficie) {
        const raw = (Array.isArray(data?.tiposCancha) && data.tiposCancha[0]) || data?.tipoCancha || data?.tipo || '';
        if (raw) {
            const matchSeparado = raw.match(/Fútbol\s+(\d+)\s*-\s*(.+)/i);
            if (matchSeparado) {
                if (data?.formatoJugadores == null && data?.formato == null) {
                    const f = parseInt(matchSeparado[1], 10);
                    if (!isNaN(f)) formato = Math.min(11, Math.max(5, f));
                }
                if (!data?.superficie) {
                    superficie = normalizarSuperficie(matchSeparado[2].trim());
                }
            } else {
                const matchFutbol = raw.match(/Fútbol\s+(\d+)/i);
                if (matchFutbol && data?.formatoJugadores == null && data?.formato == null) {
                    const f = parseInt(matchFutbol[1], 10);
                    if (!isNaN(f)) formato = Math.min(11, Math.max(5, f));
                }
                if (!data?.superficie) {
                    superficie = normalizarSuperficie(raw);
                }
            }
        }
    }

    return { formato, superficie: normalizarSuperficie(superficie) };
}

async function cargarPerfil() {
    const snap = await getDoc(doc(db, 'canchas', usuarioActual.uid));

    let bannerEstado = document.getElementById('banner-publicacion');
    if (!bannerEstado) {
        bannerEstado = document.createElement('div');
        bannerEstado.id = 'banner-publicacion';
        bannerEstado.style.cssText = 'padding:15px; margin-bottom:20px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;';
        document.querySelector('.admin-heading').insertAdjacentElement('afterend', bannerEstado);
    }

    if (!snap.exists()) {
        toast('Bienvenido. Configura los datos de tu complejo en Ajustes.', false);
        document.getElementById('nombre-cancha-admin').textContent = 'Complejo Nuevo (Sin Configurar)';
        canchaActual = { id: usuarioActual.uid, configurado: false };

        bannerEstado.style.background = 'rgba(255, 193, 7, 0.15)';
        bannerEstado.style.border = '1px solid var(--warning)';
        bannerEstado.innerHTML = `<div><strong style="color:var(--warning); display:block;">Paso 1: Configura tu Negocio</strong><span style="font-size:0.8rem; color:#ccc;">Ve a la pestaña "Ajustes", llena tus datos y dale a "Guardar Ajustes Generales".</span></div>`;

        return true;
    }

    canchaActual = { id: snap.id, ...snap.data() };

    const estadoPub = canchaActual.estadoPublicacion || 'draft';
    if (estadoPub === 'draft') {
        bannerEstado.style.background = 'rgba(255, 193, 7, 0.15)'; bannerEstado.style.border = '1px solid var(--warning)';
        bannerEstado.innerHTML = `<div><strong style="color:var(--warning); display:block;">Cancha en Borrador (No visible)</strong><span style="font-size:0.8rem; color:#ccc;">Termina de configurar tus datos y solicita la publicación.</span></div><button id="btn-solicitar-pub" class="btn btn-primary" style="width:auto; padding:8px 15px;">Solicitar Revisión</button>`;
        document.getElementById('btn-solicitar-pub').onclick = async () => {
            if (!canchaActual?.configurado) return toast('Guarda la configuración de tu cancha primero.', true);
            try {
                const tieneNocheRev = Boolean(document.getElementById('admin-check-noche')?.checked ?? canchaActual?.tienePrecioNoche);
                const payloadRev = sanitizeForFirestore({
                    nombre: String(canchaActual?.nombre || document.getElementById('admin-nombre')?.value || '').trim(),
                    precio: Number(canchaActual?.precio ?? document.getElementById('admin-precio')?.value ?? 0) || 0,
                    lat: String(canchaActual?.lat ?? document.getElementById('admin-lat')?.value ?? '').trim(),
                    lng: String(canchaActual?.lng ?? document.getElementById('admin-lng')?.value ?? '').trim(),
                    tienePrecioNoche: tieneNocheRev,
                    horaInicioNoche: String(document.getElementById('admin-hora-noche')?.value || canchaActual?.horaInicioNoche || '18:00').trim() || '18:00',
                    precioNoche: tieneNocheRev ? (Number(document.getElementById('admin-precio-noche')?.value ?? canchaActual?.precioNoche ?? 0) || 0) : 0,
                    estadoPublicacion: 'pending_review',
                    updatedAt: serverTimestamp()
                });
                await updateDoc(doc(db, 'canchas', usuarioActual.uid), payloadRev);
                toast('Solicitud enviada a los administradores.');
                await cargarPerfil();
            } catch (errRev) {
                console.error('Error al solicitar revisión:', errRev);
                toast('No se pudo enviar la solicitud de revisión.', true);
            }
        };
    } else if (estadoPub === 'pending_review') {
        bannerEstado.style.background = 'rgba(23, 162, 184, 0.15)'; bannerEstado.style.border = '1px solid #17a2b8';
        bannerEstado.innerHTML = `<div><strong style="color:#17a2b8; display:block;">En Revisión</strong><span style="font-size:0.8rem; color:#ccc;">Tu cancha está siendo evaluada.</span></div>`;
    } else if (estadoPub === 'published') {
        bannerEstado.style.background = 'rgba(0, 217, 104, 0.15)'; bannerEstado.style.border = '1px solid var(--primary-green)';
        bannerEstado.innerHTML = `<div><strong style="color:var(--primary-green); display:block;">Cancha Publicada y Activa</strong><span style="font-size:0.8rem; color:#ccc;">Tu negocio es visible para todos los jugadores.</span></div>`;
    }

    const campos = {
        'admin-nombre': canchaActual.nombre,
        'admin-whatsapp': canchaActual.whatsapp,
        'admin-descripcion': canchaActual.descripcion,
        'admin-precio': canchaActual.precio,
        'admin-ubicacion-texto': canchaActual.ubicacionTexto,
        'admin-ubicacion-link': canchaActual.ubicacionLink,
        'admin-hora-inicio': canchaActual.horaApertura || canchaActual.horaInicio || '16:00',
        'admin-hora-cierre': canchaActual.horaCierre || canchaActual.horaFin || '23:00',
        'admin-intervalo': canchaActual.intervaloMinutos || canchaActual.duracionReserva || 60,
        'admin-lat': canchaActual.lat ?? '',
        'admin-lng': canchaActual.lng ?? ''
    };
    Object.entries(campos).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v ?? '' });

    // Cargar Tarifa Nocturna Diferenciada en Ajustes del Complejo
    const elCheckNoche = document.getElementById('admin-check-noche');
    const elCajaNoche = document.getElementById('admin-caja-noche');
    const elHoraNoche = document.getElementById('admin-hora-noche');
    const elPrecioNoche = document.getElementById('admin-precio-noche');
    if (elCheckNoche) {
        elCheckNoche.checked = !!canchaActual.tienePrecioNoche;
        if (elCajaNoche) elCajaNoche.style.display = elCheckNoche.checked ? 'flex' : 'none';
    }
    if (elHoraNoche) elHoraNoche.value = canchaActual.horaInicioNoche || '18:00';
    if (elPrecioNoche) elPrecioNoche.value = canchaActual.precioNoche ?? '';

    if (canchaActual.metodosPago) {
        const elMetodos = document.getElementById('admin-pago-metodos');
        if (elMetodos) elMetodos.value = canchaActual.metodosPago.textoMetodos || '';

        const elNumero = document.getElementById('admin-pago-numero');
        if (elNumero) elNumero.value = canchaActual.metodosPago.numero || '';

        const elTitular = document.getElementById('admin-pago-titular');
        if (elTitular) elTitular.value = canchaActual.metodosPago.titular || '';

        const elReqSena = document.getElementById('admin-req-sena');
        if (elReqSena) elReqSena.checked = !!canchaActual.metodosPago.requiereSena;

        const elMontoSena = document.getElementById('admin-monto-sena');
        if (elMontoSena) elMontoSena.value = canchaActual.metodosPago.montoSena || '';
    }

    const dpto = canchaActual.departamento || '';
    const dist = canchaActual.distrito ?? canchaActual.ciudad ?? '';
    const elDpto = document.getElementById('admin-cancha-departamento') || document.getElementById('admin-departamento');
    const elDist = document.getElementById('admin-cancha-distrito') || document.getElementById('admin-distrito');
    if (elDpto && dpto) {
        elDpto.value = dpto;
        elDpto.dispatchEvent(new Event('change'));
    }
    if (elDist && dist) {
        elDist.value = dist;
    }

    const parsed = parsearTipoCancha(canchaActual);
    const elFormato = document.getElementById('admin-formato');
    if (elFormato) elFormato.value = parsed.formato;
    const elSuperficie = document.getElementById('admin-superficie');
    if (elSuperficie) elSuperficie.value = parsed.superficie;

    const elTipos = document.getElementById('admin-tipos');
    if (elTipos) { if (elTipos.tagName === 'SELECT') { elTipos.value = `Fútbol ${parsed.formato} - ${parsed.superficie}`; } else { const checkBoxes = elTipos.querySelectorAll('input[type=checkbox]'); checkBoxes.forEach(c => { c.checked = (canchaActual.tiposCancha || []).includes(c.value); }); } }

    renderWeeklyHours(canchaActual.horariosSemana || horarioDefault());
    document.getElementById('nombre-cancha-admin').textContent = canchaActual.nombre ? `${canchaActual.nombre} · Panel` : 'Mi Cancha';
    return true;
}

async function cargarEspacios() {
    const q = query(collection(db, 'espacios'), where('ownerUid', '==', usuarioActual.uid));
    const snap = await getDocs(q);
    espacios = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const todos = [
        {
            id: usuarioActual.uid,
            nombre: canchaActual.nombre || 'Cancha principal',
            tipoCancha: (Array.isArray(canchaActual.tiposCancha) ? canchaActual.tiposCancha[0] : canchaActual.tipoCancha) || 'Sintética',
            horaApertura: canchaActual.horaApertura || '16:00',
            horaCierre: canchaActual.horaCierre || '23:00',
            horariosSemana: canchaActual.horariosSemana,
            precio: Number(canchaActual.precio || 0),
            tienePrecioNoche: !!canchaActual.tienePrecioNoche,
            horaInicioNoche: canchaActual.horaInicioNoche || '18:00',
            precioNoche: Number(canchaActual.precioNoche || 0)
        },
        ...espacios.map(e => ({
            id: e.id,
            nombre: e.nombre,
            tipoCancha: e.tipo || 'Fútbol',
            horaApertura: e.horaApertura || canchaActual.horaApertura || '16:00',
            horaCierre: e.horaCierre || canchaActual.horaCierre || '23:00',
            horariosSemana: canchaActual.horariosSemana,
            precio: Number(e.precio ?? canchaActual.precio ?? 0),
            tienePrecioNoche: e.tienePrecioNoche !== undefined ? !!e.tienePrecioNoche : !!canchaActual.tienePrecioNoche,
            horaInicioNoche: e.horaInicioNoche || canchaActual.horaInicioNoche || '18:00',
            precioNoche: Number(e.precioNoche ?? canchaActual.precioNoche ?? 0)
        }))
    ];

    if (!espacioSeleccionado || !todos.find(x => x.id === espacioSeleccionado.id)) {
        espacioSeleccionado = todos[0];
    } else {
        espacioSeleccionado = todos.find(x => x.id === espacioSeleccionado.id) || todos[0];
    }

    let container = document.getElementById('dashboard-space-selector');
    if (!container) {
        const header = document.querySelector('.schedule-head');
        if (header) {
            container = document.createElement('div');
            container.id = 'dashboard-space-selector';
            header.appendChild(container);
        }
    }

    if (container) {
        container.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:6px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1);">
                <i class="ph-bold ph-soccer-ball" style="color:var(--primary-green, #2ecc71); font-size:1.1rem;"></i>
                <select id="select-cancha-activa" style="background:transparent; color:#fff; border:none; font-size:0.9rem; font-weight:bold; outline:none; cursor:pointer;">
                    ${todos.map(s => `<option value="${escapeHTML(s.id)}" ${s.id === espacioSeleccionado.id ? 'selected' : ''} style="background:#111; color:#fff;">${escapeHTML(s.nombre)} (${escapeHTML(s.tipoCancha)})</option>`).join('')}
                </select>
            </div>
        `;

        document.getElementById('select-cancha-activa').addEventListener('change', (e) => {
            espacioSeleccionado = todos.find(x => x.id === e.target.value);
            actualizarDia();
        });
    }
}

window.addEventListener('chalacapp:espacios-updated', async () => {
    if (usuarioActual && canchaActual) {
        await cargarEspacios();
        await actualizarDia();
    }
});

async function cargarReservas() {
    const idCancha = String(espacioSeleccionado?.id || canchaActual?.id || usuarioActual.uid);
    const fISO = fechaISO(fechaSeleccionada);
    const [snapReservas, snapBloqueos] = await Promise.all([
        getDocs(query(collection(db, 'reservas'), where('canchaId', '==', idCancha), where('fecha', '==', fISO))),
        getDocs(query(collection(db, 'bloqueos'), where('canchaId', '==', idCancha), where('fecha', '==', fISO)))
    ]);
    reservasDia = snapReservas.docs.map(d => ({ id: d.id, ...d.data() }));
    bloqueosDia = snapBloqueos.docs.map(d => ({ id: d.id, ...d.data() }));
}

function estadoReserva(r) {
    const st = normalizar(r?.estado || 'pending');
    if (['pendiente', 'pending'].includes(st)) return 'pending';
    if (['confirmada', 'confirmed', 'sena_pagada', 'seña_pagada'].includes(st)) return 'confirmed';
    if (['cancelada', 'cancelado', 'cancelled'].includes(st)) return 'cancelled';
    if (['completada', 'completed', 'jugada'].includes(st)) return 'completed';
    if (['rechazada', 'rejected'].includes(st)) return 'rejected';
    return 'pending';
}

function esBloqueoManual(r) { return r?.tipo === 'bloqueo_manual' || r?.estado === 'bloqueada' }

function renderSchedule() {
    const box = document.getElementById('admin-schedule'); if (!box) return;
    const canchaConfig = {
        ...canchaActual,
        horaApertura: espacioSeleccionado?.horaApertura || canchaActual?.horaApertura || '16:00',
        horaCierre: espacioSeleccionado?.horaCierre || canchaActual?.horaCierre || '23:00',
        horariosSemana: espacioSeleccionado?.horariosSemana || canchaActual?.horariosSemana
    };
    const slots = calcularDisponibilidad(canchaConfig, fechaSeleccionada, reservasDia, bloqueosDia);

    if (!slots.length) {
        box.innerHTML = '<div class="admin-empty"><i class="ph-bold ph-moon"></i><b>Cancha cerrada o sin horarios</b><span>Revisa tu configuración semanal.</span></div>';
        actualizarKpis([]); return;
    }

    box.innerHTML = slots.map(s => {
        let cls = 'available';
        if (s.estado === 'reservado') cls = 'occupied';
        if (s.estado === 'bloqueado') cls = 'occupied blocked';
        if (s.estado === 'pasado') cls += ' past';
        const label = s.estado === 'reservado' ? 'Reservada' : s.estado === 'bloqueado' ? 'Bloqueada' : s.estado === 'pasado' ? 'Pasado' : 'Disponible';
        const precioTurno = calcularPrecioTurnoAdmin(espacioSeleccionado, s.hora);

        return `<button type="button" class="admin-slot ${cls}" data-slot="${escapeHTML(s.hora)}" data-reserva="${escapeHTML(s.reserva?.id || '')}" data-bloqueo="${escapeHTML(s.bloqueo?.id || '')}" title="Clic para gestionar">
            <span class="slot-time">${escapeHTML(s.hora)}</span>
            <span class="slot-status"><i class="ph-fill ph-circle"></i>${label} · S/ ${precioTurno}</span>
            ${s.reserva ? `<small>${escapeHTML(s.reserva.nombre || 'Cliente')}</small>` : ''}
        </button>`;
    }).join('');

    box.querySelectorAll('.admin-slot').forEach(b => b.addEventListener('click', () => gestionarSlot(b.dataset.slot, b.dataset.reserva, b.dataset.bloqueo)));
    actualizarKpis(slots);
}

function actualizarKpis(slots) {
    const clientes = reservasDia.filter(r => !['cancelled', 'rejected', 'cancelada', 'cancelado'].includes(estadoReserva(r)));
    document.getElementById('reservas-hoy').textContent = clientes.length;
    document.getElementById('reservas-count').textContent = clientes.length;
    document.getElementById('horas-libres').textContent = Math.max(0, slots.filter(s => s.estado === 'disponible').length);
    const totalIngresos = clientes.reduce((sum, r) => {
        const monto = Number(r.precioTotal ?? r.precio ?? calcularPrecioTurnoAdmin(espacioSeleccionado, r.horaInicio) ?? 0);
        return sum + monto;
    }, 0);
    document.getElementById('ingresos-hoy').textContent = money(totalIngresos);
}

async function gestionarSlot(hora, reservaId, bloqueoId) {
    if (reservaId) {
        const r = reservasDia.find(x => x.id === reservaId);
        if (r) abrirGestionReserva(r);
        return;
    }
    if (bloqueoId) {
        const confirmarLiberacion = window.customConfirm 
            ? await window.customConfirm(`¿Liberar el horario de las ${hora} para volver a recibir reservas?`)
            : confirm(`¿Liberar el horario de las ${hora} para volver a recibir reservas?`);
        if (!confirmarLiberacion) return;
        try { 
            await deleteDoc(doc(db, 'bloqueos', bloqueoId)); 
            toast('Horario liberado.'); 
            await refrescar(); 
        } catch (e) { 
            console.error(e);
            toast('No se pudo liberar.', true); 
        }
        return;
    }
    const confirmarBloqueo = window.customConfirm 
        ? await window.customConfirm(`¿Bloquear manualmente las ${hora}?\nNadie podrá reservar este horario.`)
        : confirm(`¿Bloquear manualmente las ${hora}?\nNadie podrá reservar este horario.`);
    if (!confirmarBloqueo) return;
    try {
        const idCancha = espacioSeleccionado?.id || canchaActual?.id || usuarioActual?.uid;
        await addDoc(collection(db, 'bloqueos'), { 
            ownerUid: usuarioActual.uid, 
            canchaId: idCancha, 
            fecha: fechaISO(fechaSeleccionada), 
            horaInicio: hora, 
            horaFin: hora, 
            motivo: 'Bloqueo manual', 
            createdAt: serverTimestamp() 
        });
        toast('Horario bloqueado.'); 
        await refrescar();
    } catch (e) { 
        console.error(e); 
        toast('No se pudo bloquear el horario.', true); 
    }
}

// SEMÁFORO DE RESERVAS Y CALIFICACIÓN DE JUGADOR
function abrirGestionReserva(r) {
    let m = document.getElementById('modal-gestion-reserva');
    if (!m) {
        m = document.createElement('div'); m.id = 'modal-gestion-reserva'; m.className = 'admin-modal';
        m.innerHTML = `<div class="admin-modal-card reservation-manage-card">
            <button type="button" class="btn-cerrar admin-modal-close" data-close="modal-gestion-reserva"><i class="ph-bold ph-x"></i></button>
            <span class="mini-label">GESTIÓN DE RESERVA</span>
            <h2 id="manage-title">Reserva</h2>
            <div id="manage-summary" class="manage-summary" style="margin-bottom: 20px;"></div>
            <div class="manage-actions" id="manage-buttons" style="display:flex; flex-direction:column; gap:10px;"></div>
        </div>`;
        document.body.appendChild(m);
        m.querySelector('[data-close]').onclick = () => {
            m.classList.remove('mostrar');
            m.style.display = '';
        };
    }
    m.dataset.reservaId = r?.id ?? '';
    const st = estadoReserva(r);

    const statusLabels = {
        'pending': '<span style="color:#f1c40f; background:rgba(241,196,15,0.1); padding:4px 8px; border-radius:6px; border:1px solid #f1c40f; display:inline-flex; align-items:center; gap:4px;"><i class="ph-bold ph-hourglass-medium"></i> Pendiente de Validar</span>',
        'confirmed': '<span style="color:var(--primary-green); background:rgba(46,204,113,0.1); padding:4px 8px; border-radius:6px; border:1px solid var(--primary-green); display:inline-flex; align-items:center; gap:4px;"><i class="ph-bold ph-check-circle"></i> Confirmada</span>',
        'completed': '<span style="color:#a777e8; display:inline-flex; align-items:center; gap:4px;"><i class="ph-bold ph-check"></i> Completada (Jugada)</span>',
        'cancelled': '<span style="color:var(--text-muted); display:inline-flex; align-items:center; gap:4px;"><i class="ph-bold ph-x"></i> Cancelada</span>',
        'rejected': '<span style="color:var(--danger); display:inline-flex; align-items:center; gap:4px;"><i class="ph-bold ph-prohibit"></i> Rechazada por la Cancha</span>'
    };

    const senaBadge = r.senaPagada
        ? '<span style="color:#4ba3ff; font-weight:bold;"><i class="ph-fill ph-check-circle"></i> Seña recibida</span>'
        : '<span style="color:var(--text-muted);">Pendiente / Sin seña</span>';

    const clienteNombre = r.nombre || r.usuarioNombre || 'Cliente';
    const clienteTelefono = r.telefono || r.usuarioTelefono || 'Sin teléfono';
    const jugadorUid = r.usuarioUid || r.uid || '';
    const importeTotal = Number(r.precioTotal ?? r.precio ?? calcularPrecioTurnoAdmin(espacioSeleccionado, r.horaInicio));

    m.querySelector('#manage-title').textContent = `${clienteNombre} · ${r.horaInicio || '--:--'}`;
    m.querySelector('#manage-summary').innerHTML = `
        <div><span>Fecha:</span> <b>${escapeHTML(fechaTexto(fechaSeleccionada))}</b></div>
        <div><span>Jugador:</span> <b style="color:var(--primary-green); cursor:pointer; text-decoration:underline; display:inline-flex; align-items:center; gap:5px;" id="btn-ver-reputacion-jugador" title="Ver Inteligencia de Reputación del Jugador"><i class="ph-bold ph-shield-check"></i> ${escapeHTML(clienteNombre)}</b></div>
        <div><span>WhatsApp:</span> <b>${escapeHTML(clienteTelefono)}</b></div>
        <div><span>Importe Total:</span> <b>${money(importeTotal)}</b></div>
        <div><span>Adelanto (Seña):</span> <b>${senaBadge}</b></div>
        <div style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;"><span>Estado Reserva:</span> <b>${statusLabels[st] ?? escapeHTML(st)}</b></div>
    `;

    const btnRep = m.querySelector('#btn-ver-reputacion-jugador');
    if (btnRep) {
        btnRep.onclick = () => window.abrirReputacionJugador(jugadorUid, clienteNombre, clienteTelefono);
    }

    const btnContainer = m.querySelector('#manage-buttons');
    btnContainer.innerHTML = '';

    if (r.telefono) {
        const phone = String(r.telefono).replace(/\D/g, '');
        const cleanPhone = phone.startsWith('51') ? phone : `51${phone}`;
        btnContainer.innerHTML += `<a href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${clienteNombre}, te escribimos de ${canchaActual.nombre} sobre tu reserva de hoy a las ${r.horaInicio}.`)}" target="_blank" class="btn btn-outline" style="width:100%; border-color:#25D366 !important; color:#25D366 !important;"><i class="ph-bold ph-whatsapp-logo"></i> Chatear por WhatsApp</a>`;
    }

    if (st === 'pending') {
        btnContainer.innerHTML += `
            <button onclick="window.cambiarEstadoGestion('${escapeHTML(r.id)}', 'confirmed', this)" class="btn btn-primary" style="width:100%;"><i class="ph-bold ph-check-circle"></i> Validar Yape y Aprobar</button>
            <button onclick="window.cambiarEstadoGestion('${escapeHTML(r.id)}', 'rejected', this)" class="btn btn-danger" style="width:100%;"><i class="ph-bold ph-x-circle"></i> Rechazar (Pago Falso / Sin Pago)</button>
        `;
    } else if (st === 'confirmed') {
        btnContainer.innerHTML += `
            <button onclick="window.cambiarEstadoGestion('${escapeHTML(r.id)}', 'completed', this)" class="btn btn-primary" style="width:100%;"><i class="ph-bold ph-flag-checkered"></i> Marcar como Partido Jugado</button>
            <button onclick="window.cambiarEstadoGestion('${escapeHTML(r.id)}', 'cancelled', this)" class="btn btn-danger" style="width:100%;"><i class="ph-bold ph-x"></i> Cancelar Reserva</button>
        `;
    } else if (st === 'completed') {
        if (!r.calificadoPorDueno) {
            const btnRate = document.createElement('button');
            btnRate.className = 'btn btn-primary';
            btnRate.style.cssText = 'background:#f1c40f; border-color:#f1c40f; color:#000; margin-top:10px; font-weight:800; width:100%;';
            btnRate.innerHTML = '<i class="ph-fill ph-star"></i> Calificar y Reportar Equipo';
            btnRate.onclick = () => window.abrirCalificacionJugador(jugadorUid, r.id, clienteNombre);
            btnContainer.appendChild(btnRate);
        } else {
            btnContainer.innerHTML += `<div style="text-align:center; color:#aaa; font-size:0.85rem;"><i class="ph-fill ph-check-circle" style="color:#2ecc71;"></i> Ya calificaste a este equipo.</div>`;
        }
    }
    m.classList.add('mostrar');
    m.setAttribute('aria-hidden', 'false');
}

// SISTEMA DE CALIFICACIÓN DE JUGADOR (DEL DUEÑO AL JUGADOR)
window.abrirCalificacionJugador = function (jugadorUid, reservaId, nombreJugador) {
    if (!jugadorUid) return toast("Este jugador no tiene un perfil registrado en la app.", true);

    let m = document.getElementById('modal-rate-player');
    if (!m) {
        m = document.createElement('div');
        m.id = 'modal-rate-player';
        m.className = 'admin-modal';
        m.innerHTML = `
        <div class="admin-modal-card">
            <button type="button" class="btn-cerrar admin-modal-close" onclick="document.getElementById('modal-rate-player').classList.remove('mostrar')"><i class="ph-bold ph-x"></i></button>
            <span class="mini-label" style="color:#f1c40f;">SISTEMA DE REPUTACIÓN</span>
            <h2>Evaluar a <span id="rate-player-name" style="color:#f1c40f;"></span></h2>
            <p style="color:#aaa; font-size:0.85rem;">Tu calificación es pública y ayudará a otras canchas a saber si este equipo es confiable.</p>
            
            <div style="display:flex; justify-content:center; gap:10px; margin: 20px 0; font-size:2.5rem; color:#444; cursor:pointer;" id="rate-stars-container">
                <i class="ph-fill ph-star rate-star" data-val="1"></i>
                <i class="ph-fill ph-star rate-star" data-val="2"></i>
                <i class="ph-fill ph-star rate-star" data-val="3"></i>
                <i class="ph-fill ph-star rate-star" data-val="4"></i>
                <i class="ph-fill ph-star rate-star" data-val="5"></i>
            </div>
            <p id="rate-label" style="text-align:center; color:#f1c40f; font-weight:bold; margin-bottom:20px;">Toca las estrellas</p>

            <div id="rate-tags-container" style="display:none; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:25px;"></div>

            <button id="btn-submit-player-rate" class="btn btn-primary" style="width:100%;" disabled><i class="ph-bold ph-check"></i> Enviar Reporte</button>
        </div>`;
        document.body.appendChild(m);
    }

    const stars = m.querySelectorAll('.rate-star');
    const label = m.querySelector('#rate-label');
    const tagsCont = m.querySelector('#rate-tags-container');
    const btn = m.querySelector('#btn-submit-player-rate');
    let selRating = 0; let selTags = new Set();

    document.getElementById('rate-player-name').textContent = nombreJugador;
    stars.forEach(s => s.style.color = '#444');
    label.textContent = "Toca las estrellas para iniciar";
    tagsCont.style.display = 'none';
    btn.disabled = true; btn.innerHTML = '<i class="ph-bold ph-check"></i> Enviar Reporte';

    const TAGS_DUENO = {
        5: [{ icon: "ph-thumbs-up", text: "Excelente equipo" }, { icon: "ph-clock", text: "Puntuales" }, { icon: "ph-broom", text: "Dejaron limpio" }, { icon: "ph-handshake", text: "Respetuosos" }],
        4: [{ icon: "ph-thumbs-up", text: "Buen equipo" }, { icon: "ph-handshake", text: "Sin problemas" }],
        3: [{ icon: "ph-clock", text: "Llegaron tarde" }, { icon: "ph-warning", text: "Desordenados" }],
        2: [{ icon: "ph-trash", text: "Dejaron basura" }, { icon: "ph-clock", text: "Demoraron en salir" }, { icon: "ph-warning", text: "Problemáticos" }],
        1: [{ icon: "ph-prohibit", text: "No show (No vinieron)" }, { icon: "ph-sword", text: "Pelea / Violencia" }, { icon: "ph-trash", text: "Dañaron la cancha" }, { icon: "ph-warning-circle", text: "Falta de pago" }]
    };

    stars.forEach(star => {
        star.onclick = () => {
            selRating = Number(star.dataset.val);
            selTags.clear();
            stars.forEach(s => { s.style.color = Number(s.dataset.val) <= selRating ? '#f1c40f' : '#444'; });
            const labels = { 1: "Pésimos / Peligrosos", 2: "Mal comportamiento", 3: "Regulares", 4: "Buenos", 5: "¡Excelentes!" };
            label.textContent = labels[selRating];

            tagsCont.innerHTML = TAGS_DUENO[selRating].map(t => `<div class="tag-chip" data-text="${escapeHTML(t.text)}" style="padding:6px 12px; border:1px solid #555; border-radius:20px; font-size:0.8rem; color:#aaa; cursor:pointer;"><i class="ph-bold ${t.icon}"></i> ${escapeHTML(t.text)}</div>`).join('');
            tagsCont.style.display = 'flex';

            tagsCont.querySelectorAll('.tag-chip').forEach(chip => {
                chip.onclick = () => {
                    if (selTags.has(chip.dataset.text)) {
                        selTags.delete(chip.dataset.text);
                        chip.style.background = 'transparent'; chip.style.color = '#aaa'; chip.style.borderColor = '#555';
                    } else {
                        selTags.add(chip.dataset.text);
                        chip.style.background = 'rgba(241,196,15,0.1)'; chip.style.color = '#f1c40f'; chip.style.borderColor = '#f1c40f';
                    }
                };
            });
            btn.disabled = false;
        };
    });

    btn.onclick = async () => {
        if (!selRating) return;
        btn.disabled = true; btn.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Guardando...';
        try {
            await setDoc(doc(db, 'resenas_jugadores', `${reservaId}_${jugadorUid}`), {
                jugadorUid: jugadorUid,
                canchaId: canchaActual.id,
                nombreCancha: canchaActual.nombre,
                reservaId: reservaId,
                rating: selRating,
                tags: Array.from(selTags),
                createdAt: serverTimestamp()
            });
            await updateDoc(doc(db, 'reservas', reservaId), { calificadoPorDueno: true });
            m.classList.remove('mostrar');
            toast('¡Calificación guardada! Gracias por ayudar a la comunidad.');
            document.getElementById('modal-gestion-reserva')?.classList.remove('mostrar');
            await refrescar();
        } catch (e) { console.error(e); toast('Error al guardar calificación.', true); btn.disabled = false; btn.innerHTML = "Enviar Reporte"; }
    };

    m.classList.add('mostrar');
};

// ==========================================
// INTELIGENCIA DE REPUTACIÓN: HISTORIAL Y EVALUACIÓN DE JUGADOR
// ==========================================
window.abrirReputacionJugador = async function (jugadorUid, nombreFallback, telefonoFallback) {
    let m = document.getElementById('modal-reputacion-jugador');
    if (!m) {
        m = document.createElement('div');
        m.id = 'modal-reputacion-jugador';
        m.className = 'admin-modal';
        m.innerHTML = `
        <div class="admin-modal-card" style="max-width: 520px; width: 95%; max-height: 88vh; overflow-y: auto; padding: 25px; border: 1.5px solid rgba(46,204,113,0.35); box-shadow: 0 15px 45px rgba(0,0,0,0.85); position:relative;">
            <button type="button" class="btn-cerrar admin-modal-close" onclick="document.getElementById('modal-reputacion-jugador').classList.remove('mostrar')" style="position:absolute; top:15px; right:15px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#aaa; font-size:1.2rem; cursor:pointer; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="ph-bold ph-x"></i></button>
            <span class="mini-label" style="color:var(--primary-green); font-weight:800; letter-spacing:1px;"><i class="ph-fill ph-shield-check"></i> INTELIGENCIA DE REPUTACIÓN</span>
            <h2 style="margin: 4px 0 16px; font-size: 1.4rem; color: #fff;">Historial del Jugador</h2>
            
            <div id="reputacion-jugador-body">
                <div style="text-align:center; padding:30px; color:#aaa;">
                    <i class="ph-bold ph-spinner-gap ph-spin" style="font-size:2rem; color:var(--primary-green);"></i>
                    <p style="margin-top:10px;">Consultando historial en Firestore...</p>
                </div>
            </div>
        </div>`;
        document.body.appendChild(m);
        m.onclick = (e) => { if (e.target === m) m.classList.remove('mostrar'); };
    }

    const bodyEl = m.querySelector('#reputacion-jugador-body');
    bodyEl.innerHTML = `
        <div style="text-align:center; padding:30px; color:#aaa;">
            <i class="ph-bold ph-spinner-gap ph-spin" style="font-size:2rem; color:var(--primary-green);"></i>
            <p style="margin-top:10px;">Consultando historial de reputación en vivo...</p>
        </div>
    `;
    m.classList.add('mostrar');

    try {
        let perfilData = null;
        let targetUid = jugadorUid;

        if (targetUid) {
            try {
                const snapP = await getDoc(doc(db, 'jugadores_perfiles', targetUid));
                if (snapP.exists()) perfilData = snapP.data();
            } catch (errP) {
                console.warn("Error leyendo perfil por UID:", errP);
            }
        }

        if (!perfilData && telefonoFallback) {
            const telLimpio = String(telefonoFallback).replace(/\D/g, '');
            if (telLimpio.length >= 8) {
                try {
                    const qTel = query(collection(db, 'jugadores_perfiles'), where('telefono', '==', telLimpio));
                    const snapTel = await getDocs(qTel);
                    if (!snapTel.empty) {
                        targetUid = snapTel.docs[0].id;
                        perfilData = snapTel.docs[0].data();
                    }
                } catch (errTel) {
                    console.warn("Error buscando perfil por teléfono:", errTel);
                }
            }
        }

        let resenas = [];
        if (targetUid) {
            try {
                const qRes = query(collection(db, 'resenas_jugadores'), where('jugadorUid', '==', targetUid));
                const snapRes = await getDocs(qRes);
                snapRes.forEach(d => resenas.push({ id: d.id, ...d.data() }));
            } catch (errRes) {
                console.warn("Error consultando resenas_jugadores:", errRes);
            }
        }

        let sumaEstrellas = 0;
        let countValidas = 0;
        const tagCounts = {};

        resenas.forEach(r => {
            const cal = Number(r.rating || 0);
            if (cal > 0) {
                sumaEstrellas += cal;
                countValidas++;
            }
            if (Array.isArray(r.tags)) {
                r.tags.forEach(t => {
                    if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
                });
            }
        });

        const promedio = countValidas > 0 ? (sumaEstrellas / countValidas) : 0;
        const estrellasTxt = countValidas > 0 ? promedio.toFixed(1) : 'Sin calificar';
        const nombreMostrar = perfilData?.nombre || nombreFallback || 'Jugador';
        const fotoMostrar = perfilData?.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreMostrar)}&background=2ecc71&color=fff`;
        const telMostrar = perfilData?.telefono || telefonoFallback || 'No registrado';
        const posMostrar = perfilData?.posicion || 'JUG';
        const ciudadMostrar = perfilData?.ciudad || 'Lima';

        const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

        let estrellasIconos = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= Math.round(promedio)) {
                estrellasIconos += '<i class="ph-fill ph-star" style="color:#f1c40f; font-size:1.3rem;"></i>';
            } else {
                estrellasIconos += '<i class="ph-bold ph-star" style="color:#444; font-size:1.3rem;"></i>';
            }
        }

        bodyEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:16px; border-radius:14px; margin-bottom:16px;">
                <img src="${escapeHTML(fotoMostrar)}" style="width:54px; height:54px; aspect-ratio:1/1; object-fit:cover; border-radius:50%; border:2px solid var(--primary-green); flex-shrink:0;" alt="${escapeHTML(nombreMostrar)}">
                <div style="min-width:0; flex:1;">
                    <h3 style="margin:0; font-size:1.15rem; color:#fff; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(nombreMostrar)}</h3>
                    <p style="margin:3px 0 0; font-size:0.8rem; color:#aaa;">${escapeHTML(posMostrar)} · ${escapeHTML(ciudadMostrar)} · 📞 ${escapeHTML(telMostrar)}</p>
                </div>
            </div>

            <div style="background:rgba(241,196,15,0.08); border:1px solid rgba(241,196,15,0.25); border-radius:14px; padding:16px; margin-bottom:16px; text-align:center;">
                <span style="font-size:0.75rem; color:#f1c40f; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">PROMEDIO DE REPUTACIÓN GLOBAL</span>
                <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin:6px 0;">
                    ${countValidas > 0 ? estrellasIconos : '<span style="color:#888; font-size:0.9rem;">Sin estrellas aún</span>'}
                    <span style="font-size:1.4rem; font-weight:900; color:#fff; margin-left:6px;">${escapeHTML(estrellasTxt)}</span>
                </div>
                <span style="font-size:0.8rem; color:#aaa;">Basado en <b>${countValidas}</b> evaluación(es) realizada(s) por administradores de canchas</span>
            </div>

            <div style="margin-bottom:18px;">
                <h4 style="margin:0 0 8px; font-size:0.92rem; color:#fff; display:flex; align-items:center; gap:6px;">
                    <i class="ph-bold ph-tag" style="color:var(--primary-green);"></i> Etiquetas otorgadas por dueños de canchas:
                </h4>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                    ${sortedTags.length > 0 ? sortedTags.map(([tag, count]) => {
                        const esNegativa = /no show|pelea|violencia|dañaron|falta de pago|problem/i.test(tag);
                        const bg = esNegativa ? 'rgba(231,76,60,0.15)' : 'rgba(46,204,113,0.12)';
                        const border = esNegativa ? 'rgba(231,76,60,0.35)' : 'rgba(46,204,113,0.3)';
                        const color = esNegativa ? '#e74c3c' : 'var(--primary-green)';
                        const icon = esNegativa ? 'ph-warning' : 'ph-check';
                        return `
                            <span style="background:${bg}; border:1px solid ${border}; color:${color}; padding:5px 10px; border-radius:8px; font-size:0.8rem; font-weight:700; display:inline-flex; align-items:center; gap:5px;">
                                <i class="ph-bold ${icon}"></i> ${escapeHTML(tag)} <b style="opacity:0.85;">(${count})</b>
                            </span>
                        `;
                    }).join('') : '<p style="color:#666; font-size:0.82rem; margin:0;">Aún no cuenta con etiquetas de comportamiento de otros dueños.</p>'}
                </div>
            </div>

            <div>
                <h4 style="margin:0 0 10px; font-size:0.92rem; color:#fff; display:flex; align-items:center; gap:6px;">
                    <i class="ph-bold ph-buildings" style="color:#f1c40f;"></i> Evaluaciones registradas:
                </h4>
                <div style="display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto;">
                    ${resenas.length > 0 ? resenas.map(r => `
                        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); padding:10px 14px; border-radius:10px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                <b style="color:#fff; font-size:0.85rem;"><i class="ph-fill ph-map-pin"></i> ${escapeHTML(r.nombreCancha || 'Cancha aliada')}</b>
                                <span style="color:#f1c40f; font-weight:800; font-size:0.82rem;">⭐ ${Number(r.rating || 0)}/5</span>
                            </div>
                            <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
                                ${Array.isArray(r.tags) ? r.tags.map(t => `<span style="font-size:0.72rem; color:#aaa; background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px;">${escapeHTML(t)}</span>`).join('') : ''}
                            </div>
                        </div>
                    `).join('') : '<p style="color:#666; font-size:0.82rem; margin:0;">No hay reseñas registradas aún para este usuario.</p>'}
                </div>
            </div>
        `;

    } catch (e) {
        console.error("Error al cargar reputación de jugador:", e);
        bodyEl.innerHTML = '<p style="color:red; text-align:center; padding:20px;">Error al consultar la inteligencia de reputación.</p>';
    }
};

window.cambiarEstadoGestion = async function (reservaId, nuevoEstado, btnEl = null) {
    reservaId = reservaId || document.getElementById('modal-gestion-reserva')?.dataset?.reservaId;
    if (!reservaId) return;

    const nombresEstados = {
        'confirmed': 'CONFIRMADA',
        'completed': 'JUGADA',
        'cancelled': 'CANCELADA',
        'rejected': 'RECHAZADA'
    };

    const estadoAmigable = nombresEstados[nuevoEstado] || nuevoEstado.toUpperCase();

    const ok = window.customConfirm 
        ? await window.customConfirm(`¿Estás seguro de cambiar la reserva a estado: ${estadoAmigable}?`)
        : confirm(`¿Estás seguro de cambiar la reserva a estado: ${estadoAmigable}?`);
    if (!ok) return;

    let originalBtnHtml = '';
    if (btnEl) {
        btnEl.disabled = true;
        originalBtnHtml = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Actualizando...';
    }

    try {
        const updateData = { estado: nuevoEstado, updatedAt: serverTimestamp() };

        if (nuevoEstado === 'confirmed') {
            updateData.confirmadoPor = usuarioActual.uid;
            updateData.confirmadoEn = serverTimestamp();
        } else if (nuevoEstado === 'cancelled' || nuevoEstado === 'rejected') {
            updateData.canceladoPor = usuarioActual.uid;
            updateData.canceladoEn = serverTimestamp();
        }

        await updateDoc(doc(db, 'reservas', reservaId), updateData);
        document.getElementById('modal-gestion-reserva')?.classList.remove('mostrar');
        toast('Estado actualizado correctamente.');
        await refrescar();
    } catch (e) {
        console.error(e);
        toast('No se pudo actualizar la reserva.', true);
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = originalBtnHtml;
        }
    }
}
async function refrescar() { await cargarReservas(); renderSchedule(); renderReservas() }

function renderReservas() {
    const box = document.getElementById('lista-reservas');
    const activos = reservasDia.filter(r => !['cancelled', 'rejected', 'cancelada', 'cancelado'].includes(estadoReserva(r)) && !esBloqueoManual(r)).sort((a, b) => String(a.horaInicio).localeCompare(String(b.horaInicio)));

    if (!activos.length) {
        box.innerHTML = '<div class="admin-empty compact"><i class="ph-bold ph-calendar-blank"></i><b>No tienes reservas activas hoy</b><span>Las reservas que lleguen desde la web aparecerán aquí.</span></div>';
        return;
    }
    box.innerHTML = activos.map(r => {
        const st = estadoReserva(r);
        let label = 'Pendiente', colorClass = 'pendiente';
        let icon = '<i class="ph-bold ph-hourglass"></i>';

        if (st === 'confirmed') { label = 'Confirmada'; colorClass = 'confirmada'; icon = '<i class="ph-bold ph-check-circle"></i>'; }
        if (st === 'completed') { label = 'Jugado'; colorClass = 'jugada'; icon = '<i class="ph-bold ph-flag-checkered"></i>'; }

        const clienteNombre = r.nombre || r.usuarioNombre || 'Cliente';
        const clienteTelefono = r.telefono || r.usuarioTelefono || 'Sin teléfono';
        const montoTurno = Number(r.precioTotal ?? r.precio ?? calcularPrecioTurnoAdmin(espacioSeleccionado, r.horaInicio));

        return `<article class="reservation-row">
            <div class="reservation-time">${escapeHTML(r.horaInicio || '--:--')}<small>S/ ${montoTurno}</small></div>
            <div class="reservation-client"><b>${escapeHTML(clienteNombre)}</b><span>${escapeHTML(clienteTelefono)} · ${label}</span></div>
            <div class="reservation-actions">
                <button class="reservation-state ${colorClass}" data-id="${escapeHTML(r.id)}">${icon} ${label}</button>
                <button class="icon-btn release-reservation" data-id="${escapeHTML(r.id)}" title="Gestionar"><i class="ph-bold ph-sliders-horizontal"></i></button>
            </div>
        </article>`;
    }).join('');

    box.querySelectorAll('.release-reservation,.reservation-state').forEach(b => b.addEventListener('click', () => {
        const r = reservasDia.find(x => x.id === b.dataset.id);
        if (r) abrirGestionReserva(r);
    }));
}

function renderWeeklyHours(data) { const box = document.getElementById('weekly-hours'); if (!box) return; box.innerHTML = dias.slice(1).concat(['domingo']).map(dia => { const h = data[dia] || { activo: true, apertura: '16:00', cierre: '23:00' }; return `<div class="day-config-row" data-day="${dia}"><label class="day-toggle"><input type="checkbox" class="day-active" ${h.activo ? 'checked' : ''}><span class="toggle-ui"></span><b>${dia.charAt(0).toUpperCase() + dia.slice(1)}</b></label><div class="day-times"><input type="time" class="day-open" value="${h.apertura || '16:00'}"><span>—</span><input type="time" class="day-close" value="${h.cierre || '23:00'}"></div><span class="day-state">${h.activo ? 'Abierto' : 'Cerrado'}</span></div>` }).join(''); box.querySelectorAll('.day-config-row').forEach(row => { const cb = row.querySelector('.day-active'), update = () => { row.classList.toggle('closed', !cb.checked); row.querySelector('.day-state').textContent = cb.checked ? 'Abierto' : 'Cerrado'; row.querySelectorAll('.day-open,.day-close').forEach(x => x.disabled = !cb.checked) }; cb.addEventListener('change', update); update() }) }
function readWeeklyHours() { const rows = document.querySelectorAll('.day-config-row'); if (!rows.length) return canchaActual?.horariosSemana || {}; const out = {}; rows.forEach(row => { out[row.dataset.day] = { activo: row.querySelector('.day-active').checked, apertura: row.querySelector('.day-open').value, cierre: row.querySelector('.day-close').value } }); return out }
const btnHoy = document.getElementById('btn-hoy'); btnHoy?.addEventListener('click', () => { fechaSeleccionada = new Date(); fechaSeleccionada.setHours(0, 0, 0, 0); renderWeekDays(); actualizarDia() }); document.getElementById('btn-copiar-lunes')?.addEventListener('click', () => { const lunes = document.querySelector('.day-config-row[data-day="lunes"]'); if (!lunes) return; document.querySelectorAll('.day-config-row').forEach(row => { if (row === lunes) return; row.querySelector('.day-active').checked = lunes.querySelector('.day-active').checked; row.querySelector('.day-open').value = lunes.querySelector('.day-open').value; row.querySelector('.day-close').value = lunes.querySelector('.day-close').value; row.querySelector('.day-active').dispatchEvent(new Event('change')) }); toast('Horario del lunes copiado a los demás días.') });
async function subirImagen(archivo, ruta) { 
    if (!archivo) return null; 
    const storageRef = ref(storage, ruta); 
    await uploadBytes(storageRef, archivo); 
    return await getDownloadURL(storageRef); 
}

function sanitizeForFirestore(obj) {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'number') return Number.isFinite(obj) ? obj : 0;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore).filter(v => v !== undefined);
    if (obj.constructor && obj.constructor.name !== 'Object') return obj;
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) {
            clean[k] = sanitizeForFirestore(v);
        }
    }
    return clean;
}

const formPerfil = document.getElementById('form-perfil-cancha');
if (formPerfil) {
    formPerfil.addEventListener('submit', async e => {
        e.preventDefault();
        if (!usuarioActual) return;

        const btn = document.getElementById('btn-guardar-admin');
        if (!btn) {
            console.error("No se encontró el botón de guardar en el HTML");
            return;
        }

        const elFormato = document.getElementById('admin-formato');
        const elSuperficie = document.getElementById('admin-superficie');

        let formato = parseInt(elFormato?.value, 10);
        if (isNaN(formato) || formato < 5) {
            formato = 5;
        } else if (formato > 11) {
            formato = 11;
        }
        if (elFormato) elFormato.value = formato;

        const superficie = elSuperficie?.value?.trim() || 'Sintética';
        const tipoCombinado = `Fútbol ${formato} - ${superficie}`;
        const tipos = [tipoCombinado];

        const errorMsg = document.getElementById('tipos-error');
        if (errorMsg) errorMsg.textContent = '';

        btn.disabled = true;
        btn.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Guardando...';

        try {
            const uid = usuarioActual.uid;

            let fotos = [];
            try {
                const files = [document.getElementById('admin-foto1')?.files?.[0], document.getElementById('admin-foto2')?.files?.[0], document.getElementById('admin-foto3')?.files?.[0]].filter(Boolean);
                if (files.length > 0) {
                    fotos = await Promise.all(files.map((f, i) => subirImagen(f, `canchas/${uid}/foto${i + 1}`)));
                }
            } catch (errFoto) {
                console.warn('Advertencia al subir fotos:', errFoto);
            }

            let logo = null;
            try {
                const logoFile = document.getElementById('admin-logo')?.files?.[0];
                if (logoFile) {
                    logo = await subirImagen(logoFile, `canchas/${uid}/logo`);
                }
            } catch (errLogo) {
                console.warn('Advertencia al subir logo:', errLogo);
            }

            const valDpto = (document.getElementById('admin-cancha-departamento')?.value || document.getElementById('admin-departamento')?.value || '').trim();
            const valDist = (document.getElementById('admin-cancha-distrito')?.value || document.getElementById('admin-distrito')?.value || '').trim();

            const metodosPagoConfig = {
                textoMetodos: document.getElementById('admin-pago-metodos')?.value?.trim() || '',
                numero: document.getElementById('admin-pago-numero')?.value?.trim() || '',
                titular: document.getElementById('admin-pago-titular')?.value?.trim() || '',
                requiereSena: document.getElementById('admin-req-sena')?.checked || false,
                montoSena: Number(document.getElementById('admin-monto-sena')?.value || 0)
            };

            const tienePrecioNoche = Boolean(document.getElementById('admin-check-noche')?.checked);
            const horaInicioNoche = String(document.getElementById('admin-hora-noche')?.value || '18:00').trim() || '18:00';
            const rawPrecioNoche = Number(document.getElementById('admin-precio-noche')?.value ?? 0);
            const precioNoche = (tienePrecioNoche && Number.isFinite(rawPrecioNoche) && rawPrecioNoche >= 0) ? rawPrecioNoche : 0;
            const rawPrecioDia = Number(document.getElementById('admin-precio')?.value ?? 0);
            const precioDiaVal = (Number.isFinite(rawPrecioDia) && rawPrecioDia >= 0) ? rawPrecioDia : 0;
            const nombreComplejoVal = String(document.getElementById('admin-nombre')?.value ?? canchaActual?.nombre ?? '').trim();
            const latVal = String(document.getElementById('admin-lat')?.value ?? canchaActual?.lat ?? '').trim();
            const lngVal = String(document.getElementById('admin-lng')?.value ?? canchaActual?.lng ?? '').trim();

            const dataToSave = {
                ownerUid: uid || '',
                nombre: nombreComplejoVal,
                departamento: valDpto,
                distrito: valDist,
                whatsapp: (document.getElementById('admin-whatsapp')?.value || '').trim(),
                precio: precioDiaVal,
                tienePrecioNoche,
                horaInicioNoche,
                precioNoche,
                metodosPago: metodosPagoConfig,
                tiposCancha: tipos || ['Fútbol 7 - Sintética'],
                formatoJugadores: formato || 7,
                superficie: superficie || 'Sintética',
                descripcion: (document.getElementById('admin-descripcion')?.value || '').trim(),
                ubicacionTexto: (document.getElementById('admin-ubicacion-texto')?.value || '').trim(),
                ubicacionLink: (document.getElementById('admin-ubicacion-link')?.value || '').trim(),
                lat: latVal,
                lng: lngVal,
                intervaloMinutos: Number(document.getElementById('admin-intervalo')?.value || 60),
                horaApertura: document.getElementById('admin-hora-inicio')?.value || '16:00',
                horaCierre: document.getElementById('admin-hora-cierre')?.value || '23:00',
                horariosSemana: readWeeklyHours() || {},
                configurado: true,
                estadoPublicacion: canchaActual?.estadoPublicacion || 'draft',
                updatedAt: serverTimestamp()
            };
            if (logo) dataToSave.logo = logo;
            const fotosFiltradas = [...fotos.map((x, i) => x || canchaActual?.fotos?.[i]).filter(Boolean)];
            if (fotosFiltradas.length > 0) dataToSave.fotos = fotosFiltradas;

            const cleanData = sanitizeForFirestore(dataToSave);
            await setDoc(doc(db, 'canchas', uid), cleanData, { merge: true });
            canchaActual = { ...canchaActual, ...cleanData };
            await cargarEspacios();
            window.dispatchEvent(new CustomEvent('chalacapp:cancha-updated'));
            document.getElementById('mensaje-exito')?.classList.add('show');
            toast('¡Configuración guardada exitosamente!');

            try { await actualizarDia(); } catch (diaErr) { console.warn('Error al actualizar día:', diaErr); }

            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });

        } catch (err) {
            console.error('Error al guardar configuración:', err);
            toast(`No se pudo guardar: ${err?.message || 'Error de conexión'}`, true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Guardar Ajustes Generales';
        }
    });
}

function init() {
    document.getElementById('fecha-hoy').textContent = fechaTexto(fechaSeleccionada); renderWeekDays();
    const salirSeguro = async (e) => { e.preventDefault(); e.currentTarget.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Saliendo...'; try { await signOut(auth); window.location.replace('login.html'); } catch (error) { console.error("Error al salir:", error); } };
    const btnSalir1 = document.getElementById('btn-cerrar-sesion'), btnSalir2 = document.getElementById('btn-logout');
    if (btnSalir1) btnSalir1.addEventListener('click', salirSeguro); if (btnSalir2) btnSalir2.addEventListener('click', salirSeguro);

    // MÓDULO 5: AUTH GUARD ESTRICTO EN ADMIN.HTML
    onAuthStateChanged(auth, async u => {
            if (!u) {
            window.location.href = 'index.html';
            return;
        }
        try {
            const [userDoc, canchaDoc] = await Promise.all([
                getDoc(doc(db, 'usuarios', u.uid)),
                getDoc(doc(db, 'canchas', u.uid))
            ]);

            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.rol === "admin" && data.estado === "approved") {
                    window.location.replace("admin-panel.html");
                    return;
                }
                if (data.rol !== "owner" && !canchaDoc.exists()) {
                    // Usuario normal (jugador) intentando entrar por URL directa
                    window.location.href = 'index.html';
                    return;
                }
                if (data.estado === "pending") {
                    document.body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#080b0a;color:white;text-align:center;padding:20px;"><i class="ph-bold ph-clock" style="font-size:60px;color:var(--warning);"></i><h2 style="margin:20px 0 10px;">Tu cuenta está en revisión</h2><p style="color:var(--text-muted);margin-bottom:20px;">Un administrador debe aprobar tu solicitud antes de configurar tu cancha.</p><button onclick="window.location.href='index.html'" class="btn btn-outline" style="width:auto;">Volver al inicio</button></div>`;
                    document.body.style.opacity = '1';
                    document.body.style.pointerEvents = 'auto';
                    await signOut(auth);
                    return;
                }
                if (data.estado === "rejected") {
                    document.body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#080b0a;color:white;text-align:center;padding:20px;"><i class="ph-bold ph-x-circle" style="font-size:60px;color:var(--danger);"></i><h2 style="margin:20px 0 10px;">Solicitud Rechazada</h2><p style="color:var(--text-muted);margin-bottom:20px;">Lamentablemente tu solicitud para registrar la cancha ha sido rechazada.</p><button onclick="window.location.href='index.html'" class="btn btn-outline" style="width:auto;">Volver al inicio</button></div>`;
                    document.body.style.opacity = '1';
                    document.body.style.pointerEvents = 'auto';
                    await signOut(auth);
                    return;
                }
            } else if (!canchaDoc.exists()) {
                // Sin documento de usuario owner ni cancha asociada -> redirigir inmediatamente
                window.location.href = 'index.html';
                return;
            }

            // Autorizado como owner: revelar el panel
            document.body.style.opacity = '1';
            document.body.style.pointerEvents = 'auto';

            usuarioActual = u;
            document.getElementById('admin-user-label').textContent = u.email || '';
            if (await cargarPerfil()) {
                await cargarEspacios();
                actualizarDia();
            }
        } catch (e) {
            console.error(e);
            window.location.href = 'index.html';
        }
    });

    const adminFormatoInput = document.getElementById('admin-formato');
    if (adminFormatoInput) {
        adminFormatoInput.addEventListener('input', () => {
            let val = parseInt(adminFormatoInput.value, 10);
            if (isNaN(val)) return;
            if (val > 11) adminFormatoInput.value = 11;
        });
        adminFormatoInput.addEventListener('blur', () => {
            let val = parseInt(adminFormatoInput.value, 10);
            if (isNaN(val) || val < 5) adminFormatoInput.value = 5;
            else if (val > 11) adminFormatoInput.value = 11;
        });
    }
}
init();
