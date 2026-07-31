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

// Validar Seguridad: Solo Admins
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
    if (userDoc.exists() && userDoc.data().rol === "admin" && userDoc.data().estado === "approved") {
        adminUser = user.uid;
        loadOwners();
    } else {
        alert("Acceso Denegado. No eres Administrador.");
        signOut(auth).then(() => window.location.href = "login.html");
    }
});

// Cargar a todos los dueños
async function loadOwners() {
    try {
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        allOwners = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.rol === "owner") {
                allOwners.push(data);
            }
        });
        renderOwners();
    } catch (error) {
        console.error("Error al cargar dueños:", error);
        listContainer.innerHTML = `<p style="color:var(--danger)">Error cargando datos.</p>`;
    }
}

// Renderizar la lista
function renderOwners() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusFilter = filterStatus.value;

    const filtered = allOwners.filter(owner => {
        const matchesSearch = (owner.nombre || "").toLowerCase().includes(searchTerm) || 
                              (owner.email || "").toLowerCase().includes(searchTerm) ||
                              (owner.documento || "").toLowerCase().includes(searchTerm) ||
                              (owner.complejo || "").toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === "all" || owner.estado === statusFilter;
        return matchesSearch && matchesStatus;
    });

    listContainer.innerHTML = "";
    if (filtered.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">No se encontraron solicitudes.</div>`;
        return;
    }

    filtered.forEach(owner => {
        const estadoClass = owner.estado === "approved" ? "approved" : owner.estado === "rejected" ? "rejected" : "pending";
        const estadoTexto = owner.estado === "approved" ? "Aprobado" : owner.estado === "rejected" ? "Rechazado" : "Pendiente";
        
        const card = document.createElement('div');
        card.className = `master-card ${estadoClass}`;
        card.innerHTML = `
            <div class="master-info">
                <h3>${owner.complejo || "Sin Complejo"}</h3>
                <p><strong>Dueño:</strong> ${owner.nombre} | <strong>Email:</strong> ${owner.email}</p>
                <p><strong>Estado:</strong> <span style="color: var(--${estadoClass === 'pending' ? 'warning' : estadoClass === 'approved' ? 'primary-green' : 'danger'})">${estadoTexto}</span></p>
            </div>
            <div class="master-actions">
                <button class="btn btn-outline btn-view" data-uid="${owner.uid}">Revisar</button>
            </div>
        `;
        listContainer.appendChild(card);
    });

    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', (e) => viewDetails(e.target.dataset.uid));
    });
}

// Ver Detalles y Acciones (FASE 3 LOGIC)
function viewDetails(uid) {
    const owner = allOwners.find(o => o.uid === uid);
    if (!owner) return;

    document.getElementById('det-complejo').innerText = owner.complejo || "No especificado";
    document.getElementById('det-nombre').innerText = owner.nombre || "No especificado";
    document.getElementById('det-dni').innerText = owner.documento || "No especificado";
    document.getElementById('det-email').innerText = owner.email || "No especificado";
    document.getElementById('det-telefono').innerText = owner.telefono || "No especificado";
    document.getElementById('det-direccion').innerText = owner.direccion || "No especificado";
    
    const estadoEl = document.getElementById('det-estado');
    estadoEl.innerText = owner.estado;
    estadoEl.style.color = owner.estado === 'pending' ? 'var(--warning)' : owner.estado === 'approved' ? 'var(--primary-green)' : 'var(--danger)';

    const actionsContainer = document.getElementById('modal-actions');
    actionsContainer.innerHTML = "";

    if (owner.estado === "pending" || owner.estado === "rejected") {
        const btnApprove = document.createElement('button');
        btnApprove.className = "btn hero-primary";
        btnApprove.innerText = "Aprobar Dueño";
        btnApprove.onclick = () => changeStatus(uid, "approved");
        actionsContainer.appendChild(btnApprove);
    }

    if (owner.estado === "pending" || owner.estado === "approved") {
        const btnReject = document.createElement('button');
        btnReject.className = "btn";
        btnReject.style.background = "var(--danger)";
        btnReject.innerText = "Rechazar";
        btnReject.onclick = () => changeStatus(uid, "rejected");
        actionsContainer.appendChild(btnReject);
    }

    modal.classList.add('mostrar');
}

// Cambiar estado en BD (Aprobar/Rechazar)
async function changeStatus(uid, newStatus) {
    if (!confirm(`¿Estás seguro de marcar esta solicitud como ${newStatus.toUpperCase()}?`)) return;
    
    try {
        // Actualizamos en la colección usuarios
        await updateDoc(doc(db, "usuarios", uid), {
            estado: newStatus,
            approvedBy: adminUser,
            approvedAt: serverTimestamp()
        });
        
        // Actualizamos en la colección solicitudes_duenos (Historial)
        await updateDoc(doc(db, "solicitudes_duenos", uid), {
            estado: newStatus,
            reviewedBy: adminUser,
            reviewedAt: serverTimestamp()
        });

        alert(`Usuario actualizado a: ${newStatus}`);
        modal.classList.remove('mostrar');
        loadOwners(); // Recargar datos
    } catch (error) {
        console.error("Error actualizando estado:", error);
        alert("Error al actualizar. Revisa la consola.");
    }
}

// Listeners Generales
searchInput.addEventListener('input', renderOwners);
filterStatus.addEventListener('change', renderOwners);
document.getElementById('close-modal').addEventListener('click', () => modal.classList.remove('mostrar'));
document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "login.html");
});
