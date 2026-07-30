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

function normalizar(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function obtenerCiudad(cancha) {
    return cancha.ciudad || cancha.provincia || cancha.departamento || '';
}

function obtenerTipo(cancha) {
    return cancha.tipoCancha || cancha.tipo || cancha.modalidad || '';
}

function precioNumero(cancha) {
    const precio = Number(String(cancha.precio ?? '').replace(',', '.').replace(/[^0-9.]/g, ''));
    return Number.isFinite(precio) ? precio : 0;
}

function canchaEstaAbierta(cancha) {
    if (!cancha.horaApertura || !cancha.horaCierre) return false;
    const ahora = new Date();
    const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();
    const [hA, mA] = cancha.horaApertura.split(':').map(Number);
    const [hC, mC] = cancha.horaCierre.split(':').map(Number);
    if (![hA, mA, hC, mC].every(Number.isFinite)) return false;
    const minA = hA * 60 + mA;
    const minC = hC * 60 + mC;
    return minC > minA
        ? minutosActuales >= minA && minutosActuales <= minC
        : minutosActuales >= minA || minutosActuales <= minC;
}

if (window.location.pathname.includes('index') || window.location.pathname === '/') {
    const contenedor = document.getElementById('lista-canchas');
    const inputBusqueda = document.getElementById('filtro-busqueda');
    const filtroCiudad = document.getElementById('filtro-ciudad');
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroPrecio = document.getElementById('filtro-precio');
    const filtroOrden = document.getElementById('filtro-orden');
    const contador = document.getElementById('contador-canchas');
    const filtroActivo = document.getElementById('filtro-activo');
    let soloAbiertas = false;
    let soloCerca = false;
    let soloTop = false;

    function llenarSelect(select, valores, placeholder) {
        if (!select) return;
        const actual = select.value;
        select.innerHTML = `<option value="">${placeholder}</option>`;
        [...new Set(valores.map(v => String(v).trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'es'))
            .forEach(valor => {
                const option = document.createElement('option');
                option.value = valor;
                option.textContent = valor;
                select.appendChild(option);
            });
        if ([...select.options].some(option => option.value === actual)) select.value = actual;
    }

    function distanciaCerca(cancha) {
        return Number(cancha.distanciaKm ?? cancha.distancia ?? 999999);
    }

    function renderizarCanchas() {
        if (!contenedor) return;
        const texto = normalizar(inputBusqueda?.value);
        const ciudad = normalizar(filtroCiudad?.value);
        const tipo = normalizar(filtroTipo?.value);
        const rango = filtroPrecio?.value || '';
        const orden = filtroOrden?.value || 'recomendadas';

        let resultados = canchasGlobales.filter(c => {
            const buscable = normalizar(`${c.nombre} ${c.ubicacionTexto || ''} ${obtenerCiudad(c)} ${obtenerTipo(c)}`);
            const coincideTexto = !texto || buscable.includes(texto);
            const coincideCiudad = !ciudad || normalizar(obtenerCiudad(c)) === ciudad;
            const coincideTipo = !tipo || normalizar(obtenerTipo(c)) === tipo;
            const precio = precioNumero(c);
            let coincidePrecio = true;
            if (rango) {
                const [min, max] = rango.split('-').map(Number);
                coincidePrecio = precio >= min && precio <= max;
            }
            const coincideAbierto = !soloAbiertas || c.isOpen;
            const coincideTop = !soloTop || c.rating >= 4.5;
            const coincideCerca = !soloCerca || distanciaCerca(c) <= 10;
            return coincideTexto && coincideCiudad && coincideTipo && coincidePrecio && coincideAbierto && coincideTop && coincideCerca;
        });

        resultados.sort((a, b) => {
            if (orden === 'rating') return b.rating - a.rating;
            if (orden === 'precio-asc') return precioNumero(a) - precioNumero(b);
            if (orden === 'precio-desc') return precioNumero(b) - precioNumero(a);
            if (orden === 'cerca') return distanciaCerca(a) - distanciaCerca(b);
            if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
            return b.rating - a.rating;
        });

        if (contador) contador.textContent = `${resultados.length} ${resultados.length === 1 ? 'cancha encontrada' : 'canchas encontradas'}`;
        if (filtroActivo) {
            const activos = [];
            if (ciudad) activos.push(filtroCiudad.value);
            if (tipo) activos.push(filtroTipo.value);
            if (rango) activos.push(filtroPrecio.options[filtroPrecio.selectedIndex].text);
            if (soloAbiertas) activos.push('Abiertas ahora');
            if (soloTop) activos.push('4.5+ estrellas');
            if (soloCerca) activos.push('Cerca de mí');
            filtroActivo.textContent = activos.length ? activos.join(' · ') : '';
        }

        contenedor.innerHTML = '';
        if (!resultados.length) {
            contenedor.innerHTML = `<div class="card empty-results" style="grid-column:1/-1;text-align:center;"><i class="ph ph-magnifying-glass" style="font-size:34px;color:var(--primary-green);"></i><h3>No encontramos esa cancha</h3><p>Prueba quitando algún filtro o buscando otra zona.</p><button type="button" class="btn btn-outline" style="width:auto;margin:15px auto 0;" id="btn-reset-empty">Limpiar filtros</button></div>`;
            document.getElementById('btn-reset-empty')?.addEventListener('click', limpiarFiltros);
            return;
        }

        resultados.forEach(c => {
            const estadoHtml = c.isOpen
                ? '<span class="badge-estado badge-abierto"><i class="ph-fill ph-circle"></i> Abierto ahora</span>'
                : '<span class="badge-estado badge-cerrado"><i class="ph-fill ph-circle"></i> Cerrado</span>';
            const logoSrc = c.logo || 'https://via.placeholder.com/100';
            const portadaSrc = c.fotos?.length ? c.fotos[0] : 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=1000&q=85';
            const ciudadTexto = obtenerCiudad(c);
            const tipoTexto = obtenerTipo(c);
            const distancia = Number.isFinite(distanciaCerca(c)) && distanciaCerca(c) < 999999 ? ` · ${distanciaCerca(c).toFixed(1)} km` : '';
            contenedor.innerHTML += `
                <article class="card court-card">
                    <div class="court-cover" style="background-image:url('${portadaSrc}')">
                        <div class="court-status">${estadoHtml}</div>
                        <div class="court-cover-gradient"></div>
                    </div>
                    <div class="court-body">
                        <img src="${logoSrc}" alt="Logo de ${c.nombre || 'cancha'}" loading="lazy" class="court-logo">
                        <div class="court-content">
                            <div class="court-title-line"><h3>${c.nombre || 'Cancha sin nombre'}</h3><span class="court-rating"><i class="ph-fill ph-star"></i> ${c.rating > 0 ? c.rating.toFixed(1) : 'Nuevo'}</span></div>
                            <p class="court-location"><i class="ph-bold ph-map-pin"></i> ${c.ubicacionTexto || 'Ubicación no especificada'}${ciudadTexto ? ` · ${ciudadTexto}` : ''}${distancia}</p>
                            <div class="court-meta"><span><i class="ph-bold ph-soccer-ball"></i> ${tipoTexto || 'Fútbol'}</span><strong>S/ ${c.precio ?? 'Consultar'} <small>/ hr</small></strong></div>
                            <button class="court-action" data-court-id="${c.id}"><span>Ver cancha y reservar</span><i class="ph-bold ph-arrow-right"></i></button>
                        </div>
                    </div>
                </article>`;
        });

        contenedor.querySelectorAll('[data-court-id]').forEach(btn => btn.addEventListener('click', () => abrirModal(btn.dataset.courtId)));
    }

    function limpiarFiltros() {
        if (inputBusqueda) inputBusqueda.value = '';
        if (filtroCiudad) filtroCiudad.value = '';
        if (filtroTipo) filtroTipo.value = '';
        if (filtroPrecio) filtroPrecio.value = '';
        if (filtroOrden) filtroOrden.value = 'recomendadas';
        soloAbiertas = false; soloCerca = false; soloTop = false;
        document.querySelectorAll('.quick-filter').forEach(btn => btn.classList.remove('active'));
        renderizarCanchas();
    }

    async function cargarCanchasAlgoritmo() {
        if (!contenedor) return;
        contenedor.innerHTML = '<div class="card loading-card" style="grid-column:1/-1;text-align:center;color:var(--text-muted);"><i class="ph-bold ph-spinner-gap"></i> Buscando canchas...</div>';
        try {
            const snapshot = await getDocs(collection(db, 'canchas'));
            canchasGlobales = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.configurado) {
                    canchasGlobales.push({ id: docSnap.id, ...data, isOpen: canchaEstaAbierta(data), rating: Number(data.ratingPromedio || 0) });
                }
            });
            llenarSelect(filtroCiudad, canchasGlobales.map(obtenerCiudad), 'Todas las ciudades');
            llenarSelect(filtroTipo, canchasGlobales.map(obtenerTipo), 'Todos los tipos');
            renderizarCanchas();
        } catch (error) {
            console.error('Error cargando canchas:', error);
            contenedor.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;color:var(--text-muted);">No pudimos cargar las canchas. Intenta actualizar la página.</div>';
        }
    }

    [inputBusqueda, filtroCiudad, filtroTipo, filtroPrecio, filtroOrden].forEach(elemento => elemento?.addEventListener('input', renderizarCanchas));
    document.querySelectorAll('.quick-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            const filtro = btn.dataset.filter;
            if (filtro === 'limpiar') return limpiarFiltros();
            if (filtro === 'abiertas') soloAbiertas = !soloAbiertas;
            if (filtro === 'cerca') soloCerca = !soloCerca;
            if (filtro === 'top') soloTop = !soloTop;
            btn.classList.toggle('active');
            renderizarCanchas();
        });
    });
    cargarCanchasAlgoritmo();
}

