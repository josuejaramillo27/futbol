// =========================================================
// MÓDULO 4: PRIVACIDAD, COOKIES Y ASPECTOS LEGALES (LEY N° 29733)
// =========================================================

export function initLegalCompliance() {
    // 1. Exponer función global para abrir el Modal de Términos y Privacidad
    window.abrirModalTerminos = function () {
        let modal = document.getElementById('modal-terminos-legales');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-terminos-legales';
            modal.className = 'modal-oculto mostrar';
            modal.style.zIndex = '100000';
            modal.innerHTML = `
                <div class="modal-contenido" style="max-width: 580px; padding: 28px 24px; position: relative; border: 1px solid rgba(46, 204, 113, 0.4);">
                    <button type="button" class="btn-cerrar" id="cerrar-modal-terminos" aria-label="Cerrar"><i class="ph-bold ph-x"></i></button>
                    <span class="mini-label" style="color: #2ecc71; font-weight: 800; font-size: 0.72rem; letter-spacing: 1px; display: block; margin-bottom: 6px;">CUMPLIMIENTO LEGAL · LEY N° 29733</span>
                    <h2 style="color: #fff; margin: 0 0 14px 0; font-size: 1.35rem; display: flex; align-items: center; gap: 8px;">
                        <i class="ph-fill ph-shield-check" style="color: #2ecc71;"></i> Términos de Uso y Privacidad
                    </h2>
                    <div style="max-height: 60vh; overflow-y: auto; padding-right: 6px; color: #cfd8d3; font-size: 0.84rem; line-height: 1.65; display: flex; flex-direction: column; gap: 12px; text-align: left;">
                        <p style="margin:0;">Bienvenido a <b>CHALACAPP</b>. En cumplimiento de la <b>Ley N° 29733 (Ley de Protección de Datos Personales del Perú)</b> y su reglamento, informamos de manera transparente cómo protegemos tu información:</p>
                        
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px;">
                            <strong style="color: #2ecc71; display: block; margin-bottom: 4px;">1. Finalidad Exclusiva de los Datos y Teléfono</strong>
                            <span>Los nombres, correos electrónicos y números de teléfono (WhatsApp) recopilados se utilizan <b>exclusivamente para coordinar reservas deportivas, confirmar pagos/adelantos directamente con los complejos deportivos, gestionar convocatorias de partidos y mantener el sistema comunitario de reputación deportiva</b> dentro de la plataforma.</span>
                        </div>

                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px;">
                            <strong style="color: #2ecc71; display: block; margin-bottom: 4px;">2. Cero Venta de Datos a Terceros</strong>
                            <span>CHALACAPP garantiza que tus datos personales y números de contacto <b>nunca serán vendidos, alquilados ni cedidos a terceros con fines publicitarios o comerciales</b> ajenos a tu actividad deportiva en la plataforma.</span>
                        </div>

                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px;">
                            <strong style="color: #2ecc71; display: block; margin-bottom: 4px;">3. Responsabilidad en Reservas y Reputación</strong>
                            <span>Los jugadores se comprometen a brindar datos verídicos al separar una cancha y a cumplir con los horarios reservados. Los dueños de canchas se comprometen a respetar las tarifas publicadas (Día / Noche) y a validar oportunamente los adelantos recibidos.</span>
                        </div>

                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px;">
                            <strong style="color: #2ecc71; display: block; margin-bottom: 4px;">4. Uso de Cookies Técnicas y Almacenamiento Local</strong>
                            <span>Utilizamos almacenamiento local (<code>localStorage</code>) y cookies estrictamente técnicas para mantener tu sesión activa, recordar tu departamento de juego preferido y brindarte disponibilidad en tiempo real.</span>
                        </div>

                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px;">
                            <strong style="color: #2ecc71; display: block; margin-bottom: 4px;">5. Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)</strong>
                            <span>Como titular de tus datos personales, puedes actualizar o eliminar tu perfil y contacto en cualquier momento desde tu panel de jugador o dueño en la plataforma.</span>
                        </div>
                    </div>
                    <div style="margin-top: 18px; display: flex; justify-content: flex-end;">
                        <button type="button" id="btn-entendido-terminos" class="btn btn-primary" style="width: 100%;">
                            <i class="ph-bold ph-check-circle"></i> Entendido y Acepto
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const cerrar = () => {
                modal.classList.remove('mostrar');
                modal.style.display = 'none';
            };
            modal.querySelector('#cerrar-modal-terminos')?.addEventListener('click', cerrar);
            modal.querySelector('#btn-entendido-terminos')?.addEventListener('click', cerrar);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) cerrar();
            });
        } else {
            modal.style.display = 'flex';
            modal.classList.add('mostrar');
        }
    };

    // 2. Mostrar Banner de Cookies y Privacidad si aún no ha sido aceptado
    const renderCookieBanner = () => {
        try {
            if (localStorage.getItem('chalacapp_cookies_accepted')) return;
            if (document.getElementById('chalacapp-cookie-banner')) return;

            const banner = document.createElement('div');
            banner.id = 'chalacapp-cookie-banner';
            banner.className = 'cookie-banner-glass';
            banner.innerHTML = `
                <div class="cookie-banner-copy">
                    <i class="ph-fill ph-cookie"></i>
                    <p>
                        <b>Aviso de Cookies y Privacidad:</b> Utilizamos cookies técnicas y almacenamiento local para recordar tu ubicación, gestionar tus reservas en tiempo real y proteger tu cuenta conforme a la <b>Ley N° 29733</b>. 
                        <a href="#" id="cookie-link-terminos">Leer Términos y Política de Privacidad</a>.
                    </p>
                </div>
                <div class="cookie-banner-actions">
                    <button type="button" id="btn-accept-cookies" class="btn btn-primary" style="padding: 9px 18px; font-size: 0.8rem;">
                        <i class="ph-bold ph-check"></i> Aceptar y Continuar
                    </button>
                </div>
            `;
            document.body.appendChild(banner);

            banner.querySelector('#cookie-link-terminos')?.addEventListener('click', (e) => {
                e.preventDefault();
                window.abrirModalTerminos();
            });

            banner.querySelector('#btn-accept-cookies')?.addEventListener('click', () => {
                localStorage.setItem('chalacapp_cookies_accepted', 'true');
                banner.remove();
            });
        } catch (err) {
            console.warn('No se pudo inicializar el banner de cookies:', err);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderCookieBanner);
    } else {
        renderCookieBanner();
    }
}

