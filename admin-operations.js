import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk", authDomain: "app-futbol-acd0f.firebaseapp.com", projectId: "app-futbol-acd0f", storageBucket: "app-futbol-acd0f.firebasestorage.app", messagingSenderId: "223446110165", appId: "1:223446110165:web:219afce6a9dac03203f75c" };
const app = getApps().length ? getApp() : initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
let user = null, espacios = [], eventos = [], canchaPrincipalData = null;

const $ = id => document.getElementById(id);

function escapeHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const toast = (msg, error = false) => { const el = $('toast-admin'); if (!el) return; el.textContent = msg; el.className = `admin-toast show ${error ? 'error' : ''}`; clearTimeout(window.__toast); window.__toast = setTimeout(() => el.className = 'admin-toast', 2800) };

const openModal = id => {
    const m = $(id);
    if (!m) return;
    m.style.display = 'flex';
    m.classList.add('mostrar');
    m.setAttribute('aria-hidden', 'false');
};

const closeModal = id => {
    const m = $(id);
    if (!m) return;
    m.classList.remove('mostrar');
    m.style.display = 'none';
    m.setAttribute('aria-hidden', 'true');
};

const fmtDateTime = s => { if (!s) return 'Sin fecha'; const d = new Date(s); return isNaN(d) ? s : new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d) };
const diasNombre = { '1': 'Lunes', '2': 'Martes', '3': 'Miércoles', '4': 'Jueves', '5': 'Viernes', '6': 'Sábado', '0': 'Domingo' };

function normalizarSuperficie(s) {
    if (!s) return 'Sintética';
    const str = String(s).trim();
    if (/losa|futsal|cemento/i.test(str)) return 'Losa / Cemento';
    if (/pasto\s*natural/i.test(str)) return 'Pasto Natural';
    if (/parquet|coliseo/i.test(str)) return 'Parquet / Coliseo';
    if (/arena/i.test(str)) return 'Arena';
    if (/sint[eé]tica/i.test(str)) return 'Sintética';
    const validas = ['Sintética', 'Losa / Cemento', 'Pasto Natural', 'Parquet / Coliseo', 'Arena'];
    return validas.includes(str) ? str : 'Sintética';
}

function parsearTipoEspacio(data) {
    let formato = 7;
    let superficie = 'Sintética';

    if (data?.formatoJugadores != null || data?.formato != null) {
        const f = parseInt(data.formatoJugadores ?? data.formato, 10);
        if (!isNaN(f)) formato = Math.min(11, Math.max(5, f));
    }
    if (data?.superficie) {
        superficie = data.superficie;
    }

    if ((data?.formatoJugadores == null && data?.formato == null) || !data?.superficie) {
        const raw = (Array.isArray(data?.tiposCancha) && data.tiposCancha[0]) || data?.tipoCancha || data?.tipo || '';
        if (raw) {
            const matchSeparado = raw.match(/Fútbol\s+(\d+)\s*-\s*(.+)/i);
            if (matchSeparado) {
                if (data?.formatoJugadores == null && data?.formato == null) {
                    const f = parseInt(matchSeparado[1], 10);
                    if (!isNaN(f)) formato = Math.min(11, Math.max(5, f));
                }
                if (!data?.superficie) {
                    superficie = normalizarSuperficie(matchSeparado[2].trim());
                }
            } else {
                const matchFutbol = raw.match(/Fútbol\s+(\d+)/i);
                if (matchFutbol && data?.formatoJugadores == null && data?.formato == null) {
                    const f = parseInt(matchFutbol[1], 10);
                    if (!isNaN(f)) formato = Math.min(11, Math.max(5, f));
                }
                if (!data?.superficie) {
                    superficie = normalizarSuperficie(raw);
                }
            }
        }
    }

    return { formato, superficie: normalizarSuperficie(superficie) };
}

