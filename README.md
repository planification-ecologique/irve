# Carte IRVE

Carte interactive des infrastructures de recharge pour véhicules électriques (IRVE) en France.

## Stack

- [Vite](https://vite.dev/) + React + TypeScript
- [MapLibre GL JS](https://maplibre.org/) pour la cartographie
- Données [QualiCharge](https://map.qualicharge.beta.gouv.fr/)

## Fonctionnalités

- ~8 400 stations sur toute la France
- Clustering automatique au zoom
- Couleur par puissance (lente → ultra-rapide)
- Filtres : recherche, puissance min., connecteurs, disponibilité
- Panneau détail au clic sur une station

## Démarrage

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

Les données IRVE sont chargées à la volée via `/api/irve/points/` (proxy Cloud Function → [map.qualicharge.beta.gouv.fr](https://map.qualicharge.beta.gouv.fr/)). Rafraîchissement automatique toutes les 2 minutes.

Le détail d’une station (`/api/irve/stations/{id}/`) fournit l’adresse postale précise.

Si l’API est indisponible, repli sur `/data/stations.json` (snapshot généré au build) avec un bandeau « Données non live ».

En dev, Vite proxy la même route vers QualiCharge.

## Déploiement Firebase

Projet : **carto-irve** (plan **Blaze** requis pour Cloud Functions)

```bash
npm run deploy
```

URL : [https://carto-irve.web.app](https://carto-irve.web.app)
