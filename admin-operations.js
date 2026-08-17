import './admin-payment.js';
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",authDomain:"app-futbol-acd0f.firebaseapp.com",projectId:"app-futbol-acd0f",storageBucket:"app-futbol-acd0f.firebasestorage.app",messagingSenderId:"223446110165",appId:"1:223446110165:web:219afce6a9dac03203f75c"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
let uid=null,espacios=[],eventos=[];
const $=id=>document.getElementById(id);
const toast=(m,e=false)=>{const x=$('toast-admin');if(!x)return;x.textContent=m;x.className=`admin-toast show ${e?'error':''}`;clearTimeout(window.__opToast);window.__opToast=setTimeout(()=>x.className='admin-toast',2800)};
const openModal=id=>{$(id)?.classList.add('mostrar');$(id)?.setAttribute('aria-hidden','false')},closeModal=id=>{$(id)?.classList.remove('mostrar');$(id)?.setAttribute('aria-hidden','true')};
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function fecha(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)}

// FASE 8: Carga de Espacios múltiples asociados estrictamente al ownerUid
async function cargarEspacios(){
    espacios = [];

    // 1. Cargar SIEMPRE la cancha principal (legacy)
    try {
        const snap = await getDoc(doc(db, 'canchas', uid));
        if (snap.exists()) {
            const c = snap.data();
            espacios.push({
                id: `legacy-${uid}`,
                legacy: true,
                ownerUid: uid,
                nombre: c.nombre || 'Cancha principal',
                tipo: (Array.isArray(c.tiposCancha) ? c.tiposCancha[0] : c.tipoCancha) || 'Sintética',
                precio: Number(c.precio || 0),
                horaApertura: c.horaApertura || '16:00',
                horaCierre: c.horaCierre || '23:00',
                caracteristicas: 'Espacio principal'
            });
        }
    } catch(e) { console.warn("Error cargando principal:", e); }

    // 2. Cargar TODAS las canchas secundarias (espacios)
    try {
        const q = query(collection(db, 'espacios'), where('ownerUid', '==', uid));
        const s = await getDocs(q);
        s.docs.forEach(x => {
            espacios.push({ id: x.id, ...x.data() });
        });
    } catch(e) { console.error("Error cargando secundarias:", e); }

    // 3. Llamar a tus funciones originales para pintar en pantalla
    renderEspacios();
    llenarEspaciosEvento();
}

function renderEspacios(){
    const box=$('lista-espacios');if(!box)return;
    if(!espacios.length){
        box.innerHTML='<div class="admin-empty"><i class="ph-bold ph-buildings"></i><b>Aún no tienes canchas individuales</b><span>Agrega la primera para administrar horarios y precios por separado.</span></div>';
        return;
    }
    box.innerHTML=espacios.map(e=>{
        const strPrecioNoche = e.tienePrecioNoche ? `<br><small style="color:#f1c40f;"><i class="ph-fill ph-moon"></i> S/ ${Number(e.precioNoche||0).toFixed(2)} / hora (Noche)</small>` : '';
        return `<article class="space-card"><div class="space-icon"><i class="ph-fill ph-soccer-ball"></i></div><div class="space-main"><div class="space-top"><h3>${esc(e.nombre)}</h3><span class="space-status">${e.legacy?'PRINCIPAL':'ACTIVA'}</span></div><p>${esc(e.tipo||'Fútbol')} · S/ ${Number(e.precio||0).toFixed(2)} / hora (Día) ${strPrecioNoche}</p></div><div class="space-actions">${e.legacy?'':'<button class="icon-btn edit-space" data-id="'+e.id+'" title="Editar"><i class="ph-bold ph-pencil-simple"></i></button><button class="icon-btn delete-space" data-id="'+e.id+'" title="Eliminar"><i class="ph-bold ph-trash"></i></button>'}</div></article>`;
    }).join('');
    box.querySelectorAll('.edit-space').forEach(b=>b.onclick=()=>editarEspacio(b.dataset.id));
    box.querySelectorAll('.delete-space').forEach(b=>b.onclick=()=>eliminarEspacio(b.dataset.id));
}

