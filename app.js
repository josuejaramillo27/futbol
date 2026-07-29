// app.js
// 1. BASE DE DATOS SIMULADA (Próximamente Supabase/Firebase)
const bd = {
    canchas: [
        { 
            id: 'maracana', 
            nombre: 'La Maracaná 5v5', 
            precio: 80, 
            servicios: ['Balón', 'Chalecos', 'Duchas'],
            lat: -5.1950, // Coordenadas ejemplo (Piura)
            lng: -80.6270,
            imagen: 'https://images.unsplash.com/photo-1574629810360-1ef2ac304155?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
            reseñas: [
                { usuario: 'Carlos M.', texto: 'Excelente pasto, muy buena iluminación.', rating: 5 }
            ],
            horariosOcupados: ['20:00', '21:00']
        },
        { 
            id: 'wembley', 
            nombre: 'Wembley Sintético 7v7', 
            precio: 120, 
            servicios: ['Balón', 'Tribuna', 'Parqueo'],
            lat: -5.2000, 
            lng: -80.6300,
            imagen: 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
            reseñas: [],
            horariosOcupados: ['19:00']
        }
    ],
    bolsaJugadores: [
        { nombre: 'Juan Pérez', posicion: 'Arquero', mensaje: 'Busco equipo para los jueves en la noche.' }
    ]
};

// 2. UTILIDADES GEOLOCALIZACIÓN (Fórmula Haversine)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(2);
}

// 3. LÓGICA DE LA PÁGINA PRINCIPAL (Hub Social - index.html)
if (window.location.pathname.includes('index') || window.location.pathname === '/') {
    const contenedorCanchas = document.getElementById('lista-canchas');
    
    function renderizarCanchas(canchasArray, latUser = null, lngUser = null) {
        contenedorCanchas.innerHTML = '';
        canchasArray.forEach(cancha => {
            let distanciaHtml = '';
            if (latUser && lngUser) {
                const dist = calcularDistancia(latUser, lngUser, cancha.lat, cancha.lng);
                distanciaHtml = `<p class="distancia">📍 A ${dist} km de ti</p>`;
            }
            
            const ratingAvg = cancha.reseñas.length > 0 
                ? (cancha.reseñas.reduce((a,b)=>a+b.rating,0) / cancha.reseñas.length).toFixed(1) 
                : 'Nuevo';

            contenedorCanchas.innerHTML += `
                <div class="card">
                    <img src="${cancha.imagen}" alt="${cancha.nombre}" style="width:100%; border-radius:8px;">
                    <h3>${cancha.nombre}</h3>
                    <p>⭐ ${ratingAvg}/5 | 💰 S/${cancha.precio} por hora</p>
                    ${distanciaHtml}
                    <a href="cancha.html?id=${cancha.id}" class="btn">Ver Disponibilidad y Reservar</a>
                </div>
            `;
        });
    }

    renderizarCanchas(bd.canchas);

    // Botón de Cercanía
    document.getElementById('btn-geo').addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const { latitude, longitude } = position.coords;
                // Ordenar por distancia
                const canchasOrdenadas = [...bd.canchas].sort((a, b) => {
                    return calcularDistancia(latitude, longitude, a.lat, a.lng) - calcularDistancia(latitude, longitude, b.lat, b.lng);
                });
                renderizarCanchas(canchasOrdenadas, latitude, longitude);
            });
        } else {
            alert("Tu navegador no soporta geolocalización.");
        }
    });
}

// 4. LÓGICA DEL MINI-SITIO (Transaccional - cancha.html)
if (window.location.pathname.includes('cancha.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const idCancha = urlParams.get('id');
    const canchaInfo = bd.canchas.find(c => c.id === idCancha);

    if (canchaInfo) {
        document.getElementById('cancha-nombre').innerText = canchaInfo.nombre;
        document.getElementById('cancha-precio').innerText = `S/ ${canchaInfo.precio} / Hora`;
        document.getElementById('cancha-servicios').innerText = canchaInfo.servicios.join(' - ');
        
        // Renderizar Horarios (Simulación 6 PM a 11 PM)
        const horariosDiv = document.getElementById('horarios-grid');
        const horasBase = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];
        
        horasBase.forEach(hora => {
            const ocupado = canchaInfo.horariosOcupados.includes(hora);
            const clase = ocupado ? 'btn-horario ocupado' : 'btn-horario libre';
            const texto = ocupado ? 'Reservado' : hora;
            horariosDiv.innerHTML += `<button class="${clase}" ${ocupado ? 'disabled' : ''}>${texto}</button>`;
        });

        // Renderizar Reseñas
        const reseñasDiv = document.getElementById('lista-reseñas');
        if (canchaInfo.reseñas.length === 0) reseñasDiv.innerHTML = '<p>Sé el primero en dejar una reseña.</p>';
        canchaInfo.reseñas.forEach(r => {
            reseñasDiv.innerHTML += `<div class="resena"><strong>${r.usuario} (⭐${r.rating})</strong><br>${r.texto}</div>`;
        });
    } else {
        document.body.innerHTML = '<h1>Cancha no encontrada</h1>';
    }
}
