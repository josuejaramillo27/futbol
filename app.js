// 1. IMPORTS DE FIREBASE (SIEMPRE DEBEN IR EN LA LÍNEA 1)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, deleteDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 2. CONFIGURACIÓN E INICIALIZACIÓN
const firebaseConfig = {
    apiKey: "AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",
    authDomain: "app-futbol-acd0f.firebaseapp.com",
    projectId: "app-futbol-acd0f",
    storageBucket: "app-futbol-acd0f.firebasestorage.app",
    messagingSenderId: "223446110165",
    appId: "1:223446110165:web:219afce6a9dac03203f75c"
};
const app = initializeApp(firebaseConfig), db = getFirestore(app), auth = getAuth(app);
let canchasGlobales = [], ubicacionUsuario = null, usuarioActual = null;

// ==========================================
// SISTEMA DE NOTIFICACIONES ELEGANTES (Toast)
// ==========================================
window.toast = function(mensaje, tipo = 'success') {
    let container = document.getElementById('toast-container-global');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container-global';
        document.body.appendChild(container);
    }
    const toastEl = document.createElement('div');
    toastEl.className = `custom-toast toast-${tipo}`;
    const iconClass = tipo === 'success' ? 'ph-check-circle' : tipo === 'error' ? 'ph-warning-circle' : 'ph-info';
    toastEl.innerHTML = `<i class="ph-bold ${iconClass}"></i><span>${mensaje}</span>`;
    container.appendChild(toastEl);
    setTimeout(() => {
        toastEl.classList.add('toast-out');
        setTimeout(() => toastEl.remove(), 300);
    }, 3200);
};
window.alert = function(mensaje) { window.toast(mensaje, 'info'); };

// ==========================================
// UTILIDADES Y FUNCIONES BÁSICAS
// ==========================================
function normalizar(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function obtenerCiudad(c){return c.ciudad||c.provincia||c.departamento||''} function obtenerTipo(c){return c.tipoCancha||c.tipo||c.modalidad||''}
function precioNumero(c){const p=Number(String(c.precio??'').replace(',','.').replace(/[^0-9.]/g,''));return Number.isFinite(p)?p:0}
function canchaEstaAbierta(c){if(!c.horaApertura||!c.horaCierre)return false;const n=new Date(),actual=n.getHours()*60+n.getMinutes(),[ha,ma]=c.horaApertura.split(':').map(Number),[hc,mc]=c.horaCierre.split(':').map(Number);if(![ha,ma,hc,mc].every(Number.isFinite))return false;const a=ha*60+ma,b=hc*60+mc;return b>a?actual>=a&&actual<=b:actual>=a||actual<=b}
function distanciaKm(lat1,lon1,lat2,lon2){const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}
function distanciaCerca(c){if(ubicacionUsuario&&Number.isFinite(Number(c.lat))&&Number.isFinite(Number(c.lng)))return distanciaKm(ubicacionUsuario.lat,ubicacionUsuario.lng,Number(c.lat),Number(c.lng));return Number(c.distanciaKm??c.distancia??999999)}
const esInicio=()=>{const p=window.location.pathname.replace(/\/$/,'');return p===''||p.endsWith('/index.html')||p.endsWith('/futbol')||p.endsWith('/futbol/index.html')};
const fechaHoy=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const minutos=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null};

const slotsDeCancha = (c, reservas, fechaReq) => {
    const a = minutos(c.horaApertura), b0 = minutos(c.horaCierre), step = Number(c.intervaloMinutos||c.duracionReserva||60);
    if(a===null || b0===null || !Number.isFinite(step) || step<=0) return [];
    let b = b0<=a ? b0+1440 : b0;
    const fReq = fechaReq || fechaHoy();
    const ocupadas = new Set(reservas.filter(r => String(r.canchaId)===String(c.id) && String(r.fecha)===fReq && !['cancelada','cancelado','cancelled'].includes(normalizar(r.estado))).map(r=>minutos(r.horaInicio)).filter(Number.isFinite));
    const isToday = fReq === fechaHoy();
    const now = new Date(), actual = now.getHours()*60 + now.getMinutes();
    const out = [];
    for(let t=a; t<b; t+=step){
        const real = t%1440, label = `${String(Math.floor(real/60)).padStart(2,'0')}:${String(real%60).padStart(2,'0')}`;
        out.push({label, blocked: ocupadas.has(real) || (isToday && real<actual)});
    }
    return out;
};

