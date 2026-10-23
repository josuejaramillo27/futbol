import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, getDoc, updateDoc, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. CONFIGURACIÓN FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",
    authDomain: "app-futbol-acd0f.firebaseapp.com",
    projectId: "app-futbol-acd0f",
    storageBucket: "app-futbol-acd0f.firebasestorage.app",
    messagingSenderId: "223446110165",
    appId: "1:223446110165:web:219afce6a9dac03203f75c"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Sistema de Notificaciones Elegantes (Toast)
window.toast = function(msg, type = 'info') {
    let container = document.getElementById('toast-container-global');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container-global';
        container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
        document.body.appendChild(container);
    }
    const t = document.createElement('div');
    const isError = type === 'error' || type === true;
    const isSuccess = type === 'success';
    const bg = isError ? 'rgba(231,76,60,0.95)' : isSuccess ? 'rgba(46,204,113,0.95)' : 'rgba(22,28,25,0.95)';
    const color = isError ? '#fff' : isSuccess ? '#000' : '#fff';
    const icon = isError ? 'ph-x-circle' : isSuccess ? 'ph-check-circle' : 'ph-info';
    t.style.cssText = `background:${bg};color:${color};padding:12px 18px;border-radius:10px;font-weight:600;font-size:0.88rem;box-shadow:0 8px 24px rgba(0,0,0,0.5);display:flex;align-items:center;gap:8px;pointer-events:auto;transition:all 0.3s ease;transform:translateY(20px);opacity:0;`;
    t.innerHTML = `<i class="ph-bold ${icon}" style="font-size:1.1rem;"></i><span>${msg}</span>`;
    container.appendChild(t);
    requestAnimationFrame(() => {
        t.style.transform = 'translateY(0)';
        t.style.opacity = '1';
    });
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(10px)';
        setTimeout(() => t.remove(), 300);
    }, 3500);
};

let adminUser = null;
let allOwners = [];
let chartReservasInstance = null;
let chartCanchasInstance = null;

// ==========================================
// 2. SEGURIDAD Y GUARD DE ACCESO
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    try {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists() && userDoc.data().rol === "admin" && userDoc.data().estado === "approved") {
            adminUser = user.uid;
            const adminName = userDoc.data().nombre || user.displayName || user.email || "Admin Maestro";
            const displayEl = document.getElementById("admin-user-display");
            if (displayEl) displayEl.textContent = adminName;
            
            cargarDashboardEstadisticas();
            loadOwnersAndCourts();
            cargarComunidadesAdmin();
            cargarTorneosAdmin();
        } else {
            window.toast("Acceso Denegado. Esta sección es exclusiva para el Administrador Maestro.", 'error');
            signOut(auth).then(() => { setTimeout(() => window.location.href = "login.html", 1500); });
        }
    } catch (err) {
        console.error("Error autenticando admin:", err);
        window.toast("Error de autenticación con el servidor.", 'error');
        signOut(auth).then(() => { setTimeout(() => window.location.href = "login.html", 1500); });
    }
});

// ==========================================
// 3. NAVEGACIÓN ENTRE PESTAÑAS
// ==========================================
const links = document.querySelectorAll('.sidebar-link');
const tabs = document.querySelectorAll('.tab-content');

links.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        links.forEach(l => l.classList.remove('active'));
        tabs.forEach(t => t.classList.remove('mostrar'));
        
        link.classList.add('active');
        const targetId = link.getAttribute('data-target');
        const targetTab = document.getElementById(targetId);
        if (targetTab) targetTab.classList.add('mostrar');

        if (targetId === 'tab-dashboard') cargarDashboardEstadisticas();
        if (targetId === 'tab-usuarios') loadOwnersAndCourts();
        if (targetId === 'tab-comunidades') cargarComunidadesAdmin();
    });
});

// Cerrar sesión
document.getElementById('btn-logout')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});

// Botón Actualizar Métricas
document.getElementById('btn-refresh-kpis')?.addEventListener('click', () => {
    cargarDashboardEstadisticas(true);
});

