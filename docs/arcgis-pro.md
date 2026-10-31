# RepèreMaps — centres indicatifs pour ArcGIS Pro

Ce dossier contient deux tables CSV UTF-8 (séparateur virgule, décimales avec point) extraites du catalogue public `repere-west-africa.js`, ainsi qu'un export GeoJSON généré depuis ces tables :

- `data/arcgis/countries.csv` : 16 centres de pays, avec code, nom et niveau de zoom indicatif.
- `data/arcgis/cities.csv` : 24 centres de grandes villes, avec code du pays.
- `data/arcgis/centers.geojson` : 40 points indicatifs (16 centres de pays et 24 centres de villes), coordonnées GeoJSON en ordre **longitude, latitude**, WGS 84.

## Importation dans ArcGIS Pro

1. Ajouter le CSV au projet via **Add Data**.
2. Utiliser **XY Table To Point** (Geoprocessing). Choisir `longitude` pour X et `latitude` pour Y.
3. Définir le système de coordonnées d'entrée **GCS WGS 1984 (EPSG:4326)**, puis enregistrer les points dans une géodatabase.
4. Joindre `country_code` à un référentiel de pays *validé* si des frontières officielles sont nécessaires.

## Importation du GeoJSON dans ArcGIS Pro

1. Ouvrir **JSON To Features** (Conversion) et choisir `data/arcgis/centers.geojson` en entrée.
2. Définir **Geometry Type = Point**, puis enregistrer la classe d'entités dans une géodatabase.
3. Filtrer sur `kind = 'country_center'` ou `kind = 'city_center'` pour séparer les deux types de centres. Le champ `zoom` ne décrit qu'un niveau d'affichage indicatif (valeur nulle pour les villes).

L'outil **JSON To Features** prend en charge les fichiers `.geojson` : [documentation Esri](https://doc.esri.com/en/arcgis-pro/latest/tool-reference/conversion/json-to-features.html). L'importation dans une installation réelle d'ArcGIS Pro reste à vérifier.

## Mise à jour reproductible

Après modification du catalogue JavaScript et synchronisation des CSV, régénérer le GeoJSON puis contrôler la cohérence :

```bash
node scripts/export-arcgis-geojson.cjs
node scripts/export-arcgis-geojson.cjs --check
node --test tests/repere-arcgis-*.test.cjs
```

Le workflow GitHub Actions exécute également les tests sous `tests/`. Les CSV et le GeoJSON ne doivent pas être utilisés comme des frontières, des adresses précises ou des données routières.

## Limites et provenance

**Toutes les coordonnées sont des centres approximatifs**, non des adresses géocodées, limites administratives, points de livraison ou preuves de couverture routière. Le champ `coordinate_status=approximate_center` doit être conservé lors des transformations. Le champ `source` identifie uniquement le fichier interne d'origine ; il **ne constitue pas une référence géodésique indépendante**. Aucune précision métrique, date de levé ou qualité vérifiée n'est revendiquée.

Les CSV reflètent le catalogue `repere-west-africa.js` au moment du commit. Le test `tests/repere-arcgis-csv.test.cjs` détecte une divergence entre ces fichiers et le catalogue. Le test `tests/repere-arcgis-geojson.test.cjs` détecte une divergence entre le GeoJSON et les CSV. Exécuter les contrôles ci-dessus après toute modification des centres.

Pour des analyses spatiales fiables (densité, distances, accessibilité), utiliser ensuite des jeux de données officiels ou OSM contrôlés, documenter leurs licences, leur date et leur précision, et valider la couverture pays par pays.

## Traçabilité machine-lisible des exports

Le fichier `data/arcgis/provenance.json` inventorie les trois exports (CSV pays, CSV villes et GeoJSON), les 16 codes pays et les nombres d'enregistrements attendus. Il précise le référentiel WGS 84, l'ordre longitude-latitude en GeoJSON et le statut `approximate_center`.

**Attention :** `source_catalog` désigne le catalogue interne RepèreMaps et non la source originale des coordonnées. Aucune source externe indépendante, licence amont, date de relevé ou précision métrique n'est actuellement vérifiée. Les champs `external_source_verified` et `source_license_verified` restent donc à `false`, et les valeurs inconnues à `null`. Ne pas présenter ces centres comme des données officielles ou adaptées au routage.

Après une mise à jour des exports, vérifier aussi la concordance des métadonnées :

```bash
node --test tests/repere-arcgis-provenance.test.cjs
```

Les métadonnées ne confèrent aucun droit de redistribution sur des jeux de données externes futurs : vérifier séparément leur provenance et leur licence avant toute intégration.
