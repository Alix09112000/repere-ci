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

## Attribution — obligatoire

Les repères et le fond de carte viennent d'OpenStreetMap, sous licence **ODbL**.
La mention **« © les contributeurs OpenStreetMap »** figure sur la carte, sur la
page d'un lieu partagé et dans le profil. Ne la retirez pas : c'est la
condition d'usage.

## Ce qui n'y est pas

Le **suivi de livraison** reste dans l'application livreur, qui est un produit à
part. Aucun transporteur ivoirien n'expose d'accès public, et promettre le
contraire serait une promesse que rien ne tient.
