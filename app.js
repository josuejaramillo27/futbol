// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    // Pega tus claves aquí nuevamente
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ======= 1. LÓGICA DEL HUB (index.html) =======
if (window.location.pathname.includes('index') || window.location.pathname === '/') {
    
    async function cargarCanchasAlgoritmo() {
        const contenedor = document.getElementById('lista-canchas');
        if(!contenedor) return;
        contenedor.innerHTML = '<p>Cargando canchas...</p>';

        const snapshot = await getDocs(collection(db, "canchas"));
        let canchas = [];
        
        // Obtener hora actual para saber si están abiertas
        const ahora = new Date();
        const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();

        snapshot.forEach(doc => {
            const data = doc.data();
            if(data.configurado) {
                // Calcular si está abierto
                let isOpen = false;
                if(data.horaApertura && data.horaCierre) {
                    const [hA, mA] = data.horaApertura.split(':').map(Number);
                    const [hC, mC] = data.horaCierre.split(':').map(Number);
                    const minApertura = (hA * 60) + mA;
                    const minCierre = (hC * 60) + mC;
                    
                    if (minCierre > minApertura) { // Horario normal (ej. 08:00 a 22:00)
                        isOpen = minutosActuales >= minApertura && minutosActuales <= minCierre;
                    } else { // Horario de trasnoche (ej. 18:00 a 02:00)
                        isOpen = minutosActuales >= minApertura || minutosActuales <= minCierre;
                    }
                }

                // Calcular rating (Si no tiene, le ponemos 0 por defecto)
                const rating = data.ratingPromedio || 0;
                
                canchas.push({ id: doc.id, ...data, isOpen, rating });
            }
        });

        // ALGORITMO DE ORDENAMIENTO: 
        // 1ro: Abiertas arriba. 2do: Mayor puntuación.
        canchas.sort((a, b) => {
            if (a.isOpen === b.isOpen) {
                return b.rating - a.rating; // Si ambos están abiertos o cerrados, gana el de más estrellas
            }
            return a.isOpen ? -1 : 1; // El abierto va primero
        });

        // Renderizar
        contenedor.innerHTML = '';
        canchas.forEach(c => {
            const estadoHtml = c.isOpen ? '<span class="badge-estado badge-abierto">🟢 Abierto Ahora</span>' : '<span class="badge-estado badge-cerrado">🔴 Cerrado</span>';
            const logoHtml = c.logo ? `<img src="${c.logo}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">` : '🏟️';
            
            contenedor.innerHTML += `
                <div class="card">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        ${logoHtml}
                        ${estadoHtml}
                    </div>
                    <h3 style="margin-top:10px;">${c.nombre}</h3>
                    <p>⭐ ${c.rating > 0 ? c.rating.toFixed(1) : 'Nuevo'} | 💰 S/ ${c.precio} / hr</p>
                    <p style="font-size:0.9rem; color:#aaa;">📍 ${c.ubicacionTexto || 'Ubicación no especificada'}</p>
                    <div class="btn-group">
                        <a href="cancha.html?id=${c.id}" class="btn"><i class="ph-bold ph-calendar-plus"></i> Reservar y Ver Más</a>
                    </div>
                </div>
            `;
        });
    }
    
    cargarCanchasAlgoritmo();
}

// ======= 2. LÓGICA DE RESEÑAS INDRIVE (cancha.html) =======
if (window.location.pathname.includes('cancha.html')) {
    // Aquí pondremos la lógica dinámica de estrellas
    const estrellas = document.querySelectorAll('.estrellas-container i');
    const tagsDiv = document.getElementById('tags-dinamicos');
    
    const tagsPositivos = ["Pasto excelente", "Balones nuevos", "Buena iluminación", "Limpio", "Buen trato"];
    const tagsNegativos = ["Pasto gastado", "Mala iluminación", "Faltan chalecos", "Impuntuales"];

    let estrellasSeleccionadas = 0;

    estrellas.forEach(estrella => {
        estrella.addEventListener('click', (e) => {
            estrellasSeleccionadas = parseInt(e.target.dataset.valor);
            
            // Pintar estrellas
            estrellas.forEach(s => s.classList.remove('activa', 'ph-fill'));
            estrellas.forEach(s => s.classList.add('ph-light'));
            for(let i=0; i < estrellasSeleccionadas; i++) {
                estrellas[i].classList.remove('ph-light');
                estrellas[i].classList.add('ph-fill', 'activa');
            }

            // Mostrar Tags según puntuación
            tagsDiv.innerHTML = '';
            const tagsAMostrar = estrellasSeleccionadas >= 4 ? tagsPositivos : tagsNegativos;
            
            tagsAMostrar.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag-resena';
                span.innerText = tag;
                span.onclick = () => span.classList.toggle('seleccionado');
                tagsDiv.appendChild(span);
            });
        });
    });
}
