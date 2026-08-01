import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { calcularDisponibilidad, fechaISO } from './availability.js';
let bloqueosDia = [];

const firebaseConfig={apiKey:"AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",authDomain:"app-futbol-acd0f.firebaseapp.com",projectId:"app-futbol-acd0f",storageBucket:"app-futbol-acd0f.firebasestorage.app",messagingSenderId:"223446110165",appId:"1:223446110165:web:219afce6a9dac03203f75c"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),storage=getStorage(app);
let usuarioActual=null,canchaActual=null,reservasDia=[],espacios=[],espacioSeleccionado=null;
let fechaSeleccionada=new Date();const dias=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];const fechaISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const fechaHoy=()=>fechaISO(new Date());const minutos=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null};const normalizar=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const money=n=>`S/ ${Number(n||0).toFixed(2)}`;const toast=(msg,error=false)=>{const el=document.getElementById('toast-admin');if(!el)return;el.textContent=msg;el.className=`admin-toast show ${error?'error':''}`;clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.className='admin-toast',2800)};const horaActual=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()};const fechaTexto=d=>new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long'}).format(d);const horarioDefault=()=>Object.fromEntries(dias.map((dia,i)=>[dia,{activo:i>0&&i<6,apertura:'16:00',cierre:'23:00'}]));

