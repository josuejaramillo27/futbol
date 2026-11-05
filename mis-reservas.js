import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initLegalCompliance } from "./legal.js";
initLegalCompliance();

function escapeHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const firebaseConfig = {
    apiKey: "AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",
    authDomain: "app-futbol-acd0f.firebaseapp.com",
    projectId: "app-futbol-acd0f",
    storageBucket: "app-futbol-acd0f.firebasestorage.app",
    messagingSenderId: "223446110165",
    appId: "1:223446110165:web:219afce6a9dac03203f75c"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let usuario = null;
let reservas = [];
let filtro = 'todas';

const authState = document.getElementById('auth-state');
const lista = document.getElementById('reservas-lista');
const btnLogin = document.getElementById('btn-login');
const btnRefresh = document.getElementById('btn-refresh');

const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function normalizarEstado(raw) {
    const s = String(raw || '').toLowerCase();
    if (s === 'pending' || s === 'pendiente') return 'pendiente';
    if (s === 'confirmed' || s === 'confirmada') return 'confirmada';
    if (s === 'cancelled' || s === 'cancelada' || s === 'cancelado') return 'cancelada';
    if (s === 'rejected' || s === 'rechazada') return 'rechazada';
    if (s === 'completed' || s === 'completada' || s === 'jugada') return 'jugada';
    if (s === 'seña_pagada' || s === 'sena_pagada') return 'seña_pagada';
    return 'pendiente';
}

function estadoInfo(estadoRaw) {
    const e = normalizarEstado(estadoRaw);
    const map = {
        confirmada: { label: 'Confirmada', icon: 'ph-check-circle' },
        seña_pagada: { label: 'Seña recibida', icon: 'ph-Receipt' },
        pendiente: { label: 'Pendiente de Validar', icon: 'ph-clock' },
        jugada: { label: 'Jugado', icon: 'ph-soccer-ball' },
        cancelada: { label: 'Cancelada', icon: 'ph-x-circle' },
        rechazada: { label: 'Rechazada por Cancha', icon: 'ph-prohibit' }
    };
    return map[e] || { label: e, icon: 'ph-info' };
}

function parseFecha(f) {
    const [y, m, d] = String(f || '').split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d, 12, 0, 0) : new Date();
}

function esProxima(r) {
    const e = normalizarEstado(r.estado);
    return String(r.fecha || '') >= hoyISO() && !['cancelada', 'rechazada'].includes(e);
}

function filtrarReservas() {
    if (filtro === 'todas') return reservas;
    if (filtro === 'proximas') return reservas.filter(esProxima);
    return reservas.filter(r => normalizarEstado(r.estado) === filtro);
}

function render() {
    if (!usuario) {
        authState.style.display = 'flex';
        lista.innerHTML = '';
        return;
    }
    authState.style.display = 'none';
    const items = filtrarReservas();

    if (!items.length) {
        lista.innerHTML = `<div class="empty-reservas"><i class="ph-fill ph-calendar-blank"></i><h2>No hay reservas en esta vista</h2><p>Explora las canchas disponibles y separa tu próximo horario en segundos.</p><a href="index.html#canchas" class="btn btn-primary">Buscar canchas</a></div>`;
        return;
    }

    lista.innerHTML = items.map(r => {
        const d = parseFecha(r.fecha);
        const estadoNorm = normalizarEstado(r.estado);
        const st = estadoInfo(r.estado);
        const day = d.getDate();
        const weekday = d.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '').toUpperCase();
        const month = d.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '');
        const puedeCancelar = esProxima(r) && !['cancelada', 'jugada', 'rechazada'].includes(estadoNorm);
        const montoMostrar = r.precioTotal ?? r.precio ?? '--';

        return `<article class="reserva-card ${escapeHTML(estadoNorm)}">
            <div class="reserva-date"><small>${escapeHTML(weekday)}</small><b>${day}</b><span>${escapeHTML(month)}</span></div>
            <div class="reserva-info">
                <span class="reserva-status ${escapeHTML(estadoNorm)}"><i class="ph-fill ${st.icon}"></i> ${escapeHTML(st.label)}</span>
                <h2>${escapeHTML(r.canchaNombre || 'Cancha deportiva')}</h2>
                <p><i class="ph-bold ph-clock"></i> ${escapeHTML(r.horaInicio || '--:--')}${r.horaFin && r.horaFin !== r.horaInicio ? ` – ${escapeHTML(r.horaFin)}` : ''}</p>
                <p><i class="ph-bold ph-user"></i> ${escapeHTML(r.nombre || usuario.displayName || 'Jugador')}</p>
                <p><i class="ph-bold ph-whatsapp-logo"></i> ${escapeHTML(r.telefono || 'Sin teléfono')}</p>
                <div class="reserva-flow">
                    <span class="${['pendiente', 'seña_pagada', 'confirmada', 'jugada'].includes(estadoNorm) ? 'done' : ''}">1. Solicitada</span>
                    <span class="${['seña_pagada', 'confirmada', 'jugada'].includes(estadoNorm) ? 'done' : ''}">2. Validada</span>
                    <span class="${['confirmada', 'jugada'].includes(estadoNorm) ? 'done' : ''}">3. Confirmada</span>
                    <span class="${estadoNorm === 'jugada' ? 'done' : ''}">4. Jugado</span>
                </div>
            </div>
            <div class="reserva-price">
                <small>Tarifa</small>
                <strong>S/ ${escapeHTML(montoMostrar)}</strong>
                ${puedeCancelar ? `<button class="btn btn-danger cancelar-reserva" data-id="${escapeHTML(r.id)}" style="padding:6px 10px; font-size:0.72rem;">Cancelar</button>` : ''}
            </div>
        </article>`;
    }).join('');

    lista.querySelectorAll('.cancelar-reserva').forEach(btn => {
        btn.addEventListener('click', () => cancelarReserva(btn.dataset.id, btn));
    });
}

