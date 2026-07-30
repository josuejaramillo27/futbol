import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig={apiKey:"AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",authDomain:"app-futbol-acd0f.firebaseapp.com",projectId:"app-futbol-acd0f",storageBucket:"app-futbol-acd0f.firebasestorage.app",messagingSenderId:"223446110165",appId:"1:223446110165:web:219afce6a9dac03203f75c"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),storage=getStorage(app);
let usuarioActual=null,canchaActual=null,reservasHoy=[];
const fechaHoy=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const minutos=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null};
const normalizar=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const money=n=>`S/ ${Number(n||0).toFixed(2)}`;
const toast=(msg,error=false)=>{const el=document.getElementById('toast-admin');if(!el)return;el.textContent=msg;el.className=`admin-toast show ${error?'error':''}`;clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.className='admin-toast',2800)};
const horaActual=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()};

async function cargarPerfil(){
 const snap=await getDoc(doc(db,'canchas',usuarioActual.uid));
 if(!snap.exists()){toast('No encontramos tu cancha. Configúrala primero.',true);return false}
 canchaActual={id:snap.id,...snap.data()};
 const campos={'admin-nombre':canchaActual.nombre,'admin-ciudad':canchaActual.ciudad,'admin-departamento':canchaActual.departamento,'admin-tipo':canchaActual.tipoCancha,'admin-whatsapp':canchaActual.whatsapp,'admin-descripcion':canchaActual.descripcion,'admin-precio':canchaActual.precio,'admin-ubicacion-texto':canchaActual.ubicacionTexto,'admin-ubicacion-link':canchaActual.ubicacionLink,'admin-apertura':canchaActual.horaApertura,'admin-cierre':canchaActual.horaCierre};
 Object.entries(campos).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v??''});
 document.getElementById('nombre-cancha-admin').textContent=canchaActual.nombre?`${canchaActual.nombre} · Panel`:'Mi Cancha';
 return true;
}

async function cargarReservas(){
 const q=query(collection(db,'reservas'),where('canchaId','==',usuarioActual.uid),where('fecha','==',fechaHoy()));
 const snap=await getDocs(q);reservasHoy=snap.docs.map(d=>({id:d.id,...d.data()}));
}

function generarSlots(){
 const a=minutos(canchaActual?.horaApertura),b0=minutos(canchaActual?.horaCierre),step=Number(canchaActual?.intervaloMinutos||canchaActual?.duracionReserva||60);
 if(a===null||b0===null||!Number.isFinite(step)||step<=0)return[];
 let b=b0<=a?b0+1440:b0;const out=[];
 for(let t=a;t<b;t+=step){const real=t%1440;out.push({hora:`${String(Math.floor(real/60)).padStart(2,'0')}:${String(real%60).padStart(2,'0')}`,min:real})}
 return out;
}
function reservaPara(hora){return reservasHoy.find(r=>r.horaInicio===hora&&!['cancelada','cancelado','cancelled'].includes(normalizar(r.estado)))}
function esBloqueoManual(r){return r?.tipo==='bloqueo_manual'||r?.estado==='bloqueada'}