// ==========================================
// PÁGINA PRINCIPAL (INDEX)
// ==========================================
if(esInicio()){
 const contenedor=document.getElementById('lista-canchas'),inputBusqueda=document.getElementById('filtro-busqueda'),filtroCiudad=document.getElementById('filtro-ciudad'),filtroTipo=document.getElementById('filtro-tipo'),filtroPrecio=document.getElementById('filtro-precio'),filtroOrden=document.getElementById('filtro-orden'),contador=document.getElementById('contador-canchas'),filtroActivo=document.getElementById('filtro-activo');let soloAbiertas=false,soloCerca=false,soloTop=false;
 function llenarSelect(select,valores,placeholder){if(!select)return;const actual=select.value;select.innerHTML=`<option value="">${placeholder}</option>`;[...new Set(valores.map(v=>String(v).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;select.appendChild(o)});if([...select.options].some(o=>o.value===actual))select.value=actual}
 function renderizarCanchas(){if(!contenedor)return;const texto=normalizar(inputBusqueda?.value),ciudad=normalizar(filtroCiudad?.value),tipo=normalizar(filtroTipo?.value),rango=filtroPrecio?.value||'',orden=filtroOrden?.value||'recomendadas';let resultados=canchasGlobales.filter(c=>{const buscable=normalizar(`${c.nombre} ${c.ubicacionTexto||''} ${obtenerCiudad(c)} ${obtenerTipo(c)}`),precio=precioNumero(c);let rp=true;if(rango){const[min,max]=rango.split('-').map(Number);rp=precio>=min&&precio<=max}return(!texto||buscable.includes(texto))&&(!ciudad||normalizar(obtenerCiudad(c))===ciudad)&&(!tipo||normalizar(obtenerTipo(c))===tipo)&&rp&&(!soloAbiertas||c.isOpen)&&(!soloTop||c.rating>=4.5)&&(!soloCerca||distanciaCerca(c)<=10)});resultados.sort((a,b)=>orden==='rating'?b.rating-a.rating:orden==='precio-asc'?precioNumero(a)-precioNumero(b):orden==='precio-desc'?precioNumero(b)-precioNumero(a):orden==='cerca'?distanciaCerca(a)-distanciaCerca(b):a.isOpen!==b.isOpen?(a.isOpen?-1:1):b.rating-a.rating);if(contador)contador.textContent=`${resultados.length} ${resultados.length===1?'cancha encontrada':'canchas encontradas'}`;if(filtroActivo){const a=[];if(ciudad)a.push(filtroCiudad.value);if(tipo)a.push(filtroTipo.value);if(rango)a.push(filtroPrecio.options[filtroPrecio.selectedIndex].text);if(soloAbiertas)a.push('Abiertas ahora');if(soloTop)a.push('4.5+ estrellas');if(soloCerca)a.push(ubicacionUsuario?'Cerca de mí':'Cerca de mí*');filtroActivo.textContent=a.length?a.join(' · '):''}contenedor.innerHTML='';if(!resultados.length){contenedor.innerHTML='<div class="card empty-results" style="grid-column:1/-1;text-align:center"><i class="ph ph-magnifying-glass" style="font-size:34px;color:var(--primary-green)"></i><h3>No encontramos esa cancha</h3><p>Prueba quitando algún filtro o buscando otra zona.</p><button type="button" class="btn btn-outline" style="width:auto;margin:15px auto 0" id="btn-reset-empty">Limpiar filtros</button></div>';document.getElementById('btn-reset-empty')?.addEventListener('click',limpiarFiltros);return}resultados.forEach(c=>{const estado=c.isOpen?'<span class="badge-estado badge-abierto"><i class="ph-fill ph-circle"></i> Abierto ahora</span>':'<span class="badge-estado badge-cerrado"><i class="ph-fill ph-circle"></i> Cerrado</span>',logo=c.logo||'https://via.placeholder.com/100',portada=c.fotos?.length?c.fotos[0]:'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=1000&q=85',d=distanciaCerca(c),dist=Number.isFinite(d)&&d<999999?` · ${d.toFixed(1)} km`:'';contenedor.innerHTML+=`<article class="card court-card"><div class="court-cover" style="background-image:url('${portada}')"><div class="court-status">${estado}</div><div class="court-cover-gradient"></div></div><div class="court-body"><img src="${logo}" alt="Logo" loading="lazy" class="court-logo"><div class="court-content"><div class="court-title-line"><h3>${c.nombre||'Cancha'}</h3><span class="court-rating"><i class="ph-fill ph-star"></i> ${c.rating>0?c.rating.toFixed(1):'Nuevo'}</span></div><p class="court-location"><i class="ph-bold ph-map-pin"></i> ${c.ubicacionTexto||'Ubicación'}${obtenerCiudad(c)?` · ${obtenerCiudad(c)}`:''}${dist}</p><div class="court-meta"><span><i class="ph-bold ph-soccer-ball"></i> ${obtenerTipo(c)||'Fútbol'}</span><strong>S/ ${c.precio??'Consultar'} <small>/ hr</small></strong></div><button class="court-action" data-court-id="${c.id}"><span>Ver cancha y reservar</span><i class="ph-bold ph-arrow-right"></i></button></div></div></article>`});contenedor.querySelectorAll('[data-court-id]').forEach(b=>b.addEventListener('click',()=>abrirModal(b.dataset.courtId)))}
 function limpiarFiltros(){if(inputBusqueda)inputBusqueda.value='';if(filtroCiudad)filtroCiudad.value='';if(filtroTipo)filtroTipo.value='';if(filtroPrecio)filtroPrecio.value='';if(filtroOrden)filtroOrden.value='recomendadas';soloAbiertas=soloCerca=soloTop=false;document.querySelectorAll('.quick-filter').forEach(b=>b.classList.remove('active'));renderizarCanchas()}
 async function cargar(){
     if(!contenedor)return;
     contenedor.innerHTML='<div class="card loading-card" style="grid-column:1/-1;text-align:center;color:var(--text-muted)"><i class="ph-bold ph-spinner-gap ph-spin"></i> Buscando canchas...</div>';
     try{
         const s=await Promise.race([getDocs(collection(db,'canchas')),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Timeout')),12000))]);
         canchasGlobales=[];
         s.forEach(ds=>{
             const d=ds.data();
             if(d.estadoPublicacion === 'published' || (d.configurado === true && !d.estadoPublicacion)) {
                 canchasGlobales.push({id:ds.id, ...d, isOpen:canchaEstaAbierta(d), rating:Number(d.ratingPromedio||d.rating||0)});
             }
         });
         llenarSelect(filtroCiudad,canchasGlobales.map(obtenerCiudad),'Todas las ciudades');
         llenarSelect(filtroTipo,canchasGlobales.map(obtenerTipo),'Todos los tipos');
         renderizarCanchas();
     }catch(e){
         console.error(e);
         contenedor.innerHTML=`<div class="card" style="grid-column:1/-1;text-align:center;color:var(--danger);padding:28px">Error cargando las canchas.</div>`;
     }
 }
 [inputBusqueda,filtroCiudad,filtroTipo,filtroPrecio,filtroOrden].forEach(e=>e?.addEventListener('input',renderizarCanchas));document.querySelectorAll('.quick-filter').forEach(b=>b.addEventListener('click',()=>{const f=b.dataset.filter;if(f==='limpiar')return limpiarFiltros();if(f==='abiertas')soloAbiertas=!soloAbiertas;if(f==='cerca'){if(!navigator.geolocation)return window.toast('Tu navegador no permite geolocalización.','error');navigator.geolocation.getCurrentPosition(p=>{ubicacionUsuario={lat:p.coords.latitude,lng:p.coords.longitude};soloCerca=true;b.classList.add('active');renderizarCanchas()},()=>window.toast('Activa la ubicación.','warning'));return}if(f==='top')soloTop=!soloTop;b.classList.toggle('active');renderizarCanchas()}));cargar()
}

// ==========================================
// MODAL DE RESERVA Y DISPONIBILIDAD
// ==========================================
window.abrirModal=async id=>{const c=canchasGlobales.find(x=>x.id===id);if(!c)return;document.getElementById('modal-nombre').innerText=c.nombre;document.getElementById('modal-logo').src=c.logo||'https://via.placeholder.com/100';document.getElementById('modal-imagen-principal').src=c.fotos?.length?c.fotos[0]:'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=1000&q=85';document.getElementById('modal-precio').innerText=c.precio??'Consultar';document.getElementById('modal-rating').innerText=c.rating>0?c.rating.toFixed(1):'Nuevo';document.getElementById('modal-horario').innerText=`${c.horaApertura||'??:??'} a ${c.horaCierre||'??:??'}`;document.getElementById('modal-descripcion').innerText=c.descripcion||'Sin descripción disponible.';document.getElementById('modal-link-maps').href=c.ubicacionLink||'#';const tel=String(c.whatsapp||'').replace(/\D/g,'');document.getElementById('btn-whatsapp-reserva').href=tel?`https://wa.me/${tel}?text=${encodeURIComponent(`Hola ${c.nombre}, vengo de APP FUTBOL y quiero consultar disponibilidad.`)}`:'#';document.getElementById('btn-ver-resenas').href=`cancha.html?id=${c.id}`;await pintarDisponibilidadModal(c);document.getElementById('modal-cancha').classList.add('mostrar');document.body.style.overflow='hidden'};
async function pintarDisponibilidadModal(c, fechaElegida){
    const box = document.getElementById('modal-disponibilidad');
    if(!box) return;
    const fReq = fechaElegida || fechaHoy();
    box.innerHTML = '<div style="text-align:center; padding:20px;"><i class="ph-bold ph-spinner-gap ph-spin"></i></div>';
    try {
        const q = query(collection(db, 'reservas'), where('canchaId', '==', c.id), where('fecha', '==', fReq));
        const snap = await getDocs(q);
        const slots = slotsDeCancha(c, snap.docs.map(d => d.data()), fReq);
        const libres = slots.filter(s => !s.blocked).length;
        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:rgba(255,255,255,0.03); padding:10px 15px; border-radius:10px; border:1px solid var(--border-color);">
                <label style="display:flex; flex-direction:column; font-size:0.8rem; color:var(--text-muted); font-weight:bold;">FECHA DE RESERVA<input type="date" id="input-fecha-modal" value="${fReq}" min="${fechaHoy()}" style="background:transparent; border:none; color:#fff; font-size:1.1rem; font-weight:bold; outline:none; margin-top:4px; font-family:inherit; color-scheme:dark; cursor:pointer;"></label>
                <div style="text-align:right;"><span style="font-size:0.75rem; color:var(--text-muted); font-weight:bold;">DISPONIBLES</span><strong style="font-size:1.3rem; color:var(--primary-green); display:block;">${libres}</strong></div>
            </div>
            <div class="modal-slots">${slots.length ? slots.map(s=>`<button type="button" class="modal-slot ${s.blocked?'blocked':''}" data-book-court="${c.id}" data-book-time="${s.label}" data-book-date="${fReq}" ${s.blocked?'disabled':''}>${s.label}</button>`).join('') : '<span style="color:var(--text-muted);">El dueño aún no configuró sus horarios.</span>'}</div>
        `;
        document.getElementById('input-fecha-modal').addEventListener('change', (e) => pintarDisponibilidadModal(c, e.target.value));
        box.querySelectorAll('.modal-slot:not(.blocked)').forEach(b=>b.addEventListener('click',()=>abrirReserva(c, b.dataset.bookTime, b.dataset.bookDate)));
    } catch (e) { box.innerHTML='<span style="color:var(--danger)">Error cargando horarios.</span>'; }
}
function abrirReserva(c, hora, fechaElegida){
    const modal = document.getElementById('modal-reserva');
    if(!modal) return;
    document.getElementById('booking-cancha-nombre').textContent = c.nombre;
    const dateObj = new Date(`${fechaElegida}T12:00:00`);
    document.getElementById('booking-hora').textContent = `${new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'short'}).format(dateObj).toUpperCase()} · ${hora}`;
    document.getElementById('booking-nombre').value = usuarioActual?.displayName ? (usuarioActual.displayName.split(' ')[0]) : '';
    document.getElementById('booking-status').textContent = '';
    modal.dataset.courtId = c.id; modal.dataset.time = hora; modal.dataset.date = fechaElegida;
    modal.classList.add('mostrar'); modal.setAttribute('aria-hidden','false');
}
async function confirmarReserva(){
    const modal = document.getElementById('modal-reserva');
    const id = modal?.dataset.courtId, hora = modal?.dataset.time, fechaReq = modal?.dataset.date;
    const nombre = document.getElementById('booking-nombre')?.value.trim(), telefono = document.getElementById('booking-telefono')?.value.trim(), btn = document.getElementById('btn-confirmar-reserva');
    if(!id || !hora || !fechaReq || !nombre || !telefono){ window.toast('Completa tu nombre y teléfono.','warning'); return; }
    if(!usuarioActual){
        window.toast('Inicia sesión con Google para reservar.','warning');
        try{ const r = await signInWithPopup(auth, new GoogleAuthProvider()); usuarioActual = r.user; }catch(e){return;}
    }
    const c = canchasGlobales.find(x=>x.id===id);
    btn.disabled = true; window.toast('Confirmando horario...','info');
    const key = `${id}_${fechaReq}_${hora.replace(':','')}`;
    try {
        await runTransaction(db, async tx => {
            const ref = doc(db,'reservas',key), existing = await tx.get(ref);
            if(existing.exists() && !['cancelada','cancelado','cancelled'].includes(normalizar(existing.data().estado))) throw new Error('SLOT_OCUPADO');
            tx.set(ref,{ id: key, canchaId: id, canchaNombre: c?.nombre||'', usuarioUid: usuarioActual.uid, nombre: nombre, usuarioNombre: nombre, telefono: telefono, usuarioTelefono: telefono, fecha: fechaReq, horaInicio: hora, horaFin: hora, estado: 'pendiente', precio: Number(c?.precio||0), metodoPago: 'pendiente', senaPagada: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        });
        window.toast('¡Reserva registrada! Abriendo WhatsApp...','success');
        await pintarDisponibilidadModal(c, fechaReq);
        const telOwner = String(c?.whatsapp || '').replace(/\D/g, '');
        if (telOwner) {
            const mensajeWa = `Hola *${c?.nombre || 'Cancha'}*, solicito reserva:\n👤 *Nombre:* ${nombre}\n📅 *Fecha:* ${fechaReq}\n⏰ *Hora:* ${hora}\n📱 *Teléfono:* ${telefono}`;
            setTimeout(() => { window.open(`https://wa.me/${telOwner}?text=${encodeURIComponent(mensajeWa)}`, '_blank'); cerrarReserva(); cerrarModal(); }, 1200);
        } else { setTimeout(() => { cerrarReserva(); cerrarModal(); }, 1100); }
    } catch(e) {
        window.toast(e.message==='SLOT_OCUPADO'?'Ese horario acaba de ser reservado.':'No pudimos registrar la reserva.','error');
    } finally { btn.disabled = false; }
}
const btnCerrar=document.getElementById('cerrar-modal'),modalCancha=document.getElementById('modal-cancha');if(btnCerrar)btnCerrar.addEventListener('click',cerrarModal);if(modalCancha)modalCancha.addEventListener('click',e=>{if(e.target===modalCancha)cerrarModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape'){cerrarModal();cerrarReserva()}});function cerrarModal(){if(!modalCancha)return;modalCancha.classList.remove('mostrar');document.body.style.overflow=''}
function cerrarReserva(){const m=document.getElementById('modal-reserva');if(m){m.classList.remove('mostrar');m.setAttribute('aria-hidden','true')}}
const cr=document.getElementById('cerrar-reserva');cr?.addEventListener('click',cerrarReserva);document.getElementById('modal-reserva')?.addEventListener('click',e=>{if(e.target.id==='modal-reserva')cerrarReserva()});document.getElementById('btn-confirmar-reserva')?.addEventListener('click',confirmarReserva);
onAuthStateChanged(auth,u=>{usuarioActual=u||null});

// ==========================================
// FASE 26: BOLSA DE JUGADORES Y PARTIDOS EN VIVO
// ==========================================
if (window.location.pathname.includes('jugadores.html')) {
    const btnLogin = document.getElementById('btn-login-google');
    const formAnuncio = document.getElementById('form-anuncio') || document.getElementById('form-bolsa-jugadores');
    const lista = document.getElementById('lista-jugadores');
    const hint = document.getElementById('login-hint');

    // 1. Control visual del Login de Google
    onAuthStateChanged(auth, u => {
        usuarioActual = u || null;
        if (btnLogin) btnLogin.style.display = u ? 'none' : 'flex';
        if (formAnuncio) formAnuncio.style.display = u ? 'flex' : 'none';
        if (hint) hint.style.display = u ? 'none' : 'block';
    });

    // 2. Botón Iniciar Sesión con Google
    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            try {
                await signInWithPopup(auth, new GoogleAuthProvider());
            } catch (e) {
                window.toast('No se pudo iniciar sesión con Google.', 'error');
            }
        });
    }

    // 3. Descargar y pintar los partidos en vivo (Escáner)
    if (lista) {
        const q = query(collection(db, 'bolsa_jugadores'), orderBy('createdAt', 'desc'));
        onSnapshot(q, s => {
            lista.innerHTML = '';
            const docs = [];
            s.forEach(ds => docs.push({ id: ds.id, ...ds.data() }));

            if (!docs.length) {
                lista.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px;"><i class="ph-bold ph-users-three" style="font-size:40px;color:var(--primary-green)"></i><p style="margin-top:10px;">No hay partidos abiertos todavía. Sé el primero.</p></div>';
                return;
            }

            docs.forEach(d => {
                const esMio = usuarioActual && d.uid === usuarioActual.uid;
                const borrar = esMio ? `<button class="btn btn-danger btn-borrar" data-id="${d.id}" style="padding:6px 12px; font-size:0.75rem; border-radius:6px; margin-top:10px;"><i class="ph-bold ph-trash"></i> Borrar Anuncio</button>` : '';
                const fechaTexto = d.createdAt?.toDate ? new Date(d.createdAt.toDate()).toLocaleDateString('es-PE') : 'Reciente';

                lista.innerHTML += `
                <article style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:12px; padding:20px; margin-bottom:15px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        
                        <!-- AQUÍ ESTÁ LA MAGIA: Agregamos onclick="abrirPerfilJugador('${d.uid}')" y cursor:pointer -->
                        <strong onclick="abrirPerfilJugador('${d.uid}')" style="display:flex; align-items:center; gap:8px; color:#fff; font-size:1.1rem; cursor:pointer; transition: color 0.3s;" onmouseover="this.style.color='var(--primary-green)'" onmouseout="this.style.color='#fff'" title="Ver Tarjeta FUT">
                            <i class="ph-fill ph-user-circle" style="font-size:1.8rem; color:var(--primary-green);"></i> 
                            ${d.nombreJugador || d.nombre || 'Jugador'}
                        </strong>
                        
                        <span style="font-size:0.75rem; color:var(--text-muted);">${fechaTexto}</span>
                    </div>
                    <p style="margin:5px 0; font-size:0.95rem; color:#ddd;">
                        Busco: <b style="color:#fff;">${d.tipo || 'jugador'}</b> · <b style="color:#fff;">${d.modalidad || d.posicion || 'Fútbol 7'}</b>
                    </p>
                    ${d.nivel || d.distrito ? `<p style="margin:5px 0; font-size:0.85rem; color:var(--text-muted);">Nivel: ${d.nivel || 'Amateur'} | Zona: ${d.distrito || 'No especificada'}</p>` : ''}
                    ${d.texto ? `<p style="margin:12px 0; font-size:0.95rem; color:#eee; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px;">${d.texto}</p>` : ''}
                    ${d.contacto ? `<p style="margin:10px 0; font-size:0.95rem; color:var(--primary-green); font-weight:bold;"><i class="ph-bold ph-whatsapp-logo"></i> ${d.contacto}</p>` : ''}
                    ${borrar}
                </article>`;
            });

            // Listener para borrar el anuncio propio
            lista.querySelectorAll('.btn-borrar').forEach(b => {
                b.addEventListener('click', async () => {
                    if (confirm('¿Borrar tu anuncio de búsqueda?')) {
                        try {
                            await deleteDoc(doc(db, 'bolsa_jugadores', b.dataset.id));
                            window.toast('Anuncio eliminado de la comunidad.', 'success');
                        } catch(e) { window.toast('Error al eliminar.', 'error'); }
                    }
                });
            });
        }, e => {
            console.error('Error cargando bolsa:', e);
            lista.innerHTML = '<p style="color:var(--danger); text-align:center;">Error de conexión. No pudimos cargar los partidos.</p>';
        });
    }

    // 4. Enviar Formulario Anti-Spam
    if (formAnuncio) {
        formAnuncio.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!usuarioActual) {
                window.toast('Inicia sesión con Google para publicar.', 'warning');
                return;
            }

            const btn = formAnuncio.querySelector('button[type="submit"]') || document.getElementById('btn-publicar-anuncio');
            const textOriginal = btn ? btn.innerHTML : 'Publicar Anuncio';
            if(btn) { btn.disabled = true; btn.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Publicando...'; }

            try {
                // Validar Regla Anti-SPAM
                const qCheck = query(collection(db, 'bolsa_jugadores'), where('uid', '==', usuarioActual.uid));
                const snapCheck = await getDocs(qCheck);
                
                if (!snapCheck.empty) {
                    window.toast("Ya tienes un anuncio activo. Bórralo primero para publicar otro nuevo.", "warning");
                    if(btn) { btn.disabled = false; btn.innerHTML = textOriginal; }
                    return; 
                }

                const texto = document.getElementById('texto-anuncio')?.value || '';
                const tipo = document.getElementById('tipo-anuncio')?.value || document.getElementById('bolsa-tipo')?.value || 'jugador';
                const modalidad = document.getElementById('modalidad-anuncio')?.value || document.getElementById('bolsa-posicion')?.value || 'Fútbol 7';

                await addDoc(collection(db, 'bolsa_jugadores'), {
                    uid: usuarioActual.uid, 
                    nombreJugador: usuarioActual.displayName || 'Jugador',
                    nombre: usuarioActual.displayName || 'Jugador', // retro-compatibilidad
                    tipo: tipo,
                    modalidad: modalidad,
                    posicion: document.getElementById('bolsa-posicion')?.value || '',
                    nivel: document.getElementById('bolsa-nivel')?.value || '',
                    distrito: document.getElementById('bolsa-distrito')?.value || '',
                    contacto: document.getElementById('bolsa-contacto')?.value || '',
                    texto: texto,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                
                window.toast('¡Tu partido se publicó con éxito!', 'success');
                formAnuncio.reset();
                
            } catch (error) {
                window.toast('Ocurrió un error al intentar publicar.', 'error');
            } finally {
                if(btn) { btn.disabled = false; btn.innerHTML = textOriginal; }
            }
        });
    }
}