async function cargarEspacios() {
    if (!user) return;
    const [snapNuevas, snapAntigua] = await Promise.all([
        getDocs(query(collection(db, 'espacios'), where('ownerUid', '==', user.uid))),
        getDoc(doc(db, 'canchas', user.uid))
    ]);

    canchaPrincipalData = snapAntigua.exists() ? snapAntigua.data() : null;

    espacios = snapNuevas.docs.map(d => {
        const data = d.data();
        const tienePrecioNoche = data.tienePrecioNoche !== undefined ? !!data.tienePrecioNoche : !!canchaPrincipalData?.tienePrecioNoche;
        const horaInicioNoche = data.horaInicioNoche || canchaPrincipalData?.horaInicioNoche || '18:00';
        const precioNoche = Number(data.precioNoche ?? canchaPrincipalData?.precioNoche ?? 0);
        return {
            id: d.id,
            ...data,
            tienePrecioNoche,
            horaInicioNoche,
            precioNoche
        };
    });

    if (snapAntigua.exists()) {
        const c = snapAntigua.data();
        const parsedLegacy = parsearTipoEspacio(c);
        espacios.unshift({
            id: snapAntigua.id,
            nombre: c.nombre ? `${c.nombre} (Principal)` : 'Cancha Principal',
            tipo: `Fútbol ${parsedLegacy.formato} - ${parsedLegacy.superficie}`,
            formatoJugadores: parsedLegacy.formato,
            superficie: parsedLegacy.superficie,
            precio: c.precio || 0,
            tienePrecioNoche: !!c.tienePrecioNoche,
            horaInicioNoche: c.horaInicioNoche || '18:00',
            precioNoche: Number(c.precioNoche || 0),
            horaApertura: c.horaApertura || '',
            horaCierre: c.horaCierre || '',
            esLegacy: true
        });
    }

    renderEspacios();
    renderSelectEspacios();
}

window.addEventListener('chalacapp:cancha-updated', () => {
    cargarEspacios();
});

async function cargarEventos() {
    if (!user) return;
    const snap = await getDocs(query(collection(db, 'eventos'), where('ownerUid', '==', user.uid)));
    eventos = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.inicio || '').localeCompare(String(a.inicio || '')));
    renderEventos();
}

function renderEspacios() {
    const box = $('lista-espacios'); if (!box) return;
    if (!espacios.length) {
        box.innerHTML = `<div class="admin-empty compact"><i class="ph-bold ph-soccer-ball"></i><b>Aún no tienes canchas registradas</b><span>Agrega tu primera cancha y configura sus precios de día y noche.</span></div>`;
        return;
    }

    box.innerHTML = espacios.map(e => {
        const precioTexto = e.tienePrecioNoche && Number(e.precioNoche) > 0
            ? `☀️ Día: S/ ${Number(e.precio || 0)} | 🌙 Noche: S/ ${Number(e.precioNoche)} (desde ${escapeHTML(e.horaInicioNoche || '18:00')})`
            : `☀️ Tarifa Única: S/ ${Number(e.precio || 0)}`;

        const etiquetaEstado = e.esLegacy
            ? `<span class="space-status" style="background:rgba(52, 152, 219, 0.2); color:#3498db; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">Principal</span>`
            : `<span class="space-status" style="background:rgba(46, 204, 113, 0.2); color:#2ecc71; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">Adicional</span>`;

        const parsed = parsearTipoEspacio(e);
        const tipoMostrar = e.tipo || `Fútbol ${parsed.formato} - ${parsed.superficie}`;

        return `<article class="space-card" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:15px; border-radius:12px; display:flex; align-items:center; gap:15px;">
            <div class="space-icon" style="background:rgba(46,204,113,0.1); color:#2ecc71; width:45px; height:45px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.5rem; flex-shrink:0;"><i class="ph-bold ph-soccer-ball"></i></div>
            <div class="space-main" style="flex:1; min-width:0;">
                <div class="space-top" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; gap:8px; flex-wrap:wrap;">
                    <h3 style="margin:0; font-size:1.1rem; color:#fff;">${escapeHTML(e.nombre || 'Cancha')}</h3>
                    ${etiquetaEstado}
                </div>
                <p style="margin:0 0 5px 0; font-size:0.85rem; color:#ccc; font-weight:bold;">${precioTexto}</p>
                <small style="color:#888; font-size:0.75rem;">Formato: ${escapeHTML(tipoMostrar)}</small>
            </div>
            <div class="space-actions" style="display:flex; gap:8px;">
                <button type="button" class="icon-btn edit-space" data-id="${escapeHTML(e.id)}" title="Editar" style="background:rgba(255,255,255,0.05); border:none; color:#fff; width:35px; height:35px; border-radius:8px; cursor:pointer;"><i class="ph-bold ph-pencil-simple"></i></button>
                ${!e.esLegacy ? `<button type="button" class="icon-btn delete-space" data-id="${escapeHTML(e.id)}" title="Eliminar" style="background:rgba(231,76,60,0.1); border:none; color:#e74c3c; width:35px; height:35px; border-radius:8px; cursor:pointer;"><i class="ph-bold ph-trash"></i></button>` : ''}
            </div>
        </article>`;
    }).join('');

    box.querySelectorAll('.edit-space').forEach(b => b.onclick = () => editarEspacio(b.dataset.id));
    box.querySelectorAll('.delete-space').forEach(b => b.onclick = () => eliminarEspacio(b.dataset.id));
}

