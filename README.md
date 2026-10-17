# Repère CI

Application mobile grand public : partager sa position en langage local,
naviguer jusqu'à un repère, signaler la route.

## Les fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | L'application — six écrans, trois onglets |
| `lieu.html` | La page publique d'un lieu partagé, sans compte |
| `repere-api.js` | Appels à l'API, magasin local, génération de la description |
| `repere-app.js` | Logique des écrans |
| `repere.css` | La feuille unique |
| `manifest.json` | Installation sur l'écran d'accueil |
| `logo-icon.svg` | La marque |

Aucun framework, aucune étape de compilation. Une seule dépendance externe :
Leaflet, chargé depuis unpkg pour la carte.

## Mise en service

Dépose le dossier tel quel sur ton hébergement. L'application appelle
`https://geodeliver-ci.onrender.com`, défini en tête de `repere-api.js`.

### La clé publique — indispensable

Trois routes de l'API demandent une clé : enregistrer un repère
(`POST /geocode`), nommer un quartier (`GET /reverse`) et soumettre une
correction (`POST /apprendre`). Sans clé, capturer sa position échoue en 401 —
c'est-à-dire le cœur du produit.

**Sur Render**, ajoute une variable :

    CLE_PUBLIQUE=rc_pub_choisis_une_longue_valeur

**Dans `repere-api.js`**, remplace `CLE_PUBLIQUE` par la même valeur.

Cette clé est forcément visible dans le code du navigateur. Ce qui la rend
acceptable : elle n'ouvre que ces trois routes, elle ne consomme le quota
d'aucun client payant, et elle se révoque en changeant la variable sur Render.
L'offre commerciale aux entreprises garde ses clés `gd_…`, séparées.

**Une chose à faire côté serveur.** Ajoute l'origine de cette application à
`ORIGINES_AUTORISEES` sur Render, sinon le navigateur bloquera tous les appels
et l'application paraîtra hors service :

    ORIGINES_AUTORISEES=https://geodeliver-ci.onrender.com,https://…,https://ton-domaine-repere

La géolocalisation exige **HTTPS**. En local, `localhost` est accepté ; sur un
domaine, il faut un certificat.

## Les six écrans

**Naviguer** — la carte occupe toute la hauteur. La recherche accepte quatre
formes : un GeoCode reçu par WhatsApp, une adresse écrite (« 13 rue des
Capucines »), un nom de lieu, ou un appui long sur la carte. Les résultats sont
classés par distance à celui qui cherche, avec la distance affichée.

Le tracé suit les rues réelles, avec les instructions en français et les
signalements du trajet listés avant elles.

**Le guidage en temps réel** se lance avec « Démarrer le guidage ». Le téléphone
suit la position en continu, affiche la manœuvre suivante en grand avec la
distance qui reste, et l'annonce à voix haute trois fois : à quatre cents mètres
pour changer de file, à cent cinquante, puis juste avant le carrefour.

La voix passe par la synthèse vocale du téléphone — rien à télécharger, aucun
serveur, et le français est disponible partout. Le bouton haut-parleur la coupe,
et le choix est retenu.

Si le conducteur s'écarte de plus de soixante mètres du tracé sur **trois
relevés consécutifs**, le trajet est recalculé et annoncé. Trois relevés et non
un seul : un point GPS aberrant ne doit pas déclencher un recalcul.

**Partager** — capture de la position, puis la phrase. La description est écrite
à partir du quartier et des repères alentour ; l'utilisateur la corrige avant
d'envoyer. Le lien mène à `lieu.html`, que le destinataire ouvre sans rien
installer.

**Signaler** — deux volets. La route : huit types d'incidents, chacun avec sa
durée de vie. Une adresse : cinq façons d'enrichir la base.

**Mes lieux** — les lieux enregistrés et l'historique des partages. L'action
principale est « renvoyer », parce qu'on revient ici pour repartager.

**Sur la route** — tous les signalements autour, et les compteurs.

**Profil** — points, contributions, statut de Pionnier, et l'écran de données.

## La description en langage local

