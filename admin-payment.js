import{initializeApp,getApps}from'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import{getAuth,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import{getFirestore,doc,getDoc,setDoc,serverTimestamp}from'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const cfg={apiKey:'AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk',authDomain:'app-futbol-acd0f.firebaseapp.com',projectId:'app-futbol-acd0f',storageBucket:'app-futbol-acd0f.firebasestorage.app',messagingSenderId:'223446110165',appId:'1:223446110165:web:219afce6a9dac03203f75c'};
const app=getApps().length?getApps()[0]:initializeApp(cfg),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const toast=(m,e=false)=>{const x=$('toast-admin');if(!x)return;x.textContent=m;x.className=`admin-toast show ${e?'error':''}`;setTimeout(()=>x.className='admin-toast',2800)};
let uid=null;

function sync(){
    const active=[$('pago-yape'),$('pago-plin'),$('pago-efectivo')].some(x=>x?.checked);
    $('payment-details')?.classList.toggle('show',active&&($('pago-yape')?.checked||$('pago-plin')?.checked));
}

async function load(){
    if(!uid)return;
    try{
        const s=await getDoc(doc(db,'canchas',uid));
        const p=s.exists()?s.data().metodosPago||{}:{};
        if($('pago-yape')) $('pago-yape').checked=!!p.yape;
        if($('pago-plin')) $('pago-plin').checked=!!p.plin;
        if($('pago-efectivo')) $('pago-efectivo').checked=!!p.efectivo;
        if($('admin-pago-numero')) $('admin-pago-numero').value=p.numero||'';
        if($('admin-pago-titular')) $('admin-pago-titular').value=p.titular||'';
        if($('admin-req-sena')) $('admin-req-sena').checked=!!p.requiereSena;
        if($('admin-monto-sena')) $('admin-monto-sena').value=p.montoSena||'';
        if($('admin-pago-nota')) $('admin-pago-nota').value=p.nota||'';
        sync();
    }catch(e){console.error(e)}
}

async function save(){
    if(!uid)return;
    const p={
        yape:$('pago-yape')?.checked || false,
        plin:$('pago-plin')?.checked || false,
        efectivo:$('pago-efectivo')?.checked || false,
        numero:$('admin-pago-numero')?.value?.trim() || '',
        titular:$('admin-pago-titular')?.value?.trim() || '',
        requiereSena:$('admin-req-sena')?.checked || false,
        montoSena:Number($('admin-monto-sena')?.value||0),
        nota:$('admin-pago-nota')?.value?.trim() || ''
    };
    if(!p.yape&&!p.plin&&!p.efectivo){toast('Selecciona al menos un método de pago.',true);return}
    if((p.yape||p.plin)&&!p.numero){toast('Añade el número de Yape / Plin.',true);return}
    if(p.requiereSena && p.montoSena <= 0){toast('Si requieres seña, ingresa un monto mayor a 0.',true);return}
    
    try{
        await setDoc(doc(db,'canchas',uid),{metodosPago:p,updatedAt:serverTimestamp()},{merge:true});
    }catch(e){
        console.error(e);
        toast('No pudimos guardar los métodos de pago.',true)
    }
}

document.addEventListener('DOMContentLoaded',()=>{
    ['pago-yape','pago-plin','pago-efectivo'].forEach(id=>$(id)?.addEventListener('change',sync));
    const form=$('form-perfil-cancha');
    form?.addEventListener('submit',e=>{setTimeout(save,350)});
    $('admin-pago-numero')?.addEventListener('input',e=>e.target.value=e.target.value.replace(/[^0-9+ ]/g,'').slice(0,15));
});

onAuthStateChanged(auth,u=>{if(u){uid=u.uid;load()}});
