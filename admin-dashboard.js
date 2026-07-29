// admin-dashboard.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDZnSndcRrzQquTa2ExKYcTgjyaFdJU_es",
  authDomain: "futbol-a74a2.firebaseapp.com",
  projectId: "futbol-a74a2",
  storageBucket: "futbol-a74a2.firebasestorage.app",
  messagingSenderId: "383262709861",
  appId: "1:383262709861:web:ebf392c929cf704f840e8c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const formPerfil = document.getElementById('form-perfil-cancha');
let usuarioActualId = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioActualId = user.uid;
        const docRef = doc(db, "canchas", usuarioActualId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const d = docSnap.data();
            document.getElementById('admin-nombre').value = d.nombre || "";
            document.getElementById('admin-logo').value = d.logo || "";
            document.getElementById('admin-descripcion').value = d.descripcion || "";
            document.getElementById('admin-precio').value = d.precio || "";
            document.getElementById('admin-ubicacion-texto').value = d.ubicacionTexto || "";
            document.getElementById('admin-ubicacion-link').value = d.ubicacionLink || "";
            document.getElementById('admin-apertura').value = d.horaApertura || "";
            document.getElementById('admin-cierre').value = d.horaCierre || "";
            if(d.fotos) {
                document.getElementById('admin-foto1').value = d.fotos[0] || "";
                document.getElementById('admin-foto2').value = d.fotos[1] || "";
                document.getElementById('admin-foto3').value = d.fotos[2] || "";
            }
        }
    } else {
        window.location.href = "login.html";
    }
});

if (formPerfil) {
    formPerfil.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (usuarioActualId) {
            const fotosArray = [
                document.getElementById('admin-foto1').value,
                document.getElementById('admin-foto2').value,
                document.getElementById('admin-foto3').value
            ].filter(url => url !== ""); // Elimina las vacías

            await updateDoc(doc(db, "canchas", usuarioActualId), {
                nombre: document.getElementById('admin-nombre').value,
                logo: document.getElementById('admin-logo').value,
                descripcion: document.getElementById('admin-descripcion').value,
                precio: Number(document.getElementById('admin-precio').value),
                ubicacionTexto: document.getElementById('admin-ubicacion-texto').value,
                ubicacionLink: document.getElementById('admin-ubicacion-link').value,
                horaApertura: document.getElementById('admin-apertura').value,
                horaCierre: document.getElementById('admin-cierre').value,
                fotos: fotosArray,
                configurado: true
            });
            alert("¡Actualizado con éxito!");
        }
    });
}

// 6. CERRAR SESIÓN
if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = "login.html";
        }).catch((error) => {
            console.error("Error al cerrar sesión", error);
        });
    });
}