function llenarEspaciosEvento(){
    const s=$('evento-espacios');if(!s)return;
    s.innerHTML=espacios.length?espacios.map(e=>`<option value="${e.id}" ${e.legacy?'disabled':''}>${esc(e.nombre)} · ${esc(e.tipo||'Fútbol')}${e.legacy?' · principal':''}</option>`).join(''):'<option disabled>No hay canchas creadas</option>';
}

function editarEspacio(id){
    const e=espacios.find(x=>x.id===id);if(!e||e.legacy)return;
    $('espacio-id').value=e.id;
    $('espacio-modal-title').textContent='Editar cancha';
    $('espacio-nombre').value=e.nombre||'';
    $('espacio-tipo').value=e.tipo||'Sintética';
    $('espacio-precio').value=e.precio??'';
    
    // MAGIA COMERCIAL: Carga de tarifa nocturna
    const checkNoche = $('espacio-check-noche');
    const cajaNoche = $('caja-noche');
    if (e.tienePrecioNoche) {
        checkNoche.checked = true;
        cajaNoche.style.display = 'block';
        $('espacio-hora-noche').value = e.horaInicioNoche || '18:00';
        $('espacio-precio-noche').value = e.precioNoche ?? '';
    } else {
        checkNoche.checked = false;
        cajaNoche.style.display = 'none';
        $('espacio-hora-noche').value = '18:00';
        $('espacio-precio-noche').value = '';
    }
    
    openModal('modal-espacio');
}

async function eliminarEspacio(id){
    const e=espacios.find(x=>x.id===id);if(!e||e.legacy||!confirm(`¿Eliminar ${e.nombre}? Las reservas históricas no se borrarán.`))return;
    try{await deleteDoc(doc(db,'espacios',id));toast('Cancha eliminada.');await cargarEspacios()}catch(err){console.error(err);toast('No se pudo eliminar.',true)}
}

$('btn-nuevo-espacio')?.addEventListener('click',()=>{
    $('form-espacio').reset();
    $('espacio-id').value='';
    $('espacio-modal-title').textContent='Agregar cancha';
    $('espacio-check-noche').checked = false;
    $('caja-noche').style.display = 'none';
    openModal('modal-espacio');
});

$('form-espacio')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const id=$('espacio-id').value;
    const tieneNoche = $('espacio-check-noche').checked;
    
    // FASE 8: Creación/Edición con OwnerUid estricto + TARIFAS DINÁMICAS
    const data={
        ownerUid:uid,
        nombre:$('espacio-nombre').value.trim(),
        tipo:$('espacio-tipo').value,
        precio:Number($('espacio-precio').value||0),
        tienePrecioNoche: tieneNoche,
        precioNoche: tieneNoche ? Number($('espacio-precio-noche').value||0) : null,
        horaInicioNoche: tieneNoche ? $('espacio-hora-noche').value : null,
        activo:true,
        updatedAt:serverTimestamp()
    };
    
    try{
        if(id) await updateDoc(doc(db,'espacios',id),data);
        else {
            data.createdAt = serverTimestamp();
            await addDoc(collection(db,'espacios'),data);
        }
        closeModal('modal-espacio');toast(id?'Cancha actualizada.':'Cancha agregada.');await cargarEspacios();
    }catch(err){console.error(err);toast('No se pudo guardar la cancha.',true)}
});

// FASE 27 PREP: EVENTOS Y ABONADOS FIJOS VINCULADOS A ESPACIOS
async function cargarEventos(){
    const q=query(collection(db,'eventos'),where('ownerUid','==',uid));
    const s=await getDocs(q);
    // Para simplificar la vista, ordenaremos por fecha de creación o inicio.
    eventos=s.docs.map(x=>({id:x.id,...x.data()})); 
    renderEventos();
}

