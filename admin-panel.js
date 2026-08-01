import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",
    authDomain: "app-futbol-acd0f.firebaseapp.com",
    projectId: "app-futbol-acd0f",
    storageBucket: "app-futbol-acd0f.firebasestorage.app",
    messagingSenderId: "223446110165",
    appId: "1:223446110165:web:219afce6a9dac03203f75c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let adminUser = null;
let allOwners = [];

const listContainer = document.getElementById('owners-list');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const modal = document.getElementById('modal-details');

// Validar Seguridad: Solo Admins Maestros
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
    if (userDoc.exists() && userDoc.data().rol === "admin" && userDoc.data().estado === "approved") {
        adminUser = user.uid;
        loadOwnersAndCourts();
    } else {
        alert("Acceso Denegado. No eres Administrador.");
        signOut(auth).then(() => window.location.href = "login.html");
    }
});

// Cargar a todos los dueños y cruzar los datos con la colección de canchas
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
        console.error("Error al cargar datos:", error);
        listContainer.innerHTML = `<p style="color:var(--danger); text-align:center;">Error cargando datos del servidor.</p>`;
    }
}

// Renderizar lista en el panel
function renderOwners() {
    const searchTerm = (searchInput?.value || "").toLowerCase();
    const statusFilter = filterStatus?.value || "all";

    const filtered = allOwners.filter(owner => {
        const matchesSearch = (owner.nombre || "").toLowerCase().includes(searchTerm) || 
                              (owner.email || "").toLowerCase().includes(searchTerm) ||
                              (owner.documento || "").toLowerCase().includes(searchTerm) ||
                              (owner.complejo || owner.canchaData?.nombre || "").toLowerCase().includes(searchTerm);
        
        let matchesStatus = true;
        if (statusFilter === "pending") matchesStatus = owner.estado === "pending";
        else if (statusFilter === "approved") matchesStatus = owner.estado === "approved";
        else if (statusFilter === "rejected") matchesStatus = owner.estado === "rejected";
        else if (statusFilter === "pending_review") matchesStatus = owner.estadoPublicacion === "pending_review";
        
        return matchesSearch && matchesStatus;
    });

    listContainer.innerHTML = "";
    if (filtered.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted); grid-column:1/-1;">No se encontraron registros.</div>`;
        return;
    }

    filtered.forEach(owner => {
        const estadoCuenta = owner.estado === "approved" ? "approved" : owner.estado === "rejected" ? "rejected" : "pending";
        const estadoCuentaTexto = owner.estado === "approved" ? "Cuenta Aprobada" : owner.estado === "rejected" ? "Cuenta Rechazada" : "Cuenta Pendiente";
        
        const estPub = owner.estadoPublicacion;
        let badgePublicacion = `<span style="color:var(--warning); background:rgba(255,193,7,0.1); padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold;">Cancha en Borrador</span>`;
        if (estPub === 'pending_review') badgePublicacion = `<span style="color:#17a2b8; background:rgba(23,162,184,0.15); padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold;">⚠️ SOLICITUD DE PUBLICACIÓN PENDIENTE</span>`;
        if (estPub === 'published') badgePublicacion = `<span style="color:var(--primary-green); background:rgba(0,217,104,0.1); padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold;">PÚBLICA Y ACTIVA</span>`;

        const card = document.createElement('div');
        card.className = `master-card ${estadoCuenta}`;
        card.style.cssText = "background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:12px; padding:18px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;";
        
        card.innerHTML = `
            <div class="master-info">
                <h3 style="margin:0 0 5px; font-size:1.1rem;">${owner.complejo || owner.canchaData?.nombre || "Sin Complejo Registrado"}</h3>
                <p style="margin:2px 0; font-size:0.85rem; color:var(--text-muted);">
                    <strong>Dueño:</strong> ${owner.nombre} | <strong>Email:</strong> ${owner.email}
                </p>
                <div style="margin-top:8px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <span style="font-size:0.75rem; font-weight:bold; color:var(--${estadoCuenta === 'pending' ? 'warning' : estadoCuenta === 'approved' ? 'primary-green' : 'danger'})">${estadoCuentaTexto}</span>
                    ${owner.estado === 'approved' ? ' • ' + badgePublicacion : ''}
                </div>
            </div>
            <div class="master-actions">
                <button class="btn btn-outline btn-view" data-uid="${owner.uid}" style="width:auto; padding:8px 16px;">Gestionar / Revisar</button>
            </div>
        `;
        listContainer.appendChild(card);
    });

    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', (e) => viewDetails(e.target.dataset.uid));
    });
}

