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
let canchasGlobales = [];

if (window.location.pathname.includes('index') || window.location.pathname === '/') {
    async function cargarCanchasAlgoritmo() {
        const contenedor = document.getElementById('lista-canchas');
        if (!contenedor) return;
        contenedor.innerHTML = '<div class="card" style="grid-column:1/-1; text-align:center; color:var(--text-muted);">Cargando canchas...</div>';

        try {
            const snapshot = await getDocs(collection(db, "canchas"));
            canchasGlobales = [];
            const ahora = new Date();
            const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.configurado) {
                    let isOpen = false;
                    if (data.horaApertura && data.horaCierre) {
                        const [hA, mA] = data.horaApertura.split(':').map(Number);
                        const [hC, mC] = data.horaCierre.split(':').map(Number);
                        const minA = hA * 60 + mA;
                        const minC = hC * 60 + mC;
                        isOpen = minC > minA
                            ? minutosActuales >= minA && minutosActuales <= minC
                            : minutosActuales >= minA || minutosActuales <= minC;
                    }
                    canchasGlobales.push({ id: docSnap.id, ...data, isOpen, rating: data.ratingPromedio || 0 });
                }
            });

            canchasGlobales.sort((a, b) => {
                if (a.isOpen === b.isOpen) return b.rating - a.rating;
                return a.isOpen ? -1 : 1;
            });

            contenedor.innerHTML = '';
            if (!canchasGlobales.length) {
                contenedor.innerHTML = '<div class="card" style="grid-column:1/-1; text-align:center;"><i class="ph ph-buildings" style="font-size:30px;color:var(--primary-green);"></i><h3 style="margin:8px 0 3px;">Próximamente</h3><p style="color:var(--text-muted);">Estamos incorporando nuevas canchas a la red.</p></div>';
                return;
            }

            canchasGlobales.forEach(c => {
                const estadoHtml = c.isOpen
                    ? '<span class="badge-estado badge-abierto"><i class="ph-fill ph-circle"></i> Abierto ahora</span>'
                    : '<span class="badge-estado badge-cerrado"><i class="ph-fill ph-circle"></i> Cerrado</span>';
                const logoSrc = c.logo || 'https://via.placeholder.com/100';
                const portadaSrc = (c.fotos && c.fotos.length > 0)
                    ? c.fotos[0]
                    : 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=1000&q=85';

                contenedor.innerHTML += `
                <article class="card" style="padding:0; overflow:hidden; display:flex; flex-direction:column;">
                    <div style="width:100%; aspect-ratio:1/1; background-image:url('${portadaSrc}'); background-size:cover; background-position:center; position:relative;">
                        <div style="position:absolute; top:12px; right:12px; z-index:10;">${estadoHtml}</div>
                    </div>
                    <div style="padding:20px; position:relative; background:var(--card-bg);">
                        <img src="${logoSrc}" alt="Logo de ${c.nombre}" loading="lazy" style="width:75px;height:75px;border-radius:50%;border:4px solid var(--bg-dark);object-fit:cover;position:absolute;top:-37px;left:20px;z-index:10;">
                        <h3 style="margin-top:35px;font-size:1.3rem;text-transform:uppercase;">${c.nombre}</h3>
                        <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:10px;"><i class="ph-bold ph-map-pin"></i> ${c.ubicacionTexto || 'Ubicación no especificada'}</p>
                        <p style="color:var(--primary-green);font-weight:800;font-size:1.1rem;">
                            <i class="ph-fill ph-star" style="color:var(--gold);"></i> ${c.rating > 0 ? c.rating.toFixed(1) : 'Nuevo'} <span style="color:var(--text-dim);">·</span> <i class="ph-bold ph-currency-circle-dollar"></i> S/ ${c.precio} / hr
                        </p>
                        <div class="btn-group" style="margin-top:15px;">
                            <button onclick="abrirModal('${c.id}')"><i class="ph-bold ph-calendar-plus"></i> Ver cancha y reservar</button>
                        </div>
                    </div>
                </article>`;
            });
        } catch (error) {
            console.error('Error cargando canchas:', error);
            contenedor.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;color:var(--text-muted);">No pudimos cargar las canchas. Intenta actualizar la página.</div>';
        }
    }
    cargarCanchasAlgoritmo();
}