// ==========================================
// FASE 27: VISUALIZACIÓN PÚBLICA DE EVENTOS
// ==========================================
async function cargarEventosPublicos() {
    const contenedorEventos = document.getElementById('lista-eventos-publicos');
    if (!contenedorEventos) return; 
    contenedorEventos.innerHTML = '<div style="text-align:center; padding:20px;"><i class="ph-bold ph-spinner-gap ph-spin"></i></div>';
    try {
        const q = query(collection(db, 'eventos'), where('estado', '==', 'programado'));
        const snap = await getDocs(q);
        let eventos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const ahora = new Date();
        eventos = eventos.filter(e => new Date(e.fin) >= ahora).sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
        if (eventos.length === 0) {
            contenedorEventos.innerHTML = `<div class="empty-state" style="text-align:center; padding: 30px;"><i class="ph-fill ph-trophy" style="font-size:40px; color:var(--text-muted);"></i><h4>No hay campeonatos próximos</h4></div>`;
            return;
        }
        contenedorEventos.innerHTML = eventos.map(e => {
            const fechaInicio = new Date(e.inicio).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
            return `<article class="evento-publico-card" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:15px; margin-bottom:15px;">
                <div><span style="background:var(--primary-green); color:#000; font-size:0.7rem; font-weight:bold; padding:3px 8px; border-radius:4px;">TORNEO</span>
                <h3 style="margin:5px 0;">${e.nombre}</h3><p style="margin:0; color:var(--text-muted); font-size:0.85rem;"><i class="ph-bold ph-calendar"></i> Inicia: ${fechaInicio}</p></div>
                ${e.nota ? `<p style="margin-top:10px; font-size:0.9rem; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">${e.nota}</p>` : ''}
            </article>`;
        }).join('');
    } catch (error) { contenedorEventos.innerHTML = '<p style="color:var(--danger);">Error cargando eventos.</p>'; }
}
document.addEventListener('DOMContentLoaded', cargarEventosPublicos);

