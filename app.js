import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",
  authDomain: "app-futbol-acd0f.firebaseapp.com",
  projectId: "app-futbol-acd0f",
  storageBucket: "app-futbol-acd0f.firebasestorage.app",
  messagingSenderId: "223446110165",
  appId: "1:223446110165:web:219afce6a9dac03203f75c"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let canchasGlobales = []; // Guardamos las canchas en memoria para la Modal

if (window.location.pathname.includes('index') || window.location.pathname === '/') {
    
    async function cargarCanchasAlgoritmo() {
        const contenedor = document.getElementById('lista-canchas');
        if(!contenedor) return;
        contenedor.innerHTML = '<p>Cargando canchas premium...</p>';

        const snapshot = await getDocs(collection(db, "canchas"));
        canchasGlobales = [];
        
        const ahora = new Date();
        const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();

        snapshot.forEach(doc => {
            const data = doc.data();
            if(data.configurado) {
                let isOpen = false;
                if(data.horaApertura && data.horaCierre) {
                    const [hA, mA] = data.horaApertura.split(':').map(Number);
                    const [hC, mC] = data.horaCierre.split(':').map(Number);
                    const minA = (hA * 60) + mA;
                    const minC = (hC * 60) + mC;
                    if (minC > minA) isOpen = minutosActuales >= minA && minutosActuales <= minC;
                    else isOpen = minutosActuales >= minA || minutosActuales <= minC;
                }
                canchasGlobales.push({ id: doc.id, ...data, isOpen, rating: data.ratingPromedio || 0 });
            }
        });

        canchasGlobales.sort((a, b) => {
            if (a.isOpen === b.isOpen) return b.rating - a.rating;
            return a.isOpen ? -1 : 1;
        });

        contenedor.innerHTML = '';
        canchasGlobales.forEach(c => {
            const estadoHtml = c.isOpen ? '<span class="badge-estado badge-abierto">🟢 Abierto Ahora</span>' : '<span class="badge-estado badge-cerrado">🔴 Cerrado</span>';
            const logoSrc = c.logo || 'https://via.placeholder.com/50';
            const portadaSrc = (c.fotos && c.fotos.length > 0) ? c.fotos[0] : 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=800&q=80'; // Foto 1 o Default
            
            contenedor.innerHTML += `
                <div class="card" style="padding:0; overflow:hidden;">
                    <div style="height:150px; background-image:url('${portadaSrc}'); background-size:cover; background-position:center; position:relative;">
                        <div style="position:absolute; top:10px; right:10px;">${estadoHtml}</div>
                    </div>
                    
                    <div style="padding:20px;">
                        <div style="display:flex; align-items:center; gap:10px; margin-top:-40px; margin-bottom:10px;">
                            <img src="${logoSrc}" style="width:60px; height:60px; border-radius:50%; border:3px solid var(--card-bg); object-fit:cover;">
                            <h3 style="margin-top:20px;">${c.nombre}</h3>
                        </div>
                        
                        <p>⭐ ${c.rating > 0 ? c.rating.toFixed(1) : 'Nuevo'} | 💰 S/ ${c.precio} / hr</p>
                        
                        <div class="btn-group">
                            <button onclick="abrirModal('${c.id}')">Ver Info y Reservar</button>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    cargarCanchasAlgoritmo();
}

// === LÓGICA DE LA VENTANA MODAL ===
window.abrirModal = function(idCancha) {
    const cancha = canchasGlobales.find(c => c.id === idCancha);
    if(!cancha) return;

    // Llenar datos de la Modal
    document.getElementById('modal-nombre').innerText = cancha.nombre;
    document.getElementById('modal-logo').src = cancha.logo || 'https://via.placeholder.com/60';
    document.getElementById('modal-imagen-principal').src = (cancha.fotos && cancha.fotos.length > 0) ? cancha.fotos[0] : 'https://images.unsplash.com/photo-1518605368461-1e1e38ce81ba?auto=format&fit=crop&w=800&q=80';
    document.getElementById('modal-precio').innerText = cancha.precio;
    document.getElementById('modal-rating').innerText = cancha.rating > 0 ? cancha.rating.toFixed(1) : 'Nuevo';
    document.getElementById('modal-horario').innerText = `${cancha.horaApertura || '??:??'} a ${cancha.horaCierre || '??:??'}`;
    document.getElementById('modal-descripcion').innerText = cancha.descripcion || 'Sin descripción disponible.';
    
    // Links dinámicos
    document.getElementById('modal-link-maps').href = cancha.ubicacionLink || '#';
    
    // WhatsApp con mensaje predeterminado
    const mensaje = `Hola ${cancha.nombre}, vengo de APP FUTBOL y quiero consultar disponibilidad para reservar.`;
    document.getElementById('btn-whatsapp-reserva').href = `https://wa.me/${cancha.whatsapp}?text=${encodeURIComponent(mensaje)}`;
    
    // El botón de reseñas enviará a la página anterior de reseñas
    document.getElementById('btn-ver-resenas').href = `cancha.html?id=${cancha.id}`;

    // Mostrar Modal
    document.getElementById('modal-cancha').classList.add('mostrar');
};

// Cerrar Modal
const btnCerrar = document.getElementById('cerrar-modal');
if(btnCerrar) {
    btnCerrar.addEventListener('click', () => {
        document.getElementById('modal-cancha').classList.remove('mostrar');
    });
}
