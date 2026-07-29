// auth.js
// 1. IMPORTAR FIREBASE (Versión Modular Web)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. TUS CLAVES DE FIREBASE (¡Pega aquí el código que guardaste!)
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
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const errorMessage = document.getElementById('auth-error-message');

// 4. FUNCIÓN: CREAR CUENTA DE DUEÑO
if(btnRegister) {
    btnRegister.addEventListener('click', async () => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
            const user = userCredential.user;
            
            // Al crear la cuenta, creamos su espacio vacío en la base de datos
            await setDoc(doc(db, "canchas", user.uid), {
                nombre: "Nombre de tu Cancha",
                precio: 0,
                servicios: "Ninguno aún",
                configurado: false
            });

            alert("¡Cuenta creada exitosamente! Bienvenido a APP FUTBOL.");
            window.location.href = "admin.html"; // Redirigir al panel
        } catch (error) {
            errorMessage.innerText = "Error: " + error.message;
        }
    });
}

// 5. FUNCIÓN: INICIAR SESIÓN
if(btnLogin) {
    btnLogin.addEventListener('click', async () => {
        try {
            await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
            window.location.href = "admin.html"; // Redirigir al panel
        } catch (error) {
            errorMessage.innerText = "Credenciales incorrectas.";
        }
    });
}
