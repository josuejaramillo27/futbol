import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, deleteDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
const firebaseConfig={apiKey:"AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",authDomain:"app-futbol-acd0f.firebaseapp.com",projectId:"app-futbol-acd0f",storageBucket:"app-futbol-acd0f.firebasestorage.app",messagingSenderId:"223446110165",appId:"1:223446110165:web:219afce6a9dac03203f75c"};
const app=initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app);let canchasGlobales=[];let ubicacionUsuario=null;let usuarioActual=null;
function normalizar(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function obtenerCiudad(c){return c.ciudad||c.provincia||c.departamento||''} function obtenerTipo(c){return c.tipoCancha||c.tipo||c.modalidad||''}
function precioNumero(c){const p=Number(String(c.precio??'').replace(',','.').replace(/[^0-9.]/g,''));return Number.isFinite(p)?p:0}
function canchaEstaAbierta(c){if(!c.horaApertura||!c.horaCierre)return false;const n=new Date(),actual=n.getHours()*60+n.getMinutes(),[ha,ma]=c.horaApertura.split(':').map(Number),[hc,mc]=c.horaCierre.split(':').map(Number);if(![ha,ma,hc,mc].every(Number.isFinite))return false;const a=ha*60+ma,b=hc*60+mc;return b>a?actual>=a&&actual<=b:actual>=a||actual<=b}
function distanciaKm(lat1,lon1,lat2,lon2){const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}
function distanciaCerca(c){if(ubicacionUsuario&&Number.isFinite(Number(c.lat))&&Number.isFinite(Number(c.lng)))return distanciaKm(ubicacionUsuario.lat,ubicacionUsuario.lng,Number(c.lat),Number(c.lng));return Number(c.distanciaKm??c.distancia??999999)}
const esInicio=()=>{const p=window.location.pathname.replace(/\/$/,'');return p===''||p.endsWith('/index.html')||p.endsWith('/futbol')||p.endsWith('/futbol/index.html')};
function mostrarErrorCarga(el,tipo,e){console.error(`APP FUTBOL: error cargando ${tipo}`,e);if(el)el.innerHTML=`<div class="card" style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:28px"><i class="ph-bold ph-warning-circle" style="font-size:30px;color:var(--primary-green)"></i><h3 style="margin-top:8px">No pudimos cargar ${tipo}</h3><p style="font-size:.74rem;margin-top:4px">Revisa tu conexión y vuelve a intentarlo.</p><button type="button" class="btn btn-outline" style="width:auto;margin:14px auto 0" onclick="location.reload()">Reintentar</button></div>`}
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
if(esInicio()){
 const contenedor=document.getElementById('lista-canchas'),inputBusqueda=document.getElementById('filtro-busqueda'),filtroCiudad=document.getElementById('filtro-ciudad'),filtroTipo=document.getElementById('filtro-tipo'),filtroPrecio=document.getElementById('filtro-precio'),filtroOrden=document.getElementById('filtro-orden'),contador=document.getElementById('contador-canchas'),filtroActivo=document.getElementById('filtro-activo');let soloAbiertas=false,soloCerca=false,soloTop=false;
 function llenarSelect(select,valores,placeholder){if(!select)return;const actual=select.value;select.innerHTML=`<option value="">${placeholder}</option>`;[...new Set(valores.map(v=>String(v).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;select.appendChild(o)});if([...select.options].some(o=>o.value===actual))select.value=actual}
 function renderizarCanchas(){if(!contenedor)return;const texto=normalizar(inputBusqueda?.value),ciudad=normalizar(filtroCiudad?.value),tipo=normalizar(filtroTipo?.value),rango=filtroPrecio?.value||'',orden=filtroOrden?.value||'recomendadas';let resultados=canchasGlobales.filter(c=>{const buscable=normalizar(`${c.nombre} ${c.ubicacionTexto||''} ${obtenerCiudad(c)} ${obtenerTipo(c)}`),precio=precioNumero(c);let rp=true;if(rango){const[min,max]=rango.split('-').map(Number);rp=precio>=min&&precio<=max}return(!texto||buscable.includes(texto))&&(!ciudad||normalizar(obtenerCiudad(c))===ciudad)&&(!tipo||normalizar(obtenerTipo(c))===tipo)&&rp&&(!soloAbiertas||c.isOpen)&&(!soloTop||c.rating>=4.5)&&(!soloCerca||distanciaCerca(c)<=10)});resultados.sort((a,b)=>orden==='rating'?b.rating-a.rating:orden==='precio-asc'?precioNumero(a)-precioNumero(b):orden==='precio-desc'?precioNumero(b)-precioNumero(a):orden==='cerca'?distanciaCerca(a)-distanciaCerca(b):a.isOpen!==b.isOpen?(a.isOpen?-1:1):b.rating-a.rating);if(contador)contador.textContent=`${resultados.length} ${resultados.length===1?'cancha encontrada':'canchas encontradas'}`;if(filtroActivo){const a=[];if(ciudad)a.push(filtroCiudad.value);if(tipo)a.push(filtroTipo.value);if(rango)a.push(filtroPrecio.options[filtroPrecio.selectedIndex].text);if(soloAbiertas)a.push('Abiertas ahora');if(soloTop)a.push('4.5+ estrellas');if(soloCerca)a.push(ubicacionUsuario?'Cerca de mí':'Cerca de mí*');filtroActivo.textContent=a.length?a.join(' · '):''}contenedor.innerHTML='';if(!resultados.length){contenedor.innerHTML='<div class="card empty-results" style="grid-column:1/-1;text-align:center"><i class="ph ph-magnifying-glass" style="font-size:34px;color:var(--primary-green)"></i><h3>No encontramos esa cancha</h3><p>Prueba quitando algún filtro o buscando otra zona.</p><button type="button" class="btn btn-outline" style="width:auto;margin:15px auto 0" id="btn-reset-empty">Limpiar filtros</button></div>';document.getElementById('btn-reset-empty')?.addEventListener('click',limpiarFiltros);return}resultados.forEach(c=>{const estado=c.isOpen?'<span class="badge-estado badge-abierto"><i class="ph-fill ph-circle"></i> Abierto ahora</span>':'<span class="badge-estado badge-cerrado"><i class="ph-fill ph-circle"></i> Cerrado</span>',logo=c.logo||'https://via.placeholder.com/100',portada=c.fotos?.length?c.fotos[0]:'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=1000&q=85',d=distanciaCerca(c),dist=Number.isFinite(d)&&d<999999?` · ${d.toFixed(1)} km`:'';contenedor.innerHTML+=`<article class="card court-card"><div class="court-cover" style="background-image:url('${portada}')"><div class="court-status">${estado}</div><div class="court-cover-gradient"></div></div><div class="court-body"><img src="${logo}" alt="Logo de ${c.nombre||'cancha'}" loading="lazy" class="court-logo"><div class="court-content"><div class="court-title-line"><h3>${c.nombre||'Cancha sin nombre'}</h3><span class="court-rating"><i class="ph-fill ph-star"></i> ${c.rating>0?c.rating.toFixed(1):'Nuevo'}</span></div><p class="court-location"><i class="ph-bold ph-map-pin"></i> ${c.ubicacionTexto||'Ubicación no especificada'}${obtenerCiudad(c)?` · ${obtenerCiudad(c)}`:''}${dist}</p><div class="court-meta"><span><i class="ph-bold ph-soccer-ball"></i> ${obtenerTipo(c)||'Fútbol'}</span><strong>S/ ${c.precio??'Consultar'} <small>/ hr</small></strong></div><button class="court-action" data-court-id="${c.id}"><span>Ver cancha y reservar</span><i class="ph-bold ph-arrow-right"></i></button></div></div></article>`});contenedor.querySelectorAll('[data-court-id]').forEach(b=>b.addEventListener('click',()=>abrirModal(b.dataset.courtId)))}
 function limpiarFiltros(){if(inputBusqueda)inputBusqueda.value='';if(filtroCiudad)filtroCiudad.value='';if(filtroTipo)filtroTipo.value='';if(filtroPrecio)filtroPrecio.value='';if(filtroOrden)filtroOrden.value='recomendadas';soloAbiertas=soloCerca=soloTop=false;document.querySelectorAll('.quick-filter').forEach(b=>b.classList.remove('active'));renderizarCanchas()}
 async function cargar(){
     if(!contenedor)return;
     contenedor.innerHTML='<div class="card loading-card" style="grid-column:1/-1;text-align:center;color:var(--text-muted)"><i class="ph-bold ph-spinner-gap"></i> Buscando canchas...</div>';
     try{
         const s=await Promise.race([getDocs(collection(db,'canchas')),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Firestore tardó más de 12 segundos en responder')),12000))]);
         canchasGlobales=[];
         s.forEach(ds=>{
             const d=ds.data();
             // FASE 10: SOLO mostrar canchas con estado 'published' (o las antiguas para no romper retrocompatibilidad durante las pruebas)
             if(d.estadoPublicacion === 'published' || (d.configurado === true && !d.estadoPublicacion)) {
                 canchasGlobales.push({
                     id:ds.id,
                     nombre: d.nombre,
                     ubicacionTexto: d.ubicacionTexto,
                     ciudad: d.ciudad,
                     distrito: d.distrito,
                     departamento: d.departamento,
                     tipoCancha: d.tipoCancha,
                     precio: d.precio,
                     fotos: d.fotos,
                     logo: d.logo,
                     horaApertura: d.horaApertura,
                     horaCierre: d.horaCierre,
                     lat: d.lat,
                     lng: d.lng,
                     whatsapp: d.whatsapp,
                     ubicacionLink: d.ubicacionLink,
                     descripcion: d.descripcion,
                     intervaloMinutos: d.intervaloMinutos,
                     isOpen:canchaEstaAbierta(d),
                     rating:Number(d.ratingPromedio||d.rating||0)
                 });
             }
         });
         llenarSelect(filtroCiudad,canchasGlobales.map(obtenerCiudad),'Todas las ciudades');
         llenarSelect(filtroTipo,canchasGlobales.map(obtenerTipo),'Todos los tipos');
         renderizarCanchas();
     }catch(e){
         mostrarErrorCarga(contenedor,'las canchas',e);
     }
 }
 [inputBusqueda,filtroCiudad,filtroTipo,filtroPrecio,filtroOrden].forEach(e=>e?.addEventListener('input',renderizarCanchas));document.querySelectorAll('.quick-filter').forEach(b=>b.addEventListener('click',()=>{const f=b.dataset.filter;if(f==='limpiar')return limpiarFiltros();if(f==='abiertas')soloAbiertas=!soloAbiertas;if(f==='cerca'){if(!navigator.geolocation)return alert('Tu navegador no permite geolocalización.');navigator.geolocation.getCurrentPosition(p=>{ubicacionUsuario={lat:p.coords.latitude,lng:p.coords.longitude};soloCerca=true;b.classList.add('active');renderizarCanchas()},()=>alert('Activa la ubicación para encontrar canchas cercanas.'));return}if(f==='top')soloTop=!soloTop;b.classList.toggle('active');renderizarCanchas()}));cargar()
}
window.abrirModal=async id=>{const c=canchasGlobales.find(x=>x.id===id);if(!c)return;document.getElementById('modal-nombre').innerText=c.nombre;document.getElementById('modal-logo').src=c.logo||'https://via.placeholder.com/100';document.getElementById('modal-imagen-principal').src=c.fotos?.length?c.fotos[0]:'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=1000&q=85';document.getElementById('modal-precio').innerText=c.precio??'Consultar';document.getElementById('modal-rating').innerText=c.rating>0?c.rating.toFixed(1):'Nuevo';document.getElementById('modal-horario').innerText=`${c.horaApertura||'??:??'} a ${c.horaCierre||'??:??'}`;document.getElementById('modal-descripcion').innerText=c.descripcion||'Sin descripción disponible.';document.getElementById('modal-link-maps').href=c.ubicacionLink||'#';const tel=String(c.whatsapp||'').replace(/\D/g,'');document.getElementById('btn-whatsapp-reserva').href=tel?`https://wa.me/${tel}?text=${encodeURIComponent(`Hola ${c.nombre}, vengo de APP FUTBOL y quiero consultar disponibilidad para reservar.`)}`:'#';document.getElementById('btn-ver-resenas').href=`cancha.html?id=${c.id}`;await pintarDisponibilidadModal(c);document.getElementById('modal-cancha').classList.add('mostrar');document.body.style.overflow='hidden'};
async function obtenerReservasHoy(){try{const snap=await getDocs(collection(db,'reservas'));return snap.docs.map(d=>({id:d.id,...d.data()}))}catch(e){console.warn('APP FUTBOL reservas:',e);return[]}}
async function pintarDisponibilidadModal(c, fechaElegida){
    const box = document.getElementById('modal-disponibilidad');
    if(!box) return;
    const fReq = fechaElegida || fechaHoy();
    
    box.innerHTML = '<div class="availability-loading" style="text-align:center; padding:20px; color:var(--text-muted);"><i class="ph-bold ph-spinner-gap ph-spin"></i> Consultando horarios...</div>';
    
    try {
        const q = query(collection(db, 'reservas'), where('canchaId', '==', c.id), where('fecha', '==', fReq));
        const snap = await getDocs(q);
        const reservas = snap.docs.map(d => d.data());
        
        const slots = slotsDeCancha(c, reservas, fReq);
        const libres = slots.filter(s => !s.blocked).length;
        
        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:rgba(255,255,255,0.03); padding:10px 15px; border-radius:10px; border:1px solid var(--border-color);">
                <label style="display:flex; flex-direction:column; font-size:0.8rem; color:var(--text-muted); font-weight:bold; letter-spacing:0.05em;">
                    FECHA DE RESERVA
                    <input type="date" id="input-fecha-modal" value="${fReq}" min="${fechaHoy()}" style="background:transparent; border:none; color:#fff; font-size:1.1rem; font-weight:bold; outline:none; margin-top:4px; font-family:inherit; color-scheme:dark; cursor:pointer;">
                </label>
                <div style="text-align:right;">
                    <span style="font-size:0.75rem; color:var(--text-muted); display:block; font-weight:bold; letter-spacing:0.05em;">DISPONIBLES</span>
                    <strong style="font-size:1.3rem; color:var(--primary-green);">${libres}</strong>
                </div>
            </div>
            <div class="modal-slots">${slots.length ? slots.map(s=>`<button type="button" class="modal-slot ${s.blocked?'blocked':''}" data-book-court="${c.id}" data-book-time="${s.label}" data-book-date="${fReq}" ${s.blocked?'disabled':''}>${s.label}</button>`).join('') : '<span class="availability-empty">El dueño aún no configuró sus horarios.</span>'}</div>
        `;
        
        // Listener para recargar cuando el jugador cambia la fecha
        document.getElementById('input-fecha-modal').addEventListener('change', (e) => {
            pintarDisponibilidadModal(c, e.target.value);
        });

        box.querySelectorAll('.modal-slot:not(.blocked)').forEach(b=>b.addEventListener('click',()=>abrirReserva(c, b.dataset.bookTime, b.dataset.bookDate)));
    } catch (e) {
        console.error(e);
        box.innerHTML='<span class="availability-empty">Error cargando horarios.</span>';
    }
}
function abrirReserva(c, hora, fechaElegida){
    const modal = document.getElementById('modal-reserva');
    if(!modal) return;
    
    document.getElementById('booking-cancha-nombre').textContent = c.nombre;
    const dateObj = new Date(`${fechaElegida}T12:00:00`);
    const fechaTexto = new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'short'}).format(dateObj).toUpperCase();
    
    document.getElementById('booking-hora').textContent = `${fechaTexto} · ${hora}`;
    document.getElementById('booking-nombre').value = usuarioActual?.displayName ? formatearNombre(usuarioActual.displayName) : '';
    document.getElementById('booking-status').textContent = '';
    
    modal.dataset.courtId = c.id;
    modal.dataset.time = hora;
    modal.dataset.date = fechaElegida; // ¡Guardamos la fecha elegida!
    
    modal.classList.add('mostrar');
    modal.setAttribute('aria-hidden','false');
}
async function confirmarReserva(){
    const modal = document.getElementById('modal-reserva');
    const id = modal?.dataset.courtId, hora = modal?.dataset.time, fechaReq = modal?.dataset.date;
    const nombre = document.getElementById('booking-nombre')?.value.trim(), telefono = document.getElementById('booking-telefono')?.value.trim(), status = document.getElementById('booking-status'), btn = document.getElementById('btn-confirmar-reserva');
    
    if(!id || !hora || !fechaReq || !nombre || !telefono){ status.textContent='Completa tu nombre y teléfono para continuar.'; status.className='booking-status error'; return; }
    
    if(!usuarioActual){
        status.textContent='Necesitas iniciar sesión con Google para reservar.'; status.className='booking-status error';
        try{
            const result = await signInWithPopup(auth, new GoogleAuthProvider());
            const user = result.user;
            const userRef = doc(db, 'usuarios', user.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) await setDoc(userRef, { uid: user.uid, rol: 'player', estado: 'active', nombre: user.displayName || 'Jugador', email: user.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            usuarioActual = user;
        }catch(e){return;}
    }
    
    const c = canchasGlobales.find(x=>x.id===id);
    btn.disabled = true; status.textContent='Confirmando horario…'; status.className='booking-status';
    
    const key = `${id}_${fechaReq}_${hora.replace(':','')}`;
    try {
        await runTransaction(db, async tx => {
            const ref = doc(db,'reservas',key), existing = await tx.get(ref);
            if(existing.exists() && !['cancelada','cancelado','cancelled'].includes(normalizar(existing.data().estado))) throw new Error('SLOT_OCUPADO');
            tx.set(ref,{ id: key, canchaId: id, canchaNombre: c?.nombre||'', usuarioUid: usuarioActual.uid, usuarioNombre: nombre, usuarioEmail: usuarioActual.email||'', usuarioTelefono: telefono, fecha: fechaReq, horaInicio: hora, horaFin: hora, estado: 'pendiente', precio: Number(c?.precio||0), metodoPago: 'pendiente', senaPagada: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        });
        status.textContent='¡Reserva registrada! La cancha ya quedó bloqueada.'; status.className='booking-status success';
        await pintarDisponibilidadModal(c, fechaReq);
        setTimeout(()=>{cerrarReserva(); cerrarModal();}, 1100);
    } catch(e) {
        status.textContent = e.message==='SLOT_OCUPADO'?'Ese horario acaba de ser reservado por otra persona. Elige otro.':'No pudimos registrar la reserva. Intenta nuevamente.';
        status.className='booking-status error';
    } finally {
        btn.disabled = false;
    }
}
function formatearNombre(n){if(!n)return'Jugador';const p=n.trim().split(/\s+/);return p.length>1?`${p[0]} ${p[1].charAt(0)}.`:p[0]}
const btnCerrar=document.getElementById('cerrar-modal'),modalCancha=document.getElementById('modal-cancha');if(btnCerrar)btnCerrar.addEventListener('click',cerrarModal);if(modalCancha)modalCancha.addEventListener('click',e=>{if(e.target===modalCancha)cerrarModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape'){cerrarModal();cerrarReserva()}});function cerrarModal(){if(!modalCancha)return;modalCancha.classList.remove('mostrar');document.body.style.overflow=''}
function cerrarReserva(){const m=document.getElementById('modal-reserva');if(m){m.classList.remove('mostrar');m.setAttribute('aria-hidden','true')}}
const cr=document.getElementById('cerrar-reserva');cr?.addEventListener('click',cerrarReserva);document.getElementById('modal-reserva')?.addEventListener('click',e=>{if(e.target.id==='modal-reserva')cerrarReserva()});document.getElementById('btn-confirmar-reserva')?.addEventListener('click',confirmarReserva);onAuthStateChanged(auth,u=>{usuarioActual=u||null});
if(window.location.pathname.includes('jugadores.html')){const provider=new GoogleAuthProvider(),btnLogin=document.getElementById('btn-login-google'),form=document.getElementById('form-anuncio'),lista=document.getElementById('lista-jugadores'),hint=document.getElementById('login-hint');let usuario=null;const groserias=['mierda','puta','puto','pendejo','pendeja','cabron','cabrón','carajo','joder','cojudo','conchatumare','ctm','imbecil','imbécil','idiota','perra','estupido','estúpido','asco'];const tieneGroserias=t=>groserias.some(x=>normalizar(t).includes(normalizar(x)));onAuthStateChanged(auth,u=>{usuario=u||null;if(btnLogin)btnLogin.style.display=u?'none':'flex';if(form)form.style.display=u?'flex':'none';if(hint)hint.style.display=u?'none':'block'});if(btnLogin)btnLogin.addEventListener('click',async()=>{try{await signInWithPopup(auth,provider)}catch(e){alert('No se pudo iniciar sesión: '+e.message)}});if(form)form.addEventListener('submit',async e=>{e.preventDefault();const t=document.getElementById('texto-anuncio').value.trim(),tipo=document.getElementById('tipo-anuncio')?.value||'jugador',modalidad=document.getElementById('modalidad-anuncio')?.value||'Fútbol 7';if(!usuario)return alert('Debes iniciar sesión con Google.');if(!t)return;if(tieneGroserias(t))return alert('Lenguaje inapropiado detectado. Mantengamos el respeto.');try{await addDoc(collection(db,'bolsa_jugadores'),{nombre:formatearNombre(usuario.displayName),texto:t,tipo,modalidad,uid:usuario.uid,fecha:serverTimestamp(),expiraEn:Date.now()+86400000});document.getElementById('texto-anuncio').value=''}catch(e){console.error(e);alert('No se pudo publicar. Intenta nuevamente.')}});const q=query(collection(db,'bolsa_jugadores'),orderBy('fecha','desc'));onSnapshot(q,s=>{if(!lista)return;lista.innerHTML='';const ahora=Date.now(),docs=[];s.forEach(ds=>{const d=ds.data();if(d.expiraEn&&d.expiraEn<ahora){if(usuario&&d.uid===usuario.uid)deleteDoc(doc(db,'bolsa_jugadores',ds.id));return}docs.push({id:ds.id,...d})});if(!docs.length){lista.innerHTML='<div class="card" style="text-align:center;color:var(--text-muted);grid-column:1/-1"><i class="ph ph-users-three" style="font-size:30px;color:var(--primary-green)"></i><p style="margin-top:7px">No hay partidos abiertos todavía. Sé el primero.</p></div>';return}docs.forEach(d=>{const borrar=usuario&&d.uid===usuario.uid?`<button class="btn btn-danger btn-borrar" data-id="${d.id}"><i class="ph-bold ph-trash"></i> Borrar</button>`:'';lista.innerHTML+=`<article class="card player-post"><div class="player-post-head"><strong><i class="ph-fill ph-user-circle"></i> ${d.nombre||'Jugador'}</strong>${borrar}</div><p>${d.texto||''}</p><small>${d.tipo||'jugador'} · ${d.modalidad||'Fútbol 7'}</small></article>`});lista.querySelectorAll('.btn-borrar').forEach(b=>b.addEventListener('click',async()=>{if(confirm('¿Borrar tu anuncio?'))await deleteDoc(doc(db,'bolsa_jugadores',b.dataset.id))}))},e=>console.error('APP FUTBOL bolsa:',e))}

// ==========================================
// FASE 26: BOLSA DE JUGADORES SEGURA
// ==========================================
const formBolsa = document.getElementById('form-bolsa-jugadores');
if (formBolsa) {
    formBolsa.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. Verificación de Autenticación
        if (!usuarioActual) {
            alert('Debes iniciar sesión con Google para publicar un anuncio.');
            try {
                const { GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
                await signInWithPopup(auth, new GoogleAuthProvider());
                // La página recargará o el estado cambiará
            } catch (err) {
                return;
            }
            return;
        }

        const btn = document.getElementById('btn-publicar-anuncio');
        if(btn) { btn.disabled = true; btn.innerHTML = 'Publicando...'; }

        try {
            // 2. Guardado Seguro Atado al UID del jugador
            await addDoc(collection(db, 'bolsa_jugadores'), {
                uid: usuarioActual.uid, // Validado por reglas de Firestore
                nombreJugador: usuarioActual.displayName || 'Jugador',
                tipo: document.getElementById('bolsa-tipo').value,
                posicion: document.getElementById('bolsa-posicion').value,
                nivel: document.getElementById('bolsa-nivel').value,
                distrito: document.getElementById('bolsa-distrito').value.trim(),
                contacto: document.getElementById('bolsa-contacto').value.trim(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            alert('¡Anuncio publicado con éxito!');
            formBolsa.reset();
            cargarAnunciosBolsa(); // Si tienes una función que renderice la lista, llámala aquí
        } catch (error) {
            console.error('Error al publicar anuncio:', error);
            alert('Hubo un error al publicar tu anuncio. Revisa los permisos.');
        } finally {
            if(btn) { btn.disabled = false; btn.innerHTML = 'Publicar Anuncio'; }
        }
    });
}

// Lógica para borrar un anuncio propio
window.borrarAnuncioPropio = async function(anuncioId, anuncioUid) {
    if (!usuarioActual || usuarioActual.uid !== anuncioUid) {
        alert('Solo puedes borrar tus propios anuncios.');
        return;
    }
    if (!confirm('¿Estás seguro de borrar este anuncio?')) return;

    try {
        await deleteDoc(doc(db, 'bolsa_jugadores', anuncioId));
        alert('Anuncio eliminado.');
        cargarAnunciosBolsa();
    } catch (e) {
        console.error(e);
        alert('No se pudo eliminar el anuncio.');
    }
};
// ==========================================
// FASE 27: VISUALIZACIÓN PÚBLICA DE EVENTOS
// ==========================================
async function cargarEventosPublicos() {
    const contenedorEventos = document.getElementById('lista-eventos-publicos');
    // Solo se ejecuta si estamos en una página que tiene el contenedor de eventos
    if (!contenedorEventos) return; 

    contenedorEventos.innerHTML = '<div style="text-align:center; padding:20px;"><i class="ph-bold ph-spinner-gap ph-spin"></i> Cargando eventos...</div>';

    try {
        // Consultamos eventos programados
        const q = query(collection(db, 'eventos'), where('estado', '==', 'programado'));
        const snap = await getDocs(q);
        
        let eventos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Filtramos eventos que ya pasaron
        const ahora = new Date();
        eventos = eventos.filter(e => new Date(e.fin) >= ahora);
        
        // Ordenamos por fecha de inicio más cercana
        eventos.sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

        if (eventos.length === 0) {
            contenedorEventos.innerHTML = `
                <div class="empty-state" style="text-align:center; padding: 30px; background: rgba(255,255,255,0.02); border-radius:15px;">
                    <i class="ph-fill ph-trophy" style="font-size:40px; color:var(--text-muted); margin-bottom:15px;"></i>
                    <h4>No hay campeonatos próximos</h4>
                    <p style="color:var(--text-muted); font-size:0.9rem;">Pronto las canchas publicarán nuevos eventos aquí.</p>
                </div>
            `;
            return;
        }

        contenedorEventos.innerHTML = eventos.map(e => {
            const fechaInicio = new Date(e.inicio).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
            return `
            <article class="evento-publico-card" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:15px; margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <span style="background:var(--primary-green); color:#000; font-size:0.7rem; font-weight:bold; padding:3px 8px; border-radius:4px; margin-bottom:8px; display:inline-block;">TORNEO / EVENTO</span>
                        <h3 style="margin:0 0 5px; font-size:1.1rem;">${e.nombre}</h3>
                        <p style="margin:0; color:var(--text-muted); font-size:0.85rem;"><i class="ph-bold ph-calendar"></i> Inicia: ${fechaInicio}</p>
                    </div>
                </div>
                ${e.nota ? `<p style="margin-top:12px; font-size:0.9rem; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">${e.nota}</p>` : ''}
            </article>
            `;
        }).join('');

    } catch (error) {
        console.error("Error cargando eventos:", error);
        contenedorEventos.innerHTML = '<p style="color:var(--danger);">Error al cargar los eventos.</p>';
    }
}

// Llamar a la función al cargar la página (si existe el contenedor)
document.addEventListener('DOMContentLoaded', () => {
    cargarEventosPublicos();
});
// ==========================================
// FASE 29: LÓGICA PARA LA PÁGINA DE RESEÑAS (cancha.html)
// ==========================================
if (window.location.pathname.includes('cancha.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const canchaId = urlParams.get('id');
    
    async function cargarDetalleCancha() {
        if (!canchaId) return document.getElementById('court-info').innerHTML = '<h2>Cancha no encontrada</h2>';
        
        try {
            // 1. Cargar info de la cancha
            const docSnap = await getDoc(doc(db, 'canchas', canchaId));
            if (!docSnap.exists()) return document.getElementById('court-info').innerHTML = '<h2>Cancha no encontrada</h2>';
            const c = docSnap.data();
            
            const logoEl = document.getElementById('court-logo');
            if (logoEl) logoEl.src = c.logo || 'https://via.placeholder.com/100';
            const titleEl = document.getElementById('court-title');
            if (titleEl) titleEl.textContent = c.nombre || 'Cancha';
            const metaEl = document.getElementById('court-meta');
            if (metaEl) metaEl.innerHTML = `<i class="ph-bold ph-map-pin"></i> ${c.ubicacionTexto || c.distrito || 'Ubicación'} · <i class="ph-bold ph-soccer-ball"></i> ${c.tipoCancha || 'Fútbol'}`;
            
            // 2. Cargar Reseñas
            const q = query(collection(db, 'resenas'), where('canchaId', '==', canchaId));
            const resenasSnap = await getDocs(q);
            let resenas = resenasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Promedio
            const total = resenas.length;
            const prom = total > 0 ? (resenas.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1) : "0.0";
            
            const ratingEl = document.getElementById('court-rating');
            if (ratingEl) ratingEl.innerHTML = `<strong>${prom}</strong><span>de 5 (${total} reseñas)</span>`;
            
            // 3. Renderizado y Filtros
            window.resenasGlobales = resenas;
            renderizarResenas(resenas);
            
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    const star = e.target.dataset.star;
                    if (star === 'all') renderizarResenas(window.resenasGlobales);
                    else renderizarResenas(window.resenasGlobales.filter(r => String(r.rating) === String(star)));
                });
            });
            
        } catch (e) {
            console.error(e);
            document.getElementById('reviews-list').innerHTML = '<p style="color:var(--danger)">Hubo un error al cargar la información.</p>';
        }
    }
    
    function renderizarResenas(lista) {
        const listEl = document.getElementById('reviews-list');
        if (!listEl) return;
        
        if (lista.length === 0) {
            listEl.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); background:rgba(255,255,255,0.02); border-radius:12px; border:1px dashed var(--border-color);">Aún no hay reseñas en esta categoría.</div>';
            return;
        }
        
        // Ordenar más recientes primero
        lista.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        
        listEl.innerHTML = lista.map(r => {
            const estrellas = Array.from({length: 5}, (_, i) => `<i class="ph-fill ph-star" style="color: ${i < r.rating ? 'var(--warning)' : '#333'}"></i>`).join('');
            const fechaTexto = r.createdAt ? new Date(r.createdAt.toDate()).toLocaleDateString('es-PE') : 'Reciente';
            
            return `
            <article class="review-card" style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:20px; border-radius:12px; margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <div style="width:35px; height:35px; background:var(--primary-green); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#000; font-weight:bold;">
                            ${r.nombre ? r.nombre.charAt(0).toUpperCase() : 'J'}
                        </div>
                        <div>
                            <strong style="display:block;">${r.nombre || 'Jugador'}</strong>
                            <small style="color:var(--text-muted);">${fechaTexto}</small>
                        </div>
                    </div>
                    <div style="display:flex; gap:2px; font-size:1.1rem;">${estrellas}</div>
                </div>
                ${r.comentario ? `<p style="margin-top:10px; color:#ddd; line-height:1.5;">${r.comentario}</p>` : '<p style="margin-top:10px; color:var(--text-muted); font-style:italic;">Sin comentario escrito.</p>'}
            </article>
            `;
        }).join('');
    }
    
    document.addEventListener('DOMContentLoaded', cargarDetalleCancha);
}
