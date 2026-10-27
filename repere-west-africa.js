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
const CITIES=[
['Dakar','SN',14.7167,-17.4677],['Saint-Louis','SN',16.0326,-16.4818],
['Abidjan','CI',5.3599,-4.0083],['Yamoussoukro','CI',6.8276,-5.2893],['Bouaké','CI',7.6894,-5.0300],
['Accra','GH',5.6037,-0.1870],['Kumasi','GH',6.6885,-1.6244],
['Lomé','TG',6.1319,1.2228],['Cotonou','BJ',6.3703,2.3912],['Porto-Novo','BJ',6.4969,2.6289],
['Lagos','NG',6.5244,3.3792],['Abuja','NG',9.0765,7.3986],['Kano','NG',12.0022,8.5920],
['Ouagadougou','BF',12.3714,-1.5197],['Bobo-Dioulasso','BF',11.1771,-4.2979],
['Bamako','ML',12.6392,-8.0029],['Niamey','NE',13.5116,2.1254],
['Conakry','GN',9.6412,-13.5784],['Bissau','GW',11.8817,-15.6170],
['Monrovia','LR',6.3156,-10.8074],['Freetown','SL',8.4657,-13.2317],
['Banjul','GM',13.4549,-16.5790],['Nouakchott','MR',18.0735,-15.9582],
['Praia','CV',14.9331,-23.5133]
];
// Recherche locale indicative : accents et variantes d'apostrophes/tirets
// sont équivalents. Aucun résultat n'est présenté comme une adresse exacte.
function normaliser(texte){
 return String(texte ?? '').normalize('NFD')
   .replace(/[\u0300-\u036f]/g,'').toLowerCase()
   .replace(/['’`´‐‑–—-]/g,' ')
   .replace(/\s+/g,' ').trim();
}
function chercherVilles(recherche,limite=7){
 const terme=normaliser(recherche);
 if(terme.length<2)return [];
 const maximum=Number.isInteger(limite)?Math.max(0,Math.min(50,limite)):7;
 return CITIES.filter(([nom,code])=>{
   const pays=COUNTRIES.find(c=>c[0]===code);
   return normaliser(nom).includes(terme) ||
     normaliser(pays?.[1]).includes(terme) ||
     code.toLowerCase()===terme;
 }).slice(0,maximum).map(([name,country,lat,lng])=>({name,country,lat,lng}));
}
window.RepereWestAfrica={cities:CITIES.map(([name,country,lat,lng])=>({name,country,lat,lng})),countries:COUNTRIES.map(([code,name,lat,lng,zoom])=>({code,name,lat,lng,zoom})),searchCities:chercherVilles};
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
 const cityLabel=document.createElement('label');cityLabel.textContent='Ou rechercher une grande ville';cityLabel.setAttribute('for','repereCitySearch');
 const cityInput=document.createElement('input');cityInput.id='repereCitySearch';cityInput.type='search';cityInput.placeholder='Ex. Dakar, Lagos, Lomé…';cityInput.autocomplete='off';
 const cityResults=document.createElement('div');cityResults.className='repere-city-results';cityResults.setAttribute('role','group');cityResults.setAttribute('aria-label','Villes proposées');
 function moveTo(lat,lng,zoom,label){
   const m=(typeof map!=='undefined'&&map&&typeof map.setView==='function')?map:window.map;
   if(!m||typeof m.setView!=='function'){note.textContent='Carte indisponible pour le moment. Réessaie après son chargement.';return false}
   m.setView([lat,lng],zoom,{animate:true});button.textContent='🌍 '+label;panel.hidden=true;button.setAttribute('aria-expanded','false');return true;
 }
 function renderCities(){
   cityResults.replaceChildren();
   if(normaliser(cityInput.value).length<2)return;
   const hits=chercherVilles(cityInput.value);
   if(!hits.length){const msg=document.createElement('p');msg.textContent='Ville absente de cette liste de démarrage.';cityResults.appendChild(msg);return}
   hits.forEach(({name,country:code,lat,lng})=>{const country=COUNTRIES.find(c=>c[0]===code)?.[1]||code;const b=document.createElement('button');b.type='button';b.textContent=name+' · '+country;b.addEventListener('click',()=>moveTo(lat,lng,12,name));cityResults.appendChild(b)});
 }
 cityInput.addEventListener('input',renderCities);
 panel.append(select,go,cityLabel,cityInput,cityResults,note);
 mapRoot.append(button,panel);
 button.addEventListener('click',()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden))});
 // Fermer le panneau si l'utilisateur revient à la carte ou à un autre outil.
 document.addEventListener('pointerdown',e=>{
   if(!panel.hidden && !panel.contains(e.target) && e.target!==button){
     panel.hidden=true;button.setAttribute('aria-expanded','false');
   }
 });
 select.addEventListener('change',()=>{go.disabled=!select.value});
 go.addEventListener('click',()=>{
  const item=COUNTRIES.find(c=>c[0]===select.value);if(!item)return;
  const [,name,lat,lng,zoom]=item;
  moveTo(lat,lng,zoom,name);
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.hidden=true;button.setAttribute('aria-expanded','false')}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
