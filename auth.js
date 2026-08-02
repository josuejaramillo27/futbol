import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const errorMessage = document.getElementById('auth-error-message');
const successMessage = document.getElementById('auth-success-message');

// Referencias de UI
const btnShowRegister = document.getElementById('btn-show-register');
const btnShowLogin = document.getElementById('btn-show-login');
const registerFields = document.getElementById('register-fields');
const loginActions = document.getElementById('login-actions');
const registerActions = document.getElementById('register-actions');
const formTitle = document.getElementById('form-title');
const formSubtitle = document.getElementById('form-subtitle');

// ==========================================
// FIX 1: Bloquear la tecla "Enter" para que no active botones por error
// ==========================================
document.getElementById('auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
});

if(btnShowRegister) {
    btnShowRegister.addEventListener('click', () => {
        registerFields.style.display = 'block';
        registerActions.style.display = 'flex';
        loginActions.style.display = 'none';
        formTitle.innerText = 'Solicitud de Registro';
        formSubtitle.innerText = 'Completa tus datos. Un administrador evaluará tu solicitud.';
        errorMessage.innerText = '';
    });
}

if(btnShowLogin) {
    btnShowLogin.addEventListener('click', () => {
        registerFields.style.display = 'none';
        registerActions.style.display = 'none';
        loginActions.style.display = 'flex';
        formTitle.innerText = 'Panel de Socios';
        formSubtitle.innerText = 'Gestiona tu cancha, automatiza tus reservas y aumenta tus ingresos.';
        errorMessage.innerText = '';
    });
}

// ==========================================
// LÓGICA DE REGISTRO 
// ==========================================
if(btnRegister) {
    btnRegister.addEventListener('click', async () => {
        errorMessage.innerText = '';
        const nombre = document.getElementById('reg-nombre').value.trim();
        const dni = document.getElementById('reg-dni').value.trim();
        const telefono = document.getElementById('reg-telefono').value.trim();
        const complejo = document.getElementById('reg-complejo').value.trim();
        const direccion = document.getElementById('reg-direccion').value.trim();
        const email = emailInput.value.trim();
        const pass = passwordInput.value.trim();

        if(!nombre || !dni || !telefono || !complejo || !direccion || !email || !pass) {
            errorMessage.innerText = 'Por favor, completa absolutamente todos los campos.';
            return;
        }

        btnRegister.disabled = true;
        btnRegister.innerHTML = '<i class="ph-bold ph-spinner-gap"></i> Enviando...';

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;
            
            await setDoc(doc(db, "usuarios", user.uid), {
                uid: user.uid,
                email: email,
                rol: "owner",
                estado: "pending",
                nombre: nombre,
                telefono: telefono,
                documento: dni,
                complejo: complejo,
                direccion: direccion,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            await setDoc(doc(db, "solicitudes_duenos", user.uid), {
                uid: user.uid,
                email: email,
                nombre: nombre,
                telefono: telefono,
                documento: dni,
                complejo: complejo,
                direccion: direccion,
                estado: "pending",
                createdAt: serverTimestamp()
            });

            successMessage.innerText = "¡Solicitud enviada! Abriendo WhatsApp...";
            successMessage.style.display = "block";
            
            // ==========================================
            // FIX 2: Alerta por WhatsApp segura contra bloqueos
            // ==========================================
            const tuNumeroWhatsApp = "51953066853"; // <-- CAMBIA ESTO POR TU NÚMERO
            const mensajeWhatsApp = `Hola CHALACAPP ⚽, acabo de enviar una solicitud en la web para registrar mi complejo "${complejo}". Mi nombre es ${nombre} y mi DNI es ${dni}. Quedo a la espera de la aprobación.`;
            
            // Forzamos la redirección en la misma ventana para evitar pop-up blockers
            window.location.href = `https://wa.me/${tuNumeroWhatsApp}?text=${encodeURIComponent(mensajeWhatsApp)}`;
            
            document.getElementById('auth-form').reset();
            auth.signOut(); 

        } catch (error) {
            console.error(error);
            errorMessage.innerText = "Error: " + (error.code === 'auth/email-already-in-use' ? 'El correo ya está registrado.' : error.message);
        } finally {
            btnRegister.disabled = false;
            btnRegister.innerHTML = 'Enviar Solicitud';
        }
    });
}

// ==========================================
// LÓGICA DE INICIO DE SESIÓN 
// ==========================================
if(btnLogin) {
    btnLogin.addEventListener('click', async () => {
        errorMessage.innerText = '';
        
        // FIX 3: Validar que no manden campos vacíos
        const email = emailInput.value.trim();
        const pass = passwordInput.value.trim();
        
        if(!email || !pass) {
            errorMessage.innerText = 'Por favor, ingresa tu correo y contraseña.';
            return;
        }

        btnLogin.disabled = true;
        btnLogin.innerHTML = '<i class="ph-bold ph-spinner-gap"></i> Conectando...';

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;
            
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                if (userData.rol === "admin" && userData.estado === "approved") {
                    window.location.href = "admin-panel.html";
                    return;
                }

                if (userData.estado === "pending") {
                    errorMessage.innerText = "Tu solicitud aún está pendiente de aprobación por un administrador.";
                    auth.signOut();
                } else if (userData.estado === "rejected") {
                    errorMessage.innerText = "Tu solicitud ha sido rechazada.";
                    auth.signOut();
                } else if (userData.estado === "approved") {
                    window.location.href = "admin.html";
                }
            } else {
                const canchaDoc = await getDoc(doc(db, "canchas", user.uid));
                if(canchaDoc.exists()) {
                    await setDoc(doc(db, "usuarios", user.uid), {
                        uid: user.uid,
                        email: user.email,
                        rol: "owner",
                        estado: "approved",
                        nombre: canchaDoc.data().nombre || "Dueño Antiguo",
                        migrado: true,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    window.location.href = "admin.html";
                } else {
                    errorMessage.innerText = "Cuenta no encontrada en la base de datos.";
                    auth.signOut();
                }
            }
        } catch (error) {
            console.error(error);
            errorMessage.innerText = "Credenciales incorrectas o correo inválido.";
        } finally {
            btnLogin.disabled = false;
            btnLogin.innerHTML = 'Iniciar Sesión';
        }
    });
}