// ==========================================
// 4. ANIMACIÓN SUAVE DE CONTADORES (KPIS)
// ==========================================
function animateCounter(el, target, duration = 1100) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    const update = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - (1 - progress) * (1 - progress);
        const current = Math.floor(start + (target - start) * ease);
        el.textContent = current.toLocaleString('es-PE');
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = Number(target).toLocaleString('es-PE');
        }
    };
    requestAnimationFrame(update);
}

// ==========================================
// 5. MÓDULO: CARGAR DASHBOARD DE ESTADÍSTICAS
// ==========================================
async function cargarDashboardEstadisticas(isManualRefresh = false) {
    const refreshIcon = document.getElementById('icon-refresh-kpis');
    if (refreshIcon && isManualRefresh) refreshIcon.classList.add('ph-spin');

    try {
        const [snapUsuarios, snapCanchas, snapReservas, snapComunidades] = await Promise.all([
            getDocs(collection(db, "usuarios")),
            getDocs(collection(db, "canchas")),
            getDocs(collection(db, "reservas")),
            getDocs(collection(db, "comunidades"))
        ]);

        // 1. Usuarios
        let totalJugadores = 0;
        let totalDuenos = 0;
        let totalUsuariosValidos = 0;

        snapUsuarios.forEach(docSnap => {
            const u = docSnap.data();
            const rol = (u.rol || "").toLowerCase().trim();
            if (rol === "player") {
                totalJugadores++;
                totalUsuariosValidos++;
            } else if (rol === "owner") {
                totalDuenos++;
                totalUsuariosValidos++;
            } else if (rol !== "admin") {
                totalUsuariosValidos++;
            }
        });

        // 2. Canchas
        let canchasPublicadas = 0;
        let canchasRevision = 0;
        let canchasBorrador = 0;

        snapCanchas.forEach(docSnap => {
            const c = docSnap.data();
            const estado = (c.estadoPublicacion || "").toLowerCase();
            if (estado === "published") {
                canchasPublicadas++;
            } else if (estado === "pending_review") {
                canchasRevision++;
            } else if (c.configurado === true && !estado) {
                canchasPublicadas++;
            } else {
                canchasBorrador++;
            }
        });

        const navBadge = document.getElementById("nav-pending-badge");
        if (navBadge) {
            if (canchasRevision > 0) {
                navBadge.textContent = canchasRevision;
                navBadge.style.display = "inline-block";
            } else {
                navBadge.style.display = "none";
            }
        }

        // 3. Reservas
        let reservasConfirmadas = 0;
        let reservasPendientes = 0;
        let reservasSena = 0;
        let reservasCanceladas = 0;
        const totalReservas = snapReservas.size;

        snapReservas.forEach(docSnap => {
            const r = docSnap.data();
            const st = (r.estado || "").toLowerCase().trim();
            if (["confirmada", "confirmed", "completed", "jugada"].includes(st)) {
                reservasConfirmadas++;
            } else if (["pendiente", "pending"].includes(st)) {
                reservasPendientes++;
            } else if (st.includes("seña") || st.includes("sena")) {
                reservasSena++;
            } else if (["cancelada", "cancelado", "cancelled", "rejected"].includes(st)) {
                reservasCanceladas++;
            } else {
                reservasConfirmadas++;
            }
        });

        // 4. Comunidades
        const totalComunidades = snapComunidades.size;

        // 5. Actualizar KPIs con contadores animados
        animateCounter(document.getElementById('kpi-usuarios'), totalUsuariosValidos);
        animateCounter(document.getElementById('kpi-canchas'), canchasPublicadas);
        animateCounter(document.getElementById('kpi-reservas'), reservasConfirmadas);
        animateCounter(document.getElementById('kpi-comunidades'), totalComunidades);

        const jugEl = document.getElementById('kpi-jugadores');
        if (jugEl) jugEl.textContent = totalJugadores;
        const dueEl = document.getElementById('kpi-duenos');
        if (dueEl) dueEl.textContent = totalDuenos;
        const canPubEl = document.getElementById('kpi-canchas-pub');
        if (canPubEl) canPubEl.textContent = canchasPublicadas;
        const canPendEl = document.getElementById('kpi-canchas-pend');
        if (canPendEl) canPendEl.textContent = canchasRevision;
        const resTotEl = document.getElementById('kpi-reservas-total');
        if (resTotEl) resTotEl.textContent = totalReservas;

        // 6. Gráficos Chart.js
        renderizarGraficosDashboard({
            reservas: {
                confirmadas: reservasConfirmadas,
                pendientes: reservasPendientes,
                sena: reservasSena,
                canceladas: reservasCanceladas
            },
            canchas: {
                publicadas: canchasPublicadas,
                revision: canchasRevision,
                borrador: canchasBorrador
            }
        });

    } catch (error) {
        console.error("Error al cargar dashboard de estadísticas:", error);
    } finally {
        if (refreshIcon && isManualRefresh) {
            setTimeout(() => refreshIcon.classList.remove('ph-spin'), 600);
        }
    }
}

