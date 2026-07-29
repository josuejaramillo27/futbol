// Navegación entre vistas
const btnJugador = document.getElementById('btn-jugador');
const btnAdmin = document.getElementById('btn-admin');
const vistaJugador = document.getElementById('vista-jugador');
const vistaAdmin = document.getElementById('vista-admin');

btnJugador.addEventListener('click', () => {
    vistaJugador.classList.remove('seccion-oculta');
    vistaJugador.classList.add('seccion-activa');
    
    vistaAdmin.classList.remove('seccion-activa');
    vistaAdmin.classList.add('seccion-oculta');
    
    btnJugador.classList.add('active');
    btnAdmin.classList.remove('active');
});

btnAdmin.addEventListener('click', () => {
    vistaAdmin.classList.remove('seccion-oculta');
    vistaAdmin.classList.add('seccion-activa');
    
    vistaJugador.classList.remove('seccion-activa');
    vistaJugador.classList.add('seccion-oculta');
    
    btnAdmin.classList.add('active');
    btnJugador.classList.remove('active');
});

// Función para el jugador al darle a reservar
function reservarCancha(nombreCancha) {
    // Aquí puedes pedir el nombre del jugador en el futuro
    let nombre = prompt("Ingresa tu nombre para la reserva:");
    
    if(nombre) {
        alert(`¡Pase filtrado, ${nombre}! ⚽\nHas iniciado la reserva para: ${nombreCancha}.\n\nPronto implementaremos la pasarela de pagos.`);
    } else {
        alert("Reserva cancelada. Necesitamos tu nombre para separar la cancha.");
    }
}

// Lógica para guardar ajustes del administrador
const switches = document.querySelectorAll('input[type="checkbox"]');
const mensajeGuardado = document.getElementById('mensaje-guardado');

switches.forEach(interruptor => {
    interruptor.addEventListener('change', () => {
        // Muestra un mensaje temporal de guardado
        mensajeGuardado.classList.remove('oculto');
        mensajeGuardado.style.color = "#10B981";
        
        setTimeout(() => {
            mensajeGuardado.classList.add('oculto');
        }, 2000);
    });
});
