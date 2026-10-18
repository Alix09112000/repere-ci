/* RepèreMaps — navigation régionale, 16 pays d'Afrique de l'Ouest.
   Les centres sont indicatifs : ils ne constituent ni des frontières ni une preuve
   de couverture routière ou de disponibilité des points d'intérêt. */
(()=>{
'use strict';
const COUNTRIES=[
['BJ','Bénin',9.3077,2.3158,7],['BF','Burkina Faso',12.2383,-1.5616,6],
['CV','Cap-Vert',16.5388,-23.0418,7],['CI','Côte d’Ivoire',7.54,-5.55,6],
['GM','Gambie',13.4432,-15.3101,8],['GH','Ghana',7.9465,-1.0232,6],
['GN','Guinée',9.9456,-9.6966,6],['GW','Guinée-Bissau',11.8037,-15.1804,7],
['LR','Liberia',6.4281,-9.4295,7],['ML','Mali',17.5707,-3.9962,5],
['MR','Mauritanie',21.0079,-10.9408,5],['NE','Niger',17.6078,8.0817,5],
['NG','Nigeria',9.082,8.6753,6],['SN','Sénégal',14.4974,-14.4524,7],
['SL','Sierra Leone',8.4606,-11.7799,7],['TG','Togo',8.6195,0.8248,7]
];
window.RepereWestAfrica={countries:COUNTRIES.map(([code,name,lat,lng,zoom])=>({code,name,lat,lng,zoom}))};
function init(){
 const mapRoot=document.getElementById('scrCarte');
 if(!mapRoot||document.getElementById('repereCountryButton'))return;
 const button=document.createElement('button');
 button.type='button';button.id='repereCountryButton';button.className='repere-country-button';
 button.textContent='🌍 Pays';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','repereCountryPanel');
 const panel=document.createElement('div');panel.id='repereCountryPanel';panel.className='repere-country-panel';panel.hidden=true;
 panel.setAttribute('role','group');panel.setAttribute('aria-label','Choisir un pays d’Afrique de l’Ouest');
 const heading=document.createElement('div');heading.className='repere-country-heading';heading.textContent='Explorer l’Afrique de l’Ouest';panel.appendChild(heading);
 const select=document.createElement('select');select.setAttribute('aria-label','Pays à afficher sur la carte');
 const initial=document.createElement('option');initial.value='';initial.textContent='Sélectionner un pays';select.appendChild(initial);
 COUNTRIES.forEach(([code,name])=>{const o=document.createElement('option');o.value=code;o.textContent=name;select.appendChild(o)});
 const go=document.createElement('button');go.type='button';go.textContent='Afficher ce pays';go.disabled=true;
 const note=document.createElement('p');note.textContent='La disponibilité des routes et des lieux varie selon les données cartographiques.';
 panel.append(select,go,note);
 mapRoot.append(button,panel);
 button.addEventListener('click',()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden))});
 select.addEventListener('change',()=>{go.disabled=!select.value});
 go.addEventListener('click',()=>{
  const item=COUNTRIES.find(c=>c[0]===select.value);if(!item)return;
  const [,name,lat,lng,zoom]=item;
  if(typeof map!=='undefined'&&map&&typeof map.setView==='function'){map.setView([lat,lng],zoom,{animate:true})}
  else if(window.map&&typeof window.map.setView==='function'){window.map.setView([lat,lng],zoom,{animate:true})}
  else {note.textContent='Carte indisponible pour le moment. Réessaie après son chargement.';return}
  button.textContent='🌍 '+name;panel.hidden=true;button.setAttribute('aria-expanded','false');
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.hidden=true;button.setAttribute('aria-expanded','false')}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
