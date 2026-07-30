import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyBqZSb3ZkI1QqoLGyP47ckD7eexwdStdXk",authDomain:"app-futbol-acd0f.firebaseapp.com",projectId:"app-futbol-acd0f",storageBucket:"app-futbol-acd0f.firebasestorage.app",messagingSenderId:"223446110165",appId:"1:223446110165:web:219afce6a9dac03203f75c"};
const app=initializeApp(firebaseConfig),db=getFirestore(app);
const mapEl=document.getElementById('map-canchas');

if(mapEl&&window.L){
  const map=L.map(mapEl,{zoomControl:false,scrollWheelZoom:false,fadeAnimation:true}).setView([-5.1945,-80.6328],13);
  L.control.zoom({position:'bottomright'}).addTo(map);

  // Carto Voyager: mapa claro y limpio, más legible con la interfaz oscura de APP FUTBOL.
  // Dejamos OSM como respaldo si el primer proveedor no consigue cargar los tiles.
  const carto=L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
    subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO',crossOrigin:true
  });
  const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'&copy; OpenStreetMap contributors',crossOrigin:true
  });
  carto.on('tileerror',()=>{if(!map.hasLayer(osm)){map.addLayer(osm);}});
  carto.addTo(map);

  const markers=L.layerGroup().addTo(map),userLayer=L.layerGroup().addTo(map),status=document.getElementById('map-status'),btn=document.getElementById('btn-mi-ubicacion');
  const icon=L.divIcon({className:'premium-map-marker',html:'<div><i class="ph-fill ph-soccer-ball"></i></div>',iconSize:[40,40],iconAnchor:[20,38],popupAnchor:[0,-38]});
  const userIcon=L.divIcon({className:'user-map-marker',html:'<div><span></span></div>',iconSize:[24,24],iconAnchor:[12,12]});

  function coords(c){
    let lat=Number(c.lat),lng=Number(c.lng);
    if(Number.isFinite(lat)&&Number.isFinite(lng))return [lat,lng];
    const u=String(c.ubicacionLink||'');
    let m=u.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if(!m)m=u.match(/[?&](?:q|ll)=(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/);
    return m?[Number(m[1]),Number(m[2])]:null;
  }
  function popup(c){
    const p=c.precio!=null?`<b>S/ ${c.precio}</b> / hora`:'Consultar precio';
    const rating=Number(c.ratingPromedio||0);
    return `<div class="map-popup"><strong>${c.nombre||'Cancha'}</strong><span><i class="ph-fill ph-star"></i> ${rating?rating.toFixed(1):'Nuevo'} · ${c.tipoCancha||'Fútbol'}</span><span>${c.ubicacionTexto||c.ciudad||'Ubicación disponible'}</span><div>${p}</div><a href="${c.ubicacionLink||'#'}" target="_blank" rel="noopener">Abrir ubicación <i class="ph-bold ph-arrow-up-right"></i></a></div>`;
  }
  async function cargar(){
    try{
      const snap=await getDocs(collection(db,'canchas')),bounds=[];
      snap.forEach(ds=>{
        const c={id:ds.id,...ds.data()};
        if(!c.configurado)return;
        const pos=coords(c);if(!pos)return;
        const marker=L.marker(pos,{icon}).bindPopup(popup(c),{maxWidth:260});marker.addTo(markers);bounds.push(pos);
      });
      if(bounds.length){map.fitBounds(bounds,{padding:[35,35],maxZoom:14});status.textContent=`${bounds.length} cancha${bounds.length===1?'':'s'} con ubicación disponible.`}
      else status.textContent='Explora el mapa o activa tu ubicación para encontrar canchas cercanas.';
      setTimeout(()=>map.invalidateSize(true),100);
      setTimeout(()=>map.invalidateSize(true),600);
    }catch(e){console.error('APP FUTBOL mapa:',e);status.textContent='No pudimos cargar las ubicaciones. El mapa sigue disponible.';setTimeout(()=>map.invalidateSize(true),200)}
  }
  function ubicarUsuario(){
    if(!navigator.geolocation){status.textContent='Tu navegador no admite geolocalización.';return}
    btn?.setAttribute('disabled','disabled');if(status)status.textContent='Obteniendo tu ubicación…';
    navigator.geolocation.getCurrentPosition(pos=>{
      const lat=pos.coords.latitude,lng=pos.coords.longitude;userLayer.clearLayers();
      L.marker([lat,lng],{icon:userIcon}).addTo(userLayer).bindPopup('<strong>Estás aquí</strong>').openPopup();
      L.circle([lat,lng],{radius:1000,color:'#00D968',fillColor:'#00D968',fillOpacity:.08,weight:1}).addTo(userLayer);
      map.setView([lat,lng],14);if(status)status.textContent='Ubicación activada. Explora las canchas cercanas.';btn?.removeAttribute('disabled');
    },()=>{if(status)status.textContent='No pudimos acceder a tu ubicación. Revisa el permiso del navegador.';btn?.removeAttribute('disabled')},{enableHighAccuracy:true,timeout:10000,maximumAge:30000});
  }
  btn?.addEventListener('click',ubicarUsuario);cargar();window.addEventListener('resize',()=>map.invalidateSize(true));
}