function horarioDelDia(){const nombre=dias[fechaSeleccionada.getDay()],semanal=espacioSeleccionado?.horariosSemana?.[nombre]||canchaActual?.horariosSemana?.[nombre];if(semanal)return semanal;return{activo:true,apertura:espacioSeleccionado?.horaApertura||canchaActual?.horaApertura||'16:00',cierre:espacioSeleccionado?.horaCierre||canchaActual?.horaCierre||'23:00'}}
function renderWeekDays(){const box=document.getElementById('week-days');if(!box)return;const base=new Date();base.setHours(0,0,0,0);box.innerHTML=Array.from({length:7},(_,i)=>{const d=new Date(base);d.setDate(base.getDate()+i);const active=fechaISO(d)===fechaISO(fechaSeleccionada);return `<button type="button" class="week-day ${active?'active':''}" data-date="${fechaISO(d)}"><small>${new Intl.DateTimeFormat('es-PE',{weekday:'short'}).format(d).replace('.','')}</small><strong>${d.getDate()}</strong><span>${i===0?'HOY':new Intl.DateTimeFormat('es-PE',{month:'short'}).format(d).replace('.','')}</span></button>`}).join('');box.querySelectorAll('.week-day').forEach(b=>b.addEventListener('click',()=>{const[y,m,day]=b.dataset.date.split('-').map(Number);fechaSeleccionada=new Date(y,m-1,day);fechaSeleccionada.setHours(0,0,0,0);renderWeekDays();actualizarDia()}))}
async function actualizarDia(){const texto=fechaTexto(fechaSeleccionada);document.getElementById('fecha-hoy').textContent=texto;document.getElementById('schedule-title').textContent=`Horarios · ${texto}`;document.getElementById('reservas-title').textContent=`Reservas · ${texto}`;const box=document.getElementById('admin-schedule'),list=document.getElementById('lista-reservas');if(box)box.innerHTML='<div class="admin-loading"><i class="ph-bold ph-spinner-gap"></i> Cargando horarios...</div>';if(list)list.innerHTML='<div class="admin-loading"><i class="ph-bold ph-spinner-gap"></i> Cargando reservas...</div>';try{await cargarReservas();renderSchedule();renderReservas()}catch(e){console.error(e);reservasDia=[];renderSchedule();renderReservas();toast('No pudimos leer las reservas. Mostramos los horarios disponibles.',true)}}
async function cargarPerfil(){
    const snap=await getDoc(doc(db,'canchas',usuarioActual.uid));
    if(!snap.exists()){
        toast('No encontramos tu cancha. Configúrala primero.',true);
        return false;
    }
    canchaActual={id:snap.id,...snap.data()};
    
    // FASE 9: Banner de Estado de Publicación
    let bannerEstado = document.getElementById('banner-publicacion');
    if(!bannerEstado) {
        bannerEstado = document.createElement('div');
        bannerEstado.id = 'banner-publicacion';
        bannerEstado.style.cssText = 'padding:15px; margin-bottom:20px; border-radius:12px; display:flex; justify-content:space-between; align-items:center;';
        document.querySelector('.admin-heading').insertAdjacentElement('afterend', bannerEstado);
    }

    const estadoPub = canchaActual.estadoPublicacion || 'draft';
    if(estadoPub === 'draft') {
        bannerEstado.style.background = 'rgba(255, 193, 7, 0.15)';
        bannerEstado.style.border = '1px solid var(--warning)';
        bannerEstado.innerHTML = `
            <div><strong style="color:var(--warning); display:block;">Cancha en Borrador (No visible)</strong>
            <span style="font-size:0.8rem; color:#ccc;">Termina de configurar tus datos y solicita la publicación.</span></div>
            <button id="btn-solicitar-pub" class="btn hero-primary" style="width:auto; padding:8px 15px;">Solicitar Revisión</button>
        `;
        document.getElementById('btn-solicitar-pub').onclick = async () => {
            if(!canchaActual.configurado) return toast('Guarda la configuración de tu cancha primero.', true);
            await updateDoc(doc(db, 'canchas', usuarioActual.uid), { estadoPublicacion: 'pending_review' });
            toast('Solicitud enviada a los administradores.');
            cargarPerfil(); // Recargar banner
        };
    } else if (estadoPub === 'pending_review') {
        bannerEstado.style.background = 'rgba(23, 162, 184, 0.15)';
        bannerEstado.style.border = '1px solid #17a2b8';
        bannerEstado.innerHTML = `
            <div><strong style="color:#17a2b8; display:block;">En Revisión</strong>
            <span style="font-size:0.8rem; color:#ccc;">Tu cancha está siendo evaluada por el equipo de APP FUTBOL.</span></div>
        `;
    } else if (estadoPub === 'published') {
        bannerEstado.style.background = 'rgba(0, 217, 104, 0.15)';
        bannerEstado.style.border = '1px solid var(--primary-green)';
        bannerEstado.innerHTML = `
            <div><strong style="color:var(--primary-green); display:block;">Cancha Publicada y Activa</strong>
            <span style="font-size:0.8rem; color:#ccc;">Tu negocio es visible para todos los jugadores.</span></div>
        `;
    }

    const campos={'admin-nombre':canchaActual.nombre,'admin-distrito':canchaActual.distrito??canchaActual.ciudad,'admin-departamento':canchaActual.departamento,'admin-whatsapp':canchaActual.whatsapp,'admin-descripcion':canchaActual.descripcion,'admin-precio':canchaActual.precio,'admin-ubicacion-texto':canchaActual.ubicacionTexto,'admin-ubicacion-link':canchaActual.ubicacionLink,'admin-intervalo':canchaActual.intervaloMinutos||canchaActual.duracionReserva||60};
    Object.entries(campos).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v??''});
    const tipos=Array.isArray(canchaActual.tiposCancha)?canchaActual.tiposCancha:(canchaActual.tipoCancha?[canchaActual.tipoCancha]:[]);
    document.querySelectorAll('#admin-tipos input[type=checkbox]').forEach(c=>c.checked=tipos.includes(c.value));
    renderWeeklyHours(canchaActual.horariosSemana||horarioDefault());
    document.getElementById('nombre-cancha-admin').textContent=canchaActual.nombre?`${canchaActual.nombre} · Panel`:'Mi Cancha';
    return true;
}
async function cargarEspacios(){const q=query(collection(db,'espacios'),where('ownerUid','==',usuarioActual.uid));const snap=await getDocs(q);espacios=snap.docs.map(d=>({id:d.id,...d.data()}));const todos=[{id:usuarioActual.uid,nombre:canchaActual.nombre||'Cancha principal',tipoCancha:(Array.isArray(canchaActual.tiposCancha)?canchaActual.tiposCancha[0]:canchaActual.tipoCancha)||'Sintética',horaApertura:canchaActual.horaApertura||'16:00',horaCierre:canchaActual.horaCierre||'23:00',horariosSemana:canchaActual.horariosSemana},...espacios.map(e=>({id:e.id,nombre:e.nombre,tipoCancha:e.tipo||'Fútbol',horaApertura:e.horaApertura||'16:00',horaCierre:e.horaCierre||'23:00',horariosSemana:canchaActual.horariosSemana}))];if(!espacioSeleccionado||!todos.find(x=>x.id===espacioSeleccionado.id)){espacioSeleccionado=todos[0]}let container=document.getElementById('dashboard-space-selector');if(!container){const header=document.querySelector('.schedule-head');if(header){container=document.createElement('div');container.id='dashboard-space-selector';container.className='space-selector';header.appendChild(container)}}if(container){container.innerHTML=`<label><span>CANCHA ACTIVA</span><select id="select-cancha-activa" style="margin-left:8px; padding:6px; border-radius:8px; background:#101614; color:#fff; border:1px solid #333;">${todos.map(s=>`<option value="${s.id}" ${s.id===espacioSeleccionado.id?'selected':''}>${s.nombre} · ${s.tipoCancha}</option>`).join('')}</select></label>`;document.getElementById('select-cancha-activa').addEventListener('change',(e)=>{espacioSeleccionado=todos.find(x=>x.id===e.target.value);actualizarDia()})}}
async function cargarReservas(){
    const idCancha = String(canchaActual?.id || usuarioActual.uid);
    const fISO = fechaISO(fechaSeleccionada);
    
    // FASE 50 PREP: Usar Querys en lugar de leer toda la base de datos
    const [snapReservas, snapBloqueos] = await Promise.all([
        getDocs(query(collection(db,'reservas'), where('canchaId', '==', idCancha), where('fecha', '==', fISO))),
        getDocs(query(collection(db,'bloqueos'), where('canchaId', '==', idCancha), where('fecha', '==', fISO)))
    ]);
    
    reservasDia = snapReservas.docs.map(d=>({id:d.id,...d.data()}));
    bloqueosDia = snapBloqueos.docs.map(d=>({id:d.id,...d.data()}));
}
function generarSlots(){const h=horarioDelDia();if(!h.activo)return[];const a=minutos(h.apertura),b0=minutos(h.cierre),step=Number(canchaActual?.intervaloMinutos||canchaActual?.duracionReserva||60);if(a===null||b0===null||!Number.isFinite(step)||step<=0)return[];let b=b0<=a?b0+1440:b0;const out=[];for(let t=a;t<b;t+=step){const real=t%1440;out.push({hora:`${String(Math.floor(real/60)).padStart(2,'0')}:${String(real%60).padStart(2,'0')}`,min:real})}return out}
function reservaPara(hora){return reservasDia.find(r=>r.horaInicio===hora&&!['cancelada','cancelado','cancelled'].includes(normalizar(r.estado)))}function esBloqueoManual(r){return r?.tipo==='bloqueo_manual'||r?.estado==='bloqueada'}
function estadoReserva(r){
    const st = normalizar(r?.estado||'pending');
    // Mapeo de retrocompatibilidad y estados permitidos
    if(['pendiente', 'pending'].includes(st)) return 'pending';
    if(['confirmada', 'confirmed'].includes(st)) return 'confirmed';
    if(['cancelada', 'cancelado', 'cancelled'].includes(st)) return 'cancelled';
    if(['completada', 'completed', 'jugada'].includes(st)) return 'completed';
    if(['rechazada', 'rejected'].includes(st)) return 'rejected';
    return 'pending';
}
function renderSchedule(){
    const box=document.getElementById('admin-schedule'); if(!box)return;
    const slots = calcularDisponibilidad(canchaActual, fechaSeleccionada, reservasDia, bloqueosDia);
    
    if(!slots.length){
        box.innerHTML='<div class="admin-empty"><i class="ph-bold ph-moon"></i><b>Cancha cerrada o sin horarios</b><span>Revisa tu configuración semanal.</span></div>';
        actualizarKpis([]);
        return;
    }
    
    box.innerHTML=slots.map(s => {
        let cls='available';
        if(s.estado === 'reservado') cls = 'occupied';
        if(s.estado === 'bloqueado') cls = 'occupied blocked';
        if(s.estado === 'pasado') cls += ' past';
        
        const label = s.estado === 'reservado' ? 'Reservada' : s.estado === 'bloqueado' ? 'Bloqueada' : s.estado === 'pasado' ? 'Pasado' : 'Disponible';
        
        return `<button type="button" class="admin-slot ${cls}" data-slot="${s.hora}" data-reserva="${s.reserva?.id||''}" data-bloqueo="${s.bloqueo?.id||''}" title="Clic para gestionar">
            <span class="slot-time">${s.hora}</span>
            <span class="slot-status"><i class="ph-fill ph-circle"></i>${label}</span>
            ${s.reserva ? `<small>${s.reserva.nombre||'Cliente'}</small>` : ''}
        </button>`;
    }).join('');
    
    box.querySelectorAll('.admin-slot').forEach(b=>b.addEventListener('click',()=>gestionarSlot(b.dataset.slot, b.dataset.reserva, b.dataset.bloqueo)));
    actualizarKpis(slots);
}
function actualizarKpis(slots){
    const clientes = reservasDia.filter(r => !['cancelled', 'rejected', 'cancelada', 'cancelado'].includes(estadoReserva(r)));
    document.getElementById('reservas-hoy').textContent = clientes.length;
    document.getElementById('reservas-count').textContent = clientes.length;
    document.getElementById('horas-libres').textContent = Math.max(0, slots.filter(s => s.estado === 'disponible').length);
    document.getElementById('ingresos-hoy').textContent = money(clientes.reduce((sum,r)=>sum+Number(r.precio??canchaActual?.precio??0),0));
}