// ==========================================
// FASE 29: LÓGICA DE CALIFICACIÓN (cancha.html)
// ==========================================
if (window.location.pathname.includes('cancha.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const canchaId = urlParams.get('id');
    let ratingSeleccionado = 0;
    let etiquetasSeleccionadas = new Map(); 

    const TAGS_POR_RATING = {
        5: [{ icon: "ph-leaf", text: "Césped impecable" }, { icon: "ph-lightbulb", text: "Buena iluminación" }, { icon: "ph-handshake", text: "Excelente atención" }, { icon: "ph-soccer-ball", text: "Pelotas buenas" }, { icon: "ph-shower", text: "Vestuarios limpios" }, { icon: "ph-car", text: "Estacionamiento" }],
        4: [{ icon: "ph-thumbs-up", text: "Buena experiencia" }, { icon: "ph-lightbulb", text: "Luz aceptable" }, { icon: "ph-buildings", text: "Buenas instalaciones" }, { icon: "ph-handshake", text: "Atención amable" }, { icon: "ph-map-pin", text: "Fácil acceso" }],
        3: [{ icon: "ph-scales", text: "Regular" }, { icon: "ph-leaf", text: "Césped desgastado" }, { icon: "ph-lightbulb", text: "Luz media" }, { icon: "ph-clock", text: "Demora en hora" }],
        2: [{ icon: "ph-warning-circle", text: "Mala iluminación" }, { icon: "ph-leaf", text: "Césped muy usado" }, { icon: "ph-shower", text: "Vestuarios descuidados" }, { icon: "ph-thumbs-down", text: "Mala atención" }],
        1: [{ icon: "ph-prohibit", text: "Pésimo estado" }, { icon: "ph-lightbulb", text: "Luces quemadas" }, { icon: "ph-clock", text: "Impuntualidad" }, { icon: "ph-smiley-sad", text: "Mala atención" }]
    };

    async function cargarDetalleCancha() {
        const infoEl = document.getElementById('court-info');
        if (!canchaId) { if (infoEl) infoEl.innerHTML = '<h2>Cancha no especificada</h2>'; return; }
        try {
            const docSnap = await getDoc(doc(db, 'canchas', canchaId));
            if (docSnap.exists()) {
                const c = docSnap.data();
                const logoEl = document.getElementById('court-logo');
                if (logoEl) logoEl.src = c.logo || 'https://via.placeholder.com/100';
                const titleEl = document.getElementById('court-title');
                if (titleEl) titleEl.textContent = c.nombre || 'Cancha';
                const metaEl = document.getElementById('court-meta');
                if (metaEl) metaEl.innerHTML = `<i class="ph-bold ph-map-pin"></i> ${c.ubicacionTexto || c.distrito || 'Ubicación'} · <i class="ph-bold ph-soccer-ball"></i> ${c.tipoCancha || 'Fútbol'}`;
            }
        } catch (e) { console.error(e); }
        await refrescarPromedio();
        setupRatingForm();
    }

    async function refrescarPromedio() {
        try {
            const q = query(collection(db, 'resenas'), where('canchaId', '==', canchaId));
            const resenasSnap = await getDocs(q);
            const reseñas = resenasSnap.docs.map(d => d.data());
            const total = reseñas.length;
            const sum = reseñas.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
            const prom = total > 0 ? (sum / total).toFixed(1) : "0.0";
            const ratingEl = document.getElementById('court-rating');
            if (ratingEl) {
                ratingEl.innerHTML = `<div class="rating-badge-minimal"><span>${prom}</span><i class="ph-fill ph-star"></i><span style="font-size:0.85rem; color:var(--text-muted); font-weight:normal;">Estrellas</span></div><small style="color:var(--text-muted); margin-top:6px; display:block;">(${total} ${total === 1 ? 'calificación' : 'calificaciones'})</small>`;
            }
        } catch (e) { console.error(e); }
    }

    function setupRatingForm() {
        const stars = document.querySelectorAll('#star-picker i');
        const starLabel = document.getElementById('star-label');
        const tagsBox = document.getElementById('quick-tags-box');
        const tagsContainer = document.getElementById('quick-tags-container');
        const btnSubmit = document.getElementById('btn-submit-review');

        stars.forEach(star => {
            star.onclick = () => {
                ratingSeleccionado = Number(star.dataset.val);
                etiquetasSeleccionadas.clear();
                stars.forEach(s => s.classList.toggle('selected', Number(s.dataset.val) <= ratingSeleccionado));
                const labels = { 1: "Pésimo", 2: "Malo", 3: "Regular", 4: "Bueno", 5: "¡Excelente!" };
                starLabel.textContent = labels[ratingSeleccionado];
                const tagsDisponibles = TAGS_POR_RATING[ratingSeleccionado] || [];
                tagsContainer.innerHTML = tagsDisponibles.map(t => `<div class="tag-chip" data-icon="${t.icon}" data-text="${t.text}"><i class="ph-bold ${t.icon}"></i> ${t.text}</div>`).join('');
                tagsBox.style.display = 'block';
                tagsContainer.querySelectorAll('.tag-chip').forEach(chip => {
                    chip.onclick = () => {
                        const icon = chip.dataset.icon, text = chip.dataset.text, key = `${icon}|${text}`; 
                        if (etiquetasSeleccionadas.has(key)) { etiquetasSeleccionadas.delete(key); chip.classList.remove('active'); } 
                        else { etiquetasSeleccionadas.set(key, true); chip.classList.add('active'); }
                    };
                });
                btnSubmit.disabled = false;
            };
        });

        btnSubmit.onclick = async () => {
            if (!ratingSeleccionado) return;
            if (!usuarioActual) {
                window.toast("Debes iniciar sesión con Google para calificar.", "warning");
                try { await signInWithPopup(auth, new GoogleAuthProvider()); if(!auth.currentUser) return; } catch(e) { return; }
            }
            btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Publicando...';
            try {
                const reseñaUnicaId = `${canchaId}_${auth.currentUser.uid}`;
                await setDoc(doc(db, 'resenas', reseñaUnicaId), {
                    canchaId: canchaId, usuarioUid: auth.currentUser.uid, nombre: auth.currentUser.displayName || 'Jugador',
                    rating: ratingSeleccionado, tags: Array.from(etiquetasSeleccionadas.keys()), createdAt: serverTimestamp()
                });
                window.toast("¡Calificación registrada con éxito!", "success");
                ratingSeleccionado = 0; etiquetasSeleccionadas.clear();
                stars.forEach(s => s.classList.remove('selected'));
                tagsBox.style.display = 'none'; starLabel.textContent = "Toca las estrellas para calificar";
                btnSubmit.textContent = 'Publicar Calificación'; btnSubmit.disabled = true;
                await refrescarPromedio();
            } catch (e) {
                console.error(e); window.toast("Ocurrió un error al registrar tu calificación.", "error");
                btnSubmit.disabled = false; btnSubmit.textContent = 'Publicar Calificación';
            }
        };
    }
    document.addEventListener('DOMContentLoaded', cargarDetalleCancha);
}
