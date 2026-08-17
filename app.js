// 1. IMPORTS DE FIREBASE (SIEMPRE DEBEN IR EN LA LÍNEA 1)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, deleteDoc, runTransaction, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
// SISTEMA DE NOTIFICACIONES ELEGANTES
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

// MODAL PARA PEDIR WHATSAPP
window.customPrompt = function(mensaje, placeholder) {
    return new Promise((resolve) => {
        let overlay = document.getElementById('custom-prompt-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'custom-prompt-overlay';
            overlay.innerHTML = `
                <style>
                    #custom-prompt-overlay { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; }
                    #custom-prompt-overlay.show { display:flex; }
                    .prompt-box { background:#111; padding:25px; border-radius:16px; width:100%; max-width:350px; border:1px solid #f1c40f; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
                </style>
                <div class="prompt-box">
                    <i class="ph-fill ph-whatsapp-logo" style="font-size:3rem; color:#25D366; margin-bottom:10px;"></i>
                    <p id="custom-prompt-msg" style="margin:0 0 15px; font-size:0.95rem; color:#fff; line-height:1.4;"></p>
                    <input type="tel" id="custom-prompt-input" maxlength="9" oninput="this.value=this.value.replace(/[^0-9]/g,'');" style="width:100%; padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.5); color:#fff; margin-bottom:20px; text-align:center; font-size:1.2rem; font-weight:bold; letter-spacing:2px;" placeholder="">
                    <div style="display:flex; gap:10px;">
                        <button id="btn-prompt-cancel" class="btn" style="flex:1; background:rgba(255,255,255,0.1); color:#fff; border:none;">Cancelar</button>
                        <button id="btn-prompt-ok" class="btn" style="flex:1; background:#f1c40f; color:#000; font-weight:bold; border:none;">Enviar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        document.getElementById('custom-prompt-msg').textContent = mensaje;
        document.getElementById('custom-prompt-input').placeholder = placeholder || '';
        document.getElementById('custom-prompt-input').value = '';
        overlay.classList.add('show');

        document.getElementById('btn-prompt-ok').onclick = () => {
            const val = document.getElementById('custom-prompt-input').value.trim();
            if(val.length !== 9) { window.toast('El número debe tener 9 dígitos.', 'warning'); return; }
            if(confirm(`¿Tu número es ${val}?\nVerifica que esté correcto antes de enviarlo.`)) {
                overlay.classList.remove('show');
                resolve(val);
            }
        };
        document.getElementById('btn-prompt-cancel').onclick = () => {
            overlay.classList.remove('show');
            resolve(null);
        };
    });
};

// ==========================================
// UTILIDADES Y FUNCIONES BÁSICAS
// ==========================================
function formatWsp(num) {
    if (!num) return '';
    let n = String(num).replace(/\D/g, ''); 
    if (n.length === 9) return '51' + n;    
    return n;                               
}

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
    const ocupadas = new Set(reservas.filter(r => String(r.canchaId)===String(c.id) && String(r.fecha)===fReq && !['cancelada','cancelado','cancelled','rejected'].includes(normalizar(r.estado))).map(r=>minutos(r.horaInicio)).filter(Number.isFinite));
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
 
 function renderizarCanchas(){
     if(!contenedor)return;
     const texto=normalizar(inputBusqueda?.value),ciudad=normalizar(filtroCiudad?.value),tipo=normalizar(filtroTipo?.value),rango=filtroPrecio?.value||'',orden=filtroOrden?.value||'recomendadas';
     let resultados=canchasGlobales.filter(c=>{
         const buscable=normalizar(`${c.nombre} ${c.ubicacionTexto||''} ${obtenerCiudad(c)} ${obtenerTipo(c)} ${c.tiposMulti||''}`),precio=precioNumero(c);
         let rp=true;if(rango){const[min,max]=rango.split('-').map(Number);rp=precio>=min&&precio<=max}
         return(!texto||buscable.includes(texto))&&(!ciudad||normalizar(obtenerCiudad(c))===ciudad)&&(!tipo||(normalizar(obtenerTipo(c))===tipo || normalizar(c.tiposMulti||'').includes(tipo)))&&rp&&(!soloAbiertas||c.isOpen)&&(!soloTop||c.rating>=4.5)&&(!soloCerca||distanciaCerca(c)<=10);
     });
     resultados.sort((a,b)=>orden==='rating'?b.rating-a.rating:orden==='precio-asc'?precioNumero(a)-precioNumero(b):orden==='precio-desc'?precioNumero(b)-precioNumero(a):orden==='cerca'?distanciaCerca(a)-distanciaCerca(b):a.isOpen!==b.isOpen?(a.isOpen?-1:1):b.rating-a.rating);
     if(contador)contador.textContent=`${resultados.length} ${resultados.length===1?'complejo encontrado':'complejos encontrados'}`;
     if(filtroActivo){const a=[];if(ciudad)a.push(filtroCiudad.value);if(tipo)a.push(filtroTipo.value);if(rango)a.push(filtroPrecio.options[filtroPrecio.selectedIndex].text);if(soloAbiertas)a.push('Abiertas ahora');if(soloTop)a.push('4.5+ estrellas');if(soloCerca)a.push(ubicacionUsuario?'Cerca de mí':'Cerca de mí*');filtroActivo.textContent=a.length?a.join(' · '):''}
     contenedor.innerHTML='';
     if(!resultados.length){
         contenedor.innerHTML='<div class="card empty-results" style="grid-column:1/-1;text-align:center"><i class="ph ph-magnifying-glass" style="font-size:34px;color:var(--primary-green)"></i><h3>No encontramos canchas</h3><p>Prueba quitando algún filtro o buscando otra zona.</p><button type="button" class="btn btn-outline" style="width:auto;margin:15px auto 0" id="btn-reset-empty">Limpiar filtros</button></div>';
         document.getElementById('btn-reset-empty')?.addEventListener('click',limpiarFiltros);return;
     }
     resultados.forEach(c=>{
         const estado=c.isOpen?'<span class="badge-estado badge-abierto"><i class="ph-fill ph-circle"></i> Abierto ahora</span>':'<span class="badge-estado badge-cerrado"><i class="ph-fill ph-circle"></i> Cerrado</span>',logo=c.logo||'https://via.placeholder.com/100',portada=c.fotos?.length?c.fotos[0]:'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=1000&q=85',d=distanciaCerca(c),dist=Number.isFinite(d)&&d<999999?` · ${d.toFixed(1)} km`:'';
         
         // 🔥 TEXTO QUE AVISA SI HAY MÁS CANCHAS
         const multiBadge = c.multiCancha ? `<p style="margin: 6px 0 0 0; font-size: 0.8rem; color: #f1c40f; font-weight: bold;"><i class="ph-bold ph-copy"></i> ${c.cantidadCanchas} Canchas (${c.tiposMulti})</p>` : '';

         contenedor.innerHTML+=`<article class="card court-card"><div class="court-cover" style="background-image:url('${portada}')"><div class="court-status">${estado}</div><div class="court-cover-gradient"></div></div><div class="court-body"><img src="${logo}" alt="Logo" loading="lazy" class="court-logo"><div class="court-content"><div class="court-title-line"><h3>${c.nombre||'Cancha'}</h3><span class="court-rating"><i class="ph-fill ph-star"></i> ${c.rating>0?c.rating.toFixed(1):'Nuevo'}</span></div><p class="court-location"><i class="ph-bold ph-map-pin"></i> ${c.ubicacionTexto||'Ubicación'}${obtenerCiudad(c)?` · ${obtenerCiudad(c)}`:''}${dist}</p>
         ${multiBadge}
         <div class="court-meta" style="${c.multiCancha ? 'margin-top:8px;' : ''}"><span><i class="ph-bold ph-soccer-ball"></i> ${c.multiCancha ? 'Múltiples' : (obtenerTipo(c)||'Fútbol')}</span><strong>S/ ${c.precio??'Consultar'} <small>/ hr</small></strong></div><button class="court-action" data-court-id="${c.id}"><span>Ver perfil y reservar</span><i class="ph-bold ph-arrow-right"></i></button></div></div></article>`
     });
     contenedor.querySelectorAll('[data-court-id]').forEach(b=>b.addEventListener('click',()=> window.location.href = `cancha.html?id=${b.dataset.courtId}`));
 }
 
 function limpiarFiltros(){if(inputBusqueda)inputBusqueda.value='';if(filtroCiudad)filtroCiudad.value='';if(filtroTipo)filtroTipo.value='';if(filtroPrecio)filtroPrecio.value='';if(filtroOrden)filtroOrden.value='recomendadas';soloAbiertas=soloCerca=soloTop=false;document.querySelectorAll('.quick-filter').forEach(b=>b.classList.remove('active'));renderizarCanchas()}
 
 async function cargar(){
     if(!contenedor)return;
     contenedor.innerHTML='<div class="card loading-card" style="grid-column:1/-1;text-align:center;color:var(--text-muted)"><i class="ph-bold ph-spinner-gap ph-spin"></i> Buscando canchas...</div>';
     try{
         const s=await Promise.race([getDocs(collection(db,'canchas')),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Timeout')),12000))]);
         const agrupados = {};
         s.forEach(ds=>{
             const d=ds.data();
             if(d.estadoPublicacion === 'published' || (d.configurado === true && !d.estadoPublicacion)) {
                 const uid = d.usuarioUid || ds.id; // Agrupa por el dueño
                 if(!agrupados[uid]) agrupados[uid] = [];
                 agrupados[uid].push({id:ds.id, ...d, isOpen:canchaEstaAbierta(d), rating:Number(d.ratingPromedio||d.rating||0)});
             }
         });

         canchasGlobales = Object.values(agrupados).map(grupo => {
             const main = grupo[0];
             if (grupo.length > 1) {
                 const tiposUnicos = [...new Set(grupo.map(c => c.tipo))].filter(Boolean).join(', ');
                 main.multiCancha = true;
                 main.cantidadCanchas = grupo.length;
                 main.tiposMulti = tiposUnicos;
             }
             return main;
         });

         llenarSelect(filtroCiudad,canchasGlobales.map(obtenerCiudad),'Todas las ciudades');
         
         const todosLosTipos = [];
         Object.values(agrupados).forEach(g => g.forEach(c => { if(c.tipo) todosLosTipos.push(c.tipo); }));
         llenarSelect(filtroTipo, todosLosTipos, 'Todos los tipos');
         
         renderizarCanchas();
     }catch(e){
         contenedor.innerHTML=`<div class="card" style="grid-column:1/-1;text-align:center;color:var(--danger);padding:28px">Error cargando las canchas.</div>`;
     }
 }
 [inputBusqueda,filtroCiudad,filtroTipo,filtroPrecio,filtroOrden].forEach(e=>e?.addEventListener('input',renderizarCanchas));document.querySelectorAll('.quick-filter').forEach(b=>b.addEventListener('click',()=>{const f=b.dataset.filter;if(f==='limpiar')return limpiarFiltros();if(f==='abiertas')soloAbiertas=!soloAbiertas;if(f==='cerca'){if(!navigator.geolocation)return window.toast('Tu navegador no permite geolocalización.','error');navigator.geolocation.getCurrentPosition(p=>{ubicacionUsuario={lat:p.coords.latitude,lng:p.coords.longitude};soloCerca=true;b.classList.add('active');renderizarCanchas()},()=>window.toast('Activa la ubicación.','warning'));return}if(f==='top')soloTop=!soloTop;b.classList.toggle('active');renderizarCanchas()}));cargar()
}

// ==========================================
// MODAL DE RESERVA Y DISPONIBILIDAD
// ==========================================
window.abrirModal=async id=>{const c=canchasGlobales.find(x=>x.id===id);if(!c)return;document.getElementById('modal-nombre-interno').innerText=c.nombre; await pintarDisponibilidadModal(c);document.getElementById('modal-cancha').classList.add('mostrar');document.body.style.overflow='hidden'};
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
    document.getElementById('booking-status').innerHTML = ''; 
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
            if(existing.exists() && !['cancelada','cancelado','cancelled','rejected'].includes(normalizar(existing.data().estado))) throw new Error('SLOT_OCUPADO');
            tx.set(ref,{ id: key, canchaId: id, canchaNombre: c?.nombre||'', usuarioUid: usuarioActual.uid, nombre: nombre, usuarioNombre: nombre, telefono: telefono, usuarioTelefono: telefono, fecha: fechaReq, horaInicio: hora, horaFin: hora, estado: 'pendiente', precio: Number(c?.precio||0), metodoPago: 'pendiente', senaPagada: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        });
        
        document.getElementById('booking-status').innerHTML = `
            <div style="background:rgba(241,196,15,0.15); border:1px solid #f1c40f; padding:15px; border-radius:8px; color:#f1c40f; margin-top:15px; text-align:center;">
                <i class="ph-fill ph-hourglass-high" style="font-size: 2rem;"></i><br>
                <b style="font-size:1.1rem; display:block; margin:5px 0;">Reserva en estado PENDIENTE</b>
                <span>Abre WhatsApp, envía la foto del pago/seña y espera que la cancha valide tu reserva.</span>
            </div>`;
            
        await pintarDisponibilidadModal(c, fechaReq);
        const telOwner = formatWsp(c?.whatsapp); 
        
        if (telOwner) {
            const mensajeWa = `Hola *${c?.nombre || 'Cancha'}*, acabo de reservar en la APP:\n👤 *Nombre:* ${nombre}\n📅 *Fecha:* ${fechaReq}\n⏰ *Hora:* ${hora}\n\n*Te adjunto la seña para que puedas VALIDAR la reserva:*`;
            setTimeout(() => { window.open(`https://wa.me/${telOwner}?text=${encodeURIComponent(mensajeWa)}`, '_blank'); }, 2500);
        }
    } catch(e) {
        window.toast(e.message==='SLOT_OCUPADO'?'Ese horario acaba de ser reservado.':'No pudimos registrar la reserva.','error');
    } finally { btn.disabled = false; }
}

const btnCerrar=document.getElementById('cerrar-modal'),modalCancha=document.getElementById('modal-cancha');if(btnCerrar)btnCerrar.addEventListener('click',cerrarModal);if(modalCancha)modalCancha.addEventListener('click',e=>{if(e.target===modalCancha)cerrarModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape'){cerrarModal();cerrarReserva()}});function cerrarModal(){if(!modalCancha)return;modalCancha.classList.remove('mostrar');document.body.style.overflow=''}
function cerrarReserva(){const m=document.getElementById('modal-reserva');if(m){m.classList.remove('mostrar');m.setAttribute('aria-hidden','true')}}
const cr=document.getElementById('cerrar-reserva');cr?.addEventListener('click',cerrarReserva);document.getElementById('modal-reserva')?.addEventListener('click',e=>{if(e.target.id==='modal-reserva')cerrarReserva()});document.getElementById('btn-confirmar-reserva')?.addEventListener('click',confirmarReserva);
onAuthStateChanged(auth,u=>{usuarioActual=u||null});

// ==========================================
// FASE 26: BOLSA DE JUGADORES (MOTOR RECONSTRUIDO)
// ==========================================
if (window.location.pathname.includes('jugadores.html')) {
    const btnLogin = document.getElementById('btn-login-google');
    const formAnuncio = document.getElementById('form-anuncio');
    const lista = document.getElementById('lista-jugadores');
    const hint = document.getElementById('login-hint');

    let docsBolsa = []; 

    function renderizarBolsa() {
        if (!lista) return;
        if (!docsBolsa.length) {
            lista.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px; grid-column:1/-1;"><i class=\"ph-bold ph-users-three\" style=\"font-size:40px;color:var(--primary-green)\"></i><p style=\"margin-top:10px;\">No hay partidos abiertos todavía. Sé el primero.</p></div>';
            return;
        }

        let bufferHTML = '';

        docsBolsa.forEach(d => {
            const esMio = usuarioActual && d.uid === usuarioActual.uid;
            const borrar = esMio ? `<button class="btn btn-borrar-anuncio" data-id="${d.id}" style="width:100%; padding:8px 12px; font-size:0.8rem; border-radius:8px; margin-top:10px; background:rgba(231,76,60,0.1); color:#e74c3c; border:1px dashed rgba(231,76,60,0.3);"><i class="ph-bold ph-trash"></i> Borrar Anuncio</button>` : '';
            const fechaTexto = d.createdAt?.toDate ? new Date(d.createdAt.toDate()).toLocaleDateString('es-PE') : 'Reciente';

            let interaccionHTML = '';
            const postulantes = d.postulantes || {};
            const listaPostulantes = Object.values(postulantes);
            const yaPostulo = usuarioActual ? !!postulantes[usuarioActual.uid] : false;
            const miPostulacion = yaPostulo ? postulantes[usuarioActual.uid] : null;

            if (esMio) {
                let htmlPost = listaPostulantes.map(p => {
                    if(p.estado === 'aceptado') {
                        return `<div style="background:rgba(46,204,113,0.1); border:1px solid #2ecc71; padding:10px; border-radius:8px; margin-top:8px;">
                            <span style="color:#2ecc71; font-size:0.85rem;"><i class="ph-fill ph-handshake"></i> Fichaste a <b>${p.nombre}</b></span>
                            <a href="https://wa.me/${formatWsp(p.telefono)}" target="_blank" style="display:flex; justify-content:center; align-items:center; gap:5px; margin-top:8px; color:#000; background:#25D366; padding:6px 10px; border-radius:6px; font-weight:bold; font-size:0.8rem; text-decoration:none;"><i class="ph-bold ph-whatsapp-logo" style="font-size:1.1rem;"></i> Escribir a ${p.nombre}</a>
                        </div>`;
                    } else {
                        return `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; margin-top:8px; border: 1px solid rgba(255,255,255,0.1);">
                            <span onclick="abrirPerfilJugador('${p.uid}')" style="cursor:pointer; color:#f1c40f; text-decoration:underline; font-size:0.85rem;" title="Ver perfil"><i class="ph-fill ph-user-circle"></i> ${p.nombre}</span>
                            <button class="btn-aceptar-postulante" data-anuncio="${d.id}" data-uid="${p.uid}" style="padding:6px 12px; font-size:0.75rem; background:#2ecc71; color:#000; border:none; border-radius:6px; font-weight:bold; cursor:pointer;"><i class="ph-bold ph-check"></i> Fichar</button>
                        </div>`;
                    }
                }).join('');

                interaccionHTML = `<div style="margin-top:15px; border-top:1px dashed rgba(255,255,255,0.2); padding-top:15px;">
                    <strong style="color:#aaa; font-size:0.85rem;">Candidatos postulados (${listaPostulantes.length}):</strong>
                    ${htmlPost || '<div style="color:#666; font-size:0.8rem; margin-top:8px; font-style:italic;">Nadie se ha postulado aún.</div>'}
                </div>`;
            } else {
                if (!usuarioActual) {
                    interaccionHTML = `<button class="btn" style="width:100%; margin-top:15px; background:rgba(255,255,255,0.1); color:#aaa; border:1px dashed #555;" onclick="window.toast('Inicia sesión para postularte','warning')">Inicia sesión para apuntarte</button>`;
                } else if (yaPostulo) {
                    if (miPostulacion.estado === 'aceptado') {
                        interaccionHTML = `<div style="margin-top:15px; padding:15px; background:rgba(46,204,113,0.1); border:1px solid #2ecc71; border-radius:8px; text-align:center;">
                            <span style="color:#2ecc71; font-weight:bold; font-size:0.95rem; display:block; margin-bottom:8px;">🎉 ¡Has sido fichado!</span>
                            <a href="https://wa.me/${formatWsp(d.contacto)}" target="_blank" style="display:inline-flex; align-items:center; gap:5px; background:#25D366; color:#000; font-weight:bold; padding:8px 15px; border-radius:6px; text-decoration:none; font-size:0.85rem;"><i class="ph-bold ph-whatsapp-logo" style="font-size:1.1rem;"></i> Escribir al Capitán</a>
                        </div>`;
                    } else {
                        interaccionHTML = `<div style="margin-top:15px; padding:12px; background:rgba(241,196,15,0.1); border:1px dashed rgba(241,196,15,0.4); border-radius:8px; color:#f1c40f; text-align:center; font-size:0.85rem; font-weight:bold;">
                            <i class="ph-bold ph-hourglass-high"></i> Postulación enviada. Esperando que te acepte...
                        </div>`;
                    }
                } else {
                    interaccionHTML = `<button class="btn btn-postular" data-anuncio="${d.id}" style="width:100%; margin-top:15px; background:linear-gradient(45deg, #f1c40f, #e67e22); color:#000; font-weight:bold; border:none; box-shadow: 0 4px 15px rgba(241,196,15,0.2);"><i class="ph-bold ph-hand-raising" style="font-size:1.2rem;"></i> ✋ ¡Me Apunto!</button>`;
                }
            }

            bufferHTML += `
            <article style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:20px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <strong onclick="abrirPerfilJugador('${d.uid}')" style="display:flex; align-items:center; gap:8px; color:#fff; font-size:1.1rem; cursor:pointer; transition: color 0.3s;" onmouseover="this.style.color='var(--primary-green)'" onmouseout="this.style.color='#fff'" title="Ver Tarjeta FUT">
                        <i class="ph-fill ph-user-circle" style="font-size:1.8rem; color:var(--primary-green);"></i> 
                        ${d.nombreJugador || d.nombre || 'Jugador'}
                    </strong>
                    <span style="font-size:0.75rem; color:var(--text-muted); background:rgba(255,255,255,0.05); padding:3px 8px; border-radius:12px;">${fechaTexto}</span>
                </div>
                <p style="margin:5px 0; font-size:0.95rem; color:#ddd;">Busco: <b style="color:#f1c40f;">${d.tipo || 'jugador'}</b> · <b style="color:#f1c40f;">${d.modalidad || 'Fútbol 7'}</b></p>
                ${d.texto ? `<p style="margin:12px 0; font-size:0.95rem; color:#eee; background:rgba(0,0,0,0.3); padding:12px; border-radius:8px; border-left:3px solid var(--primary-green); font-style:italic;">"${d.texto}"</p>` : ''}
                
                ${interaccionHTML}
                ${borrar}
            </article>`;
        });

        lista.innerHTML = bufferHTML;

        lista.querySelectorAll('.btn-postular').forEach(b => {
            b.addEventListener('click', async () => {
                if(!usuarioActual) return window.toast('Inicia sesión para postularte.', 'warning');

                let telefonoVerificado = usuarioActual.phoneNumber;
                if (!telefonoVerificado) {
                    try {
                        const docSnap = await getDoc(doc(db, "jugadores_perfiles", usuarioActual.uid));
                        if (docSnap.exists() && docSnap.data().telefono) telefonoVerificado = docSnap.data().telefono;
                    } catch(err) { console.error(err); }
                }

                if (!telefonoVerificado) {
                    window.toast('Debes configurar y verificar tu número en la Tarjeta FUT antes de apuntarte.', 'warning');
                    return;
                }

                const anuncioId = b.dataset.anuncio;
                b.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i>'; b.disabled = true;
                try {
                    await updateDoc(doc(db, 'bolsa_jugadores', anuncioId), {
                        [`postulantes.${usuarioActual.uid}`]: {
                            uid: usuarioActual.uid,
                            nombre: usuarioActual.displayName || 'Jugador',
                            telefono: formatWsp(telefonoVerificado), 
                            estado: 'pendiente'
                        }
                    });
                    window.toast('¡Te has apuntado con éxito!', 'success');
                } catch(e) { window.toast('Error al apuntarse.', 'error'); b.innerHTML = '✋ ¡Me Apunto!'; b.disabled = false; }
            });
        });

        lista.querySelectorAll('.btn-aceptar-postulante').forEach(b => {
            b.addEventListener('click', async () => {
                if(!confirm('¿Aceptar a este jugador y mostrarle tu WhatsApp?')) return;
                const anuncioId = b.dataset.anuncio;
                const postUid = b.dataset.uid;
                b.innerHTML = '...'; b.disabled = true;
                try {
                    await updateDoc(doc(db, 'bolsa_jugadores', anuncioId), {
                        [`postulantes.${postUid}.estado`]: 'aceptado'
                    });
                    window.toast('¡Fichaje completado!', 'success');
                } catch(e) { window.toast('Error al aceptar.', 'error'); b.innerHTML = 'Fichar'; b.disabled = false; }
            });
        });

        lista.querySelectorAll('.btn-borrar-anuncio').forEach(b => {
            b.addEventListener('click', async () => {
                if (confirm('¿Borrar tu anuncio definitivamente?')) {
                    try {
                        await deleteDoc(doc(db, 'bolsa_jugadores', b.dataset.id));
                        window.toast('Anuncio eliminado.', 'success');
                    } catch(e) { window.toast('Error al eliminar.', 'error'); }
                }
            });
        });
    }

    onAuthStateChanged(auth, u => {
        usuarioActual = u || null;
        if (btnLogin) btnLogin.style.display = u ? 'none' : 'flex';
        if (formAnuncio) formAnuncio.style.display = u ? 'flex' : 'none';
        if (hint) hint.style.display = u ? 'none' : 'block';
        
        renderizarBolsa(); 
    });

    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
            catch (e) { window.toast('No se pudo iniciar sesión.', 'error'); }
        });
    }

    if (lista) {
        const q = query(collection(db, 'bolsa_jugadores'), orderBy('createdAt', 'desc'));
        onSnapshot(q, s => {
            docsBolsa = [];
            s.forEach(ds => docsBolsa.push({ id: ds.id, ...ds.data() }));
            renderizarBolsa(); 
        }, e => {
            console.error('Error cargando bolsa:', e);
            lista.innerHTML = '<p style="color:var(--danger); text-align:center;">Error de conexión. No pudimos cargar los partidos.</p>';
        });
    }

    if (formAnuncio) {
        formAnuncio.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!usuarioActual) { window.toast('Inicia sesión con Google para publicar.', 'warning'); return; }

            let telefonoVerificado = usuarioActual.phoneNumber;
            if (!telefonoVerificado) {
                try {
                    const docSnap = await getDoc(doc(db, "jugadores_perfiles", usuarioActual.uid));
                    if (docSnap.exists() && docSnap.data().telefono) telefonoVerificado = docSnap.data().telefono;
                } catch(err) { console.error(err); }
            }

            if (!telefonoVerificado) {
                window.toast('Debes verificar tu celular en "Configurar mi Tarjeta de Jugador" antes de publicar.', 'warning');
                return;
            }

            const btn = formAnuncio.querySelector('button[type="submit"]');
            const textOriginal = btn ? btn.innerHTML : 'Publicar';
            if(btn) { btn.disabled = true; btn.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Publicando...'; }

            try {
                const qCheck = query(collection(db, 'bolsa_jugadores'), where('uid', '==', usuarioActual.uid));
                const snapCheck = await getDocs(qCheck);
                
                if (!snapCheck.empty) {
                    window.toast("Ya tienes un anuncio activo. Bórralo para crear uno nuevo.", "warning");
                    if(btn) { btn.disabled = false; btn.innerHTML = textOriginal; }
                    return; 
                }

                await addDoc(collection(db, 'bolsa_jugadores'), {
                    uid: usuarioActual.uid, 
                    nombreJugador: usuarioActual.displayName || 'Jugador',
                    nombre: usuarioActual.displayName || 'Jugador',
                    tipo: document.getElementById('tipo-anuncio')?.value || 'jugador',
                    modalidad: document.getElementById('modalidad-anuncio')?.value || 'Fútbol 7',
                    contacto: formatWsp(telefonoVerificado), 
                    texto: document.getElementById('texto-anuncio')?.value || '',
                    postulantes: {}, 
                    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
                });
                
                window.toast('¡Anuncio publicado con éxito!', 'success');
                formAnuncio.reset();
            } catch (error) { window.toast('Error al publicar.', 'error'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = textOriginal; } }
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
// FASE 29: LINK EN BIO & CALIFICACIÓN (cancha.html)
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
        if (!canchaId) { document.getElementById('bio-title').textContent = 'Cancha no encontrada'; return; }
        
        try {
            const docSnap = await getDoc(doc(db, 'canchas', canchaId));
            if (docSnap.exists()) {
                const cPrincipal = docSnap.data();
                cPrincipal.id = docSnap.id; 
                
                // 1. PINTAR LA INFORMACIÓN GENERAL DEL COMPLEJO
                const coverEl = document.getElementById('bio-cover');
                if (coverEl) coverEl.src = cPrincipal.fotos?.length ? cPrincipal.fotos[0] : 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=1000&q=85';
                
                const logoEl = document.getElementById('bio-logo');
                if (logoEl) logoEl.src = cPrincipal.logo || 'https://via.placeholder.com/100';
                
                const titleEl = document.getElementById('bio-title');
                if (titleEl) titleEl.textContent = cPrincipal.nombre || 'Complejo Deportivo';
                
                const locEl = document.getElementById('bio-location');
                if (locEl) locEl.innerHTML = `<i class="ph-bold ph-map-pin"></i> ${cPrincipal.ubicacionTexto || cPrincipal.distrito || 'Ubicación'}`;

                const descEl = document.getElementById('bio-desc');
                if (descEl) descEl.textContent = cPrincipal.descripcion || 'Sin descripción disponible.';

                const btnMapa = document.getElementById('btn-mapa-bio');
                if (btnMapa) {
                    if (cPrincipal.ubicacionLink) { btnMapa.href = cPrincipal.ubicacionLink; }
                    else { btnMapa.style.display = 'none'; }
                }

                // 2. OBTENER TODAS LAS CANCHAS DEL DUEÑO (INCLUYENDO LA PRINCIPAL Y SECUNDARIAS)
                const mapCanchas = new Map();
                
                // A) Agregar SIEMPRE la cancha principal
                mapCanchas.set(cPrincipal.id, {
                    id: cPrincipal.id,
                    ...cPrincipal,
                    isOpen: canchaEstaAbierta(cPrincipal)
                });

                // B) Buscar otras canchas asociadas al mismo dueño (por usuarioUid o por cPrincipal.id)
                const ownerUid = cPrincipal.usuarioUid || cPrincipal.uid || cPrincipal.id;
                
                if (ownerUid) {
                    try {
                        const q = query(collection(db, 'canchas'), where('usuarioUid', '==', ownerUid));
                        const snap = await getDocs(q);
                        snap.forEach(d => {
                            const data = d.data();
                            mapCanchas.set(d.id, { id: d.id, ...data, isOpen: canchaEstaAbierta(data) });
                        });
                    } catch(eQuery) {
                        console.warn("Consulta por usuarioUid omitida o fallida:", eQuery);
                    }
                }

                canchasGlobales = Array.from(mapCanchas.values());

                // 3. DIBUJAR LA LISTA DE TODAS LAS CANCHAS DEL COMPLEJO
                const contenedorLista = document.getElementById('lista-canchas-complejo');
                if (contenedorLista) {
                    let htmlLista = `<h3 style="color:#fff; margin-bottom:15px; font-size:1.15rem;"><i class="ph-bold ph-list-dashes" style="color:var(--primary-green);"></i> Canchas disponibles:</h3>`;
                    
                    canchasGlobales.forEach((c, i) => {
                        const nombreEspecifico = c.nombreCancha || c.nombreEspacio || c.tipo || `Cancha ${i + 1}`;
                        
                        htmlLista += `
                        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:15px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                            <div>
                                <h4 style="margin:0 0 5px 0; color:#fff; font-size:1.1rem;">${nombreEspecifico}</h4>
                                <p style="margin:0; color:#aaa; font-size:0.85rem;"><i class="ph-bold ph-soccer-ball"></i> ${c.tipo || 'Fútbol'} <span style="margin:0 5px;">|</span> <span style="color:var(--primary-green); font-weight:bold; font-size:0.95rem;">S/ ${c.precio || '--'}</span> <small>/ hr</small></p>
                            </div>
                            <button class="btn btn-reservar-dinamico" data-id="${c.id}" style="background:linear-gradient(45deg, var(--primary-green), #27ae60); color:#000; font-weight:900; border:none; padding:10px 16px; border-radius:10px; cursor:pointer; font-size:0.9rem; box-shadow:0 4px 10px rgba(0,217,104,0.2);"><i class="ph-bold ph-calendar-plus"></i> Reservar</button>
                        </div>
                        `;
                    });
                    
                    contenedorLista.innerHTML = htmlLista;

                    contenedorLista.querySelectorAll('.btn-reservar-dinamico').forEach(btn => {
                        btn.addEventListener('click', () => {
                            if (window.abrirModal) {
                                window.abrirModal(btn.dataset.id);
                            }
                        });
                    });
                }
            }
        } catch (e) { console.error("Error cargando detalle:", e); }
        
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
                ratingEl.innerHTML = `<div class="rating-badge-minimal" style="font-size:1.5rem; padding: 5px 15px;"><span style="font-weight:900;">${prom}</span><i class="ph-fill ph-star"></i></div><small style="color:var(--text-muted); margin-top:8px; display:block;">Basado en ${total} calificaciones</small>`;
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
                stars.forEach(s => {
                    if(Number(s.dataset.val) <= ratingSeleccionado) {
                        s.style.color = '#f1c40f'; s.classList.add('selected');
                    } else {
                        s.style.color = '#333'; s.classList.remove('selected');
                    }
                });
                
                const labels = { 1: "Pésimo", 2: "Malo", 3: "Regular", 4: "Bueno", 5: "¡Excelente!" };
                starLabel.textContent = labels[ratingSeleccionado];
                starLabel.style.color = '#f1c40f';
                
                const tagsDisponibles = TAGS_POR_RATING[ratingSeleccionado] || [];
                tagsContainer.innerHTML = tagsDisponibles.map(t => `<div class="tag-chip" data-icon="${t.icon}" data-text="${t.text}" style="border:1px solid #555; padding:6px 12px; border-radius:20px; font-size:0.8rem; cursor:pointer;"><i class="ph-bold ${t.icon}"></i> ${t.text}</div>`).join('');
                tagsBox.style.display = 'block';
                
                tagsContainer.querySelectorAll('.tag-chip').forEach(chip => {
                    chip.onclick = () => {
                        const icon = chip.dataset.icon, text = chip.dataset.text, key = `${icon}|${text}`; 
                        if (etiquetasSeleccionadas.has(key)) { 
                            etiquetasSeleccionadas.delete(key); 
                            chip.style.background = 'transparent'; chip.style.color = '#fff'; chip.style.borderColor = '#555';
                        } else { 
                            etiquetasSeleccionadas.set(key, true); 
                            chip.style.background = 'rgba(241,196,15,0.1)'; chip.style.color = '#f1c40f'; chip.style.borderColor = '#f1c40f';
                        }
                    };
                });
                btnSubmit.disabled = false;
                btnSubmit.style.background = 'linear-gradient(45deg, #f1c40f, #e67e22)';
                btnSubmit.style.color = '#000';
                btnSubmit.style.fontWeight = 'bold';
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
                const refResena = doc(db, 'resenas', reseñaUnicaId);

                // 🔥 MAGIA AQUÍ: Verificamos si ya existe antes de que Firebase nos bloquee
                const snapResena = await getDoc(refResena);
                if (snapResena.exists()) {
                    window.toast("Ya calificaste esta cancha anteriormente.", "warning");
                    btnSubmit.textContent = 'Publicar Calificación'; btnSubmit.disabled = true;
                    btnSubmit.style.background = 'rgba(255,255,255,0.05)'; btnSubmit.style.color = '#888';
                    return;
                }

                // SI NO EXISTÍA, GUARDAMOS
                await setDoc(refResena, {
                    canchaId: canchaId, usuarioUid: auth.currentUser.uid, nombre: auth.currentUser.displayName || 'Jugador',
                    rating: ratingSeleccionado, tags: Array.from(etiquetasSeleccionadas.keys()), createdAt: serverTimestamp()
                });
                
                window.toast("¡Calificación registrada con éxito!", "success");
                ratingSeleccionado = 0; etiquetasSeleccionadas.clear();
                stars.forEach(s => { s.style.color = '#333'; s.classList.remove('selected'); });
                tagsBox.style.display = 'none'; starLabel.textContent = "Toca las estrellas para calificar"; starLabel.style.color = 'var(--text-muted)';
                btnSubmit.textContent = 'Publicar Calificación'; btnSubmit.disabled = true;
                btnSubmit.style.background = 'rgba(255,255,255,0.05)'; btnSubmit.style.color = '#888';
                await refrescarPromedio();
                
            } catch (e) {
                console.error(e);
                // Si aún así Firebase rechaza por reglas de seguridad
                if (e.code === 'permission-denied') {
                    window.toast("Ya calificaste esta cancha.", "warning");
                } else {
                    window.toast("Ocurrió un error al publicar.", "error");
                }
                btnSubmit.disabled = false; btnSubmit.textContent = 'Publicar Calificación';
            }
        };
    }
    document.addEventListener('DOMContentLoaded', cargarDetalleCancha);
}

