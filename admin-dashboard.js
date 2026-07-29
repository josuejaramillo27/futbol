// admin-dashboard.js

// 1. Verificar si hay un usuario logueado (Simulación previa a Firebase)
// Aquí pondremos la validación de Firebase. Si no hay usuario, lo devolverá a login.html.

// 2. Datos Simulados (Próximamente vendrán de la base de datos)
const datosFinancieros = {
    etiquetas: ['Hoy', 'Esta Semana', 'Este Mes'],
    ingresos: [320, 1850, 6500], // Montos en dinero
    reservas: [4, 22, 85]        // Cantidad de partidos
};

// Actualizar KPIs de texto
document.getElementById('ingresos-hoy').innerText = `S/ ${datosFinancieros.ingresos[0]}`;
document.getElementById('reservas-hoy').innerText = datosFinancieros.reservas[0];

// 3. Generar Gráfico de Ingresos
const ctxIngresos = document.getElementById('graficoIngresos').getContext('2d');
new Chart(ctxIngresos, {
    type: 'bar', // Tipo de gráfico: Barras
    data: {
        labels: datosFinancieros.etiquetas,
        datasets: [{
            label: 'Ingresos (S/)',
            data: datosFinancieros.ingresos,
            backgroundColor: 'rgba(40, 167, 69, 0.6)', // Verde
            borderColor: 'rgba(40, 167, 69, 1)',
            borderWidth: 1
        }]
    }
});

// 4. Generar Gráfico de Reservas
const ctxReservas = document.getElementById('graficoReservas').getContext('2d');
new Chart(ctxReservas, {
    type: 'line', // Tipo de gráfico: Línea
    data: {
        labels: datosFinancieros.etiquetas,
        datasets: [{
            label: 'Cantidad de Reservas',
            data: datosFinancieros.reservas,
            backgroundColor: 'rgba(54, 162, 235, 0.2)', // Azul
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2,
            fill: true
        }]
    },
    options: {
        scales: {
            y: { beginAtZero: true }
        }
    }
});