window.abrirModal = function(idCancha) {
    const cancha = canchasGlobales.find(c => c.id === idCancha);
    if (!cancha) return;

    document.getElementById('modal-nombre').innerText = cancha.nombre;
    document.getElementById('modal-logo').src = cancha.logo || 'https://via.placeholder.com/100';
    document.getElementById('modal-imagen-principal').src = (cancha.fotos && cancha.fotos.length > 0)
        ? cancha.fotos[0]
        : 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=1000&q=85';
    document.getElementById('modal-precio').innerText = cancha.precio ?? 'Consultar';
    document.getElementById('modal-rating').innerText = cancha.rating > 0 ? cancha.rating.toFixed(1) : 'Nuevo';
    document.getElementById('modal-horario').innerText = `${cancha.horaApertura || '??:??'} a ${cancha.horaCierre || '??:??'}`;
    document.getElementById('modal-descripcion').innerText = cancha.descripcion || 'Sin descripción disponible.';
    document.getElementById('modal-link-maps').href = cancha.ubicacionLink || '#';

    const mensaje = `Hola ${cancha.nombre}, vengo de APP FUTBOL y quiero consultar disponibilidad para reservar.`;
    const telefono = String(cancha.whatsapp || '').replace(/\D/g, '');
    document.getElementById('btn-whatsapp-reserva').href = telefono
        ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
        : '#';
    document.getElementById('btn-ver-resenas').href = `cancha.html?id=${cancha.id}`;
    document.getElementById('modal-cancha').classList.add('mostrar');
    document.body.style.overflow = 'hidden';
};

const btnCerrar = document.getElementById('cerrar-modal');
const modalCancha = document.getElementById('modal-cancha');
if (btnCerrar) btnCerrar.addEventListener('click', cerrarModal);
if (modalCancha) modalCancha.addEventListener('click', e => { if (e.target === modalCancha) cerrarModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });
function cerrarModal() {
    if (!modalCancha) return;
    modalCancha.classList.remove('mostrar');
    document.body.style.overflow = '';
}

function formatearNombre(nombreCompleto) {
    if (!nombreCompleto) return 'Jugador';
    const partes = nombreCompleto.trim().split(/\s+/);
    return partes.length > 1 ? `${partes[0]} ${partes[1].charAt(0)}.` : partes[0];
}

