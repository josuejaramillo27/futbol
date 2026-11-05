import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initLegalCompliance } from "./legal.js";
initLegalCompliance();

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

// MÓDULO 6: Auto-registro en jugadores_perfiles si el usuario inicia sesión con Google
onAuthStateChanged(auth, async (user) => {
    if (!user || !user.uid) return;
    try {
        const isGoogle = Array.isArray(user.providerData) && user.providerData.some(p => p.providerId === 'google.com');
        if (!isGoogle) return;
        const uSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (uSnap.exists() && ["owner", "admin"].includes(uSnap.data()?.rol)) return;
        const pRef = doc(db, "jugadores_perfiles", user.uid);
        const pSnap = await getDoc(pRef);
        if (!pSnap.exists()) {
            await setDoc(pRef, {
                uid: user.uid,
                nombre: user.displayName || "Jugador",
                email: user.email || "",
                foto: user.photoURL || "",
                posicion: "MED",
                ovr: 60,
                partidosJugados: 0,
                goles: 0,
                asistencias: 0,
                mvps: 0,
                vallasInvictas: 0,
                updatedAt: serverTimestamp()
            }, { merge: true });
        }
    } catch (e) {
        console.warn("Sincronización automática de jugador:", e);
    }
});

const inputEmail = document.getElementById('email');
const inputPassword = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnRegistrar = document.getElementById('btn-registrar');
const mensajeError = document.getElementById('mensaje-error');

const mostrarMensaje = (texto, esExito = false) => {
    mensajeError.textContent = texto;
    mensajeError.style.display = 'block';
    if (esExito) {
        mensajeError.style.backgroundColor = 'rgba(0, 217, 104, 0.1)';
        mensajeError.style.borderColor = 'rgba(0, 217, 104, 0.4)';
        mensajeError.style.color = '#71eaa3';
    } else {
        mensajeError.style.backgroundColor = 'rgba(255, 69, 69, 0.1)';
        mensajeError.style.borderColor = 'rgba(255, 69, 69, 0.25)';
        mensajeError.style.color = '#ff9c9c';
    }
};

