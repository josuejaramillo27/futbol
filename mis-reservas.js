import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// LLAVE CORREGIDA
const cfg = { apiKey: "AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk", authDomain: "app-futbol-acd0f.firebaseapp.com", projectId: "app-futbol-acd0f", storageBucket: "app-futbol-acd0f.firebasestorage.app", messagingSenderId: "223446110165", appId: "1:223446110165:web:219afce6a9dac03203f75c" };
const app = getApps().length ? getApps()[0] : initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

let usuarioActual = null;
const contenedorReservas = document.getElementById('reservas-lista');

// LOGIN CON GOOGLE
document.getElementById('btn-login')?.addEventListener('click', async () => {
    try {
        const btn = document.getElementById('btn-login');
        btn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Conectando...';
        await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
        alert("Error al iniciar sesión: " + e.message);
        document.getElementById('btn-login').innerHTML = '<i class="ph-bold ph-google-logo"></i> Continuar con Google';
    }
});

onAuthStateChanged(auth, u => {
    if (u) {
        usuarioActual = u;
        document.getElementById('auth-state').style.display = 'none';
        cargarMisReservas();
    } else {
        usuarioActual = null;
        document.getElementById('auth-state').style.display = 'flex';
        contenedorReservas.innerHTML = '';
    }
});

// REFRESCAR SOLO LA LISTA, NO LA PÁGINA COMPLETA
document.getElementById('btn-refresh')?.addEventListener('click', () => {
    if(usuarioActual) {
        cargarMisReservas();
        // Al refrescar, devolvemos el filtro a "Todas"
        document.querySelectorAll('.reserva-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.reserva-tab[data-filter="todas"]')?.classList.add('active');
    }
});

async function cargarMisReservas() {
    contenedorReservas.innerHTML = '<div style="text-align:center; padding: 40px; color: #aaa;"><i class="ph-bold ph-spinner ph-spin" style="font-size:2rem;"></i><p>Buscando tus partidos...</p></div>';
    
    try {
        const q = query(collection(db, 'reservas'), where('usuarioUid', '==', usuarioActual.uid));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            contenedorReservas.innerHTML = `
                <div style="text-align:center; padding:50px 20px; background:rgba(255,255,255,0.02); border-radius:16px; border:1px dashed #333;">
                    <i class="ph-fill ph-calendar-x" style="font-size:3rem; color:#555; margin-bottom:15px;"></i>
                    <h3 style="color:#fff; margin:0 0 10px 0;">No tienes reservas</h3>
                    <p style="color:#aaa; font-size:0.9rem; margin-bottom:20px;">Aún no has solicitado ninguna cancha con tu cuenta.</p>
                    <a href="index.html" class="btn" style="width:auto; padding:10px 20px; background:var(--primary-green); color:#000;">Explorar canchas</a>
                </div>
            `;
            return;
        }

        const reservasArr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Ordenar por fecha (las más recientes/futuras primero)
        reservasArr.sort((a, b) => new Date(`${b.fecha}T${b.hora||'00:00'}`) - new Date(`${a.fecha}T${a.hora||'00:00'}`));

        let html = '';
        const ahora = new Date();

        reservasArr.forEach(r => {
            const fechaStr = r.fecha || 'Sin fecha';
            const horaStr = r.hora || 'Sin hora';
            const canchaNom = r.canchaNombre || 'Cancha Desconocida';
            
            // Determinar si es pasado
            let esPasado = false;
            if(r.fecha && r.hora) {
                const fechaHoraReserva = new Date(`${r.fecha}T${r.hora}`);
                esPasado = fechaHoraReserva < ahora;
            }

            const estadoNorm = normalizarEstado(r.estado);
            const { clase: estadoClase, txt: estadoTexto } = getEstadoUI(estadoNorm);

            // AGREGAMOS LOS DATA-ATTRIBUTES (data-estado y data-proxima) AQUÍ PARA LOS FILTROS
            html += `
            <div class="reserva-card ${esPasado ? 'pasado' : ''}" data-estado="${estadoNorm}" data-proxima="${!esPasado}">
                <div class="reserva-header">
                    <span class="reserva-estado ${estadoClase}">${estadoTexto}</span>
                    <span style="font-size:0.8rem; color:#888;">ID: ${r.id.substring(0,6).toUpperCase()}</span>
                </div>
                
                <h3 class="reserva-titulo">${canchaNom}</h3>
                
                <div class="reserva-datos">
                    <div class="reserva-dato"><i class="ph-bold ph-calendar-blank"></i> ${formatearFecha(fechaStr)}</div>
                    <div class="reserva-dato"><i class="ph-bold ph-clock"></i> ${horaStr}</div>
                    <div class="reserva-dato"><i class="ph-bold ph-currency-circle-dollar"></i> S/ ${r.precio || '--'}</div>
                </div>

                <div class="reserva-actions">
                    ${(estadoNorm === 'pending' || estadoNorm === 'seña_pagada') && !esPasado ? `<button class="btn btn-cancelar" onclick="cancelarReserva('${r.id}')"><i class="ph-bold ph-x"></i> Cancelar Solicitud</button>` : ''}
                    ${esPasado && estadoNorm === 'confirmed' ? `<button class="btn btn-resena" onclick="dejarResena('${r.id}', '${r.canchaId}')"><i class="ph-bold ph-star"></i> Calificar Cancha</button>` : ''}
                    ${!esPasado && estadoNorm === 'confirmed' ? `<a href="#" class="btn btn-outline" style="pointer-events:none; border-color:var(--primary-green); color:var(--primary-green);"><i class="ph-bold ph-check-circle"></i> ¡Todo listo para jugar!</a>` : ''}
                </div>
            </div>
            `;
        });

        contenedorReservas.innerHTML = html;
        
        // Al cargar, aplicamos el filtro que esté activo (por si recargan estando en "Próximas")
        const tabActiva = document.querySelector('.reserva-tab.active');
        if(tabActiva) filtrarReservas(tabActiva.getAttribute('data-filter'));

    } catch (error) {
        console.error("Error al cargar reservas: ", error);
        contenedorReservas.innerHTML = '<p style="color:red; text-align:center;">Hubo un error al cargar tus reservas.</p>';
    }
}

