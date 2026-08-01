// availability.js - Motor central de horarios y disponibilidad (FASE 18)

export function fechaISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function minutos(t) {
    const m = String(t||'').match(/^(\d{1,2}):(\d{2})$/);
    return m ? Number(m[1])*60 + Number(m[2]) : null;
}

export function obtenerHorarioDia(cancha, fecha) {
    if (!cancha) return { activo: false };
    const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    const d = typeof fecha === 'string' ? new Date(`${fecha}T12:00:00`) : fecha;
    const nombreDia = dias[d.getDay()];
    
    const semanal = cancha.horariosSemana?.[nombreDia];
    if (semanal) return semanal; // Si el dueño personalizó el día
    
    return {
        activo: true,
        apertura: cancha.horaApertura || '16:00',
        cierre: cancha.horaCierre || '23:00'
    };
}

export function calcularDisponibilidad(cancha, fecha, reservas = [], bloqueos = []) {
    const horario = obtenerHorarioDia(cancha, fecha);
    if (!horario.activo) return [];

    const a = minutos(horario.apertura);
    const b0 = minutos(horario.cierre);
    const step = Number(cancha.intervaloMinutos || cancha.duracionReserva || 60);

    if (a === null || b0 === null || step <= 0) return [];
    
    let b = b0 <= a ? b0 + 1440 : b0;
    
    const fechaStr = typeof fecha === 'string' ? fecha : fechaISO(fecha);
    const hoyStr = fechaISO(new Date());
    const esHoy = fechaStr === hoyStr;
    const now = new Date();
    const actual = now.getHours() * 60 + now.getMinutes();

    const slots = [];
    
    for (let t = a; t < b; t += step) {
        const real = t % 1440;
        const horaStr = `${String(Math.floor(real/60)).padStart(2,'0')}:${String(real%60).padStart(2,'0')}`;
        
        // Filtrar reservas válidas y bloqueos
        const reserva = reservas.find(r => r.horaInicio === horaStr && !['cancelada', 'cancelado', 'cancelled', 'rejected'].includes(String(r.estado||'').toLowerCase()));
        const bloqueo = bloqueos.find(bk => bk.horaInicio === horaStr);
        const pasado = esHoy && real < actual;
        
        let estado = 'disponible';
        if (bloqueo) estado = 'bloqueado';
        else if (reserva) estado = 'reservado';
        else if (pasado) estado = 'pasado';

        slots.push({
            hora: horaStr,
            minutos: real,
            estado: estado,
            reserva: reserva || null,
            bloqueo: bloqueo || null
        });
    }
    
    return slots;
}