function renderSchedule(){
 const box=document.getElementById('admin-schedule');if(!box)return;const slots=generarSlots();
 if(!slots.length){box.innerHTML='<div class="admin-empty"><i class="ph-bold ph-clock"></i><b>Configura apertura y cierre</b><span>Guarda el horario de tu cancha para generar los turnos.</span></div>';actualizarKpis([]);return}
 box.innerHTML=slots.map(s=>{const r=reservaPara(s.hora),busy=!!r,past=s.min<horaActual(),manual=esBloqueoManual(r);let cls=busy?'occupied':'available';if(past&&!busy)cls+=' past';const label=busy?(manual?'Bloqueada':'Reservada'):'Disponible';return `<button type="button" class="admin-slot ${cls}" data-slot="${s.hora}" data-reserva="${r?.id||''}" title="${busy?(manual?'Clic para liberar':'Clic para gestionar y liberar'):'Clic para ocupar'}"><span class="slot-time">${s.hora}</span><span class="slot-status"><i class="ph-fill ph-circle"></i>${label}</span>${busy&&!manual?`<small>${r.nombre||'Cliente'}</small>`:''}</button>`}).join('');
 box.querySelectorAll('.admin-slot').forEach(b=>b.addEventListener('click',()=>gestionarSlot(b.dataset.slot,b.dataset.reserva)));
 actualizarKpis(slots);
}
function actualizarKpis(slots){
 const activos=reservasHoy.filter(r=>!['cancelada','cancelado','cancelled'].includes(normalizar(r.estado)));const manual=activos.filter(esBloqueoManual);const clientes=activos.filter(r=>!esBloqueoManual(r));
 document.getElementById('reservas-hoy').textContent=clientes.length;document.getElementById('reservas-count').textContent=clientes.length;document.getElementById('horas-libres').textContent=Math.max(0,slots.filter(s=>!reservaPara(s.hora)).length);
 const ingresos=clientes.reduce((sum,r)=>sum+Number(r.precio??canchaActual?.precio??0),0);document.getElementById('ingresos-hoy').textContent=money(ingresos);
}

async function gestionarSlot(hora,reservaId){
 const existente=reservaId?reservasHoy.find(r=>r.id===reservaId):null;
 if(existente){
   const manual=esBloqueoManual(existente);const pregunta=manual?`Liberar ${hora} para volver a recibir reservas?`:`La hora ${hora} está reservada por ${existente.nombre||'un cliente'}. ¿Quieres cancelarla y liberar el horario?`;
   if(!confirm(pregunta))return;
   try{await updateDoc(doc(db,'reservas',existente.id),{estado:'cancelada',canceladoPor:'dueno',canceladoEn:serverTimestamp()});toast('Horario liberado.');await refrescar();}catch(e){console.error(e);toast('No se pudo liberar el horario.',true)}
   return;
 }
 if(!confirm(`Ocupar ${hora} manualmente?\n\nLa hora quedará bloqueada y ningún jugador podrá reservarla.`))return;
 try{await addDoc(collection(db,'reservas'),{canchaId:usuarioActual.uid,canchaNombre:canchaActual.nombre||'',fecha:fechaHoy(),horaInicio:hora,horaFin:hora,estado:'bloqueada',tipo:'bloqueo_manual',nombre:'Bloqueo del dueño',uid:usuarioActual.uid,precio:0,creadoEn:serverTimestamp()});toast('Horario ocupado.');await refrescar()}catch(e){console.error(e);toast('No se pudo ocupar el horario.',true)}
}
async function refrescar(){await cargarReservas();renderSchedule();renderReservas()}
function renderReservas(){
 const box=document.getElementById('lista-reservas');const activos=reservasHoy.filter(r=>!['cancelada','cancelado','cancelled'].includes(normalizar(r.estado))&&!esBloqueoManual(r)).sort((a,b)=>String(a.horaInicio).localeCompare(String(b.horaInicio)));
 if(!activos.length){box.innerHTML='<div class="admin-empty compact"><i class="ph-bold ph-calendar-blank"></i><b>No tienes reservas de clientes hoy</b><span>Las reservas que lleguen desde la web aparecerán aquí.</span></div>';return}
 box.innerHTML=activos.map(r=>`<article class="reservation-row"><div class="reservation-time">${r.horaInicio||'--:--'}<small>${r.horaFin&&r.horaFin!==r.horaInicio?`hasta ${r.horaFin}`:'1 hora'}</small></div><div class="reservation-client"><b>${r.nombre||'Cliente'}</b><span>${r.telefono||'Sin teléfono'} · ${r.estado||'pendiente'}</span></div><div class="reservation-actions"><button class="icon-btn release-reservation" data-id="${r.id}" title="Liberar hora"><i class="ph-bold ph-lock-open"></i></button>${r.telefono?`<a class="icon-btn" href="https://wa.me/${String(r.telefono).replace(/\D/g,'')}" target="_blank" rel="noopener" title="WhatsApp"><i class="ph-bold ph-whatsapp-logo"></i></a>`:''}</div></article>`).join('');
 box.querySelectorAll('.release-reservation').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('¿Liberar esta reserva y cancelar el turno?'))return;try{await updateDoc(doc(db,'reservas',b.dataset.id),{estado:'cancelada',canceladoPor:'dueno',canceladoEn:serverTimestamp()});toast('Reserva cancelada y hora liberada.');await refrescar()}catch(e){toast('No se pudo cancelar.',true)}}));
}