// Ver Detalles Completos y Controlar Publicación
function viewDetails(uid) {
    const owner = allOwners.find(o => o.uid === uid);
    if (!owner) return;

    const cancha = owner.canchaData || {};

    document.getElementById('det-complejo').innerText = owner.complejo || cancha.nombre || "No especificado";
    document.getElementById('det-nombre').innerText = owner.nombre || "No especificado";
    document.getElementById('det-dni').innerText = owner.documento || "No especificado";
    document.getElementById('det-email').innerText = owner.email || "No especificado";
    document.getElementById('det-telefono').innerText = owner.telefono || cancha.whatsapp || "No especificado";
    document.getElementById('det-direccion').innerText = owner.direccion || cancha.ubicacionTexto || "No especificado";
    
    const estadoEl = document.getElementById('det-estado');
    estadoEl.innerText = owner.estado.toUpperCase();
    estadoEl.style.color = owner.estado === 'pending' ? 'var(--warning)' : owner.estado === 'approved' ? 'var(--primary-green)' : 'var(--danger)';

    const actionsContainer = document.getElementById('modal-actions');
    actionsContainer.innerHTML = "";
    actionsContainer.style.cssText = "display:flex; flex-direction:column; gap:10px; margin-top:20px;";

    // 1. ACCIONES DE CUENTA DE USUARIO (Aprobar / Rechazar Registro)
    if (owner.estado === "pending" || owner.estado === "rejected") {
        const btnApprove = document.createElement('button');
        btnApprove.className = "btn hero-primary";
        btnApprove.innerHTML = `<i class="ph-bold ph-check-circle"></i> Aprobar Solicitud de Cuenta`;
        btnApprove.onclick = () => changeAccountStatus(uid, "approved");
        actionsContainer.appendChild(btnApprove);
    }

    if (owner.estado === "pending" || owner.estado === "approved") {
        const btnReject = document.createElement('button');
        btnReject.className = "btn";
        btnReject.style.background = "var(--danger)";
        btnReject.innerHTML = `<i class="ph-bold ph-x-circle"></i> Rechazar / Suspender Cuenta`;
        btnReject.onclick = () => changeAccountStatus(uid, "rejected");
        actionsContainer.appendChild(btnReject);
    }

    // 2. ACCIONES DE PUBLICACIÓN EN LA WEB (Si el usuario ya está aprobado)
    if (owner.estado === "approved") {
        const hr = document.createElement('hr');
        hr.style.cssText = "border: 0; border-top: 1px solid var(--border-color); margin: 10px 0;";
        actionsContainer.appendChild(hr);

        const labelPub = document.createElement('small');
        labelPub.style.cssText = "color:var(--text-muted); font-weight:bold; letter-spacing:0.05em;";
        labelPub.innerText = "ESTADO DE PUBLICACIÓN PÚBLICA:";
        actionsContainer.appendChild(labelPub);

        if (owner.estadoPublicacion === "pending_review" || owner.estadoPublicacion === "draft") {
            const btnPublish = document.createElement('button');
            btnPublish.className = "btn";
            btnPublish.style.cssText = "background: var(--primary-green); color: #000; font-weight: bold;";
            btnPublish.innerHTML = `<i class="ph-bold ph-globe-hemisphere-west"></i> Aprobar y PUBLICAR Cancha en la Web`;
            btnPublish.onclick = () => changePublicationStatus(uid, "published");
            actionsContainer.appendChild(btnPublish);
        } else if (owner.estadoPublicacion === "published") {
            const btnUnpublish = document.createElement('button');
            btnUnpublish.className = "btn btn-outline";
            btnUnpublish.style.cssText = "color: var(--warning); border-color: var(--warning);";
            btnUnpublish.innerHTML = `<i class="ph-bold ph-eye-slash"></i> Pausar / Ocultar de la Web (Borrador)`;
            btnUnpublish.onclick = () => changePublicationStatus(uid, "draft");
            actionsContainer.appendChild(btnUnpublish);
        }
    }

    modal.classList.add('mostrar');
}

// Cambiar estado de Cuenta (Aprobado/Rechazado)
async function changeAccountStatus(uid, newStatus) {
    if (!confirm(`¿Estás seguro de cambiar el estado de la CUENTA a: ${newStatus.toUpperCase()}?`)) return;
    
    try {
        await updateDoc(doc(db, "usuarios", uid), {
            estado: newStatus,
            approvedBy: adminUser,
            approvedAt: serverTimestamp()
        });
        
        await updateDoc(doc(db, "solicitudes_duenos", uid), {
            estado: newStatus,
            reviewedBy: adminUser,
            reviewedAt: serverTimestamp()
        }).catch(() => {}); // Opcional si no existe el doc

        alert(`Cuenta actualizada a: ${newStatus}`);
        modal.classList.remove('mostrar');
        loadOwnersAndCourts();
    } catch (error) {
        console.error("Error actualizando estado de cuenta:", error);
        alert("Error al actualizar la cuenta.");
    }
}

// Cambiar estado de PUBLICACIÓN DE LA CANCHA (Publicar / Ocultar)
async function changePublicationStatus(uid, newStatus) {
    if (!confirm(`¿Confirmas que deseas cambiar la PUBLICACIÓN de la cancha a: ${newStatus.toUpperCase()}?`)) return;
    
    try {
        await updateDoc(doc(db, "canchas", uid), {
            estadoPublicacion: newStatus,
            publicadoPor: adminUser,
            publicadoEn: serverTimestamp()
        });

        alert(newStatus === 'published' ? '¡Cancha PUBLICADA! Ya es visible para todos los jugadores.' : 'Cancha ocultada de la web.');
        modal.classList.remove('mostrar');
        loadOwnersAndCourts();
    } catch (error) {
        console.error("Error cambiando publicación:", error);
        alert("No se pudo actualizar la publicación de la cancha.");
    }
}

// Listeners
searchInput?.addEventListener('input', renderOwners);
filterStatus?.addEventListener('change', renderOwners);
document.getElementById('close-modal')?.addEventListener('click', () => modal.classList.remove('mostrar'));
document.getElementById('btn-logout')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "login.html");
});