C'est le cœur du produit, et elle est calculée **côté client** dans
`Description.pour()` :

1. `GET /reverse` donne le quartier et la ville.
2. `GET /lieux/proches` donne les repères dans un rayon de 600 m, triés par
    distance.
3. La phrase assemble le quartier, le repère le plus proche avec sa distance,
    puis deux repères pour trianguler.

    Cocody, Riviera 2 — à 150 m de la pharmacie Sainte-Marie — entre le marché
    et la station Total.

Le jour où l'API expose cette phrase elle-même, `Description.pour()` n'aura
plus qu'à l'appeler : la forme ne changera pas. Le faire côté serveur est
préférable à terme, pour que les quatre applications disent la même chose.

## Ce qui manque encore côté serveur

| Manque | Conséquence dans l'application |
| --- | --- |
| Endpoint de classement | Le rang du profil est une estimation locale |
| Endpoint d'effacement | « Tout effacer » ne vide que l'appareil, pas la base |
| Description côté serveur | La phrase est calculée par le téléphone, donc en double avec les autres apps |
| Comptes réels | Le compte vit dans le navigateur, pas dans la base |
| Trafic en temps réel | Les durées viennent d'OSRM, qui ignore l'état du trafic : seuls les signalements des utilisateurs le corrigent |
| Quota par appareil sur la clé publique | Rien n'empêche un usage abusif de la clé aujourd'hui |

Le premier et le dernier sont les plus utiles : sans compte réel, un
contributeur perd ses points en changeant de téléphone, ce qui vide le
classement de son sens.

## Repère Maps V8.2 — refonte réelle de la page carte

La V8 initiale ajoutait des préférences et des couleurs sans suffisamment
modifier la composition de l'interface. Cette révision déplace réellement
les éléments de l'écran dans le DOM pour reproduire le concept approuvé :

- Bandeau de marque **Repère Maps** avec logo et bouton **Couches**.
- Recherche autonome juste sous le bandeau, catégories directement sur
  la carte (sans occuper la surface principale).
- Carte de découverte **flottante** et **compacte au démarrage** sur
  téléphone, avec raccourci pour déplier ses fonctions.