// ==========================================
// MÓDULO INTELIGENTE: GPS, SLIDER Y FILTROS (CORREGIDO)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. LLENAR EL FILTRO DE TIPOS DINÁMICAMENTE USANDO LA BD EXISTENTE (db)
    async function cargarTiposDinamicos() {
        try {
            if (typeof db !== 'undefined') {
                const snap = await getDocs(collection(db, 'canchas'));
                const tipos = new Set();
                snap.forEach(d => { if(d.data().tipo) tipos.add(d.data().tipo); });
                const selectTipo = document.getElementById('filtro-tipo');
                if(selectTipo && tipos.size > 0) {
                    selectTipo.innerHTML = '<option value="">Todos los tipos</option>' + 
                        [...tipos].map(t => `<option value="${t}">${t}</option>`).join('');
                }
            }
        } catch(e) { console.error("Error al cargar tipos dinámicos", e); }
    }
    cargarTiposDinamicos();

    // 2. EFECTO DESENFOQUE (BLUR) PARA EL CARRUSEL
    const sliderLista = document.getElementById('lista-canchas');
    if (sliderLista) {
        const blurObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.filter = 'blur(0px)';
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'scale(1)';
                } else {
                    entry.target.style.filter = 'blur(4px)';
                    entry.target.style.opacity = '0.4';
                    entry.target.style.transform = 'scale(0.92)';
                }
            });
        }, { root: sliderLista, threshold: 0.6 });

        const domObserver = new MutationObserver((mutations) => {
            mutations.forEach(mut => {
                mut.addedNodes.forEach(node => {
                    if (node.classList && node.classList.contains('card')) {
                        blurObserver.observe(node);
                    }
                });
            });
        });
        domObserver.observe(sliderLista, { childList: true });

        // BOTONES DE NAVEGACIÓN DEL CARRUSEL
        const btnPrev = document.getElementById('slider-prev');
        const btnNext = document.getElementById('slider-next');
        const scrollAmount = 320;

        if (btnNext && btnPrev) {
            btnNext.onclick = () => sliderLista.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            btnPrev.onclick = () => sliderLista.scrollBy({ left: -scrollAmount, behavior: 'smooth' });

            sliderLista.addEventListener('scroll', () => {
                btnPrev.style.display = sliderLista.scrollLeft <= 10 ? 'none' : 'flex';
                const maxScroll = sliderLista.scrollWidth - sliderLista.clientWidth;
                btnNext.style.display = sliderLista.scrollLeft >= (maxScroll - 10) ? 'none' : 'flex';
            });
            setTimeout(() => sliderLista.dispatchEvent(new Event('scroll')), 500);
        }
    }

    // 3. MODAL GPS (GEOLOCALIZACIÓN DEL DEPARTAMENTO)
    const modalGps = document.getElementById('modal-ubicacion');
    if (modalGps && !localStorage.getItem('gpsPreguntado')) {
        setTimeout(() => { modalGps.style.display = 'flex'; }, 1500);
    }

    document.getElementById('btn-cerrar-gps')?.addEventListener('click', () => {
        localStorage.setItem('gpsPreguntado', 'true');
        if (modalGps) modalGps.style.display = 'none';
    });

    document.getElementById('btn-detectar-gps')?.addEventListener('click', () => {
        const btn = document.getElementById('btn-detectar-gps');
        btn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Ubicando...';
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                    const data = await res.json();
                    let dpto = data.address.state || data.address.region || '';
                    
                    dpto = dpto.replace(' Department', '').replace(' Región', '').trim();
                    
                    const selectDept = document.getElementById('filtro-ciudad');
                    let encontrado = false;
                    if (selectDept) {
                        for (let i = 0; i < selectDept.options.length; i++) {
                            if (selectDept.options[i].value.toLowerCase() === dpto.toLowerCase()) {
                                selectDept.selectedIndex = i;
                                encontrado = true;
                                selectDept.dispatchEvent(new Event('change'));
                                break;
                            }
                        }
                    }
                    
                    localStorage.setItem('gpsPreguntado', 'true');
                    if (modalGps) modalGps.style.display = 'none';
                    if (encontrado) alert(`¡Detectado! Mostrando canchas en ${dpto}.`);
                    
                } catch(e) {
                    alert("No pudimos obtener tu departamento exacto. Puedes seleccionarlo manualmente.");
                    if (modalGps) modalGps.style.display = 'none';
                }
            }, () => {
                alert("Permiso de ubicación denegado.");
                localStorage.setItem('gpsPreguntado', 'true');
                if (modalGps) modalGps.style.display = 'none';
            });
        }
    });
});
