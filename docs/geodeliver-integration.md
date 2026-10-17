# RepèreMaps + GeoDeliver — Architecture de données commune

## Vision
La même infrastructure géographique alimente :
- RepèreMaps : application grand public, navigation, partage, contributions.
- GeoDeliver API : géocodage, géocodage inverse, recherche de lieux, proximité, validation d'adresses et itinéraires pour clients tiers.

Les données géographiques ne doivent pas être dupliquées dans deux bases incohérentes. Distinguer source de vérité métier, index de recherche, graphes routiers et tuiles de diffusion.

## Audit rapide du frontend actuel
- `repere-api.js` définit `API = 'https://geodeliver-ci.onrender.com'`.
- `Api.quartier()` appelle `GET /reverse`.
- `Api.lieux()` appelle `GET /lieux`; `Api.lieuxProches()` appelle `GET /lieux/proches`.
- `Api.geocoder()` appelle `POST /geocode`, `Api.apprendre()` appelle `POST /apprendre`.
- `Geo.obtenir()` refuse actuellement les positions GPS hors des bornes `CI`.
- Le commentaire du code indique que le serveur a également une validation `geocode.BORNES_CI`; à vérifier dans le dépôt backend avant modification.
- Le frontend utilise une clé publique limitée; **ne pas** y intégrer de clé privée ou d'accès base de données.

## Architecture
```text
RepèreMaps web ───────────┐
                          ├── GeoDeliver API /v1 ─── services métier
Applications partenaires ─┘                            │
                                        ┌───────────────┼──────────────────┐
                                        │               │                  │
                                  PostGIS métier   index recherche    graphe routier
                                        │               │                  │
                                        └───────────────┼──────────────────┘
                                                        ↑
                                               Pipeline OSM/ArcGIS
                                                        │
                                             Tuiles PMTiles + CDN
                                                        │
                                            MapLibre (RepèreMaps)
```

## Compatibilité API
Garder les routes existantes en service pendant la migration; ajouter éventuellement une version `/v1` avec migration contrôlée, sans renommer les routes existantes brutalement.

Routes candidates (contrats à concevoir, non implémentées) :
- `GET /v1/places/search?q=...&country=CI`
- `GET /v1/geocode/reverse?lat=...&lon=...`
- `GET /v1/places/nearby?lat=...&lon=...&radius=...`
- `POST /v1/routes` (profils voiture, vélo, marche)
- `GET /v1/coverage?country=TG`

Ne pas annoncer de disponibilité sans implémentation et tests. L'accès partenaire nécessite authentification, quotas, journalisation minimale, conditions d'usage et tarification éventuelle.

## Schéma et qualité
- ISO 3166-1 alpha-2 pour les pays; coordonnées WGS84.
- `places` avec identifiants stables, pays, catégorie, géométrie, provenance, fraîcheur et état de vérification.
- `local_addresses` avec repères locaux et noms alternatifs.
- `coverage` pour publier l'état réel des données par région et par service.
- PostGIS : index GiST; migrations SQL versionnées, sauvegardes et tests de restauration.
- Source OSM : attribution et obligations ODbL; vérifier la compatibilité des enrichissements et redistributions.
- Géolocalisation et historique : consentement et minimisation des données.

## Déploiement progressif
1. Auditer le backend GeoDeliver, les schémas existants, la base de données et les validations `BORNES_CI`.
2. Retirer les restrictions Côte d'Ivoire uniquement quand le backend supporte réellement les autres pays.
3. Charger un pilote national CI, vérifier géocodage/recherche/routage.
4. Ajouter TG et BJ, vérifier les noms locaux et les trajets transfrontaliers.
5. Étendre pays par pays, avec tests de performance et indicateurs de qualité.

## Décision importante
La base PostGIS est le référentiel des enrichissements métier. Les tuiles vectorielles, l'index de recherche et le graphe routier sont des artefacts dérivés, reconstruits ou synchronisés par pipeline. Le navigateur ne se connecte jamais directement à PostGIS.
