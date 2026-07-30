import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",
  authDomain: "app-futbol-acd0f.firebaseapp.com",
  projectId: "app-futbol-acd0f",
  storageBucket: "app-futbol-acd0f.firebasestorage.app",
  messagingSenderId: "223446110165",
  appId: "1:223446110165:web:219afce6a9dac03203f75c"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let canchasGlobales = []; // Guardamos las canchas en memoria para la Modal

if (window.location.pathname.includes('index') || window.location.pathname === '/') {
    
    async function cargarCanchasAlgoritmo() {
        const contenedor = document.getElementById('lista-canchas');
        if(!contenedor) return;
        contenedor.innerHTML = '<p>Cargando canchas premium...</p>';

        const snapshot = await getDocs(collection(db, "canchas"));
        canchasGlobales = [];
        
        const ahora = new Date();
        const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();

        snapshot.forEach(doc => {
            const data = doc.data();
            if(data.configurado) {
                let isOpen = false;
                if(data.horaApertura && data.horaCierre) {
                    const [hA, mA] = data.horaApertura.split(':').map(Number);
                    const [hC, mC] = data.horaCierre.split(':').map(Number);
                    const minA = (hA * 60) + mA;
                    const minC = (hC * 60) + mC;
                    if (minC > minA) isOpen = minutosActuales >= minA && minutosActuales <= minC;
                    else isOpen = minutosActuales >= minA || minutosActuales <= minC;
                }
                canchasGlobales.push({ id: doc.id, ...data, isOpen, rating: data.ratingPromedio || 0 });
            }
        });

        canchasGlobales.sort((a, b) => {
            if (a.isOpen === b.isOpen) return b.rating - a.rating;
            return a.isOpen ? -1 : 1;
        });

        contenedor.innerHTML = '';
        canchasGlobales.forEach(c => {
            const estadoHtml = c.isOpen ? '<span class="badge-estado badge-abierto">🟢 Abierto Ahora</span>' : '<span class="badge-estado badge-cerrado">🔴 Cerrado</span>';
            const logoSrc = c.logo || 'https://via.placeholder.com/50';
            const portadaSrc = (c.fotos && c.fotos.length > 0) ? c.fotos[0] : 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=800&q=80'; // Foto 1 o Default
            
            contenedor.innerHTML += `
            <div class="card" style="padding:0; overflow:hidden; display:flex; flex-direction:column;">
                <div style="width: 100%; aspect-ratio: 1 / 1; background-image: url('${portadaSrc}'); background-size: cover; background-position: center; position: relative;">
                    <div style="position: absolute; top: 10px; right: 10px; z-index: 10;">${estadoHtml}</div>
                </div>
                
                <div style="padding: 20px; position: relative; background: var(--card-bg);">
                    
                    <img src="${logoSrc}" style="width: 75px; height: 75px; border-radius: 50%; border: 4px solid var(--bg-dark); object-fit: cover; position: absolute; top: -37px; left: 20px; z-index: 10;">
                    
                    <h3 style="margin-top: 35px; font-size: 1.3rem; text-transform: uppercase;">${c.nombre}</h3>
                    
                    <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 10px;">
                        <i class="ph ph-map-pin"></i> ${c.ubicacionTexto || 'Ubicación no especificada'}
                    </p>
                    
                    <p style="color: var(--primary-green); font-weight: 800; font-size: 1.1rem;">
                        ⭐ ${c.rating > 0 ? c.rating.toFixed(1) : 'Nuevo'} | 💰 S/ ${c.precio} / hr
                    </p>
                    
                    <div class="btn-group" style="margin-top: 15px;">
                        <button onclick="abrirModal('${c.id}')">
                            <i class="ph-bold ph-calendar-plus"></i> Ver Info y Reservar
                        </button>
                    </div>
                </div>
            </div>
        `;
        });
    }
    cargarCanchasAlgoritmo();
}