// ==========================================
// 1. REGISTRO DE NUEVOS DUEÑOS (CON VALIDACIÓN Y LEY N° 29733)
// ==========================================
btnRegistrar.addEventListener('click', async () => {
    const email = inputEmail.value.trim();
    const password = inputPassword.value;
    
    const nombre = document.getElementById('reg-nombre').value.trim();
    const telefono = document.getElementById('reg-telefono').value.trim();
    const cancha = document.getElementById('reg-cancha').value.trim();
    
    const dpto = document.getElementById('reg-departamento').value;
    const dist = document.getElementById('reg-distrito').value;
    const ciudadCompleta = (dpto && dist) ? `${dist}, ${dpto}` : '';

    const evidencia = document.getElementById('reg-evidencia').value.trim();
    const ruc = document.getElementById('reg-ruc').value.trim();
    const chkTerminos = document.getElementById('reg-terminos');

    if (!email || !password || !nombre || !telefono || !cancha || !ciudadCompleta || !evidencia) {
        mostrarMensaje("Por favor, completa todos los campos obligatorios y selecciona la ubicación de tu cancha.");
        return;
    }

    if (!chkTerminos || !chkTerminos.checked) {
        mostrarMensaje("Debes aceptar los Términos de Uso y la Política de Privacidad de Datos (Ley N° 29733) para registrarte.");
        return;
    }

    if (password.length < 6) {
        mostrarMensaje("La contraseña debe tener al menos 6 caracteres.");
        return;
    }

    try {
        btnRegistrar.disabled = true;
        btnRegistrar.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Procesando...';

        const credenciales = await createUserWithEmailAndPassword(auth, email, password);
        const uid = credenciales.user.uid;

        await setDoc(doc(db, "usuarios", uid), {
            uid: uid,
            email: email,
            nombre: nombre,
            telefono: telefono,
            nombreCancha: cancha,
            departamento: dpto,
            distrito: dist,
            ciudad: ciudadCompleta,
            evidenciaLink: evidencia,
            ruc: ruc || "No especificado",
            rol: "owner",
            estado: "pending",
            terminosAceptados: true,
            createdAt: serverTimestamp()
        });

        await setDoc(doc(db, "solicitudes_duenos", uid), {
            uid: uid,
            nombreDueno: nombre,
            email: email,
            telefono: telefono,
            nombreCancha: cancha,
            departamento: dpto,
            distrito: dist,
            ciudad: ciudadCompleta,
            evidencia: evidencia,
            ruc: ruc || "No especificado",
            estado: "pendiente",
            terminosAceptados: true,
            fechaSolicitud: serverTimestamp()
        });

        const numeroAdmin = "51961341323"; 
        
        const textoWhatsapp = `Hola *CHALACAPP*! 👋⚽%0A` +
                              `Acabo de registrar mi complejo en la web y solicito la activación de mi panel:%0A%0A` +
                              `🏟️ *Cancha:* ${cancha}%0A` +
                              `📍 *Ubicación:* ${ciudadCompleta}%0A` +
                              `👤 *Dueño:* ${nombre}%0A` +
                              `📱 *WhatsApp:* ${telefono}%0A` +
                              `✉️ *Correo:* ${email}%0A` +
                              `🔗 *Evidencia:* ${evidencia}%0A` +
                              `📄 *RUC/DNI:* ${ruc || 'No especificado'}%0A%0A` +
                              `Quedo atento a la validación. ¡Gracias!`;

        const urlWhatsapp = `https://wa.me/${numeroAdmin}?text=${textoWhatsapp}`;

        await signOut(auth);
        
        mostrarMensaje("¡Registro exitoso! Redirigiendo a WhatsApp para activar tu cuenta...", true);
        btnRegistrar.innerHTML = '<i class="ph-bold ph-whatsapp-logo"></i> Abriendo WhatsApp...';

        setTimeout(() => {
            window.open(urlWhatsapp, '_blank');
            window.location.reload();
        }, 2000);

    } catch (error) {
        console.error(error);
        btnRegistrar.disabled = false;
        btnRegistrar.innerHTML = '<i class="ph-bold ph-paper-plane-tilt"></i> Enviar solicitud de registro';
        
        if (error.code === 'auth/email-already-in-use') {
            mostrarMensaje("Este correo ya está registrado. Intenta iniciar sesión.");
        } else {
            mostrarMensaje("Hubo un error al registrar. Inténtalo de nuevo.");
        }
    }
});

// ==========================================
// 2. INICIO DE SESIÓN (CON FILTRO DE SEGURIDAD)
// ==========================================
btnLogin.addEventListener('click', async () => {
    const email = inputEmail.value.trim();
    const password = inputPassword.value;

    if (!email || !password) {
        mostrarMensaje("Ingresa tu correo y contraseña.");
        return;
    }

    try {
        btnLogin.disabled = true;
        btnLogin.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Verificando...';

        const credenciales = await signInWithEmailAndPassword(auth, email, password);
        const uid = credenciales.user.uid;

        const userDoc = await getDoc(doc(db, "usuarios", uid));

        if (userDoc.exists()) {
            const data = userDoc.data();
            
            if (data.rol === "admin" && data.estado === "approved") {
                window.location.href = "admin-panel.html";
                return;
            }

            if (data.estado === "pending") {
                await signOut(auth);
                mostrarMensaje("⏳ Tu cuenta aún está en revisión. Te avisaremos por WhatsApp cuando sea aprobada.");
                btnLogin.disabled = false;
                btnLogin.innerHTML = '<i class="ph-bold ph-sign-in"></i> Entrar a mi panel';
                return;
            }
            
            if (data.estado === "rejected") {
                await signOut(auth);
                mostrarMensaje("❌ Tu solicitud de registro fue denegada por no cumplir los requisitos.");
                btnLogin.disabled = false;
                btnLogin.innerHTML = '<i class="ph-bold ph-sign-in"></i> Entrar a mi panel';
                return;
            }

            if (data.estado === "approved") {
                window.location.href = "admin.html";
            }
        } else {
            window.location.href = "admin.html";
        }

    } catch (error) {
        console.error(error);
        btnLogin.disabled = false;
        btnLogin.innerHTML = '<i class="ph-bold ph-sign-in"></i> Entrar a mi panel';
        mostrarMensaje("Correo o contraseña incorrectos.");
    }
});
