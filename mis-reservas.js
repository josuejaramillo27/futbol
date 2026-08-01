import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const cfg = { apiKey: "AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk", authDomain: "app-futbol-acd0f.firebaseapp.com", projectId: "app-futbol-acd0f", storageBucket: "app-futbol-acd0f.firebasestorage.app", messagingSenderId: "223446110165", appId: "1:223446110165:web:219afce6a9dac03203f75c" };
const app = getApps().length ? getApps()[0] : initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

let usuarioActual = null;
const contenedorReservas = document.getElementById('lista-mis-reservas');

onAuthStateChanged(auth, user => {
    if (user) {
        usuarioActual = user;
        document.getElementById('user-name-label').textContent = user.displayName || user.email;
        cargarMisReservas();
    } else {
        window.location.href = 'index.html'; // Protegemos la ruta
    }
});

document.getElementById('btn-cerrar-sesion')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});

// FASE 24: Historial de Reservas del Jugador
async function cargarMisReservas() {
    if (!contenedorReservas) return;
    contenedorReservas.innerHTML = '<div style="text-align:center; padding:40px;"><i class="ph-bold ph-spinner-gap ph-spin" style="font-size:32px;"></i><p>Buscando tus partidos...</p></div>';
    
    try {
        const q = query(collection(db, 'reservas'), where('usuarioUid', '==', usuarioActual.uid));
        const snap = await getDocs(q);
        
        let reservas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Ordenar de la más reciente a la más antigua
        reservas.sort((a, b) => new Date(`${b.fecha}T${b.horaInicio}`) - new Date(`${a.fecha}T${a.horaInicio}`));
        
        if (reservas.length === 0) {
            contenedorReservas.innerHTML = `
                <div class="empty-state" style="text-align:center; padding: 50px 20px; background: rgba(255,255,255,0.02); border-radius:15px;">
                    <i class="ph-fill ph-calendar-blank" style="font-size:48px; color:var(--primary-green); margin-bottom:15px;"></i>
                    <h3>No tienes reservas aún</h3>
                    <p style="color:var(--text-muted); margin-bottom: 20px;">Explora canchas y organiza tu primer partido.</p>
                    <a href="index.html" class="btn hero-primary" style="display:inline-block;">Buscar Canchas</a>
                </div>
            `;
            return;
        }

        renderReservas(reservas);
    } catch (error) {
        console.error("Error cargando reservas:", error);
        contenedorReservas.innerHTML = '<p style="color:var(--danger); text-align:center;">Hubo un error al cargar tus reservas.</p>';
    }
}

function renderReservas(reservas) {
    contenedorReservas.innerHTML = reservas.map(r => {
        const estado = normalizarEstado(r.estado);
        const fechaObj = new Date(`${r.fecha}T00:00:00`);
        const fechaTexto = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).format(fechaObj);
        
        let badge = '<span style="color:#d7a938; background:rgba(215, 169, 56, 0.1); padding:4px 8px; border-radius:6px; font-size:0.75rem;">PENDIENTE</span>';
        if (estado === 'confirmed') badge = '<span style="color:var(--primary-green); background:rgba(46, 204, 113, 0.1); padding:4px 8px; border-radius:6px; font-size:0.75rem;">CONFIRMADA</span>';
        if (estado === 'cancelled' || estado === 'rejected') badge = '<span style="color:var(--danger); background:rgba(231, 76, 60, 0.1); padding:4px 8px; border-radius:6px; font-size:0.75rem;">CANCELADA</span>';
        if (estado === 'completed') badge = '<span style="color:#a777e8; background:rgba(167, 119, 232, 0.1); padding:4px 8px; border-radius:6px; font-size:0.75rem;">JUGADO</span>';

        return `
        <article class="reserva-card" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:15px; padding:20px; margin-bottom:15px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:15px;">
            <div>
                <h3 style="margin:0 0 5px; font-size:1.2rem;">${r.canchaNombre || 'Cancha'}</h3>
                <p style="margin:0; color:var(--text-muted); font-size:0.9rem;"><i class="ph-bold ph-calendar"></i> ${fechaTexto.toUpperCase()} · <i class="ph-bold ph-clock"></i> ${r.horaInicio}</p>
                <div style="margin-top:10px;">${badge}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px; align-items:flex-end;">
                <strong style="font-size:1.2rem; color:var(--primary-green);">S/ ${r.precio || '0'}</strong>
                ${(estado === 'pending' || estado === 'confirmed') ? 
                    `<button class="btn btn-outline btn-cancelar" data-id="${r.id}" data-fecha="${r.fecha}" data-hora="${r.horaInicio}" style="padding:6px 12px; font-size:0.8rem; color:var(--danger); border-color:var(--danger);">Cancelar</button>` 
                    : ''
                }
            </div>
        </article>
        `;
    }).join('');

    // Asignar eventos de cancelación
    document.querySelectorAll('.btn-cancelar').forEach(btn => {
        btn.addEventListener('click', (e) => intentarCancelar(e.target.dataset.id, e.target.dataset.fecha, e.target.dataset.hora));
    });
}

// FASE 25: Política Estricta de Cancelación
async function intentarCancelar(reservaId, fechaStr, horaStr) {
    const resDate = new Date(`${fechaStr}T${horaStr}:00`);
    const now = new Date();
    
    // Diferencia en horas
    const diffHours = (resDate - now) / (1000 * 60 * 60);

    if (diffHours < 2 && diffHours > 0) {
        alert("Política de Cancelación:\n\nNo puedes cancelar la reserva desde la aplicación si faltan menos de 2 horas para el partido.\n\nPor favor, comunícate directamente con la cancha.");
        return;
    }
    if (diffHours <= 0) {
        alert("Esta reserva ya pasó, no se puede cancelar.");
        return;
    }

    if (!confirm("¿Estás seguro de que deseas cancelar esta reserva de forma permanente?")) return;

    try {
        await updateDoc(doc(db, 'reservas', reservaId), {
            estado: 'cancelled',
            canceladoPor: 'player',
            canceladoEn: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        alert("Tu reserva ha sido cancelada exitosamente.");
        cargarMisReservas();
    } catch (e) {
        console.error(e);
        alert("Ocurrió un error al intentar cancelar. Intenta de nuevo.");
    }
}

function normalizarEstado(st) {
    const s = String(st||'pending').toLowerCase();
    if(['pendiente', 'pending'].includes(s)) return 'pending';
    if(['confirmada', 'confirmed'].includes(s)) return 'confirmed';
    if(['cancelada', 'cancelado', 'cancelled'].includes(s)) return 'cancelled';
    if(['completada', 'completed', 'jugada'].includes(s)) return 'completed';
    if(['rechazada', 'rejected'].includes(s)) return 'rejected';
    return 'pending';
}
