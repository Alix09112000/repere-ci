# RepèreMaps — centres indicatifs pour ArcGIS Pro

Ce dossier contient deux tables CSV UTF-8 (séparateur virgule, décimales avec point) extraites du catalogue public `repere-west-africa.js` :

- `data/arcgis/countries.csv` : 16 centres de pays, avec code, nom et niveau de zoom indicatif.
- `data/arcgis/cities.csv` : 24 centres de grandes villes, avec code du pays.

## Importation dans ArcGIS Pro

1. Ajouter le CSV au projet via **Add Data**.
2. Utiliser **XY Table To Point** (Geoprocessing). Choisir `longitude` pour X et `latitude` pour Y.
3. Définir le système de coordonnées d'entrée **GCS WGS 1984 (EPSG:4326)**, puis enregistrer les points dans une géodatabase.
4. Joindre `country_code` à un référentiel de pays *validé* si des frontières officielles sont nécessaires.

## Limites et provenance

**Toutes les coordonnées sont des centres approximatifs**, non des adresses géocodées, limites administratives, points de livraison ou preuves de couverture routière. Le champ `coordinate_status=approximate_center` doit être conservé lors des transformations. Le champ `source` identifie uniquement le fichier interne d'origine ; il **ne constitue pas une référence géodésique indépendante**. Aucune précision métrique, date de levé ou qualité vérifiée n'est revendiquée.

Les CSV reflètent le catalogue `repere-west-africa.js` au moment du commit. Le test `tests/repere-arcgis-csv.test.cjs` détecte une divergence entre ces fichiers et le catalogue. Exécuter `node --test tests/repere-arcgis-csv.test.cjs` après toute modification des centres.

Pour des analyses spatiales fiables (densité, distances, accessibilité), utiliser ensuite des jeux de données officiels ou OSM contrôlés, documenter leurs licences, leur date et leur précision, et valider la couverture pays par pays.
