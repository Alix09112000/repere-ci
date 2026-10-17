/* MapTiler Satellite: optional and enabled only after configuring a browser key. */
(function(){
  'use strict';
  const key=typeof window.REPERE_MAPTILER_KEY==='string' ? window.REPERE_MAPTILER_KEY.trim() : '';
  if(!key || !/^[a-zA-Z0-9_-]+$/.test(key))return;
  if(typeof L==='undefined' || typeof map==='undefined' || typeof fondsCarte==='undefined')return;
  const slot=document.querySelector('.repere-layer-unavailable[aria-label="Satellite indisponible actuellement"]');
  if(!slot)return;
  const satellite=L.tileLayer('https://api.maptiler.com/tiles/satellite-v4/{z}/{x}/{y}?key='+encodeURIComponent(key),{
    attribution:'© <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> · imagerie et fournisseurs',
    maxZoom:20,maxNativeZoom:19
  });
  fondsCarte.satellite=satellite;
  const button=document.createElement('button');
  button.type='button';
  button.setAttribute('aria-pressed','false');
  button.setAttribute('aria-label','Afficher la carte satellite');
  button.innerHTML='<span class="repere-layer-preview repere-layer-satellite" aria-hidden="true">◈</span><span>Satellite</span><small>Vue aérienne</small>';
  slot.replaceWith(button);
  function update(){
    button.setAttribute('aria-pressed',String(map.hasLayer(satellite)));
    document.getElementById('repereMapPlan')?.setAttribute('aria-pressed',String(map.hasLayer(fondsCarte.plan)));
    document.getElementById('repereMapDetail')?.setAttribute('aria-pressed',String(map.hasLayer(fondsCarte.details)));
  }
  button.addEventListener('click',()=>{
    if(window.Repere3D?.isActive?.())window.Repere3D.leave();
    for(const layer of Object.values(fondsCarte))if(map.hasLayer(layer))map.removeLayer(layer);
    satellite.addTo(map).bringToBack();
    if(typeof Store!=='undefined')Store.ecrire('fondCarte','satellite');
    update();
    document.getElementById('repereLayersClose')?.click();
  });
  for(const id of ['repereMapPlan','repereMapDetail']){
    document.getElementById(id)?.addEventListener('click',update);
  }
  satellite.on('tileerror',()=>{button.title='Impossible de charger certaines images : vérifiez la clé MapTiler et ses restrictions.';});
  if(typeof Store!=='undefined'&&Store.lire('fondCarte','plan')==='satellite')button.click();
  update();
})();
