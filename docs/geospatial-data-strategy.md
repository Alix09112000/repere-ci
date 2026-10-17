# RepèreMaps — Stratégie de données géospatiales

## Principe
La position GPS est fournie par le terminal (avec autorisation de l'utilisateur) : elle ne requiert pas une base volumineuse. Les cartes, la recherche de lieux, le géocodage inverse, les repères et les itinéraires utilisent en revanche des jeux de données spécialisés.

## Couverture
- Cible à long terme : pays entiers d'Afrique de l'Ouest, pas uniquement les capitales.
- Déploiement progressif : Côte d'Ivoire complète, puis Togo, Bénin, Burkina Faso, et autres pays.
- Une zone peut être « prévue », « carte disponible », « recherche disponible », « routage disponible », « vérifiée » : ne pas confondre ces statuts.
- Priorité aux routes nationales/interurbaines, puis routes secondaires et détails urbains.

## Quatre couches de données
1. **Source géographique** : extractions OpenStreetMap par pays, frontières, routes, bâtiments, POI, mises à jour périodiques; compléments publics sous licences compatibles.
2. **Base métier PostgreSQL/PostGIS** : repères locaux, adresses enrichies, contributions, corrections, géométries, provenance, contrôle qualité; index spatiaux GiST.
3. **Diffusion cartographique** : styles MapLibre + PMTiles ou serveur de tuiles, hébergés sur stockage HTTP avec CORS et cache. Ne pas interroger PostGIS pour chaque tuile si un jeu statique suffit.
4. **Services spécialisés** : graphe de routage Valhalla/OSRM et index de recherche Photon/Pelias, construits depuis des données géographiques. Ces index sont distincts de PostGIS.

## Modèle métier minimal (conceptuel)
- countries(code ISO 3166-1 alpha-2, name, geom)
- administrative_areas(id, country_code, parent_id, name, geom)
- places(id, country_code, name, category, location, source, source_id, updated_at, quality_status)
- local_addresses(id, country_code, place_id, label, location, provenance)
- reports(id, country_code, type, location, created_at, expires_at, moderation_status)
- coverage(country_code, area_id, tiles_status, search_status, routing_status, verified_at)

Utiliser SRID 4326 pour points géographiques API; index spatiaux et pagination. Ne pas stocker l'historique GPS individuel par défaut; collecte minimale, consentement explicite et durées de rétention limitées si une fonction le nécessite.

## Import et mise à jour
1. Télécharger des extraits régionaux OSM auprès d'un fournisseur approprié; documenter date, source et licence.
2. Contrôler géométries, catégories, doublons, attribution et couverture dans ArcGIS Pro / outils SIG.
3. Construire tuiles vectorielles, index de recherche et graphes routiers séparément.
4. Publier les artefacts versionnés avec contrôle qualité et possibilité de retour arrière.
5. Planifier des mises à jour incrémentales ou reconstructions selon la taille et les outils.

## Hébergement et coûts
- GitHub Pages : frontend seulement; éviter d'y publier de volumineux jeux de tuiles.
- Stockage objet/CDN : PMTiles, styles, ressources statiques.
- Base PostGIS gérée ou VPS : données métier.
- Machines de calcul distinctes ou services hébergés : routage et recherche.
- Dimensionner après mesure réelle : volume OSM, taille des tuiles, index de routage, trafic et bande passante. Ne pas avancer de capacité fixe sans benchmark.
- Les images satellites nécessitent une source et une licence adaptées.

## Sécurité et fiabilité
- Sauvegardes PostGIS automatisées, tests de restauration, surveillance, limitation des requêtes et authentification des modifications.
- Respect ODbL/attribution OSM et licences des autres sources.
- Éviter toute clé secrète dans le frontend public.
- Ne pas publier les positions personnelles des utilisateurs sans leur choix.

## Étapes suivantes
- Faire un pilote national Côte d'Ivoire : estimation des volumes et test de routage interurbain Abidjan–Bouaké.
- Répéter le pipeline au Togo, puis tester la navigation transfrontalière.
- Ajouter un tableau de bord de couverture et qualité par pays.
