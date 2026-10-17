# Repère CI → GeoDeliver : collecte participative

## Objectif produit
Repère CI est le canal de contribution terrain. Les utilisateurs soumettent volontairement des lieux, des repères, des adresses descriptives et des corrections. GeoDeliver reçoit uniquement les contributions autorisées et validées pour enrichir ses services de géocodage, recherche et proximité.

## Cycle de vie
1. Contribution explicite depuis l'application (lieu public, établissement, rue, quartier, repère local, correction).
2. Enregistrement dans une file de modération `pending` avec géométrie, précision GPS, catégorie, provenance, date, droits et consentement.
3. Contrôles : géométrie plausible, pays, doublons spatiaux/nominatifs, cohérence, contenu sensible, qualité.
4. Validation humaine ou règles de confiance prudentes : `approved`, `rejected`, `needs_review`.
5. Publication vers la base de référence GeoDeliver, puis synchronisation des index de recherche et caches.
6. Suivi des versions, correction et retrait possible.

## Confidentialité
- Pas de collecte GPS en arrière-plan pour enrichir la base.
- Pas de publication automatique de domicile, localisation privée, trajet ou historique.
- Séparer les repères privés (partage contrôlé) des points d'intérêt publics.
- Consentement spécifique pour une contribution destinée à être réutilisée par l'API; politique de confidentialité compréhensible.
- Minimiser les identifiants personnels, prévoir suppression et gestion des abus.
- Distinguer contributions originales et données dérivées d'OSM; respecter licences et attributions.

## Données minimales d'une contribution
```json
{
  "type": "place_suggestion",
  "country": "CI",
  "name": "Exemple de pharmacie",
  "category": "pharmacy",
  "location": {"lat": 5.35, "lon": -4.02},
  "accuracy_m": 12,
  "description": "Près du marché",
  "visibility": "public_candidate",
  "consent_to_publish": true
}
```
Exemple fictif, non soumis à l'API.

## Contrat d'API envisagé (non implémenté)
- `POST /v1/contributions` : soumettre une contribution authentifiée ou protégée contre l'abus.
- `GET /v1/contributions/me` : voir l'état de ses contributions.
- `POST /v1/moderation/{id}/approve` : réservé aux modérateurs.
- `POST /v1/moderation/{id}/reject` : réservé aux modérateurs.
- `GET /v1/places/search` : consulter uniquement les données publiées.
Ne pas modifier les routes existantes `/geocode`, `/apprendre`, `/lieux` sans audit backend.

## Indicateurs
Contributions par pays, taux de validation, doublons, couverture des quartiers, fraîcheur, corrections acceptées, signalements abusifs. Ne pas inciter à partager des domiciles ou positions de tiers pour gagner des points.

## Étapes d'implémentation
1. Auditer les formulaires Repère CI et les routes backend existantes, notamment `/apprendre` et `/geocode`.
2. Introduire une file de contributions distincte des lieux publiés.
3. Ajouter des écrans de consentement et de suivi de statut.
4. Développer la modération et le dédoublonnage PostGIS.
5. Connecter la publication des contributions approuvées aux services GeoDeliver.
6. Tester sur une zone pilote avant extension multi-pays.