async function gestionarSlot(hora, reservaId, bloqueoId){
    if(reservaId){
        const r = reservasDia.find(x=>x.id===reservaId);
        if(r) abrirGestionReserva(r);
        return;
    }
    
    if(bloqueoId){
        if(!confirm(`¿Liberar el horario de las ${hora} para volver a recibir reservas?`)) return;
        try{
            await deleteDoc(doc(db,'bloqueos',bloqueoId)); // FASE 17: Borramos el bloqueo de la colección correcta
            toast('Horario liberado.');
            await refrescar();
        }catch(e){toast('No se pudo liberar.',true);}
        return;
    }
    
    if(!confirm(`¿Bloquear manualmente las ${hora}?\nNadie podrá reservar este horario.`)) return;
    try{
        // FASE 17: Guardado en colección 'bloqueos'
        await addDoc(collection(db,'bloqueos'),{
            ownerUid: usuarioActual.uid,
            canchaId: canchaActual.id,
            fecha: fechaISO(fechaSeleccionada),
            horaInicio: hora,
            horaFin: hora,
            motivo: 'Bloqueo manual',
            createdAt: serverTimestamp()
        });
        toast('Horario bloqueado.');
        await refrescar();
    }catch(e){
        console.error(e);
        toast('No se pudo bloquear el horario.',true);
    }
}
function abrirGestionReserva(r){
    let m=document.getElementById('modal-gestion-reserva');
    if(!m){
        m=document.createElement('div');
        m.id='modal-gestion-reserva';
        m.className='admin-modal';
        m.innerHTML=`<div class="admin-modal-card reservation-manage-card">
            <button type="button" class="btn-cerrar admin-modal-close" data-close="modal-gestion-reserva"><i class="ph-bold ph-x"></i></button>
            <span class="mini-label">GESTIÓN DE RESERVA</span>
            <h2 id="manage-title">Reserva</h2>
            <div id="manage-summary" class="manage-summary" style="margin-bottom: 20px;"></div>
            <div class="manage-actions" id="manage-buttons" style="display:flex; flex-direction:column; gap:10px;">
                </div>
        </div>`;
        document.body.appendChild(m);
        m.querySelector('[data-close]').onclick=()=>m.classList.remove('mostrar');
    }
    window.__reservaGestion=r;
    const st = estadoReserva(r);
    
    m.querySelector('#manage-title').textContent=`${r.nombre||'Cliente'} · ${r.horaInicio||'--:--'}`;
    
    // Etiqueta de estado visual
    const statusLabels = {
        'pending': '<span style="color:#d7a938">Pendiente</span>',
        'confirmed': '<span style="color:var(--primary-green)">Confirmada</span>',
        'completed': '<span style="color:#a777e8">Completada (Jugada)</span>',
        'cancelled': '<span style="color:var(--text-muted)">Cancelada</span>',
        'rejected': '<span style="color:var(--danger)">Rechazada por la Cancha</span>'
    };

    m.querySelector('#manage-summary').innerHTML=`
        <div><span>Fecha:</span> <b>${fechaTexto(fechaSeleccionada)}</b></div>
        <div><span>WhatsApp:</span> <b>${r.telefono||'No indicado'}</b></div>
        <div><span>Importe:</span> <b>${money(r.precio??canchaActual?.precio)}</b></div>
        <div><span>Estado actual:</span> <b>${statusLabels[st]}</b></div>
    `;

    // Lógica de Máquina de Estados (Qué botones mostrar según el estado actual)
    const btnContainer = m.querySelector('#manage-buttons');
    btnContainer.innerHTML = '';
    
    // Botón de WhatsApp siempre disponible si hay teléfono
    if(r.telefono) {
        const phone = String(r.telefono).replace(/\D/g,'');
        btnContainer.innerHTML += `<a href="https://wa.me/${phone}?text=${encodeURIComponent(`Hola ${r.nombre}, te escribimos de ${canchaActual.nombre} sobre tu reserva de hoy a las ${r.horaInicio}.`)}" target="_blank" class="btn" style="background:#25D366; color:#000;"><i class="ph-bold ph-whatsapp-logo"></i> Chatear por WhatsApp</a>`;
    }

    if(st === 'pending') {
        btnContainer.innerHTML += `
            <button onclick="cambiarEstadoGestion('confirmed')" class="btn hero-primary"><i class="ph-bold ph-check-circle"></i> Aprobar Reserva</button>
            <button onclick="cambiarEstadoGestion('rejected')" class="btn" style="background:var(--danger);"><i class="ph-bold ph-x-circle"></i> Rechazar (Sin disponibilidad)</button>
        `;
    } else if(st === 'confirmed') {
        btnContainer.innerHTML += `
            <button onclick="cambiarEstadoGestion('completed')" class="btn" style="background:#a777e8;"><i class="ph-bold ph-flag-checkered"></i> Marcar como Partido Jugado</button>
            <button onclick="cambiarEstadoGestion('cancelled')" class="btn btn-outline" style="color:var(--danger); border-color:var(--danger);"><i class="ph-bold ph-x"></i> Cancelar Reserva</button>
        `;
    }

    m.classList.add('mostrar');
    m.setAttribute('aria-hidden','false');
}
async function cambiarEstadoGestion(nuevoEstado){
    const r=window.__reservaGestion;
    if(!r)return;
    
    if(!confirm(`¿Estás seguro de cambiar la reserva a estado: ${nuevoEstado.toUpperCase()}?`)) return;

    try{
        const updateData = { estado: nuevoEstado, updatedAt: serverTimestamp() };
        if(nuevoEstado === 'confirmed') {
            updateData.confirmadoPor = usuarioActual.uid;
            updateData.confirmadoEn = serverTimestamp();
        } else if (nuevoEstado === 'cancelled' || nuevoEstado === 'rejected') {
            updateData.canceladoPor = usuarioActual.uid;
            updateData.canceladoEn = serverTimestamp();
        }

        await updateDoc(doc(db,'reservas',r.id), updateData);
        document.getElementById('modal-gestion-reserva')?.classList.remove('mostrar');
        toast('Estado de reserva actualizado correctamente.');
        await refrescar();
    }catch(e){
        console.error(e);
        toast('No se pudo actualizar la reserva.',true);
    }
}
async function refrescar(){await cargarReservas();renderSchedule();renderReservas()}
function renderReservas(){
    const box=document.getElementById('lista-reservas');
    // Filtramos las canceladas/rechazadas para la vista principal, a menos que quieras ver el historial
    const activos = reservasDia.filter(r => !['cancelled', 'rejected', 'cancelada', 'cancelado'].includes(estadoReserva(r)) && !esBloqueoManual(r)).sort((a,b)=>String(a.horaInicio).localeCompare(String(b.horaInicio)));
    
    if(!activos.length){
        box.innerHTML='<div class="admin-empty compact"><i class="ph-bold ph-calendar-blank"></i><b>No tienes reservas activas hoy</b><span>Las reservas que lleguen desde la web aparecerán aquí.</span></div>';
        return;
    }
    box.innerHTML=activos.map(r=>{
        const st=estadoReserva(r);
        let label = 'Pendiente', colorClass = 'pendiente';
        let icon = '<i class="ph-bold ph-hourglass"></i>';
        
        if(st === 'confirmed') { label = 'Confirmada'; colorClass = 'confirmada'; icon = '<i class="ph-bold ph-check-circle"></i>'; }
        if(st === 'completed') { label = 'Jugado'; colorClass = 'jugada'; icon = '<i class="ph-bold ph-flag-checkered"></i>'; }

        return `<article class="reservation-row">
            <div class="reservation-time">${r.horaInicio||'--:--'}<small>${r.horaFin&&r.horaFin!==r.horaInicio?`hasta ${r.horaFin}`:'1 hora'}</small></div>
            <div class="reservation-client"><b>${r.nombre||'Cliente'}</b><span>${r.telefono||'Sin teléfono'} · ${label}</span></div>
            <div class="reservation-actions">
                <button class="reservation-state ${colorClass}" data-id="${r.id}">${icon} ${label}</button>
                <button class="icon-btn release-reservation" data-id="${r.id}" title="Gestionar"><i class="ph-bold ph-sliders-horizontal"></i></button>
            </div>
        </article>`;
    }).join('');
    
    box.querySelectorAll('.release-reservation,.reservation-state').forEach(b=>b.addEventListener('click',()=>{
        const r=reservasDia.find(x=>x.id===b.dataset.id);
        if(r) abrirGestionReserva(r);
    }));
}
function renderWeeklyHours(data){const box=document.getElementById('weekly-hours');if(!box)return;box.innerHTML=dias.slice(1).concat(['domingo']).map(dia=>{const h=data[dia]||{activo:true,apertura:'16:00',cierre:'23:00'};return `<div class="day-config-row" data-day="${dia}"><label class="day-toggle"><input type="checkbox" class="day-active" ${h.activo?'checked':''}><span class="toggle-ui"></span><b>${dia.charAt(0).toUpperCase()+dia.slice(1)}</b></label><div class="day-times"><input type="time" class="day-open" value="${h.apertura||'16:00'}"><span>—</span><input type="time" class="day-close" value="${h.cierre||'23:00'}"></div><span class="day-state">${h.activo?'Abierto':'Cerrado'}</span></div>`}).join('');box.querySelectorAll('.day-config-row').forEach(row=>{const cb=row.querySelector('.day-active'),update=()=>{row.classList.toggle('closed',!cb.checked);row.querySelector('.day-state').textContent=cb.checked?'Abierto':'Cerrado';row.querySelectorAll('.day-open,.day-close').forEach(x=>x.disabled=!cb.checked)};cb.addEventListener('change',update);update()})}
function readWeeklyHours(){const out={};document.querySelectorAll('.day-config-row').forEach(row=>{out[row.dataset.day]={activo:row.querySelector('.day-active').checked,apertura:row.querySelector('.day-open').value,cierre:row.querySelector('.day-close').value}});return out}
const btnHoy=document.getElementById('btn-hoy');btnHoy?.addEventListener('click',()=>{fechaSeleccionada=new Date();fechaSeleccionada.setHours(0,0,0,0);renderWeekDays();actualizarDia()});document.getElementById('btn-copiar-lunes')?.addEventListener('click',()=>{const lunes=document.querySelector('.day-config-row[data-day="lunes"]');if(!lunes)return;document.querySelectorAll('.day-config-row').forEach(row=>{if(row===lunes)return;row.querySelector('.day-active').checked=lunes.querySelector('.day-active').checked;row.querySelector('.day-open').value=lunes.querySelector('.day-open').value;row.querySelector('.day-close').value=lunes.querySelector('.day-close').value;row.querySelector('.day-active').dispatchEvent(new Event('change'))});toast('Horario del lunes copiado a los demás días.')});
async function subirImagen(archivo,ruta){if(!archivo)return null;const storageRef=ref(storage,ruta);await uploadBytes(storageRef,archivo);return await getDownloadURL(storageRef)}
const formPerfil=document.getElementById('form-perfil-cancha');
if(formPerfil) {
    formPerfil.addEventListener('submit', async e => {
        e.preventDefault();
        if(!usuarioActual) return;
        
        const btn = document.getElementById('btn-guardar-admin');
        const tipos = [...document.querySelectorAll('#admin-tipos input:checked')].map(x=>x.value);
        
        if(!tipos.length){
            document.getElementById('tipos-error').textContent='Selecciona al menos un tipo de cancha.';
            return;
        }
        
        document.getElementById('tipos-error').textContent='';
        btn.disabled=true;
        btn.innerHTML='<i class="ph-bold ph-spinner-gap"></i> Guardando...';
        
        try{
            const uid = usuarioActual.uid;
            
            // Subida de imágenes a Storage
            const files = [document.getElementById('admin-foto1')?.files[0], document.getElementById('admin-foto2')?.files[0], document.getElementById('admin-foto3')?.files[0]];
            const fotos = await Promise.all(files.map((f,i) => subirImagen(f,`canchas/${uid}/foto${i+1}`)));
            const logo = await subirImagen(document.getElementById('admin-logo')?.files[0], `canchas/${uid}/logo`);
            
            const inicio = document.getElementById('admin-hora-inicio')?.value || '16:00';
            const cierre = document.getElementById('admin-hora-cierre')?.value || '23:00';
            const weekly = readWeeklyHours();

            // FASE 7, 9 y 12: Guardado estructurado con Coordenadas
            const dataToSave = {
                ownerUid: uid,
                nombre: document.getElementById('admin-nombre').value.trim(),
                departamento: document.getElementById('admin-departamento').value.trim(),
                distrito: document.getElementById('admin-distrito').value.trim(),
                whatsapp: document.getElementById('admin-whatsapp').value.trim(),
                precio: Number(document.getElementById('admin-precio').value||0),
                tiposCancha: tipos,
                descripcion: document.getElementById('admin-descripcion').value.trim(),
                ubicacionTexto: document.getElementById('admin-ubicacion-texto').value.trim(),
                ubicacionLink: document.getElementById('admin-ubicacion-link').value.trim(),
                lat: document.getElementById('admin-lat').value.trim(), // NUEVO
                lng: document.getElementById('admin-lng').value.trim(), // NUEVO
                intervaloMinutos: Number(document.getElementById('admin-intervalo').value||60),
                horaApertura: inicio,
                horaCierre: cierre,
                horariosSemana: weekly,
                configurado: true,
                estadoPublicacion: canchaActual?.estadoPublicacion || 'draft',
                updatedAt: serverTimestamp()
            };

            if(logo) dataToSave.logo = logo;
            
            const fotosFiltradas = [...fotos.map((x,i) => x || canchaActual?.fotos?.[i]).filter(Boolean)];
            if(fotosFiltradas.length > 0) dataToSave.fotos = fotosFiltradas;

            await setDoc(doc(db, 'canchas', uid), dataToSave, {merge:true});
            
            canchaActual = {...canchaActual, ...dataToSave};
            document.getElementById('mensaje-exito')?.classList.add('show');
            toast('¡Configuración guardada exitosamente!');
            
            await actualizarDia();
        }catch(err){
            console.error(err);
            toast(`No se pudo guardar: ${err.message||'error desconocido'}`, true);
        }finally{
            btn.disabled = false;
            btn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Guardar configuración';
        }
    });
}

