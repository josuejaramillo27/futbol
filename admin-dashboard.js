import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// NUEVO: Importamos Storage
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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
const storage = getStorage(app); // Inicializamos Storage

let usuarioActualId = null;

// Cargar datos al entrar...
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioActualId = user.uid;
        const docSnap = await getDoc(doc(db, "canchas", usuarioActualId));
        if (docSnap.exists()) {
            const d = docSnap.data();
            document.getElementById('admin-nombre').value = d.nombre || "";
            document.getElementById('admin-whatsapp').value = d.whatsapp || "";
            document.getElementById('admin-descripcion').value = d.descripcion || "";
            document.getElementById('admin-precio').value = d.precio || "";
            document.getElementById('admin-ubicacion-texto').value = d.ubicacionTexto || "";
            document.getElementById('admin-ubicacion-link').value = d.ubicacionLink || "";
            document.getElementById('admin-apertura').value = d.horaApertura || "";
            document.getElementById('admin-cierre').value = d.horaCierre || "";
        }
    } else {
        window.location.href = "login.html";
    }
});

// Función auxiliar para subir imagen
async function subirImagen(archivo, ruta) {
    if (!archivo) return null;
    const storageRef = ref(storage, ruta);
    await uploadBytes(storageRef, archivo);
    return await getDownloadURL(storageRef);
}

// Guardar todo
document.getElementById('form-perfil-cancha').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!usuarioActualId) return;

    const btnGuardar = document.getElementById('btn-guardar-admin');
    btnGuardar.innerText = "Subiendo archivos, espera... ⏳";
    btnGuardar.disabled = true;

    try {
        // 1. Obtener archivos
        const logoFile = document.getElementById('admin-logo').files[0];
        const f1 = document.getElementById('admin-foto1').files[0];
        const f2 = document.getElementById('admin-foto2').files[0];
        const f3 = document.getElementById('admin-foto3').files[0];

        // 2. Traer datos anteriores por si no sube foto nueva para no borrarlas
        const docActual = await getDoc(doc(db, "canchas", usuarioActualId));
        let datosActuales = docActual.exists() ? docActual.data() : {};
        let fotosActuales = datosActuales.fotos || [];

        // 3. Subir nuevas fotos (si existen)
        const logoUrl = await subirImagen(logoFile, `canchas/${usuarioActualId}/logo`) || datosActuales.logo;
        const url1 = await subirImagen(f1, `canchas/${usuarioActualId}/foto1`) || fotosActuales[0];
        const url2 = await subirImagen(f2, `canchas/${usuarioActualId}/foto2`) || fotosActuales[1];
        const url3 = await subirImagen(f3, `canchas/${usuarioActualId}/foto3`) || fotosActuales[2];

        const fotosArray = [url1, url2, url3].filter(url => url != null);

        // 4. Guardar en BD
        await updateDoc(doc(db, "canchas", usuarioActualId), {
            nombre: document.getElementById('admin-nombre').value,
            whatsapp: document.getElementById('admin-whatsapp').value,
            descripcion: document.getElementById('admin-descripcion').value,
            precio: Number(document.getElementById('admin-precio').value),
            ubicacionTexto: document.getElementById('admin-ubicacion-texto').value,
            ubicacionLink: document.getElementById('admin-ubicacion-link').value,
            horaApertura: document.getElementById('admin-apertura').value,
            horaCierre: document.getElementById('admin-cierre').value,
            logo: logoUrl || "",
            fotos: fotosArray,
            configurado: true
        });

        document.getElementById('mensaje-exito').style.display = "block";
    } catch (error) {
        console.error(error);
        alert("Error al subir los datos.");
    } finally {
        btnGuardar.innerText = "Guardar y Publicar Configuración";
        btnGuardar.disabled = false;
    }
});