window.abrirModal = function(idCancha) {
    const cancha = canchasGlobales.find(c => c.id === idCancha);
    if (!cancha) return;
    document.getElementById('modal-nombre').innerText = cancha.nombre;
    document.getElementById('modal-logo').src = cancha.logo || 'https://via.placeholder.com/100';
    document.getElementById('modal-imagen-principal').src = cancha.fotos?.length ? cancha.fotos[0] : 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=1000&q=85';
    document.getElementById('modal-precio').innerText = cancha.precio ?? 'Consultar';
    document.getElementById('modal-rating').innerText = cancha.rating > 0 ? cancha.rating.toFixed(1) : 'Nuevo';
    document.getElementById('modal-horario').innerText = `${cancha.horaApertura || '??:??'} a ${cancha.horaCierre || '??:??'}`;
    document.getElementById('modal-descripcion').innerText = cancha.descripcion || 'Sin descripción disponible.';
    document.getElementById('modal-link-maps').href = cancha.ubicacionLink || '#';
    const mensaje = `Hola ${cancha.nombre}, vengo de APP FUTBOL y quiero consultar disponibilidad para reservar.`;
    const telefono = String(cancha.whatsapp || '').replace(/\D/g, '');
    document.getElementById('btn-whatsapp-reserva').href = telefono ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}` : '#';
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
    const groserias = ['mierda','puta','puto','pendejo','pendeja','cabron','cabrón','carajo','joder','cojudo','conchatumare','ctm','imbecil','imbécil','idiota','perra','estupido','estúpido','asco'];
    function tieneGroserias(texto) { const textoMinusculas = texto.toLowerCase(); return groserias.some(malaPalabra => textoMinusculas.includes(malaPalabra)); }
    onAuthStateChanged(auth, user => { usuarioActual = user || null; if (btnLogin) btnLogin.style.display = user ? 'none' : 'flex'; if (formAnuncio) formAnuncio.style.display = user ? 'flex' : 'none'; });
    if (btnLogin) btnLogin.addEventListener('click', async () => { try { await signInWithPopup(auth, provider); } catch (error) { alert('No se pudo iniciar sesión: ' + error.message); } });
    if (formAnuncio) formAnuncio.addEventListener('submit', async e => {
        e.preventDefault(); const textarea = document.getElementById('texto-anuncio'); const texto = textarea.value.trim();
        if (!usuarioActual) return alert('Debes iniciar sesión con Google para publicar.');
        if (!texto) return; if (tieneGroserias(texto)) return alert('Lenguaje inapropiado detectado. Mantengamos el respeto en la comunidad.');
        try { await addDoc(collection(db, 'bolsa_jugadores'), { nombre: formatearNombre(usuarioActual.displayName), texto, uid: usuarioActual.uid, fecha: serverTimestamp() }); textarea.value = ''; }
        catch (error) { console.error(error); alert('No se pudo publicar el anuncio. Intenta nuevamente.'); }
    });
    const q = query(collection(db, 'bolsa_jugadores'), orderBy('fecha', 'desc'));
    onSnapshot(q, snapshot => {
        if (!listaJugadores) return; listaJugadores.innerHTML = '';
        if (snapshot.empty) { listaJugadores.innerHTML = '<div class="card" style="text-align:center;color:var(--text-muted);"><i class="ph ph-users-three" style="font-size:30px;color:var(--primary-green);"></i><p style="margin-top:7px;">No hay anuncios todavía. Sé el primero.</p></div>'; return; }
        snapshot.forEach(docSnap => {
            const data = docSnap.data(); let botonEliminar = '';
            if (usuarioActual && data.uid === usuarioActual.uid) botonEliminar = `<button class="btn btn-outline" style="width:auto;padding:6px 11px;font-size:.68rem;border-color:rgba(255,69,69,.35);color:var(--danger);" onclick="eliminarAnuncio('${docSnap.id}')"><i class="ph-bold ph-trash"></i> Borrar</button>`;
            listaJugadores.innerHTML += `<article class="card" style="padding:17px 18px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;"><strong style="color:var(--text-main);font-size:.86rem;display:flex;align-items:center;gap:8px;"><span class="brand-mark" style="width:30px;height:30px;border-radius:9px;font-size:14px;"><i class="ph-fill ph-user"></i></span>${data.nombre}</strong>${botonEliminar}</div><p style="color:var(--text-main);font-size:.86rem;line-height:1.65;">${data.texto}</p><div style="margin-top:12px;color:var(--text-dim);font-size:.65rem;display:flex;align-items:center;gap:5px;"><i class="ph-bold ph-broadcast"></i> Publicación en tiempo real</div></article>`;
        });
    });
    window.eliminarAnuncio = async function(idDoc) { if (confirm('¿Seguro que deseas eliminar tu anuncio?')) { try { await deleteDoc(doc(db, 'bolsa_jugadores', idDoc)); } catch (error) { console.error(error); alert('No se pudo eliminar el anuncio.'); } } };
}

if (window.location.pathname.includes('cancha.html')) {
    const urlParams = new URLSearchParams(window.location.search); const idCancha = urlParams.get('id');
    async function cargarCanchaInfo() { if (!idCancha) return; const docSnap = await getDoc(doc(db, 'canchas', idCancha)); if (docSnap.exists()) { document.getElementById('cancha-nombre').innerText = docSnap.data().nombre; document.getElementById('cancha-precio').innerText = `S/ ${docSnap.data().precio} / hr`; } }
    cargarCanchaInfo();
    const estrellas = document.querySelectorAll('.estrellas-container i'); const tagsDiv = document.getElementById('tags-dinamicos'); const btnEnviar = document.getElementById('btn-enviar-resena');
    const tagsPositivos = ['Pasto excelente','Buen balón','Buena iluminación','Limpio','Buenos chalecos']; const tagsNegativos = ['Pasto gastado','Mala iluminación','Faltan chalecos','Mal trato'];
    estrellas.forEach(estrella => estrella.addEventListener('click', e => {
        const estrellasSeleccionadas = parseInt(e.target.dataset.valor); estrellas.forEach(s => s.classList.remove('activa','ph-fill')); estrellas.forEach(s => s.classList.add('ph-light'));
        for (let i = 0; i < estrellasSeleccionadas; i++) { estrellas[i].classList.remove('ph-light'); estrellas[i].classList.add('ph-fill','activa'); }
        if (tagsDiv) { tagsDiv.innerHTML = ''; (estrellasSeleccionadas >= 4 ? tagsPositivos : tagsNegativos).forEach(tag => { const span = document.createElement('span'); span.className = 'tag-resena'; span.innerText = tag; span.onclick = () => span.classList.toggle('seleccionado'); tagsDiv.appendChild(span); }); }
        if (btnEnviar) btnEnviar.style.display = 'block';
    }));
}
