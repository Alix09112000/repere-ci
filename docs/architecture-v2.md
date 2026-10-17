# RepèreMaps — Architecture V2 multi-pays

> Branche de préparation. Aucune migration en production n'est implicite.

## Objectifs
- Étendre la couverture d'Abidjan à Lomé puis à d'autres villes africaines, sans dupliquer l'application.
- Réduire la dépendance aux fournisseurs de fonds de carte avec un hébergement maîtrisé.
- Préserver le GPS, les repères, le partage de position, les signalements et le guidage.
- Distinguer données géographiques, affichage, recherche, routage et services métier.

## État actuel vérifié
- Frontend statique sur GitHub Pages, sans chaîne de compilation (README).
- Affichage 2D basé sur Leaflet (index.html).
- API métier GeoDeliver sur Render (README).
- Interface comprenant une vue 3D optionnelle; son fonctionnement doit être audité.
- Satellite marqué indisponible dans index.html; ne pas l'annoncer comme disponible.

## Architecture cible

```text
GitHub Pages (UI web/PWA)
    ├── MapLibre GL JS (affichage vectoriel 2D/3D)
    │      └── style.json → tuiles PMTiles/serveur de tuiles → stockage HTTP/CORS
    ├── API métier GeoDeliver (Render, existante)
    ├── API recherche (à définir : Photon/Pelias, selon tests)
    └── API routage (à définir : Valhalla/OSRM, selon tests)
                 │
        PostgreSQL + PostGIS (données métier et géospatiales)
                 ↑
   pipeline de préparation et validation (ArcGIS Pro + OSM)
```

La carte vectorielle et le routage sont deux services indépendants. ArcGIS Pro prépare les données; il n'est pas un serveur public de tuiles.

## Choix progressifs
1. **Court terme** : conserver Leaflet et ajouter un fond de carte de secours conforme aux conditions d'utilisation, pour rétablir l'affichage.
2. **Prototype** : produire un jeu de tuiles vectorielles pour Abidjan, tester le rendu dans MapLibre sur une page isolée.
3. **Production** : publier un style versionné et un hébergement de tuiles avec CORS, cache et surveillance.
4. **Extension** : ajouter Lomé et tester le chargement multi-pays.
5. **Routage** : préparer les graphes routiers régionaux et vérifier les liaisons transfrontalières.

Ne pas migrer Leaflet vers MapLibre avant tests de parité fonctionnelle.

## Données et normalisation
- Utiliser EPSG:4326 pour les coordonnées géographiques des échanges API; tuiles web selon les spécifications du moteur choisi.
- Pays : codes ISO 3166-1 alpha-2 (CI, TG, GH, BJ, etc.).
- Villes et quartiers : identifiants stables, géométries et noms multilingues si disponibles.
- Entités OSM : conserver source, identifiant, date de mise à jour et licence.
- Couverture et qualité : documenter les zones sans bâtiments, routes ou points d'intérêt.
- Respecter ODbL d'OpenStreetMap, attribution et obligations éventuelles de partage à l'identique.
- Satellite : ne pas intégrer d'imagerie sans licence de redistribution.

## Structure proposée (future, non encore implémentée)
```text
/docs/architecture-v2.md
/cartography/styles/
/cartography/config/regions.json
/cartography/pipeline/
/prototype/maplibre/
/services/  (si des services propres sont créés)
```

## Contrat de configuration régional (proposition)
```json
{
  "version": 1,
  "regions": [
    {"id":"ci-abidjan","country":"CI","name":"Abidjan","center":[-4.0083,5.3599],"zoom":11},
    {"id":"tg-lome","country":"TG","name":"Lomé","center":[1.2228,6.1319],"zoom":11}
  ]
}
```
Les centres sont indicatifs et ne constituent pas des données officielles.

## Critères d'acceptation avant mise en production
- Affichage carte 2D sur iPhone et ordinateur, sans filigrane « API KEY REQUIRED ».
- Pan/zoom, recherche, repères, géolocalisation et partage de position toujours fonctionnels.
- Itinéraires voiture/marche/vélo vérifiés sur des trajets réels.
- Couche 3D seulement si données et moteur fonctionnels.
- Bascule Abidjan/Lomé sans changement de code applicatif.
- Gestion explicite des erreurs de réseau, chargement et fournisseurs.
- Tests de performance et coûts de diffusion documentés.
- Secrets côté serveur uniquement; aucune clé privée dans le frontend GitHub Pages.

## Prochain lot
1. Auditer les scripts de fonds de carte, le routage et la vue 3D existants.
2. Ajouter un prototype MapLibre isolé sans modifier index.html.
3. Préparer un premier export cartographique d'Abidjan dans ArcGIS Pro.
4. Tester le chargement de tuiles sur mobile avant toute migration.