function renderEventos(){
    const box=$('lista-eventos');if(!box)return;
    if(!eventos.length){box.innerHTML='<div class="admin-empty"><i class="ph-bold ph-trophy"></i><b>No hay eventos ni abonados programados</b><span>Ideal para ingresos fijos mensuales y campeonatos.</span></div>';return}
    
    box.innerHTML=eventos.map(e=>{
        const ids=e.espacioIds||[],nombres=ids.map(id=>espacios.find(x=>x.id===id)?.nombre).filter(Boolean);
        
        // Render condicional si es Abonado Fijo o Evento Único
        if (e.esAbonado) {
            const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
            const diaNombre = diasSemana[parseInt(e.diaSemana)] || "Día";
            return `<article class="event-card" style="border-left: 3px solid #3498db;"><div class="event-icon"><i class="ph-fill ph-users"></i></div><div class="event-main"><div class="event-top"><h3 style="color:#3498db;">${esc(e.nombre)}</h3><span class="event-status" style="background: rgba(52,152,219,0.2); color:#3498db;">FIJO MENSUAL</span></div><p><i class="ph-bold ph-calendar-check"></i> Todos los ${diaNombre} a las ${esc(e.horaFija)}</p><small>${nombres.length?esc(nombres.join(' · ')):'Cancha eliminada'} · Contrato: ${esc(e.mesesContrato)} Mes(es)</small></div><button class="icon-btn delete-event" data-id="${e.id}" title="Eliminar contrato"><i class="ph-bold ph-trash"></i></button></article>`;
        } else {
            const pasado=new Date(e.fin)<new Date();
            return `<article class="event-card ${pasado?'event-past':''}"><div class="event-icon"><i class="ph-fill ph-trophy"></i></div><div class="event-main"><div class="event-top"><h3>${esc(e.nombre)}</h3><span class="event-status">${pasado?'FINALIZADO':'RESERVADO'}</span></div><p><i class="ph-bold ph-calendar"></i> ${fecha(e.inicio)} → ${fecha(e.fin)}</p><small>${nombres.length?esc(nombres.join(' · ')):'Espacios no especificados'}</small></div><button class="icon-btn delete-event" data-id="${e.id}" title="Eliminar evento"><i class="ph-bold ph-trash"></i></button></article>`;
        }
    }).join('');
    box.querySelectorAll('.delete-event').forEach(b=>b.onclick=()=>eliminarEvento(b.dataset.id));
}

async function eliminarEvento(id){
    if(!confirm('¿Eliminar este registro y liberar las horas asociadas?'))return;
    try{await deleteDoc(doc(db,'eventos',id));toast('Registro eliminado.');await cargarEventos()}catch(e){console.error(e);toast('No se pudo eliminar.',true)}
}

$('btn-nuevo-evento')?.addEventListener('click',()=>{
    if(!espacios.length){toast('Primero agrega al menos una cancha.',true);return;}
    $('form-evento').reset();
    $('evento-tipo').value = 'unico';
    $('caja-evento-unico').style.display='block';
    $('caja-evento-abonado').style.display='none';
    llenarEspaciosEvento();
    openModal('modal-evento');
});

$('form-evento')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const espacioIds=[...$('evento-espacios').selectedOptions].filter(o=>!o.disabled).map(o=>o.value);
    if(!espacioIds.length){toast('Selecciona al menos una cancha.',true);return}
    
    const esAbonado = $('evento-tipo').value === 'abonado';
    let data = {
        ownerUid:uid,
        nombre:$('evento-nombre').value.trim(),
        espacioIds: espacioIds,
        esAbonado: esAbonado,
        createdAt:serverTimestamp()
    };

    if (esAbonado) {
        data.diaSemana = $('abonado-dia').value;
        data.horaFija = $('abonado-hora').value;
        data.mesesContrato = parseInt($('abonado-meses').value);
        if(!data.horaFija) { toast('Debes seleccionar una hora para el abonado.',true); return; }
    } else {
        const inicio=$('evento-inicio').value,fin=$('evento-fin').value;
        if(new Date(fin)<=new Date(inicio)){toast('La fecha final debe ser posterior a la inicial.',true);return}
        data.inicio = inicio;
        data.fin = fin;
    }

    try{
        await addDoc(collection(db,'eventos'),data);
        closeModal('modal-evento');toast(esAbonado ? 'Contrato de Abonado guardado.' : 'Evento programado.');await cargarEventos();
    }catch(err){console.error(err);toast('No se pudo guardar el bloqueo.',true)}
});

document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
document.querySelectorAll('.admin-modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));

onAuthStateChanged(auth,async user=>{
    if(!user)return;
    uid=user.uid;
    try{await Promise.all([cargarEspacios(),cargarEventos()])}catch(e){console.error(e);toast('No se pudieron cargar canchas o eventos.',true)}
});
