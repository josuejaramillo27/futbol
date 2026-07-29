// Nuestra "Base de Datos" de las canchas afiliadas que pagan su mensualidad
const baseDeDatosCanchas = {
    maracana: {
        id: 'maracana',
        nombre: 'El Maracaná Fútbol 7',
        precio: 'S/ 60.00',
        servicios: '✓ Balón profesional ✓ 14 Chalecos ✓ Camerinos',
        imagenTema: 'linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8))'
    },
    wembley: {
        id: 'wembley',
        nombre: 'Wembley Sintética 5',
        precio: 'S/ 40.00',
        servicios: '✓ Balón ✓ Bebedero ✗ Sin chalecos',
        imagenTema: 'linear-gradient(rgba(4, 120, 87, 0.6), rgba(0,0,0,0.8))'
    }
};

// 1. Lógica para index.html: Pintar las canchas en la página principal
const contenedorCanchas = document.getElementById('canchas-container');
if (contenedorCanchas) {
    Object.values(baseDeDatosCanchas).forEach(cancha => {
        contenedorCanchas.innerHTML += `
            <div class="cancha-card">
                <h3>${cancha.nombre}</h3>
                <p class="text-verde font-bold">${cancha.precio} / hora</p>
                <p class="text-small" style="color: #94A3B8; font-size: 12px; margin-bottom: 15px;">${cancha.servicios}</p>
                <!-- Al hacer clic, enviamos el ID de la cancha en la URL -->
                <a href="cancha.html?id=${cancha.id}" class="btn-login" style="display:block; text-align:center;">Ver horarios y Reservar</a>
            </div>
        `;
    });
}

// 2. Lógica para cancha.html: Leer la URL y mostrar la info de la cancha correcta
function cargarDatosCancha() {
    // Leemos el link, ej: cancha.html?id=maracana
    const parametros = new URLSearchParams(window.location.search);
    const idCancha = parametros.get('id');

    // Buscamos la cancha en nuestra base de datos
    const datos = baseDeDatosCanchas[idCancha];

    if (datos) {
        // Reemplazamos los textos en el HTML
        document.getElementById('cancha-nombre-header').innerText = datos.nombre;
        document.getElementById('cancha-titulo').innerText = datos.nombre;
        document.getElementById('cancha-precio').innerText = datos.precio + ' / hora';
        document.getElementById('cancha-servicios').innerText = datos.servicios;
        document.getElementById('cancha-imagen').style.background = datos.imagenTema;
    } else {
        // Si entra al link sin ID o inventa uno
        document.getElementById('cancha-titulo').innerText = "Cancha no encontrada";
        document.getElementById('cancha-precio').innerText = "";
    }
}

// Función del botón reservar
function confirmarReserva() {
    const nombre = prompt("Para separar el horario, ingresa tu nombre:");
    if(nombre) {
        alert(`¡Reserva en proceso para ${nombre}! ⚽\n(En la versión final, esto abrirá la pasarela de pagos para abonar la mensualidad / reserva).`);
    }
}
