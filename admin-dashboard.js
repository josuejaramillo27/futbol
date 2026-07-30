import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = { apiKey:"AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk", authDomain:"app-futbol-acd0f.firebaseapp.com", projectId:"app-futbol-acd0f", storageBucket:"app-futbol-acd0f.firebasestorage.app", messagingSenderId:"223446110165", appId:"1:223446110165:web:219afce6a9dac03203f75c" };
const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getFirestore(app); const storage = getStorage(app);
let usuarioActualId = null;

onAuthStateChanged(auth, async user => {
    if (!user) { window.location.href = 'login.html'; return; }
    usuarioActualId = user.uid;
    const docSnap = await getDoc(doc(db,'canchas',usuarioActualId));
    if (!docSnap.exists()) return;
    const d = docSnap.data();
    const campos = { 'admin-nombre':d.nombre, 'admin-ciudad':d.ciudad, 'admin-departamento':d.departamento, 'admin-tipo':d.tipoCancha, 'admin-whatsapp':d.whatsapp, 'admin-descripcion':d.descripcion, 'admin-precio':d.precio, 'admin-ubicacion-texto':d.ubicacionTexto, 'admin-ubicacion-link':d.ubicacionLink, 'admin-apertura':d.horaApertura, 'admin-cierre':d.horaCierre };
    Object.entries(campos).forEach(([id,valor]) => { const el=document.getElementById(id); if(el) el.value=valor ?? ''; });
    const titulo=document.getElementById('nombre-cancha-admin'); if(titulo && d.nombre) titulo.textContent=`${d.nombre} · Dashboard`;
});

async function subirImagen(archivo,ruta){ if(!archivo) return null; const storageRef=ref(storage,ruta); await uploadBytes(storageRef,archivo); return await getDownloadURL(storageRef); }

const formPerfil=document.getElementById('form-perfil-cancha');
if(formPerfil) formPerfil.addEventListener('submit',async e=>{
    e.preventDefault(); if(!usuarioActualId) return;
    const btn=document.getElementById('btn-guardar-admin'); btn.innerText='Guardando, espera...'; btn.disabled=true;
    try{
        const logoFile=document.getElementById('admin-logo').files[0], f1=document.getElementById('admin-foto1').files[0], f2=document.getElementById('admin-foto2').files[0], f3=document.getElementById('admin-foto3').files[0];
        const refDoc=doc(db,'canchas',usuarioActualId); const docActual=await getDoc(refDoc); const actuales=docActual.exists()?docActual.data():{}; const fotosActuales=actuales.fotos||[];
        const logoUrl=await subirImagen(logoFile,`canchas/${usuarioActualId}/logo`)||actuales.logo;
        const url1=await subirImagen(f1,`canchas/${usuarioActualId}/foto1`)||fotosActuales[0]; const url2=await subirImagen(f2,`canchas/${usuarioActualId}/foto2`)||fotosActuales[1]; const url3=await subirImagen(f3,`canchas/${usuarioActualId}/foto3`)||fotosActuales[2];
        await setDoc(refDoc,{ nombre:document.getElementById('admin-nombre').value.trim(), ciudad:document.getElementById('admin-ciudad').value.trim(), departamento:document.getElementById('admin-departamento').value.trim(), tipoCancha:document.getElementById('admin-tipo').value, whatsapp:document.getElementById('admin-whatsapp').value.trim(), descripcion:document.getElementById('admin-descripcion').value.trim(), precio:Number(document.getElementById('admin-precio').value), ubicacionTexto:document.getElementById('admin-ubicacion-texto').value.trim(), ubicacionLink:document.getElementById('admin-ubicacion-link').value.trim(), horaApertura:document.getElementById('admin-apertura').value, horaCierre:document.getElementById('admin-cierre').value, logo:logoUrl||'', fotos:[url1,url2,url3].filter(Boolean), configurado:true },{merge:true});
        const ok=document.getElementById('mensaje-exito'); ok.style.display='block'; setTimeout(()=>ok.style.display='none',4000);
    }catch(error){ console.error(error); alert('Error al guardar los datos: '+error.message); }
    finally{ btn.innerText='Guardar y Publicar Configuración'; btn.disabled=false; }
});

const btnCerrarSesion=document.getElementById('btn-cerrar-sesion');
if(btnCerrarSesion) btnCerrarSesion.addEventListener('click',()=>signOut(auth));
