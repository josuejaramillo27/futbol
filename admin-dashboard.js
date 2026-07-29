// admin-dashboard.js

// 1. IMPORTAR FIREBASE (Versión Modular Web)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. TUS CLAVES DE FIREBASE (¡Pega aquí el mismo código que usaste en auth.js!)
const firebaseConfig = {
  apiKey: "AIzaSyDZnSndcRrzQquTa2ExKYcTgjyaFdJU_es",
  authDomain: "futbol-a74a2.firebaseapp.com",
  projectId: "futbol-a74a2",
  storageBucket: "futbol-a74a2.firebasestorage.app",
  messagingSenderId: "383262709861",
  appId: "1:383262709861:web:ebf392c929cf704f840e8c"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 3. REFERENCIAS AL HTML
const formPerfil = document.getElementById('form-perfil-cancha');
const inputNombre = document.getElementById('admin-nombre-cancha');
const inputPrecio = document.getElementById('admin-precio');
const inputServicios = document.getElementById('admin-servicios');
const mensajeExito = document.getElementById('mensaje-exito');
const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');

let usuarioActualId = null;

// 4. VERIFICAR SESIÓN Y CARGAR DATOS
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // El usuario está logueado
        usuarioActualId = user.uid;
        
        // Buscar los datos de su cancha en Firestore
        const docRef = doc(db, "canchas", usuarioActualId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const datos = docSnap.data();
            // Rellenar el formulario con los datos de la base de datos
            inputNombre.value = datos.nombre !== "Nombre de tu Cancha" ? datos.nombre : "";
            inputPrecio.value = datos.precio > 0 ? datos.precio : "";
            inputServicios.value = datos.servicios !== "Ninguno aún" ? datos.servicios : "";
            
            // Actualizar el título del Dashboard
            document.getElementById('nombre-cancha-admin').innerText = `${datos.nombre} Dashboard 📊`;
        }
    } else {
        // Si no hay usuario logueado, lo botamos al login por seguridad
        window.location.href = "login.html";
    }
});

// 5. GUARDAR CAMBIOS EN LA BASE DE DATOS
if (formPerfil) {
    formPerfil.addEventListener('submit', async (e) => {
        e.preventDefault(); // Evita que la página se recargue

        if (usuarioActualId) {
            const docRef = doc(db, "canchas", usuarioActualId);
            
            try {
                // Actualizar el documento en Firestore
                await updateDoc(docRef, {
                    nombre: inputNombre.value,
                    precio: Number(inputPrecio.value),
                    servicios: inputServicios.value,
                    configurado: true
                });

                // Mostrar mensaje de éxito temporal
                mensajeExito.style.display = "block";
                document.getElementById('nombre-cancha-admin').innerText = `${inputNombre.value} Dashboard 📊`;
                
                setTimeout(() => {
                    mensajeExito.style.display = "none";
                }, 3000);

            } catch (error) {
                console.error("Error al actualizar: ", error);
                alert("Hubo un error al guardar los cambios.");
            }
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