- Badge contextuel de carte (Abidjan dans les 30 km du centre, puis
  Côte d'Ivoire ou Explorer la carte) : ne prétend pas connaître la position
  GPS de l'utilisateur et décrit uniquement la zone cartographique.
- Navigation inférieure transformée en dock indépendant, avec position
  prenant en compte les marges de sécurité des appareils mobiles.
- Sur ordinateur, un panneau latéral d'exploration laisse la majorité
  de l'espace à la carte. Les commandes de guidage restent prioritaires.
- Styles isolés dans `repere-v8-2.css` ; cache PWA v19.

La vue Satellite reste réservée dans Couches, mais **désactivée** tant
qu'un fournisseur autorisé n'a pas été intégré et testé.
Les fonctions GPS, partage, guidage multimodal, signalement et points
d'intérêt réutilisent les mêmes éléments, identifiants et moteurs.

## Repère Maps V8 — première phase UX/UI (sans satellite actif)

**Objectif :** libérer la carte des barres et commandes concurrentes, sans réécrire
les recherches, itinéraires, repères locaux et guidage GPS développés en V2–V7.

- La carte occupe l'écran. Le panneau **Explorer les environs** démarre
  replié sur téléphone ; l'utilisateur peut le développer immédiatement.
- Le bouton **Couches** ouvre un panneau regroupant les fonds **Plan** et
  **Détaillé**, ainsi que les réglages séparés **Bâtiments 3D** et
  **Repères locaux**.
- La visibilité des points d'intérêt est mémorisée localement et s'applique
  aux vues Leaflet et MapLibre. Les itinéraires, alertes et positions GPS
  continuent de fonctionner quand les repères sont masqués.
- Le panneau de couches est utilisable au clavier, se ferme avec Échap,
  et se replie lorsque le guidage commence.
- Les nouveaux styles sont isolés dans `repere-v8.css`, chargé en dernier
  pour ne pas modifier les moteurs cartographiques.

**Satellite : en attente**. Le nouvel écran réserve sa place, mais aucun
contrôle actif ni imagerie photographique n'est branché. Choisir d'abord
un fournisseur disposant des droits et de la couverture adéquats sur Abidjan,
puis configurer ses clés et attributions sans exposer de secret serveur.
La source sera testée sur navigateur mobile avant activation.

Les tests GitHub assurent la non-régression structurelle. Ils ne remplacent
pas une validation visuelle du panneau sur un iPhone et un ordinateur.

## Repère Maps V7.1 — 3D vectorielle plus lisible

La V7 d'origine inclinait des **tuiles d'images 2D**, produisait une
surabondance de marqueurs et chargeait lentement quelques bâtiments à
partir d'Overpass. La V7.1 a remplacé ce rendu par un **véritable fond
de carte vectoriel OpenFreeMap Bright** avec MapLibre GL JS. Les routes
et les libellés sont rendus comme des objets vectoriels.

Les bâtiments en relief viennent de la couche vectorielle `building`
d'OpenFreeMap, qui exploite les attributs `render_height` et
`render_min_height` dérivés des données OpenStreetMap. Ils peuvent
être incomplets ou absents dans certains quartiers d'Abidjan. Ce mode
n'est **ni de l'imagerie satellite, ni une maquette photoréaliste**.

En mode 3D, les points d'intérêt de Repère CI sont limités à **12 repères
visibles au zoom moyen et 22 au zoom rapproché**, avec espacement et
noms seulement à fort zoom. L'objectif est de montrer les rues avant
les repères. Cliquer sur un point ouvre toujours sa fiche.

La vue 3D se charge uniquement après clic sur **3D**, et la carte 2D
Leaflet demeure la base des itinéraires et du guidage. Le bouton Plan
ou Repères permet de revenir à la 2D.

**Licences et infrastructure** : le fond et les bâtiments vectoriels
sont fournis par OpenFreeMap / OpenMapTiles avec des données
OpenStreetMap et attribution dans MapLibre. La source publique est sans
clé API, mais sans garantie contractuelle de disponibilité ; une
solution contractuelle ou auto-hébergée reste préférable à grande
échelle. Consulter https://openfreemap.org/ et ses conditions.

## Carte enrichie et repères locaux — V6

- **Plan** : fond OpenStreetMap standard, adapté aux rues et itinéraires.
- **Repères** : rendu humanitaire HOT/OSM France, qui met davantage en avant les équipements et lieux utiles déjà cartographiés dans OSM.
- **Marqueurs communautaires** : les données de points d'intérêt viennent de l'API Repère CI / GeoDeliver. Les icônes varient selon la catégorie. À partir du zoom 17, un nombre limité de noms s'affiche pour éviter les chevauchements.
- **Liste des repères** : une courte sélection des lieux connus près du centre de la carte, en conservant les commandes de partage en accès rapide.

Ces vues ne sont pas de l'imagerie satellite : une couche satellite nécessite **un fournisseur de données avec licence et droits d'usage adaptés**. Ne copiez pas les images Google Maps ou d'un autre service sans autorisation.

**Conditions d'utilisation des fonds :** le service de tuiles OSM France est réservé à un usage public, non lucratif et modéré, avec attribution. Avant toute commercialisation ou forte audience, migrer vers un fournisseur sous contrat, ou auto-héberger un rendu autorisé (https://www.openstreetmap.fr/usage/).

## Attribution — obligatoire

Les données cartographiques de fond sont issues d'OpenStreetMap, sous licence **ODbL**. Les repères communautaires sont fournis séparément par Repère CI / GeoDeliver.
La mention **« © les contributeurs OpenStreetMap »** figure sur la carte, sur la
page d'un lieu partagé et dans le profil. Ne la retirez pas : c'est la
condition d'usage.

## Ce qui n'y est pas

Le **suivi de livraison** reste dans l'application livreur, qui est un produit à
part. Aucun transporteur ivoirien n'expose d'accès public, et promettre le
contraire serait une promesse que rien ne tient.