function renderSelectEspacios() {
    const sel = $('evento-espacios'); if (!sel) return;
    sel.innerHTML = espacios.length
        ? espacios.map(e => `<option value="${escapeHTML(e.id)}" style="padding:8px;">${escapeHTML(e.nombre)} (${escapeHTML(e.tipo || 'Cancha')})</option>`).join('')
        : `<option value="" disabled>Primero registra al menos una cancha arriba</option>`;
}

function renderEventos() {
    const box = $('lista-eventos'); if (!box) return;
    if (!eventos.length) {
        box.innerHTML = `<div class="admin-empty compact"><i class="ph-bold ph-lock-key"></i><b>No hay bloqueos ni abonados</b><span>Usa este panel para separar canchas a academias o clientes fijos.</span></div>`;
        return;
    }

    box.innerHTML = eventos.map(ev => {
        const nombresCanchas = (ev.espacioIds || []).map(id => espacios.find(e => e.id === id)?.nombre).filter(Boolean).join(', ') || 'Cancha general';
        const esAbonado = ev.tipo === 'abonado';
        const badgeColor = esAbonado ? '#f1c40f' : '#3498db';
        const badgeText = esAbonado ? 'ABONADO FIJO' : 'EVENTO ÚNICO';
        const detalleTiempo = esAbonado
            ? `Todos los <b>${escapeHTML(diasNombre[ev.abonadoDia] || 'días')}</b> a las <b>${escapeHTML(ev.abonadoHora || '')}</b> (Por ${escapeHTML(ev.abonadoMeses || '1')} meses)`
            : `${escapeHTML(fmtDateTime(ev.inicio))} — ${escapeHTML(fmtDateTime(ev.fin))}`;

        return `<article class="event-card" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:15px; border-radius:12px; display:flex; align-items:center; gap:15px; margin-bottom:10px;">
            <div class="event-icon" style="background:rgba(52,152,219,0.1); color:${badgeColor}; width:45px; height:45px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.5rem; flex-shrink:0;">
                <i class="ph-bold ${esAbonado ? 'ph-arrows-clockwise' : 'ph-calendar-x'}"></i>
            </div>
            <div class="event-main" style="flex:1; min-width:0;">
                <div class="event-top" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; gap:8px; flex-wrap:wrap;">
                    <h3 style="margin:0; font-size:1.05rem; color:#fff;">${escapeHTML(ev.nombre || 'Reserva Especial')}</h3>
                    <span style="background:rgba(255,255,255,0.05); color:${badgeColor}; border: 1px solid ${badgeColor}; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:bold;">${badgeText}</span>
                </div>
                <p style="margin:0 0 5px 0; font-size:0.85rem; color:#aaa;">${detalleTiempo}</p>
                <small style="color:#666; font-size:0.75rem;"><i class="ph-fill ph-Court-Basketball"></i> Ocupa: ${escapeHTML(nombresCanchas)}</small>
            </div>
            <button type="button" class="icon-btn delete-event" data-id="${escapeHTML(ev.id)}" title="Liberar Cancha" style="background:rgba(231,76,60,0.1); border:none; color:#e74c3c; width:35px; height:35px; border-radius:8px; cursor:pointer;"><i class="ph-bold ph-trash"></i></button>
        </article>`;
    }).join('');

    box.querySelectorAll('.delete-event').forEach(b => b.onclick = () => eliminarEvento(b.dataset.id));
}