function init(){
    document.getElementById('fecha-hoy').textContent=fechaTexto(fechaSeleccionada);
    renderWeekDays();
    document.getElementById('btn-cerrar-sesion')?.addEventListener('click',()=>signOut(auth));
    
    onAuthStateChanged(auth, async u => {
        if(!u) { 
            window.location.href='login.html'; 
            return; 
        }

        // FASE 4: Verificación estricta de estado (Evitar que usuarios pendientes usen el panel)
        const userDoc = await getDoc(doc(db, 'usuarios', u.uid));
        
        if(userDoc.exists()) {
            const data = userDoc.data();
            
            // Si es el Administrador Maestro, lo enviamos a su panel
            if(data.rol === "admin" && data.estado === "approved") {
                window.location.href = "admin-panel.html"; 
                return;
            }
            
            // Si está pendiente de aprobación
            if(data.estado === "pending") {
                document.body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#080b0a;color:white;text-align:center;padding:20px;">
                    <i class="ph-bold ph-clock" style="font-size:60px;color:var(--warning);"></i>
                    <h2 style="margin:20px 0 10px;">Tu cuenta está en revisión</h2>
                    <p style="color:var(--text-muted);margin-bottom:20px;">Un administrador de APP FUTBOL debe aprobar tu solicitud antes de que puedas configurar tu cancha.</p>
                    <button onclick="window.location.href='login.html'" class="btn btn-outline" style="width:auto;">Volver al inicio</button>
                </div>`;
                auth.signOut();
                return;
            }
            
            // Si fue rechazado
            if(data.estado === "rejected") {
                document.body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#080b0a;color:white;text-align:center;padding:20px;">
                    <i class="ph-bold ph-x-circle" style="font-size:60px;color:var(--danger);"></i>
                    <h2 style="margin:20px 0 10px;">Solicitud Rechazada</h2>
                    <p style="color:var(--text-muted);margin-bottom:20px;">Lamentablemente tu solicitud para registrar la cancha ha sido rechazada.</p>
                    <button onclick="window.location.href='login.html'" class="btn btn-outline" style="width:auto;">Volver al inicio</button>
                </div>`;
                auth.signOut();
                return;
            }
        }

        // Si pasa las barreras, cargamos su información
        usuarioActual=u;
        document.getElementById('admin-user-label').textContent=u.email||'';
        try{
            if(await cargarPerfil()){
                actualizarDia();
            }
        }catch(e){
            console.error(e);
            toast('No se pudo cargar el panel.',true);
        }
    });
}
init();
document.getElementById('btn-extraer-coords')?.addEventListener('click', () => {
    const link = document.getElementById('admin-ubicacion-link').value;
    let m = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || link.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if(m) {
        document.getElementById('admin-lat').value = m[1];
        document.getElementById('admin-lng').value = m[2];
        toast('Coordenadas extraídas correctamente.');
    } else {
        toast('No detectamos coordenadas. Escríbelas manualmente.', true);
    }
});