async function subirImagen(archivo,ruta){if(!archivo)return null;const storageRef=ref(storage,ruta);await uploadBytes(storageRef,archivo);return await getDownloadURL(storageRef)}
const formPerfil=document.getElementById('form-perfil-cancha');
if(formPerfil)formPerfil.addEventListener('submit',async e=>{e.preventDefault();if(!usuarioActual||!canchaActual)return;const btn=document.getElementById('btn-guardar-admin');btn.disabled=true;btn.innerHTML='<i class="ph-bold ph-spinner-gap"></i> Guardando...';try{const uid=usuarioActual.uid,logo=document.getElementById('admin-logo').files[0],f1=document.getElementById('admin-foto1').files[0],f2=document.getElementById('admin-foto2').files[0],f3=document.getElementById('admin-foto3').files[0],actuales=canchaActual,fotos=actuales.fotos||[];const logoUrl=await subirImagen(logo,`canchas/${uid}/logo`)||actuales.logo;const urls=[await subirImagen(f1,`canchas/${uid}/foto1`)||fotos[0],await subirImagen(f2,`canchas/${uid}/foto2`)||fotos[1],await subirImagen(f3,`canchas/${uid}/foto3`)||fotos[2]].filter(Boolean);await setDoc(doc(db,'canchas',uid),{ownerUid:uid,nombre:document.getElementById('admin-nombre').value.trim(),ciudad:document.getElementById('admin-ciudad').value.trim(),departamento:document.getElementById('admin-departamento').value.trim(),tipoCancha:document.getElementById('admin-tipo').value,whatsapp:document.getElementById('admin-whatsapp').value.trim(),descripcion:document.getElementById('admin-descripcion').value.trim(),precio:Number(document.getElementById('admin-precio').value),ubicacionTexto:document.getElementById('admin-ubicacion-texto').value.trim(),ubicacionLink:document.getElementById('admin-ubicacion-link').value.trim(),horaApertura:document.getElementById('admin-apertura').value,horaCierre:document.getElementById('admin-cierre').value,logo:logoUrl||'',fotos:urls,configurado:true},{merge:true});canchaActual={...canchaActual,nombre:document.getElementById('admin-nombre').value.trim(),horaApertura:document.getElementById('admin-apertura').value,horaCierre:document.getElementById('admin-cierre').value,precio:Number(document.getElementById('admin-precio').value)};document.getElementById('mensaje-exito').classList.add('show');setTimeout(()=>document.getElementById('mensaje-exito').classList.remove('show'),3000);toast('Configuración guardada.');renderSchedule()}catch(err){console.error(err);toast('Error al guardar: '+err.message,true)}finally{btn.disabled=false;btn.innerHTML='<i class="ph-bold ph-floppy-disk"></i> Guardar configuración'}});

async function iniciar(user){usuarioActual=user;document.getElementById('admin-user-label').textContent=user.email||'';document.getElementById('fecha-hoy').textContent=new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long'}).format(new Date());try{const ok=await cargarPerfil();if(ok){await cargarReservas();renderSchedule();renderReservas()}}catch(e){console.error(e);toast('No se pudo cargar el panel.',true)}}
onAuthStateChanged(auth,user=>{if(!user){window.location.href='login.html';return}iniciar(user)});
document.getElementById('btn-cerrar-sesion')?.addEventListener('click',()=>signOut(auth));