function editarEspacio(id) {
    const e = espacios.find(x => x.id === id); if (!e) return;
    const parsed = parsearTipoEspacio(e);

    $('espacio-modal-title').textContent = 'Editar Cancha';
    $('espacio-id').value = e.id;
    $('espacio-nombre').value = e.nombre.replace(' (Principal)', '') || '';
    if ($('espacio-formato')) $('espacio-formato').value = parsed.formato;
    if ($('espacio-superficie')) $('espacio-superficie').value = parsed.superficie;
    $('espacio-precio').value = e.precio ?? '';

    $('espacio-hora-apertura').value = e.horaApertura || '';
    $('espacio-hora-cierre').value = e.horaCierre || '';

    const tieneNoche = !!e.tienePrecioNoche;
    $('espacio-check-noche').checked = tieneNoche;
    $('caja-noche').style.display = tieneNoche ? 'flex' : 'none';
    $('espacio-hora-noche').value = e.horaInicioNoche || '18:00';
    $('espacio-precio-noche').value = e.precioNoche || '';

    openModal('modal-espacio');
}

async function eliminarEspacio(id) {
    const confirmar = window.customConfirm
        ? await window.customConfirm('¿Seguro que deseas eliminar esta cancha?')
        : confirm('¿Seguro que deseas eliminar esta cancha?');
    if (!confirmar) return;
    try {
        await deleteDoc(doc(db, 'espacios', id));
        toast('Cancha eliminada.');
        await cargarEspacios();
        window.dispatchEvent(new CustomEvent('chalacapp:espacios-updated'));
    } catch (e) { toast('No se pudo eliminar.', true); }
}

async function eliminarEvento(id) {
    const confirmar = window.customConfirm
        ? await window.customConfirm('¿Eliminar este bloqueo? Las horas volverán a estar libres para todo el público.')
        : confirm('¿Eliminar este bloqueo? Las horas volverán a estar libres para todo el público.');
    if (!confirmar) return;
    try {
        await deleteDoc(doc(db, 'eventos', id));
        toast('Bloqueo eliminado y horas liberadas.');
        await cargarEventos();
    } catch (e) { toast('No se pudo eliminar.', true); }
}