// CANCELAR RESERVA
window.cancelarReserva = async function(id) {
    if(!confirm("¿Estás seguro que deseas cancelar esta solicitud de reserva?")) return;
    try {
        await updateDoc(doc(db, 'reservas', id), {
            estado: 'cancelled',
            canceladaPor: 'usuario',
            fechaCancelacion: serverTimestamp()
        });
        alert("Reserva cancelada exitosamente.");
        cargarMisReservas();
    } catch (e) {
        alert("Ocurrió un error al cancelar.");
    }
}

// SISTEMA DE RESEÑAS
window.dejarResena = async function(reservaId, canchaId) {
    const rating = prompt("⚽ Califica la cancha del 1 al 5:");
    if(!rating || isNaN(rating) || rating < 1 || rating > 5) return alert("Calificación inválida.");
    const comentario = prompt("Escribe un breve comentario (Opcional):");

    try {
        const cSeguro = String(comentario || '').replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[m]));
        await addDoc(collection(db, 'resenas'), {
            reservaId, canchaId, usuarioUid: usuarioActual.uid, nombre: usuarioActual.displayName || 'Jugador', rating: Number(rating), comentario: cSeguro, createdAt: serverTimestamp()
        });
        alert("¡Gracias por tu reseña!");
    } catch(e) {
        alert("Hubo un error al guardar tu reseña.");
    }
};

function normalizarEstado(st) {
    const s = String(st||'pending').toLowerCase();
    if(['pendiente', 'pending'].includes(s)) return 'pending';
    if(['confirmada', 'confirmed'].includes(s)) return 'confirmed';
    if(['cancelada', 'cancelado', 'cancelled'].includes(s)) return 'cancelled';
    if(['seña', 'sena', 'seña_pagada', 'deposit_paid'].includes(s)) return 'seña_pagada';
    return 'pending';
}

function getEstadoUI(estado) {
    switch(estado) {
        case 'pending': return { clase: 'badge-pendiente', txt: 'Esperando Confirmación' };
        case 'seña_pagada': return { clase: 'badge-sena', txt: 'Seña Recibida' };
        case 'confirmed': return { clase: 'badge-confirmada', txt: 'Confirmada' };
        case 'cancelled': return { clase: 'badge-cancelada', txt: 'Cancelada' };
        default: return { clase: 'badge-pendiente', txt: 'Pendiente' };
    }
}

function formatearFecha(fechaIso) {
    if(!fechaIso || fechaIso === 'Sin fecha') return fechaIso;
    try {
        const [y,m,d] = fechaIso.split('-');
        const f = new Date(y, m-1, d);
        const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        return `${dias[f.getDay()]}, ${d} de ${meses[f.getMonth()]}`;
    } catch(e) { return fechaIso; }
}


// ==========================================
// LÓGICA DE PESTAÑAS (FILTROS DE RESERVAS)
// ==========================================
document.querySelectorAll('.reserva-tab').forEach(btnTab => {
    btnTab.addEventListener('click', (e) => {
        // Quitar la clase active de todos los botones
        document.querySelectorAll('.reserva-tab').forEach(t => t.classList.remove('active'));
        
        // Agregar la clase active al botón presionado
        e.currentTarget.classList.add('active');
        
        // Ejecutar el filtro
        filtrarReservas(e.currentTarget.getAttribute('data-filter'));
    });
});

function filtrarReservas(filtro) {
    const tarjetas = document.querySelectorAll('.reserva-card');
    
    tarjetas.forEach(tarjeta => {
        const estado = tarjeta.getAttribute('data-estado'); // pending, confirmed, seña_pagada, cancelled
        const esProxima = tarjeta.getAttribute('data-proxima') === 'true';

        if (filtro === 'todas') {
            tarjeta.style.display = 'block';
        } else if (filtro === 'proximas') {
            tarjeta.style.display = esProxima ? 'block' : 'none';
        } else if (filtro === 'seña_pagada') {
            tarjeta.style.display = (estado === 'seña_pagada') ? 'block' : 'none';
        } else if (filtro === 'confirmada') {
            tarjeta.style.display = (estado === 'confirmed') ? 'block' : 'none';
        } else if (filtro === 'pendiente') {
            tarjeta.style.display = (estado === 'pending') ? 'block' : 'none';
        }
    });
}
