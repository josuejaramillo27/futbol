import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { calcularDisponibilidad, fechaISO } from './availability.js';
let bloqueosDia = [];

window.customConfirm = function(mensaje) {
    return new Promise((resolve) => {
        let overlay = document.getElementById('custom-confirm-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'custom-confirm-overlay';
            overlay.innerHTML = `
                <div class="custom-confirm-box">
                    <i class="ph-fill ph-warning-circle"></i>
                    <p id="custom-confirm-msg" style="margin:0; font-size:1.05rem; color:#fff; line-height:1.4;"></p>
                    <div class="custom-confirm-buttons">
                        <button id="btn-confirm-no" class="btn-confirm-no">Cancelar</button>
                        <button id="btn-confirm-yes" class="btn-confirm-yes">Aceptar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        document.getElementById('custom-confirm-msg').textContent = mensaje;
        overlay.classList.add('show');
        document.getElementById('btn-confirm-yes').onclick = () => { overlay.classList.remove('show'); resolve(true); };
        document.getElementById('btn-confirm-no').onclick = () => { overlay.classList.remove('show'); resolve(false); };
    });
};

const firebaseConfig={apiKey:"AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",authDomain:"app-futbol-acd0f.firebaseapp.com",projectId:"app-futbol-acd0f",storageBucket:"app-futbol-acd0f.firebasestorage.app",messagingSenderId:"223446110165",appId:"1:223446110165:web:219afce6a9dac03203f75c"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),storage=getStorage(app);
let usuarioActual=null,canchaActual=null,reservasDia=[],espacios=[],espacioSeleccionado=null;
let fechaSeleccionada=new Date();const dias=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];const fechaHoy=()=>fechaISO(new Date());const normalizar=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const money=n=>`S/ ${Number(n||0).toFixed(2)}`;const toast=(msg,error=false)=>{const el=document.getElementById('toast-admin');if(!el)return;el.textContent=msg;el.className=`admin-toast show ${error?'error':''}`;clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.className='admin-toast',2800)};const horaActual=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()};const fechaTexto=d=>new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long'}).format(d);const horarioDefault=()=>Object.fromEntries(dias.map((dia,i)=>[dia,{activo:i>0&&i<6,apertura:'16:00',cierre:'23:00'}]));

function horarioDelDia(){const nombre=dias[fechaSeleccionada.getDay()],semanal=espacioSeleccionado?.horariosSemana?.[nombre]||canchaActual?.horariosSemana?.[nombre];if(semanal)return semanal;return{activo:true,apertura:espacioSeleccionado?.horaApertura||canchaActual?.horaApertura||'16:00',cierre:espacioSeleccionado?.horaCierre||canchaActual?.horaCierre||'23:00'}}
function renderWeekDays(){const box=document.getElementById('week-days');if(!box)return;const base=new Date();base.setHours(0,0,0,0);box.innerHTML=Array.from({length:7},(_,i)=>{const d=new Date(base);d.setDate(base.getDate()+i);const active=fechaISO(d)===fechaISO(fechaSeleccionada);return `<button type="button" class="week-day ${active?'active':''}" data-date="${fechaISO(d)}"><small>${new Intl.DateTimeFormat('es-PE',{weekday:'short'}).format(d).replace('.','')}</small><strong>${d.getDate()}</strong><span>${i===0?'HOY':new Intl.DateTimeFormat('es-PE',{month:'short'}).format(d).replace('.','')}</span></button>`}).join('');box.querySelectorAll('.week-day').forEach(b=>b.addEventListener('click',()=>{const[y,m,day]=b.dataset.date.split('-').map(Number);fechaSeleccionada=new Date(y,m-1,day);fechaSeleccionada.setHours(0,0,0,0);renderWeekDays();actualizarDia()}))}
async function actualizarDia(){const texto=fechaTexto(fechaSeleccionada);document.getElementById('fecha-hoy').textContent=texto;document.getElementById('schedule-title').textContent=`Horarios · ${texto}`;document.getElementById('reservas-title').textContent=`Reservas · ${texto}`;const box=document.getElementById('admin-schedule'),list=document.getElementById('lista-reservas');if(box)box.innerHTML='<div class="admin-loading"><i class="ph-bold ph-spinner-gap"></i> Cargando horarios...</div>';if(list)list.innerHTML='<div class="admin-loading"><i class="ph-bold ph-spinner-gap"></i> Cargando reservas...</div>';try{await cargarReservas();renderSchedule();renderReservas()}catch(e){console.error(e);reservasDia=[];renderSchedule();renderReservas();toast('No pudimos leer las reservas. Mostramos los horarios disponibles.',true)}}

async function cargarPerfil(){
    const snap=await getDoc(doc(db,'canchas',usuarioActual.uid));
    if(!snap.exists()){ toast('No encontramos tu cancha. Configúrala primero.',true); return false; }
    canchaActual={id:snap.id,...snap.data()};
    
    let bannerEstado = document.getElementById('banner-publicacion');
    if(!bannerEstado) {
        bannerEstado = document.createElement('div');
        bannerEstado.id = 'banner-publicacion';
        bannerEstado.style.cssText = 'padding:15px; margin-bottom:20px; border-radius:12px; display:flex; justify-content:space-between; align-items:center;';
        document.querySelector('.admin-heading').insertAdjacentElement('afterend', bannerEstado);
    }
    const estadoPub = canchaActual.estadoPublicacion || 'draft';
    if(estadoPub === 'draft') {
        bannerEstado.style.background = 'rgba(255, 193, 7, 0.15)'; bannerEstado.style.border = '1px solid var(--warning)';
        bannerEstado.innerHTML = `<div><strong style="color:var(--warning); display:block;">Cancha en Borrador (No visible)</strong><span style="font-size:0.8rem; color:#ccc;">Termina de configurar tus datos y solicita la publicación.</span></div><button id="btn-solicitar-pub" class="btn hero-primary" style="width:auto; padding:8px 15px;">Solicitar Revisión</button>`;
        document.getElementById('btn-solicitar-pub').onclick = async () => {
            if(!canchaActual.configurado) return toast('Guarda la configuración de tu cancha primero.', true);
            await updateDoc(doc(db, 'canchas', usuarioActual.uid), { estadoPublicacion: 'pending_review' });
            toast('Solicitud enviada a los administradores.'); cargarPerfil();
        };
    } else if (estadoPub === 'pending_review') {
        bannerEstado.style.background = 'rgba(23, 162, 184, 0.15)'; bannerEstado.style.border = '1px solid #17a2b8';
        bannerEstado.innerHTML = `<div><strong style="color:#17a2b8; display:block;">En Revisión</strong><span style="font-size:0.8rem; color:#ccc;">Tu cancha está siendo evaluada.</span></div>`;
    } else if (estadoPub === 'published') {
        bannerEstado.style.background = 'rgba(0, 217, 104, 0.15)'; bannerEstado.style.border = '1px solid var(--primary-green)';
        bannerEstado.innerHTML = `<div><strong style="color:var(--primary-green); display:block;">Cancha Publicada y Activa</strong><span style="font-size:0.8rem; color:#ccc;">Tu negocio es visible para todos los jugadores.</span></div>`;
    }

    const campos={'admin-nombre':canchaActual.nombre,'admin-distrito':canchaActual.distrito??canchaActual.ciudad,'admin-departamento':canchaActual.departamento,'admin-whatsapp':canchaActual.whatsapp,'admin-descripcion':canchaActual.descripcion,'admin-precio':canchaActual.precio,'admin-ubicacion-texto':canchaActual.ubicacionTexto,'admin-ubicacion-link':canchaActual.ubicacionLink,'admin-intervalo':canchaActual.intervaloMinutos||canchaActual.duracionReserva||60};
    Object.entries(campos).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v??''});
    const tipos = Array.isArray(canchaActual.tiposCancha) && canchaActual.tiposCancha.length > 0 ? canchaActual.tiposCancha : (canchaActual.tipoCancha ? [canchaActual.tipoCancha] : ['Fútbol 7']);
    const elTipos = document.getElementById('admin-tipos');
    if (elTipos) { if (elTipos.tagName === 'SELECT') { elTipos.value = tipos[0] || 'Fútbol 7'; } else { const checkBoxes = elTipos.querySelectorAll('input[type=checkbox]'); checkBoxes.forEach(c => { c.checked = tipos.includes(c.value); }); } }
    renderWeeklyHours(canchaActual.horariosSemana||horarioDefault());
    document.getElementById('nombre-cancha-admin').textContent=canchaActual.nombre?`${canchaActual.nombre} · Panel`:'Mi Cancha';
    return true;
}

async function cargarEspacios(){
    const q = query(collection(db,'espacios'), where('ownerUid','==',usuarioActual.uid));
    const snap = await getDocs(q);
    espacios = snap.docs.map(d=>({id:d.id,...d.data()}));
    
    // Lista completa con la cancha principal y las secundarias
    const todos = [
        {
            id: usuarioActual.uid,
            nombre: canchaActual.nombre || 'Cancha principal',
            tipoCancha: (Array.isArray(canchaActual.tiposCancha) ? canchaActual.tiposCancha[0] : canchaActual.tipoCancha) || 'Sintética',
            horaApertura: canchaActual.horaApertura || '16:00',
            horaCierre: canchaActual.horaCierre || '23:00',
            horariosSemana: canchaActual.horariosSemana
        },
        ...espacios.map(e => ({
            id: e.id,
            nombre: e.nombre,
            tipoCancha: e.tipo || 'Fútbol',
            horaApertura: e.horaApertura || '16:00',
            horaCierre: e.horaCierre || '23:00',
            horariosSemana: canchaActual.horariosSemana
        }))
    ];

    if(!espacioSeleccionado || !todos.find(x => x.id === espacioSeleccionado.id)){
        espacioSeleccionado = todos[0];
    }

    // Dibujar el selector único en el contenedor
    let container = document.getElementById('dashboard-space-selector');
    if(!container){
        const header = document.querySelector('.schedule-head');
        if(header){
            container = document.createElement('div');
            container.id = 'dashboard-space-selector';
            header.appendChild(container);
        }
    }

    if(container){
        // Inyecta únicamente el dropdown selector estilizado
        container.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:6px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1);">
                <i class="ph-bold ph-soccer-ball" style="color:var(--primary-green, #2ecc71); font-size:1.1rem;"></i>
                <select id="select-cancha-activa" style="background:transparent; color:#fff; border:none; font-size:0.9rem; font-weight:bold; outline:none; cursor:pointer;">
                    ${todos.map(s => `<option value="${s.id}" ${s.id === espacioSeleccionado.id ? 'selected' : ''} style="background:#111; color:#fff;">${s.nombre} (${s.tipoCancha})</option>`).join('')}
                </select>
            </div>
        `;

        document.getElementById('select-cancha-activa').addEventListener('change', (e) => {
            espacioSeleccionado = todos.find(x => x.id === e.target.value);
            actualizarDia();
        });
    }
}
async function cargarReservas(){
    // 🔥 Ahora lee la cancha seleccionada en el menú, no solo la principal
    const idCancha = String(espacioSeleccionado?.id || canchaActual?.id || usuarioActual.uid);
    const fISO = fechaISO(fechaSeleccionada);
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
        actualizarKpis([]); return;
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
        try{ await deleteDoc(doc(db,'bloqueos',bloqueoId)); toast('Horario liberado.'); await refrescar(); }catch(e){toast('No se pudo liberar.',true);}
        return;
    }
    if(!confirm(`¿Bloquear manualmente las ${hora}?\nNadie podrá reservar este horario.`)) return;
    try{
        // 🔥 Aplica el bloqueo a la cancha específica que estés viendo
        const idCancha = espacioSeleccionado?.id || canchaActual.id;
        await addDoc(collection(db,'bloqueos'),{ ownerUid: usuarioActual.uid, canchaId: idCancha, fecha: fechaISO(fechaSeleccionada), horaInicio: hora, horaFin: hora, motivo: 'Bloqueo manual', createdAt: serverTimestamp() });
        toast('Horario bloqueado.'); await refrescar();
    }catch(e){ console.error(e); toast('No se pudo bloquear el horario.',true); }
}

// SEMÁFORO DE RESERVAS Y CALIFICACIÓN DE JUGADOR
function abrirGestionReserva(r){
    let m=document.getElementById('modal-gestion-reserva');
    if(!m){
        m=document.createElement('div'); m.id='modal-gestion-reserva'; m.className='admin-modal';
        m.innerHTML=`<div class="admin-modal-card reservation-manage-card">
            <button type="button" class="btn-cerrar admin-modal-close" data-close="modal-gestion-reserva"><i class="ph-bold ph-x"></i></button>
            <span class="mini-label">GESTIÓN DE RESERVA</span>
            <h2 id="manage-title">Reserva</h2>
            <div id="manage-summary" class="manage-summary" style="margin-bottom: 20px;"></div>
            <div class="manage-actions" id="manage-buttons" style="display:flex; flex-direction:column; gap:10px;"></div>
        </div>`;
        document.body.appendChild(m);
        m.querySelector('[data-close]').onclick=()=>m.classList.remove('mostrar');
    }
    const st = estadoReserva(r);
    
    // SEMÁFORO DE COLORES
    const statusLabels = {
        'pending': '<span style="color:#f1c40f; background:rgba(241,196,15,0.1); padding:4px 8px; border-radius:6px; border:1px solid #f1c40f;">Pendiente de Validar ⏳</span>',
        'confirmed': '<span style="color:var(--primary-green); background:rgba(46,204,113,0.1); padding:4px 8px; border-radius:6px; border:1px solid var(--primary-green);">Confirmada ✅</span>',
        'completed': '<span style="color:#a777e8">Completada (Jugada)</span>',
        'cancelled': '<span style="color:var(--text-muted)">Cancelada</span>',
        'rejected': '<span style="color:var(--danger)">Rechazada por la Cancha</span>'
    };

    const senaBadge = r.senaPagada 
        ? '<span style="color:#4ba3ff; font-weight:bold;"><i class="ph-fill ph-check-circle"></i> Seña recibida</span>' 
        : '<span style="color:var(--text-muted);">Pendiente / Sin seña</span>';

    const clienteNombre = r.nombre || r.usuarioNombre || 'Cliente';
    const clienteTelefono = r.telefono || r.usuarioTelefono || 'Sin teléfono';

    m.querySelector('#manage-title').textContent = `${clienteNombre} · ${r.horaInicio||'--:--'}`;
    m.querySelector('#manage-summary').innerHTML = `
        <div><span>Fecha:</span> <b>${fechaTexto(fechaSeleccionada)}</b></div>
        <div><span>Jugador:</span> <b>${clienteNombre}</b></div>
        <div><span>WhatsApp:</span> <b>${clienteTelefono}</b></div>
        <div><span>Importe Total:</span> <b>${money(r.precio??canchaActual?.precio)}</b></div>
        <div><span>Adelanto (Seña):</span> <b>${senaBadge}</b></div>
        <div style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;"><span>Estado Reserva:</span> <b>${statusLabels[st]}</b></div>
    `;

    const btnContainer = m.querySelector('#manage-buttons');
    btnContainer.innerHTML = '';
    
    if(r.telefono) {
        const phone = String(r.telefono).replace(/\D/g,'');
        btnContainer.innerHTML += `<a href="https://wa.me/${phone}?text=${encodeURIComponent(`Hola ${r.nombre}, te escribimos de ${canchaActual.nombre} sobre tu reserva de hoy a las ${r.horaInicio}.`)}" target="_blank" class="btn" style="background:#25D366; color:#000;"><i class="ph-bold ph-whatsapp-logo"></i> Chatear por WhatsApp</a>`;
    }

    if(st === 'pending') {
        // 🔥 AQUÍ ESTÁ EL BLINDAJE: PASAMOS EL ID DE LA RESERVA DIRECTAMENTE
        btnContainer.innerHTML += `
            <button onclick="window.cambiarEstadoGestion('${r.id}', 'confirmed')" class="btn hero-primary" style="background:#2ecc71; color:#000; border:none;"><i class="ph-bold ph-check-circle"></i> Validar Yape y Aprobar</button>
            <button onclick="window.cambiarEstadoGestion('${r.id}', 'rejected')" class="btn" style="background:rgba(231,76,60,0.1); color:var(--danger); border:1px solid var(--danger);"><i class="ph-bold ph-x-circle"></i> Rechazar (Pago Falso / Sin Pago)</button>
        `;
    } else if(st === 'confirmed') {
        btnContainer.innerHTML += `
            <button onclick="window.cambiarEstadoGestion('${r.id}', 'completed')" class="btn" style="background:#a777e8; color:#fff; border:none;"><i class="ph-bold ph-flag-checkered"></i> Marcar como Partido Jugado</button>
            <button onclick="window.cambiarEstadoGestion('${r.id}', 'cancelled')" class="btn btn-outline" style="color:var(--danger); border-color:var(--danger);"><i class="ph-bold ph-x"></i> Cancelar Reserva</button>
        `;
    } else if (st === 'completed') {
        if(!r.calificadoPorDueno) {
            btnContainer.innerHTML += `
                <button onclick="abrirCalificacionJugador('${r.usuarioUid}', '${r.id}', '${clienteNombre}')" class="btn" style="background:#f1c40f; color:#000; border:none; margin-top:10px;"><i class="ph-fill ph-star"></i> ⭐ Calificar y Reportar Equipo</button>
            `;
        } else {
            btnContainer.innerHTML += `<div style="text-align:center; color:#aaa; font-size:0.85rem;"><i class="ph-fill ph-check-circle" style="color:#2ecc71;"></i> Ya calificaste a este equipo.</div>`;
        }
    }
    m.classList.add('mostrar');
    m.setAttribute('aria-hidden','false');
}

// NUEVO: SISTEMA DE CALIFICACIÓN DE JUGADOR (DEL DUEÑO AL JUGADOR)
window.abrirCalificacionJugador = function(jugadorUid, reservaId, nombreJugador) {
    if(!jugadorUid) return toast("Este jugador no tiene un perfil registrado en la app.", true);
    
    let m = document.getElementById('modal-rate-player');
    if(!m) {
        m = document.createElement('div');
        m.id = 'modal-rate-player';
        m.className = 'admin-modal';
        m.innerHTML = `
        <div class="admin-modal-card">
            <button type="button" class="btn-cerrar admin-modal-close" onclick="document.getElementById('modal-rate-player').classList.remove('mostrar')"><i class="ph-bold ph-x"></i></button>
            <span class="mini-label" style="color:#f1c40f;">SISTEMA DE REPUTACIÓN</span>
            <h2>Evaluar a <span id="rate-player-name" style="color:#f1c40f;"></span></h2>
            <p style="color:#aaa; font-size:0.85rem;">Tu calificación es pública y ayudará a otras canchas a saber si este equipo es confiable.</p>
            
            <div style="display:flex; justify-content:center; gap:10px; margin: 20px 0; font-size:2.5rem; color:#444; cursor:pointer;" id="rate-stars-container">
                <i class="ph-fill ph-star rate-star" data-val="1"></i>
                <i class="ph-fill ph-star rate-star" data-val="2"></i>
                <i class="ph-fill ph-star rate-star" data-val="3"></i>
                <i class="ph-fill ph-star rate-star" data-val="4"></i>
                <i class="ph-fill ph-star rate-star" data-val="5"></i>
            </div>
            <p id="rate-label" style="text-align:center; color:#f1c40f; font-weight:bold; margin-bottom:20px;">Toca las estrellas</p>

            <div id="rate-tags-container" style="display:none; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:25px;"></div>

            <button id="btn-submit-player-rate" class="btn hero-primary" style="width:100%;" disabled><i class="ph-bold ph-check"></i> Enviar Reporte</button>
        </div>`;
        document.body.appendChild(m);
    }
    
    const stars = m.querySelectorAll('.rate-star');
    const label = m.querySelector('#rate-label');
    const tagsCont = m.querySelector('#rate-tags-container');
    const btn = m.querySelector('#btn-submit-player-rate');
    let selRating = 0; let selTags = new Set();
    
    document.getElementById('rate-player-name').textContent = nombreJugador;
    stars.forEach(s => s.style.color = '#444');
    label.textContent = "Toca las estrellas para iniciar";
    tagsCont.style.display = 'none';
    btn.disabled = true; btn.innerHTML = '<i class="ph-bold ph-check"></i> Enviar Reporte';

    const TAGS_DUEÑO = {
        5: [{icon:"ph-thumbs-up", text:"Excelente equipo"}, {icon:"ph-clock", text:"Puntuales"}, {icon:"ph-broom", text:"Dejaron limpio"}, {icon:"ph-handshake", text:"Respetuosos"}],
        4: [{icon:"ph-thumbs-up", text:"Buen equipo"}, {icon:"ph-handshake", text:"Sin problemas"}],
        3: [{icon:"ph-clock", text:"Llegaron tarde"}, {icon:"ph-warning", text:"Desordenados"}],
        2: [{icon:"ph-trash", text:"Dejaron basura"}, {icon:"ph-clock", text:"Demoraron en salir"}, {icon:"ph-warning", text:"Problemáticos"}],
        1: [{icon:"ph-prohibit", text:"No show (No vinieron)"}, {icon:"ph-sword", text:"Pelea / Violencia"}, {icon:"ph-trash", text:"Dañaron la cancha"}, {icon:"ph-warning-circle", text:"Falta de pago"}]
    };

    stars.forEach(star => {
        star.onclick = () => {
            selRating = Number(star.dataset.val);
            selTags.clear();
            stars.forEach(s => { s.style.color = Number(s.dataset.val) <= selRating ? '#f1c40f' : '#444'; });
            const labels = {1:"Pésimos / Peligrosos 😡", 2:"Mal comportamiento 👎", 3:"Regulares 😐", 4:"Buenos 👍", 5:"¡Excelentes! ⭐"};
            label.textContent = labels[selRating];
            
            tagsCont.innerHTML = TAGS_DUEÑO[selRating].map(t => `<div class="tag-chip" data-text="${t.text}" style="padding:6px 12px; border:1px solid #555; border-radius:20px; font-size:0.8rem; color:#aaa; cursor:pointer;"><i class="ph-bold ${t.icon}"></i> ${t.text}</div>`).join('');
            tagsCont.style.display = 'flex';
            
            tagsCont.querySelectorAll('.tag-chip').forEach(chip => {
                chip.onclick = () => {
                    if(selTags.has(chip.dataset.text)) {
                        selTags.delete(chip.dataset.text);
                        chip.style.background = 'transparent'; chip.style.color = '#aaa'; chip.style.borderColor = '#555';
                    } else {
                        selTags.add(chip.dataset.text);
                        chip.style.background = 'rgba(241,196,15,0.1)'; chip.style.color = '#f1c40f'; chip.style.borderColor = '#f1c40f';
                    }
                };
            });
            btn.disabled = false;
        };
    });

    btn.onclick = async () => {
        if(!selRating) return;
        btn.disabled = true; btn.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Guardando...';
        try {
            await setDoc(doc(db, 'resenas_jugadores', `${reservaId}_${jugadorUid}`), {
                jugadorUid: jugadorUid,
                canchaId: canchaActual.id,
                nombreCancha: canchaActual.nombre,
                reservaId: reservaId,
                rating: selRating,
                tags: Array.from(selTags),
                createdAt: serverTimestamp()
            });
            await updateDoc(doc(db, 'reservas', reservaId), { calificadoPorDueno: true });
            m.classList.remove('mostrar');
            toast('¡Calificación guardada! Gracias por ayudar a la comunidad.');
            document.getElementById('modal-gestion-reserva')?.classList.remove('mostrar');
            await refrescar();
        } catch(e) { console.error(e); toast('Error al guardar calificación.', true); btn.disabled = false; btn.innerHTML = "Enviar Reporte"; }
    };

    m.classList.add('mostrar');
};

// 🔥 BLINDAJE DE LA FUNCIÓN DE CAMBIAR ESTADO (CON TRADUCCIÓN VISUAL)
window.cambiarEstadoGestion = async function(reservaId, nuevoEstado){
    if(!reservaId) return;

    // DICCIONARIO PARA TRADUCIR EL ESTADO SOLO EN LA ALERTA VISUAL
    const nombresEstados = {
        'confirmed': 'CONFIRMADA ✅',
        'completed': 'JUGADA 🏁',
        'cancelled': 'CANCELADA ❌',
        'rejected': 'RECHAZADA 🚫'
    };
    
    // Si encuentra la traducción la usa, si no, usa el original en mayúsculas
    const estadoAmigable = nombresEstados[nuevoEstado] || nuevoEstado.toUpperCase();

    // MOSTRAMOS LA ALERTA EN ESPAÑOL
    if(!await window.customConfirm(`¿Estás seguro de cambiar la reserva a estado: ${estadoAmigable}?`)) return;
    
    try {
        // PERO GUARDAMOS EN INGLÉS EN LA BASE DE DATOS PARA QUE EL SISTEMA NO FALLE
        const updateData = { estado: nuevoEstado, updatedAt: serverTimestamp() };
        
        if (nuevoEstado === 'confirmed') { 
            updateData.confirmadoPor = usuarioActual.uid; 
            updateData.confirmadoEn = serverTimestamp(); 
        } else if (nuevoEstado === 'cancelled' || nuevoEstado === 'rejected') { 
            updateData.canceladoPor = usuarioActual.uid; 
            updateData.canceladoEn = serverTimestamp(); 
        }
        
        await updateDoc(doc(db,'reservas', reservaId), updateData);
        document.getElementById('modal-gestion-reserva')?.classList.remove('mostrar');
        toast('Estado actualizado correctamente.');
        await refrescar();
    } catch(e) { 
        console.error(e); 
        toast('No se pudo actualizar la reserva.', true); 
    }
}
async function refrescar(){await cargarReservas();renderSchedule();renderReservas()}

function renderReservas(){
    const box=document.getElementById('lista-reservas');
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

        const clienteNombre = r.nombre || r.usuarioNombre || 'Cliente';
        const clienteTelefono = r.telefono || r.usuarioTelefono || 'Sin teléfono';

        return `<article class="reservation-row">
            <div class="reservation-time">${r.horaInicio||'--:--'}<small>${r.horaFin&&r.horaFin!==r.horaInicio?`hasta ${r.horaFin}`:'1 hora'}</small></div>
            <div class="reservation-client"><b>${clienteNombre}</b><span>${clienteTelefono} · ${label}</span></div>
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
        e.preventDefault(); if(!usuarioActual) return;
        const btn = document.getElementById('btn-guardar-admin');
        
        // 🔥 FIX 1: Lectura compatible del Menú Desplegable
        const elTipos = document.getElementById('admin-tipos');
        let tipos = [];
        if (elTipos) {
            if (elTipos.tagName === 'SELECT') {
                tipos = elTipos.value ? [elTipos.value] : ['Fútbol 7'];
            } else {
                tipos = [...elTipos.querySelectorAll('input:checked')].map(x => x.value);
            }
        }
        if (!tipos.length) tipos = ['Fútbol 7'];

        const errorMsg = document.getElementById('tipos-error');
        if(errorMsg) errorMsg.textContent = ''; 
        
        btn.disabled=true; 
        btn.innerHTML='<i class="ph-bold ph-spinner-gap ph-spin"></i> Guardando...';
        
        try{
            const uid = usuarioActual.uid;
            const files = [document.getElementById('admin-foto1')?.files[0], document.getElementById('admin-foto2')?.files[0], document.getElementById('admin-foto3')?.files[0]];
            const fotos = await Promise.all(files.map((f,i) => subirImagen(f,`canchas/${uid}/foto${i+1}`)));
            const logo = await subirImagen(document.getElementById('admin-logo')?.files[0], `canchas/${uid}/logo`);
            
            // 🔥 FIX 2: Blindaje contra "null" usando ?.value (Si no existe el input, se guarda vacío)
            const dataToSave = {
                ownerUid: uid, 
                nombre: document.getElementById('admin-nombre')?.value?.trim() || '', 
                departamento: document.getElementById('admin-departamento')?.value?.trim() || '',
                distrito: document.getElementById('admin-distrito')?.value?.trim() || '', 
                whatsapp: document.getElementById('admin-whatsapp')?.value?.trim() || '',
                precio: Number(document.getElementById('admin-precio')?.value || 0), 
                tiposCancha: tipos, 
                descripcion: document.getElementById('admin-descripcion')?.value?.trim() || '',
                ubicacionTexto: document.getElementById('admin-ubicacion-texto')?.value?.trim() || '', 
                ubicacionLink: document.getElementById('admin-ubicacion-link')?.value?.trim() || '',
                lat: document.getElementById('admin-lat')?.value?.trim() || '', 
                lng: document.getElementById('admin-lng')?.value?.trim() || '',
                intervaloMinutos: Number(document.getElementById('admin-intervalo')?.value || 60), 
                horaApertura: document.getElementById('admin-hora-inicio')?.value || '16:00',
                horaCierre: document.getElementById('admin-hora-cierre')?.value || '23:00', 
                horariosSemana: readWeeklyHours(), 
                configurado: true,
                estadoPublicacion: canchaActual?.estadoPublicacion || 'draft', 
                updatedAt: serverTimestamp()
            };
            
            if(logo) dataToSave.logo = logo;
            const fotosFiltradas = [...fotos.map((x,i) => x || canchaActual?.fotos?.[i]).filter(Boolean)];
            if(fotosFiltradas.length > 0) dataToSave.fotos = fotosFiltradas;

            await setDoc(doc(db, 'canchas', uid), dataToSave, {merge:true});
            canchaActual = {...canchaActual, ...dataToSave};
            document.getElementById('mensaje-exito')?.classList.add('show'); toast('¡Configuración guardada exitosamente!'); await actualizarDia();
        }catch(err){ console.error(err); toast(`No se pudo guardar.`, true); }finally{ btn.disabled = false; btn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Guardar configuración'; }
    });
}

function init(){
    document.getElementById('fecha-hoy').textContent=fechaTexto(fechaSeleccionada); renderWeekDays();
    const salirSeguro = async (e) => { e.preventDefault(); e.target.innerHTML = '<i class="ph-bold ph-spinner-gap ph-spin"></i> Saliendo...'; try { await signOut(auth); window.location.href = 'login.html'; } catch (error) { console.error("Error al salir:", error); } };
    const btnSalir1 = document.getElementById('btn-cerrar-sesion'), btnSalir2 = document.getElementById('btn-logout');
    if(btnSalir1) btnSalir1.addEventListener('click', salirSeguro); if(btnSalir2) btnSalir2.addEventListener('click', salirSeguro);
    
    onAuthStateChanged(auth, async u => {
        if(!u) { window.location.href='login.html'; return; }
        const userDoc = await getDoc(doc(db, 'usuarios', u.uid));
        if(userDoc.exists()) {
            const data = userDoc.data();
            if(data.rol === "admin" && data.estado === "approved") { window.location.href = "admin-panel.html"; return; }
            if(data.estado === "pending") { document.body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#080b0a;color:white;text-align:center;padding:20px;"><i class="ph-bold ph-clock" style="font-size:60px;color:var(--warning);"></i><h2 style="margin:20px 0 10px;">Tu cuenta está en revisión</h2><p style="color:var(--text-muted);margin-bottom:20px;">Un administrador debe aprobar tu solicitud antes de configurar tu cancha.</p><button onclick="window.location.href='login.html'" class="btn btn-outline" style="width:auto;">Volver al inicio</button></div>`; auth.signOut(); return; }
            if(data.estado === "rejected") { document.body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#080b0a;color:white;text-align:center;padding:20px;"><i class="ph-bold ph-x-circle" style="font-size:60px;color:var(--danger);"></i><h2 style="margin:20px 0 10px;">Solicitud Rechazada</h2><p style="color:var(--text-muted);margin-bottom:20px;">Lamentablemente tu solicitud para registrar la cancha ha sido rechazada.</p><button onclick="window.location.href='login.html'" class="btn btn-outline" style="width:auto;">Volver al inicio</button></div>`; auth.signOut(); return; }
        }
        usuarioActual=u; document.getElementById('admin-user-label').textContent=u.email||'';
        try{ 
            if(await cargarPerfil()){ 
                await cargarEspacios(); // 🔥 ¡ESTA LÍNEA ENCIENDE EL SELECTOR DE MÚLTIPLES CANCHAS!
                actualizarDia(); 
            } 
        }catch(e){ console.error(e); toast('No se pudo cargar el panel.',true); }
    });
}
init();
