/* Repère Maps V7 : véritable rendu 3D facultatif (MapLibre GL).
   Leaflet reste source de vérité pour GPS, itinéraires et interactions 2D.
   Le moteur 3D se charge seulement après demande explicite. */
const Repere3D = (() => {
  'use strict';
  const SCRIPT = 'https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js';
  const CSS = 'https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css';
  const OVERPASS = 'https://overpass-api.de/api/interpreter';
  const VIDE = {type:'FeatureCollection',features:[]};
  const el = id => document.getElementById(id);
  let instance = null, active = false, ready = false, pending = null;
  let cachedBuildings = VIDE, centerBuildings = null, timestampBuildings = 0;
  let controller = null, timer = null, syncingFrom3D = false;
  let lastPlaces = [], lastRoute = null, lastPosition = null;
  function status(message) { const e = el('repere3dStatus'); if(e)e.textContent=message; }
  function pressed(state) {
    el('repereMap3D')?.setAttribute('aria-pressed',String(state));
    el('repere3dControls')?.toggleAttribute('hidden',!state);
  }
  function geojson(features) { return {type:'FeatureCollection',features}; }
  function point(center) { return [Number(center.lng), Number(center.lat)]; }
  function fond() {
    return {
      version:8,
      sources: {
        osm: {
          type:'raster',
          tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize:256,
          maxzoom:19,
          attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributeurs'
        }
      },
      layers:[{id:'fond-osm',type:'raster',source:'osm'}]
    };
  }
  async function loadLibrary() {
    if (window.maplibregl) return;
    if (pending) return pending;
    pending = new Promise((resolve,reject) => {
      const css = document.createElement('link');
      css.rel='stylesheet';css.href=CSS;document.head.appendChild(css);
      const script=document.createElement('script');
      script.src=SCRIPT;script.async=true;
      script.onload=() => window.maplibregl ? resolve() : reject(Error('MapLibre indisponible'));
      script.onerror=() => reject(Error('Le module 3D ne peut pas être téléchargé'));
      document.head.appendChild(script);
    });
    try { await pending; }
    finally { pending = null; }
  }
  function setGeo(id,data) {
    const source=instance?.getSource(id);
    if (ready&&source)source.setData(data);
  }
  function addSource(id,data) {
    instance.addSource(id,{type:'geojson',data});
  }
  function addLayers() {
    if (!instance || ready) return;
    addSource('repere-3d-batiments',cachedBuildings);
    instance.addLayer({
      id:'repere-3d-buildings',type:'fill-extrusion',
      source:'repere-3d-batiments',minzoom:14,
      paint:{
        'fill-extrusion-color':['case',['get','estimated'],'#B7C7C6','#88AAA1'],
        'fill-extrusion-height':['get','height'],
        'fill-extrusion-base':['get','base'],
        'fill-extrusion-opacity':0.84
      }
    });
    addSource('repere-3d-parcours',VIDE);
    instance.addLayer({id:'repere-3d-route-outline',type:'line',source:'repere-3d-parcours',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#FFFFFF','line-width':13,'line-opacity':0.95}});
    instance.addLayer({id:'repere-3d-route',type:'line',source:'repere-3d-parcours',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#087F68','line-width':8}});
    addSource('repere-3d-points',VIDE);
    instance.addLayer({id:'repere-3d-places',type:'circle',source:'repere-3d-points',
      paint:{
        'circle-color':['get','color'],
        'circle-radius':['interpolate',['linear'],['zoom'],12,3,16,7,18,9],
        'circle-stroke-width':2.5,'circle-stroke-color':'#fff'
      }
    });
    addSource('repere-3d-position',VIDE);
    instance.addLayer({id:'repere-3d-gps',type:'circle',source:'repere-3d-position',
      paint:{'circle-radius':10,'circle-color':'#087F68','circle-stroke-color':'#fff','circle-stroke-width':4}});
    ready=true;
    updatePlaces(lastPlaces);
    updateRoute(lastRoute);
    updatePosition(lastPosition,false);
    instance.on('click','repere-3d-places',e=>{
      const feat=e.features?.[0],index=Number(feat?.properties?.index);
      const place=lastPlaces[index];
      if(place && typeof ouvrirFicheLieu==='function')ouvrirFicheLieu(place);
    });
    instance.on('mouseenter','repere-3d-places',()=>{instance.getCanvas().style.cursor='pointer';});
    instance.on('mouseleave','repere-3d-places',()=>{instance.getCanvas().style.cursor='';});
  }
  function updatePlaces(lieux) {
    lastPlaces=(Array.isArray(lieux)?lieux:[]).filter(x=>
      Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lng))&&
      x.lat!=null&&x.lng!=null
    ).slice(0,200);
    const feats=lastPlaces.map((l,index)=>({
      type:'Feature',
      properties:{index,color:ReperePoi.profil(l).couleur},
      geometry:{type:'Point',coordinates:[Number(l.lng),Number(l.lat)]}
    }));
    setGeo('repere-3d-points',geojson(feats));
  }
  function updateRoute(route) {
    lastRoute=route&&Array.isArray(route.ligne)?route:null;
    if(!ready)return;
    const features=lastRoute&&lastRoute.ligne.length>=2 ? [{
      type:'Feature',properties:{mode:lastRoute.mode},
      geometry:{type:'LineString',coordinates:lastRoute.ligne.map(x=>[x[1],x[0]])}
    }] : [];
    setGeo('repere-3d-parcours',geojson(features));
    const style={voiture:['#087F68',[1,0]],velo:['#1877D2',[2,1]],pied:['#F07A28',[0.5,1.5]]};
    const [color,dashes]=style[lastRoute?.mode]||style.voiture;
    instance.setPaintProperty('repere-3d-route','line-color',color);
    instance.setPaintProperty('repere-3d-route','line-dasharray',dashes);
  }
  function updatePosition(position,follow=true) {
    if(position&&Number.isFinite(position.lat)&&Number.isFinite(position.lng)){
      lastPosition={lat:position.lat,lng:position.lng};
    }
    if(!ready)return;
    setGeo('repere-3d-position',geojson(lastPosition ? [{
      type:'Feature',properties:{},geometry:{type:'Point',coordinates:point(lastPosition)}
    }] : []));
    if(active && follow && lastPosition && typeof Nav!=='undefined' && Nav.actif){
      instance.easeTo({center:point(lastPosition),zoom:Math.max(16,instance.getZoom()),duration:450});
    }
  }
  function syncLeaflet() {
    if(!ready||!active||syncingFrom3D)return;
    const c=map.getCenter();
    instance.jumpTo({center:[c.lng,c.lat],zoom:Math.max(12,map.getZoom())});
  }
  async function buildings() {
    if(!active||!ready)return;
    const c=instance.getCenter();
    if(instance.getZoom()<15){
      status('Zoomez davantage pour afficher les bâtiments 3D.');
      return;
    }
    const meters=centerBuildings?map.distance([c.lat,c.lng],[centerBuildings.lat,centerBuildings.lng]):Infinity;
    // Conserver le dernier quartier et éviter les nombreuses requêtes répétées.
    if(meters<210 && cachedBuildings.features.length>0){
      status(cachedBuildings.features.length+' bâtiments OSM affichés · hauteurs parfois estimées');
      return;
    }
    if(Date.now()-timestampBuildings<45000)return;
    timestampBuildings=Date.now();
    if(controller)controller.abort();
    const request=new AbortController();
    controller=request;
    status('Chargement des bâtiments cartographiés…');
    try {
      const q=Repere3DData.requete({lat:c.lat,lng:c.lng});
      const timeout=setTimeout(()=>request.abort(),13000);
      let res;
      try{res=await fetch(OVERPASS+'?data='+encodeURIComponent(q),{signal:request.signal});}
      finally{clearTimeout(timeout);}
      if(!res.ok)throw Error('Réponse du serveur '+res.status);
      const data=Repere3DData.convertir(await res.json());
      if(!active)return;
      cachedBuildings=data;
      centerBuildings={lat:c.lat,lng:c.lng};
      setGeo('repere-3d-batiments',data);
      status(data.features.length?
        data.features.length+' bâtiments · hauteurs estimées si absentes d’OSM':
        'Aucun bâtiment 3D renseigné dans ce secteur. La carte reste inclinable.');
    } catch(e){
      if(!active)return;
      status('Bâtiments indisponibles actuellement · retour 2D toujours possible.');
    }
  }
  function scheduleBuildings() {
    clearTimeout(timer);
    if(active)timer=setTimeout(buildings,850);
  }
  function enter() {
    active=true;
    el('scrCarte').classList.add('repere-3d-on');
    el('map3d').hidden=false;
    pressed(true);
    if(instance) {
      instance.resize();
      syncLeaflet();
      scheduleBuildings();
    }
  }
  function leave() {
    active=false;
    clearTimeout(timer);
    controller?.abort();
    el('scrCarte').classList.remove('repere-3d-on');
    el('map3d').hidden=true;
    pressed(false);
    if(instance) {
      const c=instance.getCenter();
      syncingFrom3D=true;
      map.setView([c.lat,c.lng],Math.min(19,instance.getZoom()),{animate:false});
      syncingFrom3D=false;
    }
    map.invalidateSize();
  }
  async function toggle() {
    if(active){leave();return;}
    if(!window.WebGLRenderingContext){
      toast('La 3D nécessite WebGL. Le plan 2D reste disponible.');
      return;
    }
    status('Initialisation du mode 3D…');
    const b=el('repereMap3D'); b.disabled=true;
    try {
      await loadLibrary();
      if(!instance){
        const c=map.getCenter();
        el('map3d').hidden=false;
        instance=new maplibregl.Map({
          container:'map3d',style:fond(),center:[c.lng,c.lat],
          zoom:Math.max(15,map.getZoom()),pitch:57,bearing:-22,
          maxPitch:75,maxZoom:19,
          canvasContextAttributes:{antialias:true},
          attributionControl:true
        });
        instance.on('load',()=>{
          addLayers();
          if(active)scheduleBuildings();
        });
        instance.on('error',e=>{
          if(!ready && active){
            status('La carte 3D ne répond pas, réessayez en 2D.');
            leave();
          }
        });
        instance.on('moveend',()=>{
          if(!active||syncingFrom3D)return;
          const v=instance.getCenter();
          const c=map.getCenter();
          if(map.distance([v.lat,v.lng],[c.lat,c.lng])>10||
             Math.abs(map.getZoom()-instance.getZoom())>0.3){
            syncingFrom3D=true;
            map.setView([v.lat,v.lng],Math.min(19,instance.getZoom()),{animate:false});
            syncingFrom3D=false;
          }
          scheduleBuildings();
        });
      }
      enter();
    } catch(e){
      el('map3d').hidden=true;
      status('Mode 3D indisponible. Le plan 2D reste fonctionnel.');
      toast('Impossible de charger le mode 3D.');
    } finally {b.disabled=false;}
  }
  function resetPerspective() {
    if(!instance||!active)return;
    const c=instance.getCenter();
    instance.easeTo({center:[c.lng,c.lat],pitch:57,bearing:-22,duration:500});
  }
  function tilt() {
    if(!instance||!active)return;
    instance.easeTo({pitch:instance.getPitch()>15?0:57,duration:450});
  }
  function setup() {
    el('repereMap3D')?.addEventListener('click',toggle);
    el('repere3dReset')?.addEventListener('click',resetPerspective);
    el('repere3dTilt')?.addEventListener('click',tilt);
    for(const id of ['repereMapPlan','repereMapDetail']){
      el(id)?.addEventListener('click',()=>{if(active)leave();});
    }
  }
  setup();
  return Object.freeze({toggle,leave,isActive:()=>active,
    updatePlaces,updateRoute,updatePosition,syncLeaflet});
})();