async function cargarReservas() {
    if (!usuario) return render();
    lista.innerHTML = `<div class="loading-reservas"><i class="ph-bold ph-spinner-gap ph-spin"></i> Cargando tus reservas...</div>`;
    try {
        const snap = await getDocs(query(collection(db, 'reservas'), where('usuarioUid', '==', usuario.uid)));
        reservas = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
            const cmp = String(b.fecha || '').localeCompare(String(a.fecha || ''));
            return cmp !== 0 ? cmp : String(b.horaInicio || '').localeCompare(String(a.horaInicio || ''));
        });
        render();
    } catch (e) {
        console.error(e);
        lista.innerHTML = `<div class="empty-reservas"><i class="ph-bold ph-warning-circle"></i><h2>No pudimos cargar tus reservas</h2><p>Revisa tu conexión e inténtalo nuevamente.</p></div>`;
    }
}

function mostrarAlertaPremium(titulo, mensaje) {
    let box = document.getElementById('premium-cancel-alert');
    if (!box) {
        box = document.createElement('div');
        box.id = 'premium-cancel-alert';
        box.className = 'premium-alert';
        box.innerHTML = `<i class="ph-fill ph-shield-warning"></i><div><strong></strong><span></span></div><button type="button" aria-label="Cerrar"><i class="ph-bold ph-x"></i></button>`;
        box.querySelector('button').onclick = () => box.style.display = 'none';
        lista.parentElement.insertBefore(box, lista);
    }
    box.querySelector('strong').textContent = titulo;
    box.querySelector('span').textContent = mensaje;
    box.style.display = 'flex';
}

function faltanMenosDe12Horas(r) {
    const [y, m, d] = String(r.fecha || '').split('-').map(Number);
    const match = String(r.horaInicio || '00:00').match(/^(\d{1,2}):(\d{2})$/);
    if (!y || !m || !d || !match) return false;
    const inicio = new Date(y, m - 1, d, Number(match[1]), Number(match[2]), 0);
    return (inicio.getTime() - Date.now()) < 12 * 60 * 60 * 1000;
}

async function cancelarReserva(id, btn) {
    const r = reservas.find(x => x.id === id);
    if (r && faltanMenosDe12Horas(r)) {
        mostrarAlertaPremium(
            'Política de Protección al Dueño (12 horas)',
            'No es posible cancelar una reserva cuando faltan menos de 12 horas para el partido. Si tienes una urgencia, comunícate directamente con la cancha.'
        );
        return;
    }
    if (!confirm('¿Deseas cancelar esta reserva? El horario volverá a quedar disponible.')) return;
    btn.disabled = true;
    btn.textContent = 'Cancelando...';
    try {
        await updateDoc(doc(db, 'reservas', id), {
            estado: 'cancelled',
            canceladaEn: serverTimestamp(),
            canceladaPor: usuario.uid,
            updatedAt: serverTimestamp()
        });
        await cargarReservas();
    } catch (e) {
        console.error(e);
        btn.disabled = false;
        btn.textContent = 'Cancelar';
    }
}

document.querySelectorAll('.reserva-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.reserva-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        filtro = tab.dataset.filter;
        render();
    });
});

btnLogin?.addEventListener('click', async () => {
    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
    } catch (e) { console.error(e); }
});

btnRefresh?.addEventListener('click', cargarReservas);
onAuthStateChanged(auth, u => {
    usuario = u || null;
    cargarReservas();
});