// === LÓGICA DE LA VENTANA MODAL ===
window.abrirModal = function(idCancha) {
    const cancha = canchasGlobales.find(c => c.id === idCancha);
    if(!cancha) return;

    // Llenar datos de la Modal
    document.getElementById('modal-nombre').innerText = cancha.nombre;
    document.getElementById('modal-logo').src = cancha.logo || 'https://via.placeholder.com/60';
    document.getElementById('modal-imagen-principal').src = (cancha.fotos && cancha.fotos.length > 0) ? cancha.fotos[0] : 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=800&q=80';
    document.getElementById('modal-precio').innerText = cancha.precio;
    document.getElementById('modal-rating').innerText = cancha.rating > 0 ? cancha.rating.toFixed(1) : 'Nuevo';
    document.getElementById('modal-horario').innerText = `${cancha.horaApertura || '??:??'} a ${cancha.horaCierre || '??:??'}`;
    document.getElementById('modal-descripcion').innerText = cancha.descripcion || 'Sin descripción disponible.';
    
    // Links dinámicos
    document.getElementById('modal-link-maps').href = cancha.ubicacionLink || '#';
    
    // WhatsApp con mensaje predeterminado
    const mensaje = `Hola ${cancha.nombre}, vengo de APP FUTBOL y quiero consultar disponibilidad para reservar.`;
    document.getElementById('btn-whatsapp-reserva').href = `https://wa.me/${cancha.whatsapp}?text=${encodeURIComponent(mensaje)}`;
    
    // El botón de reseñas enviará a la página anterior de reseñas
    document.getElementById('btn-ver-resenas').href = `cancha.html?id=${cancha.id}`;

    // Mostrar Modal
    document.getElementById('modal-cancha').classList.add('mostrar');
};

// Cerrar Modal
const btnCerrar = document.getElementById('cerrar-modal');
if(btnCerrar) {
    btnCerrar.addEventListener('click', () => {
        document.getElementById('modal-cancha').classList.remove('mostrar');
    });
}
// ==========================================
// LÓGICA DE PRIVACIDAD: NOMBRES (Ej: Carlos J.)
// ==========================================
function formatearNombre(nombreCompleto) {
    if (!nombreCompleto) return "Jugador";
    const partes = nombreCompleto.split(" ");
    if (partes.length > 1) {
        return `${partes[0]} ${partes[1].charAt(0)}.`; // Retorna "Carlos J."
    }
    return partes[0];
}

// ==========================================
// LÓGICA DE LA BOLSA DE JUGADORES
// ==========================================
if (window.location.pathname.includes('jugadores.html')) {
    const provider = new GoogleAuthProvider();
    const btnLogin = document.getElementById('btn-login-google');
    const formAnuncio = document.getElementById('form-anuncio');
    const listaJugadores = document.getElementById('lista-jugadores');
    let usuarioActual = null;

    // 1. DICCIONARIO DE GROSERÍAS (Filtro de moderación)
    const groserias = [
        "mierda", "puta", "puto", "pendejo", "pendeja", "cabron", "cabrón", 
        "carajo", "joder", "cojudo", "conchatumare", "ctm", "imbecil", "imbécil", 
        "idiota", "perra", "estupido", "estúpido", "asco"
    ];

    function tieneGroserias(texto) {
        const textoMinusculas = texto.toLowerCase();
        // Verifica si alguna palabra prohibida está dentro del texto del jugador
        return groserias.some(malaPalabra => textoMinusculas.includes(malaPalabra));
    }

    // 2. DETECTAR SESIÓN
    onAuthStateChanged(auth, (user) => {
        if (user) {
            usuarioActual = user;
            if(btnLogin) btnLogin.style.display = 'none';
            if(formAnuncio) formAnuncio.style.display = 'flex'; 
        } else {
            usuarioActual = null;
            if(btnLogin) btnLogin.style.display = 'flex';
            if(formAnuncio) formAnuncio.style.display = 'none'; 
        }
    });

    // 3. LOGIN CON GOOGLE
    if(btnLogin) {
        btnLogin.addEventListener('click', async () => {
            try { await signInWithPopup(auth, provider); } 
            catch (error) { alert("Error al iniciar sesión: " + error.message); }
        });
    }

    // 4. PUBLICAR ANUNCIO (Con validaciones de seguridad)
    if(formAnuncio) {
        formAnuncio.addEventListener('submit', async (e) => {
            e.preventDefault();
            const texto = document.getElementById('texto-anuncio').value;
            
            // Bloqueo estricto por si logran ver el formulario sin sesión
            if (!usuarioActual) {
                alert("🔒 Error: Debes iniciar sesión con Google para publicar.");
                return;
            }

            if (texto.trim() === "") return;

            // Bloqueo de Groserías
            if (tieneGroserias(texto)) {
                alert("⚠️ Lenguaje inapropiado detectado. Por favor, mantén el respeto en la comunidad.");
                return;
            }

            // Si todo está bien, se guarda en la base de datos
            await addDoc(collection(db, "bolsa_jugadores"), {
                nombre: formatearNombre(usuarioActual.displayName),
                texto: texto,
                uid: usuarioActual.uid, 
                fecha: serverTimestamp()
            });
            document.getElementById('texto-anuncio').value = "";
        });
    }

    // 5. LEER ANUNCIOS EN TIEMPO REAL
    const q = query(collection(db, "bolsa_jugadores"), orderBy("fecha", "desc"));
    onSnapshot(q, (snapshot) => {
        if(!listaJugadores) return;
        listaJugadores.innerHTML = '';
        if (snapshot.empty) listaJugadores.innerHTML = '<p style="text-align:center; color: var(--text-muted);">No hay anuncios hoy. ¡Sé el primero!</p>';
        
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            
            // Botón de eliminar SOLO si el anuncio es mío
            // ARREGLO VISUAL: Se agregó 'width: auto' para que no sea gigante
            let botonEliminar = "";
            if (usuarioActual && data.uid === usuarioActual.uid) {
                botonEliminar = `<button class="btn btn-outline" style="width: auto; padding: 6px 15px; font-size: 0.8rem; border-color: var(--danger); color: var(--danger);" onclick="eliminarAnuncio('${docSnap.id}')"><i class="ph-bold ph-trash"></i> Borrar</button>`;
            }

            listaJugadores.innerHTML += `
                <div class="card" style="padding: 15px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                        <strong style="color: var(--primary-green); font-size: 1.1rem; display:flex; align-items:center; gap:5px;"><i class="ph-fill ph-user-circle"></i> ${data.nombre}</strong>
                        ${botonEliminar}
                    </div>
                    <p style="color: var(--text-main); font-size: 0.95rem; line-height: 1.5;">${data.texto}</p>
                </div>
            `;
        });
    });

    // 6. FUNCIÓN PARA BORRAR
    window.eliminarAnuncio = async function(idDoc) {
        if(confirm("¿Seguro que deseas eliminar tu anuncio?")) {
            await deleteDoc(doc(db, "bolsa_jugadores", idDoc));
        }
    };
}

