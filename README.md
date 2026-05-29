# Carte IRVE

Carte interactive des infrastructures de recharge pour véhicules électriques (IRVE) en France.

## Stack

- [Vite](https://vite.dev/) + React + TypeScript
- [MapLibre GL JS](https://maplibre.org/) pour la cartographie
- Données [QualiCharge](https://qualicharge-carto.osc-fr1.scalingo.io/api/irve/points/)

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

Le build télécharge les données IRVE dans `public/data/stations.json` (snapshot au moment du build).

## Déploiement Firebase

Projet : **carto-irve**

```bash
npm run deploy
```

URL : [https://carto-irve.web.app](https://carto-irve.web.app)

> Plan Spark : données servies en statique depuis le build. Relancer `npm run deploy` pour rafraîchir.
> Cloud Function proxy (`functions/`) disponible si passage au plan Blaze → `npm run deploy:functions`.