// ==========================================
// 6. RENDERIZADO DE GRÁFICOS CON CHART.JS
// ==========================================
function renderizarGraficosDashboard(data) {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.color = '#929C97';
    Chart.defaults.font.family = "'Poppins', sans-serif";
    Chart.defaults.font.size = 12;

    // Gráfico 1: Reservas por Estado
    const ctxReservas = document.getElementById('chart-reservas')?.getContext('2d');
    if (ctxReservas) {
        if (chartReservasInstance) chartReservasInstance.destroy();

        chartReservasInstance = new Chart(ctxReservas, {
            type: 'bar',
            data: {
                labels: ['Confirmadas / Jugadas', 'Pendientes', 'Seña Recibida', 'Canceladas'],
                datasets: [{
                    label: 'Total Reservas',
                    data: [
                        data.reservas.confirmadas,
                        data.reservas.pendientes,
                        data.reservas.sena,
                        data.reservas.canceladas
                    ],
                    backgroundColor: [
                        'rgba(46, 204, 113, 0.75)',
                        'rgba(255, 200, 87, 0.75)',
                        'rgba(52, 152, 219, 0.75)',
                        'rgba(255, 69, 69, 0.65)'
                    ],
                    borderColor: [
                        '#2ecc71',
                        '#FFC857',
                        '#3498db',
                        '#FF4545'
                    ],
                    borderWidth: 1.5,
                    borderRadius: 8,
                    maxBarThickness: 45
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#111613',
                        titleColor: '#ffffff',
                        bodyColor: '#F5F7F6',
                        borderColor: 'rgba(46, 204, 113, 0.3)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10,
                        boxPadding: 6,
                        usePointStyle: true
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { color: '#929C97', font: { weight: '600' } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { precision: 0, color: '#929C97' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Gráfico 2: Estado de Canchas
    const ctxCanchas = document.getElementById('chart-canchas')?.getContext('2d');
    if (ctxCanchas) {
        if (chartCanchasInstance) chartCanchasInstance.destroy();

        chartCanchasInstance = new Chart(ctxCanchas, {
            type: 'doughnut',
            data: {
                labels: ['Publicadas (Web)', 'En Revisión', 'En Borrador'],
                datasets: [{
                    data: [
                        data.canchas.publicadas,
                        data.canchas.revision,
                        data.canchas.borrador
                    ],
                    backgroundColor: [
                        '#2ecc71',
                        '#2bd1ea',
                        'rgba(255, 255, 255, 0.18)'
                    ],
                    borderColor: '#0f1512',
                    borderWidth: 3,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 16,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            color: '#F5F7F6',
                            font: { weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#111613',
                        titleColor: '#ffffff',
                        bodyColor: '#F5F7F6',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10
                    }
                }
            }
        });
    }
}

// ==========================================
// 7. MÓDULO: GESTIÓN DE DUEÑOS Y CANCHAS
// ==========================================
const listContainer = document.getElementById('owners-list');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const modalDetails = document.getElementById('modal-details');

async function loadOwnersAndCourts() {
    try {
        const [snapUsuarios, snapCanchas] = await Promise.all([
            getDocs(collection(db, "usuarios")),
            getDocs(collection(db, "canchas"))
        ]);

        const canchasMap = new Map();
        snapCanchas.forEach(d => canchasMap.set(d.id, { id: d.id, ...d.data() }));

        allOwners = [];
        snapUsuarios.forEach((d) => {
            const data = d.data();
            if (data.rol === "owner") {
                const canchaInfo = canchasMap.get(data.uid) || {};
                allOwners.push({
                    ...data,
                    canchaData: canchaInfo,
                    estadoPublicacion: canchaInfo.estadoPublicacion || (canchaInfo.configurado ? 'published' : 'draft')
                });
            }
        });

        renderOwners();
    } catch (error) {
        console.error("Error al cargar dueños y canchas:", error);
        if (listContainer) {
            listContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--danger);"><i class="ph-bold ph-warning-octagon" style="font-size:2rem;"></i><p style="margin-top:8px;">Error conectando a la base de datos.</p></div>`;
        }
    }
}

function renderOwners() {
    const searchTerm = (searchInput?.value || "").toLowerCase().trim();
    const statusFilter = filterStatus?.value || "all";

    const filtered = allOwners.filter(owner => {
        const searchStr = `${owner.nombre || ''} ${owner.email || ''} ${owner.documento || ''} ${owner.complejo || ''} ${owner.canchaData?.nombre || ''}`.toLowerCase();
        const matchesSearch = !searchTerm || searchStr.includes(searchTerm);
        
        let matchesStatus = true;
        if (statusFilter === "pending") matchesStatus = owner.estado === "pending";
        else if (statusFilter === "approved") matchesStatus = owner.estado === "approved";
        else if (statusFilter === "rejected") matchesStatus = owner.estado === "rejected";
        else if (statusFilter === "pending_review") matchesStatus = owner.estadoPublicacion === "pending_review";
        
        return matchesSearch && matchesStatus;
    });

    if (!listContainer) return;
    listContainer.innerHTML = "";

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 45px 20px; color: var(--text-muted); background: rgba(255,255,255,0.02); border: 1px dashed var(--card-border); border-radius: var(--radius-lg);">
                <i class="ph-bold ph-magnifying-glass" style="font-size: 2.2rem; color: var(--text-dim); margin-bottom: 8px;"></i>
                <h4 style="margin: 0; color: #fff; font-size: 1rem;">No se encontraron solicitudes</h4>
                <p style="font-size: 0.8rem; margin: 4px 0 0;">Intenta con otro filtro o término de búsqueda.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(owner => {
        const estadoCuenta = owner.estado === "approved" ? "approved" : owner.estado === "rejected" ? "rejected" : "pending";
        const estadoCuentaTexto = owner.estado === "approved" ? "Cuenta Aprobada" : owner.estado === "rejected" ? "Cuenta Suspendida" : "Cuenta Pendiente";
        
        const estPub = owner.estadoPublicacion;
        let badgePublicacion = `<span class="badge badge-draft"><i class="ph-bold ph-file-dashed"></i> Borrador</span>`;
        if (estPub === 'pending_review') {
            badgePublicacion = `<span class="badge badge-review"><i class="ph-bold ph-hourglass-medium"></i> SOLICITA PUBLICACIÓN</span>`;
        } else if (estPub === 'published') {
            badgePublicacion = `<span class="badge badge-published"><i class="ph-bold ph-globe"></i> PÚBLICA EN WEB</span>`;
        }

        const card = document.createElement('div');
        card.className = `owner-card status-${estadoCuenta}`;
        
        card.innerHTML = `
            <div style="flex: 1; min-width: 250px;">
                <h3 class="owner-title">${owner.complejo || owner.canchaData?.nombre || "Complejo Sin Nombre"}</h3>
                <div class="owner-meta">
                    <span><i class="ph-bold ph-user"></i> ${owner.nombre || "Dueño no registrado"}</span>
                    <span><i class="ph-bold ph-envelope"></i> ${owner.email || "Sin email"}</span>
                    ${owner.documento ? `<span><i class="ph-bold ph-identification-card"></i> Doc: ${owner.documento}</span>` : ''}
                </div>
                <div class="owner-badges">
                    <span class="badge badge-${estadoCuenta}">
                        <i class="ph-bold ph-${estadoCuenta === 'approved' ? 'check-circle' : estadoCuenta === 'pending' ? 'clock' : 'x-circle'}"></i>
                        ${estadoCuentaTexto}
                    </span>
                    ${owner.estado === 'approved' ? badgePublicacion : ''}
                </div>
            </div>
            <div>
                <button class="btn btn-outline btn-view" data-uid="${owner.uid}">
                    <i class="ph-bold ph-sliders-horizontal"></i> Gestionar
                </button>
            </div>
        `;
        listContainer.appendChild(card);
    });

    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', (e) => viewDetails(e.currentTarget.dataset.uid));
    });
}

searchInput?.addEventListener('input', renderOwners);
filterStatus?.addEventListener('change', renderOwners);
document.getElementById('close-modal')?.addEventListener('click', () => modalDetails?.classList.remove('mostrar'));

function viewDetails(uid) {
    const owner = allOwners.find(o => o.uid === uid);
    if (!owner) return;

    const cancha = owner.canchaData || {};
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setTxt('det-complejo', owner.complejo || cancha.nombre || "No especificado");
    setTxt('det-nombre', owner.nombre || "No especificado");
    setTxt('det-dni', owner.documento || "No especificado");
    setTxt('det-email', owner.email || "No especificado");
    setTxt('det-telefono', owner.telefono || cancha.whatsapp || "No especificado");
    
    const estadoEl = document.getElementById('det-estado');
    if (estadoEl) {
        estadoEl.innerText = (owner.estado || "PENDING").toUpperCase();
        estadoEl.style.color = owner.estado === 'pending' ? 'var(--warning)' : owner.estado === 'approved' ? 'var(--primary-green)' : 'var(--danger)';
    }

    const actionsContainer = document.getElementById('modal-actions');
    if (!actionsContainer) return;
    actionsContainer.innerHTML = "";

    // 1. Acciones de Cuenta
    if (owner.estado === "pending" || owner.estado === "rejected") {
        const btnApprove = document.createElement('button');
        btnApprove.className = "btn btn-primary";
        btnApprove.innerHTML = `<i class="ph-bold ph-check-circle"></i> Aprobar Acceso al Sistema`;
        btnApprove.onclick = () => changeAccountStatus(uid, "approved", btnApprove);
        actionsContainer.appendChild(btnApprove);
    }

    if (owner.estado === "pending" || owner.estado === "approved") {
        const btnReject = document.createElement('button');
        btnReject.className = "btn btn-danger";
        btnReject.innerHTML = `<i class="ph-bold ph-x-circle"></i> Rechazar / Suspender Cuenta`;
        btnReject.onclick = () => changeAccountStatus(uid, "rejected", btnReject);
        actionsContainer.appendChild(btnReject);
    }

    // 2. Acciones de Publicación
    if (owner.estado === "approved") {
        const divider = document.createElement('div');
        divider.style.cssText = "border-top: 1px solid var(--card-border); margin: 8px 0; padding-top: 8px;";
        actionsContainer.appendChild(divider);

        if (owner.estadoPublicacion === "pending_review" || owner.estadoPublicacion === "draft") {
            const btnPublish = document.createElement('button');
            btnPublish.className = "btn btn-primary";
            btnPublish.style.background = "#ffffff";
            btnPublish.style.color = "#080B0A";
            btnPublish.style.borderColor = "#ffffff";
            btnPublish.innerHTML = `<i class="ph-bold ph-globe"></i> Aprobar y PUBLICAR Cancha en la Web`;
            btnPublish.onclick = () => changePublicationStatus(uid, "published", btnPublish);
            actionsContainer.appendChild(btnPublish);
        } else if (owner.estadoPublicacion === "published") {
            const btnUnpublish = document.createElement('button');
            btnUnpublish.className = "btn btn-outline";
            btnUnpublish.style.color = "var(--warning)";
            btnUnpublish.style.borderColor = "rgba(255, 200, 87, 0.4)";
            btnUnpublish.innerHTML = `<i class="ph-bold ph-eye-slash"></i> Pausar / Ocultar de la Web`;
            btnUnpublish.onclick = () => changePublicationStatus(uid, "draft", btnUnpublish);
            actionsContainer.appendChild(btnUnpublish);
        }
    }
    modalDetails?.classList.add('mostrar');
}

async function changeAccountStatus(uid, newStatus, btnEl = null) {
    if (!confirm(`¿Confirmas cambiar el estado de la CUENTA a: ${newStatus.toUpperCase()}?`)) return;
    let oldHtml = '';
    if (btnEl) {
        btnEl.disabled = true;
        oldHtml = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Actualizando...';
    }
    try {
        await updateDoc(doc(db, "usuarios", uid), {
            estado: newStatus,
            approvedBy: adminUser,
            approvedAt: serverTimestamp()
        });
        window.toast(`Cuenta actualizada a: ${newStatus.toUpperCase()}`, 'success');
        modalDetails?.classList.remove('mostrar');
        loadOwnersAndCourts();
        cargarDashboardEstadisticas();
    } catch (error) {
        console.error("Error al actualizar la cuenta:", error);
        window.toast("Error al actualizar la cuenta.", 'error');
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = oldHtml;
        }
    }
}

async function changePublicationStatus(uid, newStatus, btnEl = null) {
    if (!confirm(`¿Confirmas cambiar la PUBLICACIÓN de la cancha a: ${newStatus.toUpperCase()}?`)) return;
    let oldHtml = '';
    if (btnEl) {
        btnEl.disabled = true;
        oldHtml = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Actualizando...';
    }
    try {
        await updateDoc(doc(db, "canchas", uid), {
            estadoPublicacion: newStatus,
            publicadoPor: adminUser,
            publicadoEn: serverTimestamp()
        });
        window.toast(newStatus === 'published' ? '¡Cancha PUBLICADA y visible para todos los jugadores!' : 'Cancha ocultada de la web (en borrador).', 'success');
        modalDetails?.classList.remove('mostrar');
        loadOwnersAndCourts();
        cargarDashboardEstadisticas();
    } catch (error) {
        console.error("Error cambiando publicación:", error);
        window.toast("Error cambiando publicación.", 'error');
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = oldHtml;
        }
    }
}

// ==========================================
// 8. MÓDULO: GESTIÓN DE COMUNIDADES
// ==========================================
const modalComunidad = document.getElementById('modal-admin-comunidad');
const formComunidad = document.getElementById('form-admin-comunidad');

document.getElementById('btn-abrir-crear-comunidad')?.addEventListener('click', () => modalComunidad?.classList.add('mostrar'));
document.getElementById('cerrar-admin-comunidad')?.addEventListener('click', () => modalComunidad?.classList.remove('mostrar'));

async function cargarComunidadesAdmin() {
    const tbody = document.getElementById('admin-lista-comunidades');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px;"><i class="ph-bold ph-spinner-gap ph-spin" style="font-size: 1.5rem; color: var(--primary-green);"></i><p style="margin-top:6px; color:var(--text-muted);">Cargando comunidades...</p></td></tr>';
    try {
        const snap = await getDocs(query(collection(db, 'comunidades')));
        tbody.innerHTML = '';
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px; color: var(--text-muted);"><i class="ph-bold ph-shield-warning" style="font-size: 1.8rem; margin-bottom: 6px;"></i><br>No se encontraron comunidades registradas.</td></tr>';
            return;
        }
        snap.forEach(docSnap => {
            const c = docSnap.data();
            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: 700; color: #fff;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="ph-fill ph-shield-checkered" style="color: var(--primary-green); font-size: 1.1rem;"></i>
                            <span>${c.nombre || "Sin nombre"}</span>
                        </div>
                    </td>
                    <td>${c.deporte || "Fútbol"} • <span style="color: var(--text-muted);">${c.categoria || "Libre"}</span></td>
                    <td><i class="ph-bold ph-map-pin" style="color: var(--primary-green);"></i> ${c.ciudad || "No especificada"}</td>
                    <td><a href="https://wa.me/${String(c.whatsappLider || '').replace(/\D/g,'')}" target="_blank" style="color: var(--primary-green); font-weight: 600; text-decoration: none;"><i class="ph-bold ph-whatsapp-logo"></i> ${c.whatsappLider || "Sin teléfono"}</a></td>
                    <td style="text-align: right;">
                        <button class="btn btn-danger btn-borrar-comunidad" data-id="${docSnap.id}" style="padding: 6px 12px; font-size: 0.78rem;">
                            <i class="ph-bold ph-trash"></i> Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        document.querySelectorAll('.btn-borrar-comunidad').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const btnReal = e.target.closest('.btn-borrar-comunidad');
                const docId = btnReal.getAttribute('data-id');
                if (confirm('¿Estás seguro de eliminar esta comunidad de la plataforma?')) {
                    btnReal.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i>';
                    btnReal.disabled = true;
                    try {
                        await deleteDoc(doc(db, 'comunidades', docId));
                        window.toast('Comunidad eliminada.', 'info');
                        cargarComunidadesAdmin();
                        cargarDashboardEstadisticas();
                    } catch (err) {
                        console.error("Error al eliminar comunidad:", err);
                        window.toast("No se pudo eliminar la comunidad.", 'error');
                        btnReal.innerHTML = '<i class="ph-bold ph-trash"></i> Eliminar';
                        btnReal.disabled = false;
                    }
                }
            });
        });
    } catch (error) {
        console.error("Error al cargar comunidades:", error);
        tbody.innerHTML = '<tr><td colspan="5" style="color: var(--danger); text-align: center; padding: 25px;">Error conectando con la base de datos de comunidades.</td></tr>';
    }
}

formComunidad?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = formComunidad.querySelector('button[type="submit"]');
    btnSubmit.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Publicando...';
    btnSubmit.disabled = true;
    try {
        await addDoc(collection(db, 'comunidades'), {
            nombre: document.getElementById('admin-com-nombre').value.trim(),
            deporte: document.getElementById('admin-com-deporte').value.trim(),
            categoria: document.getElementById('admin-com-categoria').value.trim(),
            ciudad: document.getElementById('admin-com-ciudad').value.trim(),
            whatsappLider: document.getElementById('admin-com-wsp').value.trim(),
            liderUid: document.getElementById('admin-com-lider-uid').value.trim(),
            descripcion: document.getElementById('admin-com-desc').value.trim(),
            miembros: 0,
            creadoPor: adminUser,
            creadoEn: serverTimestamp()
        });
        window.toast('¡Comunidad publicada exitosamente en CHALACAPP!', 'success');
        modalComunidad?.classList.remove('mostrar');
        formComunidad.reset();
        cargarComunidadesAdmin();
        cargarDashboardEstadisticas();
    } catch (error) {
        console.error("Error al publicar comunidad:", error);
        window.toast('Error al publicar comunidad.', 'error');
    } finally {
        btnSubmit.innerHTML = '<i class="ph-bold ph-check"></i> Publicar Comunidad';
        btnSubmit.disabled = false;
    }
});