// ==========================================
// REPARACIÓN DE LA PÁGINA DE RESEÑAS
// ==========================================
if (window.location.pathname.includes('cancha.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const idCancha = urlParams.get('id');

    // Descargar datos de la cancha para el título
    async function cargarCanchaInfo() {
        if(!idCancha) return;
        const docSnap = await getDoc(doc(db, "canchas", idCancha));
        if (docSnap.exists()) {
            document.getElementById('cancha-nombre').innerText = docSnap.data().nombre;
            document.getElementById('cancha-precio').innerText = `💰 S/ ${docSnap.data().precio} / hr`;
        }
    }
    cargarCanchaInfo();

    // Lógica dinámica de estrellas y botones estilo InDrive
    const estrellas = document.querySelectorAll('.estrellas-container i');
    const tagsDiv = document.getElementById('tags-dinamicos');
    const btnEnviar = document.getElementById('btn-enviar-resena');
    
    const tagsPositivos = ["Pasto excelente", "Buen balón", "Buena iluminación", "Limpio", "Buenos chalecos"];
    const tagsNegativos = ["Pasto gastado", "Mala iluminación", "Faltan chalecos", "Mal trato"];

    estrellas.forEach(estrella => {
        estrella.addEventListener('click', (e) => {
            const estrellasSeleccionadas = parseInt(e.target.dataset.valor);
            
            // Pintar estrellas seleccionadas de color dorado
            estrellas.forEach(s => s.classList.remove('activa', 'ph-fill'));
            estrellas.forEach(s => s.classList.add('ph-light'));
            for(let i=0; i < estrellasSeleccionadas; i++) {
                estrellas[i].classList.remove('ph-light');
                estrellas[i].classList.add('ph-fill', 'activa');
                estrellas[i].style.color = '#FFD700';
            }

            // Inyectar opciones de tags
            tagsDiv.innerHTML = '';
            const tagsAMostrar = estrellasSeleccionadas >= 4 ? tagsPositivos : tagsNegativos;
            
            tagsAMostrar.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag-resena';
                span.innerText = tag;
                span.onclick = () => span.classList.toggle('seleccionado');
                tagsDiv.appendChild(span);
            });

            // Mostrar el botón de enviar
            btnEnviar.style.display = 'block';
        });
    });
}