function bindUI() {
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeModal(b.dataset.close));
    document.querySelectorAll('.admin-modal').forEach(m => m.addEventListener('click', e => { if (e.target === m && m.id) closeModal(m.id); }));

    const espacioFormatoInput = $('espacio-formato');
    if (espacioFormatoInput) {
        espacioFormatoInput.addEventListener('input', () => {
            let val = parseInt(espacioFormatoInput.value, 10);
            if (isNaN(val)) return;
            if (val > 11) espacioFormatoInput.value = 11;
        });
        espacioFormatoInput.addEventListener('blur', () => {
            let val = parseInt(espacioFormatoInput.value, 10);
            if (isNaN(val) || val < 5) espacioFormatoInput.value = 5;
            else if (val > 11) espacioFormatoInput.value = 11;
        });
    }

    $('btn-nuevo-espacio')?.addEventListener('click', () => {
        $('form-espacio')?.reset();
        $('espacio-id').value = '';
        if ($('espacio-formato')) $('espacio-formato').value = 7;
        if ($('espacio-superficie')) $('espacio-superficie').value = 'Sintética';
        if ($('espacio-precio') && canchaPrincipalData?.precio) {
            $('espacio-precio').value = canchaPrincipalData.precio;
        }
        // Heredar tarifa nocturna del complejo principal por defecto al crear nueva cancha secundaria
        const heredaNoche = !!canchaPrincipalData?.tienePrecioNoche;
        if ($('espacio-check-noche')) $('espacio-check-noche').checked = heredaNoche;
        if ($('caja-noche')) $('caja-noche').style.display = heredaNoche ? 'flex' : 'none';
        if ($('espacio-hora-noche')) $('espacio-hora-noche').value = canchaPrincipalData?.horaInicioNoche || '18:00';
        if ($('espacio-precio-noche')) $('espacio-precio-noche').value = canchaPrincipalData?.precioNoche || '';

        $('espacio-modal-title').textContent = 'Agregar Nueva Cancha';
        openModal('modal-espacio');
    });

    $('btn-nuevo-evento')?.addEventListener('click', () => {
        $('form-evento')?.reset();
        $('caja-evento-unico').style.display = 'block';
        $('caja-evento-abonado').style.display = 'none';
        const now = new Date(), end = new Date(now.getTime() + 7200000);
        const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`;
        $('evento-inicio').value = isoLocal(now);
        $('evento-fin').value = isoLocal(end);
        openModal('modal-evento');
    });

    $('form-espacio')?.addEventListener('submit', async e => {
        e.preventDefault(); if (!user) return;
        const id = $('espacio-id').value;
        const checkNoche = $('espacio-check-noche').checked;
        const horaAperturaVal = $('espacio-hora-apertura').value;
        const horaCierreVal = $('espacio-hora-cierre').value;

        let formato = parseInt($('espacio-formato')?.value, 10);
        if (isNaN(formato) || formato < 5) formato = 5;
        else if (formato > 11) formato = 11;
        if ($('espacio-formato')) $('espacio-formato').value = formato;

        const superficie = ($('espacio-superficie')?.value || 'Sintética').trim();
        const tipoCombinado = `Fútbol ${formato} - ${superficie}`;

        const horaInicioNoche = checkNoche ? ($('espacio-hora-noche').value || canchaPrincipalData?.horaInicioNoche || '18:00') : '18:00';
        const precioNoche = checkNoche ? Number($('espacio-precio-noche').value || canchaPrincipalData?.precioNoche || 0) : 0;

        const payload = {
            ownerUid: user.uid,
            canchaId: user.uid,
            nombre: $('espacio-nombre').value.trim(),
            tipo: tipoCombinado,
            formatoJugadores: formato,
            superficie: superficie,
            precio: Number($('espacio-precio').value || 0),
            tienePrecioNoche: checkNoche,
            horaInicioNoche,
            precioNoche,
            horaApertura: horaAperturaVal || null,
            horaCierre: horaCierreVal || null,
            estado: 'Disponible',
            updatedAt: serverTimestamp()
        };

        try {
            if (id === user.uid) {
                await setDoc(doc(db, 'canchas', user.uid), {
                    nombre: payload.nombre,
                    precio: payload.precio,
                    tienePrecioNoche: payload.tienePrecioNoche,
                    horaInicioNoche: payload.horaInicioNoche,
                    precioNoche: payload.precioNoche,
                    tiposCancha: [payload.tipo],
                    formatoJugadores: payload.formatoJugadores,
                    superficie: payload.superficie,
                    ...(payload.horaApertura ? { horaApertura: payload.horaApertura } : {}),
                    ...(payload.horaCierre ? { horaCierre: payload.horaCierre } : {}),
                    updatedAt: serverTimestamp()
                }, { merge: true });
            } else if (id) {
                await setDoc(doc(db, 'espacios', id), payload, { merge: true });
            } else {
                await addDoc(collection(db, 'espacios'), { ...payload, createdAt: serverTimestamp() });
            }
            closeModal('modal-espacio');
            toast('Cancha guardada con éxito.');
            await cargarEspacios();
            window.dispatchEvent(new CustomEvent('chalacapp:espacios-updated'));
        } catch (err) { console.error(err); toast('Error al guardar la cancha.', true); }
    });

    $('form-evento')?.addEventListener('submit', async e => {
        e.preventDefault(); if (!user) return;
        const espacioIds = Array.from($('evento-espacios').selectedOptions).map(o => o.value).filter(Boolean);
        if (!espacioIds.length) { toast('Debes seleccionar al menos una cancha de la lista.', true); return; }

        const tipo = $('evento-tipo').value;
        const payload = {
            ownerUid: user.uid,
            canchaId: user.uid,
            nombre: $('evento-nombre').value.trim(),
            tipo: tipo,
            espacioIds: espacioIds,
            bloquea: true,
            createdAt: serverTimestamp()
        };

        if (tipo === 'unico') {
            if (!$('evento-inicio').value || !$('evento-fin').value) return toast('Completa las fechas de inicio y fin.', true);
            payload.inicio = $('evento-inicio').value;
            payload.fin = $('evento-fin').value;
        } else {
            if (!$('abonado-hora').value) return toast('Especifica la hora del abonado fijo.', true);
            payload.abonadoDia = $('abonado-dia').value;
            payload.abonadoHora = $('abonado-hora').value;
            payload.abonadoMeses = Number($('abonado-meses').value || 1);
            payload.inicio = new Date().toISOString();
        }

        try {
            await addDoc(collection(db, 'eventos'), payload);
            closeModal('modal-evento');
            toast(tipo === 'abonado' ? 'Abonado fijo registrado.' : 'Cancha bloqueada para el evento.');
            await cargarEventos();
        } catch (err) { console.error(err); toast('Error al registrar el bloqueo.', true); }
    });
}

bindUI();
onAuthStateChanged(auth, async u => {
    user = u; if (!u) return;
    try { await Promise.all([cargarEspacios(), cargarEventos()]); }
    catch (e) { console.error(e); }
});