// ==========================================
// 9. MÓDULO: MODERACIÓN DE TORNEOS Y LIGAS
// ==========================================
async function cargarTorneosAdmin() {
    const tbody = document.getElementById('admin-lista-torneos');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 30px;"><i class="ph-bold ph-spinner-gap ph-spin" style="font-size: 1.5rem; color: var(--warning);"></i><p style="margin-top:6px; color:var(--text-muted);">Cargando torneos y academias...</p></td></tr>';
    try {
        const snap = await getDocs(query(collection(db, 'anuncios_ligas')));
        tbody.innerHTML = '';
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 30px; color: var(--text-muted);"><i class="ph-bold ph-trophy" style="font-size: 1.8rem; margin-bottom: 6px; color: var(--warning);"></i><br>No se encontraron solicitudes de torneos o academias.</td></tr>';
            return;
        }
        snap.forEach(docSnap => {
            const t = docSnap.data();
            const estado = (t.estado || 'pendiente_aprobacion').toLowerCase();
            let badgeEstado = '<span class="badge badge-pending"><i class="ph-bold ph-clock"></i> Pendiente</span>';
            if (estado === 'aprobado') {
                badgeEstado = '<span class="badge badge-approved"><i class="ph-bold ph-check-circle"></i> Aprobado</span>';
            } else if (estado === 'rechazado') {
                badgeEstado = '<span class="badge badge-rejected"><i class="ph-bold ph-x-circle"></i> Rechazado</span>';
            }

            const wspClean = String(t.whatsapp || '').replace(/\D/g, '');
            const wspLink = wspClean ? `<a href="https://wa.me/${wspClean}" target="_blank" style="color:var(--primary-green); font-weight:600; text-decoration:none;"><i class="ph-bold ph-whatsapp-logo"></i> ${t.whatsapp}</a>` : '<span style="color:var(--text-muted);">Sin WhatsApp</span>';
            const linkVerif = t.linkVerificacion ? `<a href="${t.linkVerificacion}" target="_blank" style="color:var(--blue); font-size:0.78rem; display:block; margin-top:3px;"><i class="ph-bold ph-arrow-square-out"></i> Ver Bases/Flyer</a>` : '';

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: 700; color: #fff;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="ph-fill ph-trophy" style="color: var(--warning); font-size: 1.15rem;"></i>
                            <span>${t.nombre || "Torneo sin título"}</span>
                        </div>
                    </td>
                    <td>${t.tipo ? t.tipo.toUpperCase() : 'TORNEO'} • <span style="color: var(--text-muted);">${t.deporte || 'Fútbol'} (${t.categorias || 'Libre'})</span></td>
                    <td><i class="ph-bold ph-map-pin" style="color: var(--primary-green);"></i> ${t.sede || "No especificada"}<br><small style="color:var(--text-dim);">${t.premiosHorario || 'Premios a confirmar'}</small></td>
                    <td>${wspLink}${linkVerif}</td>
                    <td>${badgeEstado}</td>
                    <td style="text-align: right; white-space: nowrap;">
                        ${estado !== 'aprobado' ? `<button class="btn btn-primary btn-aprobar-torneo" data-id="${docSnap.id}" style="padding: 6px 10px; font-size: 0.78rem; margin-right: 4px;" title="Aprobar Torneo"><i class="ph-bold ph-check"></i> Aprobar</button>` : ''}
                        ${estado !== 'rechazado' ? `<button class="btn btn-outline btn-rechazar-torneo" data-id="${docSnap.id}" style="padding: 6px 10px; font-size: 0.78rem; color: var(--warning); border-color: rgba(255,200,87,0.3); margin-right: 4px;" title="Rechazar"><i class="ph-bold ph-x"></i> Rechazar</button>` : ''}
                        <button class="btn btn-danger btn-borrar-torneo" data-id="${docSnap.id}" style="padding: 6px 10px; font-size: 0.78rem;" title="Eliminar"><i class="ph-bold ph-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        tbody.querySelectorAll('.btn-aprobar-torneo').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm('¿Aprobar y publicar este torneo para todos los jugadores?')) return;
                btn.disabled = true;
                btn.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i>';
                try {
                    await updateDoc(doc(db, 'anuncios_ligas', id), {
                        estado: 'aprobado',
                        moderadoPor: adminUser,
                        moderadoEn: serverTimestamp()
                    });
                    window.toast('Torneo aprobado y publicado exitosamente.', 'success');
                    cargarTorneosAdmin();
                } catch (err) {
                    console.error('Error aprobando torneo:', err);
                    window.toast('Error al aprobar el torneo.', 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="ph-bold ph-check"></i> Aprobar';
                }
            });
        });

        tbody.querySelectorAll('.btn-rechazar-torneo').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm('¿Rechazar esta solicitud de torneo?')) return;
                btn.disabled = true;
                btn.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i>';
                try {
                    await updateDoc(doc(db, 'anuncios_ligas', id), {
                        estado: 'rechazado',
                        moderadoPor: adminUser,
                        moderadoEn: serverTimestamp()
                    });
                    window.toast('Torneo marcado como rechazado.', 'info');
                    cargarTorneosAdmin();
                } catch (err) {
                    console.error('Error rechazando torneo:', err);
                    window.toast('Error al rechazar el torneo.', 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="ph-bold ph-x"></i> Rechazar';
                }
            });
        });

        tbody.querySelectorAll('.btn-borrar-torneo').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm('¿Eliminar permanentemente este registro de torneo?')) return;
                btn.disabled = true;
                btn.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i>';
                try {
                    await deleteDoc(doc(db, 'anuncios_ligas', id));
                    window.toast('Torneo eliminado.', 'info');
                    cargarTorneosAdmin();
                } catch (err) {
                    console.error('Error eliminando torneo:', err);
                    window.toast('Error al eliminar el torneo.', 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="ph-bold ph-trash"></i>';
                }
            });
        });

    } catch (err) {
        console.error("Error al cargar torneos:", err);
        tbody.innerHTML = '<tr><td colspan="6" style="color: var(--danger); text-align: center; padding: 25px;">Error conectando con la base de datos de torneos.</td></tr>';
    }
}