if (window.location.pathname.includes('jugadores.html')) {
    const provider = new GoogleAuthProvider();
    const btnLogin = document.getElementById('btn-login-google');
    const formAnuncio = document.getElementById('form-anuncio');
    const listaJugadores = document.getElementById('lista-jugadores');
    let usuarioActual = null;

    const groserias = [
        'mierda','puta','puto','pendejo','pendeja','cabron','cabrón','carajo','joder','cojudo',
        'conchatumare','ctm','imbecil','imbécil','idiota','perra','estupido','estúpido','asco'
    ];
    function tieneGroserias(texto) {
        const textoMinusculas = texto.toLowerCase();
        return groserias.some(malaPalabra => textoMinusculas.includes(malaPalabra));
    }

    onAuthStateChanged(auth, user => {
        usuarioActual = user || null;
        if (btnLogin) btnLogin.style.display = user ? 'none' : 'flex';
        if (formAnuncio) formAnuncio.style.display = user ? 'flex' : 'none';
    });

    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            try { await signInWithPopup(auth, provider); }
            catch (error) { alert('No se pudo iniciar sesión: ' + error.message); }
        });
    }

    if (formAnuncio) {
        formAnuncio.addEventListener('submit', async e => {
            e.preventDefault();
            const textarea = document.getElementById('texto-anuncio');
            const texto = textarea.value.trim();
            if (!usuarioActual) return alert('Debes iniciar sesión con Google para publicar.');
            if (!texto) return;
            if (tieneGroserias(texto)) return alert('Lenguaje inapropiado detectado. Mantengamos el respeto en la comunidad.');
            try {
                await addDoc(collection(db, 'bolsa_jugadores'), {
                    nombre: formatearNombre(usuarioActual.displayName), texto, uid: usuarioActual.uid, fecha: serverTimestamp()
                });
                textarea.value = '';
            } catch (error) {
                console.error(error);
                alert('No se pudo publicar el anuncio. Intenta nuevamente.');
            }
        });
    }

    const q = query(collection(db, 'bolsa_jugadores'), orderBy('fecha', 'desc'));
    onSnapshot(q, snapshot => {
        if (!listaJugadores) return;
        listaJugadores.innerHTML = '';
        if (snapshot.empty) {
            listaJugadores.innerHTML = '<div class="card" style="text-align:center;color:var(--text-muted);"><i class="ph ph-users-three" style="font-size:30px;color:var(--primary-green);"></i><p style="margin-top:7px;">No hay anuncios todavía. Sé el primero.</p></div>';
            return;
        }
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            let botonEliminar = '';
            if (usuarioActual && data.uid === usuarioActual.uid) {
                botonEliminar = `<button class="btn btn-outline" style="width:auto;padding:6px 11px;font-size:.68rem;border-color:rgba(255,69,69,.35);color:var(--danger);" onclick="eliminarAnuncio('${docSnap.id}')"><i class="ph-bold ph-trash"></i> Borrar</button>`;
            }
            listaJugadores.innerHTML += `
                <article class="card" style="padding:17px 18px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
                        <strong style="color:var(--text-main);font-size:.86rem;display:flex;align-items:center;gap:8px;"><span class="brand-mark" style="width:30px;height:30px;border-radius:9px;font-size:14px;"><i class="ph-fill ph-user"></i></span>${data.nombre}</strong>
                        ${botonEliminar}
                    </div>
                    <p style="color:var(--text-main);font-size:.86rem;line-height:1.65;">${data.texto}</p>
                    <div style="margin-top:12px;color:var(--text-dim);font-size:.65rem;display:flex;align-items:center;gap:5px;"><i class="ph-bold ph-broadcast"></i> Publicación en tiempo real</div>
                </article>`;
        });
    });

    window.eliminarAnuncio = async function(idDoc) {
        if (confirm('¿Seguro que deseas eliminar tu anuncio?')) {
            try { await deleteDoc(doc(db, 'bolsa_jugadores', idDoc)); }
            catch (error) { console.error(error); alert('No se pudo eliminar el anuncio.'); }
        }
    };
}

if (window.location.pathname.includes('cancha.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const idCancha = urlParams.get('id');

    async function cargarCanchaInfo() {
        if (!idCancha) return;
        const docSnap = await getDoc(doc(db, 'canchas', idCancha));
        if (docSnap.exists()) {
            document.getElementById('cancha-nombre').innerText = docSnap.data().nombre;
            document.getElementById('cancha-precio').innerText = `S/ ${docSnap.data().precio} / hr`;
        }
    }
    cargarCanchaInfo();

    const estrellas = document.querySelectorAll('.estrellas-container i');
    const tagsDiv = document.getElementById('tags-dinamicos');
    const btnEnviar = document.getElementById('btn-enviar-resena');
    const tagsPositivos = ['Pasto excelente','Buen balón','Buena iluminación','Limpio','Buenos chalecos'];
    const tagsNegativos = ['Pasto gastado','Mala iluminación','Faltan chalecos','Mal trato'];

    estrellas.forEach(estrella => {
        estrella.addEventListener('click', e => {
            const estrellasSeleccionadas = parseInt(e.target.dataset.valor);
            estrellas.forEach(s => s.classList.remove('activa','ph-fill'));
            estrellas.forEach(s => s.classList.add('ph-light'));
            for (let i = 0; i < estrellasSeleccionadas; i++) {
                estrellas[i].classList.remove('ph-light');
                estrellas[i].classList.add('ph-fill','activa');
            }
            if (tagsDiv) {
                tagsDiv.innerHTML = '';
                const tagsAMostrar = estrellasSeleccionadas >= 4 ? tagsPositivos : tagsNegativos;
                tagsAMostrar.forEach(tag => {
                    const span = document.createElement('span');
                    span.className = 'tag-resena';
                    span.innerText = tag;
                    span.onclick = () => span.classList.toggle('seleccionado');
                    tagsDiv.appendChild(span);
                });
            }
            if (btnEnviar) btnEnviar.style.display = 'block';
        });
    });
}
