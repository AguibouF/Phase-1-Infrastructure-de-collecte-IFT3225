# Client — Ambiance des Lieux (Phase 2)

Application web React (Vite) qui consomme l'API de la Phase 1 pour rendre l'ambiance d'un lieu lisible d'un coup d'œil : une **carte** des lieux (marqueurs colorés selon la classification renvoyée par l'API) et une **vue détaillée** (badge de classification, historique du niveau sonore, créneaux calmes). Les lectures sont publiques ; la soumission d'observations et la gestion des favoris demandent un compte.

## Prérequis

- **Node.js ≥ 18**
- **L'API de la Phase 1 en marche** (par défaut sur `http://localhost:3000`). Voir le `README.md` à la racine du dépôt pour la démarrer (`npm start`), et lancer `npm run seed` pour disposer de lieux et de données de démonstration.

## Installation et lancement

```bash
cd client
npm install
cp .env.example .env     # configure l'URL de l'API (voir ci-dessous)
npm run dev              # démarre le serveur de dev sur http://localhost:5173
```

Autres scripts : `npm run build` (build de production), `npm run preview` (prévisualise le build), `npm run lint` (Oxlint).

## Configuration

L'URL de l'API est lue dans la variable d'environnement `VITE_API_URL` (fichier `client/.env`, voir `client/.env.example`). Le préfixe `/v1` est inclus.

| Variable | Rôle | Valeur par défaut |
|---|---|---|
| `VITE_API_URL` | URL de base de l'API Phase 1 | `http://localhost:3000/v1` |

## Se connecter et tester les actions protégées

Les **lectures** (carte, portrait d'ambiance, historique, créneaux calmes) fonctionnent **sans compte**. Les **écritures** demandent d'être authentifié :

1. Lancez l'API (`npm start` à la racine) puis le client (`npm run dev`) et ouvrez `http://localhost:5173`.
2. Cliquez sur **Connexion → Créer un compte** (nom d'utilisateur, courriel, mot de passe ≥ 6 caractères). La connexion est automatique après l'inscription ; l'en-tête affiche « Bonjour, \<utilisateur\> ».
3. Une fois connecté :
   - ouvrez un lieu depuis la carte → **+ Nouvelle observation** → remplissez et soumettez. L'observation est liée à votre compte (envoi du token JWT dans l'en-tête `Authorization: Bearer <token>`) et horodatée côté serveur.
   - marquez des lieux en **favoris** (★) et retrouvez-les via **Mes favoris**.
   - consultez **Mes lieux** : le récapitulatif des lieux où vous avez soumis des observations.
4. **Déconnexion** vide la session ; si le token expire, l'application déconnecte automatiquement et invite à se reconnecter.

Le token et l'utilisateur sont conservés dans le `localStorage` du navigateur, ce qui garde la session au rechargement de la page.

## Organisation

```
client/src/
├── api/ambianceApi.js       # couche client : tous les appels HTTP à l'API (axios) sont isolés ici
├── components/
│   ├── MapView.jsx          # carte Leaflet : marqueurs colorés par classification, seuil de fraîcheur
│   ├── LocationDetail.jsx   # portrait d'un lieu : badge, graphe d'historique, créneaux calmes, formulaire d'observation
│   ├── LoginForm.jsx        # connexion
│   ├── RegisterForm.jsx     # inscription
│   └── MyLocations.jsx      # récapitulatif « mes lieux » et favoris
├── App.jsx                  # état d'authentification, navigation entre les vues
└── main.jsx                 # point d'entrée React
```

La couche `api/ambianceApi.js` est volontairement séparée de l'interface : toute la classification et l'interprétation sont faites **côté serveur**, le client ne fait qu'afficher et interroger. Un intercepteur gère la déconnexion automatique sur token expiré (401).

## Seuil de fraîcheur de la carte

Un marqueur affiche l'ambiance des **30 dernières minutes**. Sans mesure récente, il montre sa **dernière ambiance connue** (marqueur estompé, contour pointillé, avec l'ancienneté) pendant **2 heures au maximum** ; au-delà, le lieu passe en gris « Données non disponibles ». L'historique complet reste consultable dans la vue détaillée.
