/* Repère Maps V7 : véritable rendu 3D facultatif (MapLibre GL).
   Leaflet reste source de vérité pour GPS, itinéraires et interactions 2D.
   Le moteur 3D se charge seulement après demande explicite. */
const Repere3D = (() => {
  'use strict';
  const SCRIPT = 'https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js';
  const CSS = 'https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css';
  const VECTOR_STYLE = 'https://tiles.openfreemap.org/styles/bright';
  const BUILDING_TILEJSON = 'https://tiles.openfreemap.org/planet';
  const VIDE = {type:'FeatureCollection',features:[]};
  const el = id => document.getElementById(id);
  let instance = null, active = false, ready = false, pending = null;
  let syncingFrom3D = false;
  let lastPlaces = [], lastRoute = null, lastPosition = null;
  let placesVisible = window.RepereLayers?.placesVisible !== false;
  function status(message) { const e = el('repere3dStatus'); if(e)e.textContent=message; }
  function pressed(state) {
    el('repereMap3D')?.setAttribute('aria-pressed',String(state));
    el('repere3dControls')?.toggleAttribute('hidden',!state);
  }
  function geojson(features) { return {type:'FeatureCollection',features}; }
  function point(center) { return [Number(center.lng), Number(center.lat)]; }
  // Un vrai fond VECTORIEL : routes et libellés restent lisibles en perspective.
  function fond() { return VECTOR_STYLE; }

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
    // Les empreintes/hauteurs sont déjà présentes dans les TUILES VECTORIELLES.
    // Plus de chargement lent depuis Overpass ni de données factices par bâtiment.
    if (!instance.getSource('repere-3d-batiments-vectoriels')) {
      instance.addSource('repere-3d-batiments-vectoriels', {
        type:'vector',url:BUILDING_TILEJSON
      });
    }
    const firstLabel=instance.getStyle().layers.find(
      l=>l.type==='symbol' && l.layout && l.layout['text-field']
    )?.id;
    instance.addLayer({
      id:'repere-3d-buildings',type:'fill-extrusion',
      source:'repere-3d-batiments-vectoriels', 'source-layer':'building',
      minzoom:15,
      filter:['!=',['get','hide_3d'],true],
      paint:{
        'fill-extrusion-color':[
          'interpolate',['linear'],['coalesce',['get','render_height'],0],
          0,'#DEE9E6',25,'#ADC9C3',80,'#83ADA7',180,'#6D9996'
        ],
        'fill-extrusion-height':[
          'interpolate',['linear'],['zoom'],15,0,16,
          ['coalesce',['get','render_height'],0]
        ],
        'fill-extrusion-base':[
          'interpolate',['linear'],['zoom'],15,0,16,
          ['coalesce',['get','render_min_height'],0]
        ],
        'fill-extrusion-opacity':0.84
      }
    }, firstLabel);
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
        'circle-radius':['interpolate',['linear'],['zoom'],14,3,16,5,18,6],
        'circle-stroke-width':2,'circle-stroke-color':'#fff',
        'circle-opacity':0.92
      }
    });
    instance.addLayer({
      id:'repere-3d-place-labels',type:'symbol',source:'repere-3d-points',
      minzoom:17,
      layout:{
        'text-field':['get','name'],
        'text-size':11,
        'text-anchor':'top',
        'text-offset':[0,1.1],
        'text-allow-overlap':false
      },
      paint:{
        'text-color':'#1B423A',
        'text-halo-color':'#FFFFFF',
        'text-halo-width':1.7
      }
    });
    addSource('repere-3d-position',VIDE);
    instance.addLayer({id:'repere-3d-gps',type:'circle',source:'repere-3d-position',
      paint:{'circle-radius':10,'circle-color':'#087F68','circle-stroke-color':'#fff','circle-stroke-width':4}});
    ready=true;
    renderPlaces();
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
  // Les 200 points simultanés observés en V7 masquaient complètement
  // la ville : conserver seulement les lieux visibles et suffisamment espacés.
  function renderPlaces() {
    if(!ready || !instance) return;
    if(!placesVisible) { setGeo('repere-3d-points',VIDE);return; }
    const zoom=instance.getZoom();
    if(zoom<15.5) { setGeo('repere-3d-points',VIDE);return; }
    const center=instance.getCenter();
    const bounds=instance.getBounds();
    const ordered=lastPlaces.map((lieu,index)=>({lieu,index})).filter(({lieu})=>
      bounds.contains([Number(lieu.lng),Number(lieu.lat)])
    ).sort((a,b)=>{
      const score=(x)=>Math.hypot((Number(x.lieu.lat)-center.lat)*111000,
        (Number(x.lieu.lng)-center.lng)*111000*Math.cos(center.lat*Math.PI/180));
      return score(a)-score(b);
    });
    const maximum=zoom>=17?22:12;
    const occupied=[];
    const features=[];
    for(const {lieu,index} of ordered) {
      const projected=instance.project([Number(lieu.lng),Number(lieu.lat)]);
      if(occupied.some(p=>Math.abs(p.x-projected.x)<52 &&
          Math.abs(p.y-projected.y)<42))continue;
      occupied.push(projected);
      const name=String(lieu.nom||'').trim().slice(0,45);
      features.push({
        type:'Feature',
        properties:{index,color:ReperePoi.profil(lieu).couleur,name},
        geometry:{type:'Point',coordinates:[Number(lieu.lng),Number(lieu.lat)]}
      });
      if(features.length>=maximum)break;
    }
    setGeo('repere-3d-points',geojson(features));
  }
  function setPlacesVisible(value) {
    placesVisible = value !== false;
    renderPlaces();
  }
  function updatePlaces(lieux) {
    lastPlaces=(Array.isArray(lieux)?lieux:[]).filter(x=>
      x && x.lat!=null && x.lng!=null &&
      Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng))
    ).slice(0,200);
    renderPlaces();
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
  function enter() {
    active=true;
    el('scrCarte').classList.add('repere-3d-on');
    el('map3d').hidden=false;
    pressed(true);
    if(instance) {
      instance.resize();
      syncLeaflet();
      renderPlaces();
    }
  }
  function leave() {
    active=false;
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
          zoom:Math.max(16,map.getZoom()),pitch:50,bearing:-18,
          maxPitch:75,maxZoom:19,
          canvasContextAttributes:{antialias:true},
          attributionControl:true
        });
        instance.on('load',()=>{
          addLayers();
          status('Carte vectorielle prête · bâtiments en relief selon les données OSM.');
          if(active)renderPlaces();
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
          renderPlaces();
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
    instance.easeTo({center:[c.lng,c.lat],pitch:50,bearing:-18,duration:500});
  }
  function tilt() {
    if(!instance||!active)return;
    instance.easeTo({pitch:instance.getPitch()>15?0:50,duration:450});
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
    updatePlaces,updateRoute,updatePosition,syncLeaflet,setPlacesVisible});
})();
