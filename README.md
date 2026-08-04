# Serveur de collecte environnementale — Ambiance des lieux

Auteurs :
- Aguibou FOFANA

- Mamadou TRAORE

- Kofi OSEL

API REST (Express + MongoDB Atlas) qui collecte des **mesures** sonores (capteur Phyphox) et des **observations** humaines pour évaluer l'**ambiance** d'un lieu (calme, modéré, animé, bruyant). Le projet expose les ressources persistées (`devices`, `locations`, `measurements`, `observations`) et des **vues sémantiques calculées** (`ambiance/now`, `quiet-hours`, `compare`, `history`, `where-to-go`). Réalisé pour IFT3225 — Phases 1 à 3.

## Prérequis

- **Node.js ≥ 18** (le bridge et le serveur utilisent `fetch` natif)
- **Un cluster MongoDB Atlas** (gratuit M0 suffisant) + sa chaîne de connexion
- **Phyphox** sur un téléphone, avec « Allow remote access » activé (pour la collecte réelle ; optionnel pour tester avec le seed)

## Installation et lancement

```bash
npm install                 # installe les dépendances backend
cp .env.example .env        # puis renseignez MONGODB_URI et ADMIN_API_KEY
npm run seed                # (optionnel) peuple la base de données de démo
npm start                   # compile le TypeScript puis démarre le serveur sur http://localhost:3000
```

> **Bonus Phase 2 — backend TypeScript** : le serveur est écrit en TypeScript
> (`index.ts`, `src/**/*.ts`) avec typage complet du modèle (interfaces Mongoose),
> de la couche données et des routes. `npm start` compile automatiquement
> (`npm run build` = `tsc`) vers `dist/` avant de démarrer.

### Application client React (Phase 2)

```bash
cd client                   # aller dans le dossier client
npm install                 # installe les dépendances frontend
cp .env.example .env        # configure l'URL de l'API (VITE_API_URL)
npm run dev                 # démarre le serveur de développement sur http://localhost:5173
```

La couche client (`client/src/api/ambianceApi.js`) lit l'URL de l'API dans la variable
`VITE_API_URL` (fichier `client/.env`, voir `client/.env.example`). Par défaut :
`http://localhost:3000/v1`.

L'application client React permet de :
- Visualiser la carte des lieux avec marqueurs colorés selon l'ambiance (nom du lieu en infobulle au survol)
- Voir la **dernière ambiance connue** d'un lieu sans mesure récente : marqueur estompé à contour pointillé avec son ancienneté (fenêtre de fraîcheur 30 min ; au-delà de 2 h sans mesure, retour au gris « Données non disponibles » — comportement documenté sous la légende)
- Consulter les détails d'un lieu (ambiance actuelle, historique, créneaux calmes en heure locale de Montréal groupés par jour, 5 dernières observations)
- Créer un compte et se connecter
- Soumettre des observations (authentifié)
- Gérer ses lieux favoris

`npm run seed` affiche les **clés API des devices**. Le seed est **non destructif** : il conserve les lieux, les devices (les clés restent donc stables d'une exécution à l'autre) et les **collectes réelles** (distinguées des données simulées par `receivedAt ≈ timestamp`) ; seules les données de démonstration sont régénérées. Il synchronise aussi automatiquement `DEVICE_API_KEY` dans le `.env` avec le device correspondant à votre `LOCATION_SLUG` — aucun copier-coller nécessaire pour le bridge.

### Tests unitaires (Phase 3 — Tâche 3)

Les **services métier** du backend sont couverts par des tests unitaires
(**Vitest**), exécutables **sans base de données ni serveur** (fonctions pures).
Les dépendances sont installées par `npm install` à la racine ; ensuite :

```bash
npm test            # lance toute la suite une fois (27 tests)
npm run test:watch  # mode watch pendant le développement
```

Couverture : `ambianceService` (portrait d'ambiance, créneaux calmes, historique,
classement « où aller »), les utilitaires de temps (`parseDuration`,
`buildTimeWindow`) et le middleware de cache (HIT/MISS, invalidation). Tous les
tests passent sur le code livré et déployé.

### Connexion et test des actions protégées

1. Lancez le backend (`npm start`) puis le client (`cd client && npm run dev`) et ouvrez `http://localhost:5173`.
2. Cliquez sur **Connexion** puis **Créer un compte** (nom d'utilisateur, courriel, mot de passe d'au moins 6 caractères). La connexion est automatique après l'inscription et l'en-tête affiche « Bonjour, \<utilisateur\> ».
3. Une fois connecté, testez les actions protégées :
   - ouvrez un lieu depuis la carte → **+ Nouvelle observation** → remplissez et soumettez : l'observation est liée à votre compte (champ `author`) et horodatée côté serveur ;
   - **☆ Ajouter aux favoris** dans la vue détaillée, puis utilisez le filtre **Mes favoris** sur la carte ;
   - ouvrez **Mes lieux** pour voir le récapitulatif de vos contributions (nombre d'observations, dernière écoute).
4. Vérifiez le refus sans authentification : `POST /v1/observations/user` sans en-tête `Authorization` renvoie **401** `NO_TOKEN` (testable via la collection Postman ou `curl`).
5. Cliquez sur **Déconnexion** : le formulaire d'observation, les favoris et « Mes lieux » disparaissent de l'interface ; si le token expire (7 jours), l'application déconnecte automatiquement et invite à se reconnecter.

### Variables d'environnement (`.env`)

| Variable | Rôle |
|---|---|
| `PORT` | Port d'écoute (défaut 3000) |
| `MONGODB_URI` | Chaîne de connexion du cluster Atlas |
| `DB_NAME` | Nom de la base (défaut `ambiance`) |
| `ADMIN_API_KEY` | Clé d'administration des endpoints de gestion |
| `JWT_SECRET` | Secret pour les tokens JWT (authentification utilisateur) |
| `RATE_LIMIT_PER_MIN` | Limite de requêtes/min (défaut 130) |
| `MAX_PER_PAGE` | Pagination max (défaut 200) |

## Déploiement (Phase 3 — Tâche 5)

L'application est déployée sur **Render** en deux services (voir le Blueprint
[`render.yaml`](render.yaml) qui les décrit) :

- **Backend** (Web Service Node) : <https://ambiance-api.onrender.com> — santé : `/v1/health`
- **Frontend** (Static Site) : <https://ambiance-client.onrender.com>

| Service | Commande de build | Démarrage / publication |
|---|---|---|
| Backend | `npm install && npm run build` | démarrage : `node dist/index.js` |
| Frontend | `cd client && npm install && npm run build` | publication : `client/dist` |

**Variables d'environnement à définir dans Render :**
- Backend : `MONGODB_URI`, `DB_NAME`, `ADMIN_API_KEY`, `JWT_SECRET` (le `PORT` est fourni automatiquement par Render).
- Frontend : `VITE_API_URL = https://ambiance-api.onrender.com/v1` — **variable de build** : toute modification exige un redéploiement du frontend.

**Prérequis :** dans MongoDB Atlas, autoriser l'accès réseau depuis Render
(*Network Access* → `0.0.0.0/0`, les IP sortantes du plan gratuit étant
dynamiques). Sur le plan gratuit, le backend s'endort après ~15 min d'inactivité
(premier appel ~50 s).

## Architecture

L'organisation sépare routes, modèles et middlewares (pas de mégafichier `index.js`) :

```
├── index.ts                 # point d'entrée backend (TypeScript) : connecte la DB puis démarre Express
├── tsconfig.json            # configuration TypeScript (compilation vers dist/)
├── render.yaml              # Blueprint de déploiement Render (backend + frontend) — Phase 3
├── src/
│   ├── app.ts               # construction de l'app Express (middlewares + montage des routes)
│   ├── config/db.ts         # connexion Mongoose à MongoDB Atlas (URI via .env)
│   ├── models/              # schémas Mongoose typés : Device, Location, Measurement, Observation, User
│   ├── middlewares/         # auth (x-api-key), userAuth (JWT), rate limit, cache, gestion d'erreurs
│   ├── routes/              # devices, locations, measurements, observations, ambiance, auth, events (SSE)
│   ├── services/            # logique métier pure et testable : ambianceService, cacheService (Phase 3)
│   ├── types/               # augmentations de types Express (req.device, req.user)
│   └── utils/               # enveloppe de réponse, pagination, fenêtres temporelles, calculs d'ambiance, bus d'événements
├── tests/                   # tests unitaires Vitest (services, temps, cache) — Phase 3
├── scripts/seed.js          # peuplement de données de démonstration
├── bridge/bridge.js         # collecte : Phyphox -> POST /v1/measurements
├── client/                  # Application React (Phase 2, enrichie Phase 3)
│   ├── src/
│   │   ├── components/      # MapView, LocationDetail, WhereToGo, MyLocations, LoginForm, RegisterForm, common/StateMessage
│   │   ├── context/        # contextes React : AuthContext, FavoritesContext (Phase 3)
│   │   ├── hooks/          # hooks personnalisés : useLocations (Phase 3)
│   │   ├── store/          # store Zustand : uiStore — navigation + notifications (Phase 3)
│   │   ├── api/            # API client : ambianceApi (avec cache)
│   │   ├── utils/          # utilitaires partagés : ambiance (couleurs/libellés), cache (Phase 3)
│   │   ├── App.jsx          # orchestrateur principal
│   │   ├── main.jsx         # point d'entrée React (montage des providers)
│   │   └── App.css          # styles globaux
│   └── package.json         # dépendances frontend
└── postman/                 # collection Postman de test
```

## Table des endpoints

Tous les chemins sont préfixés par `/v1`. Enveloppe de réponse : `{ status, data, meta }` ; enveloppe d'erreur : `{ status:"error", error:{ code, message, details? }, meta }`.

### Gestion des appareils
| Méthode | Endpoint | Corps / params | Auth | Codes |
|---|---|---|---|---|
| POST | `/v1/devices` | `{ name, locationSlug }` | **aucune (faille volontaire)** | 201, 400, 404, 409 |
| GET | `/v1/devices` | `locationSlug?, page?, perPage?, sort?` | publique | 200 |
| DELETE | `/v1/devices/{id}` | — | `x-api-key` admin | 204, 401, 403, 404 |

### Gestion des lieux
| Méthode | Endpoint | Corps / params | Auth | Codes |
|---|---|---|---|---|
| GET | `/v1/locations` | `city?, type?, page?, perPage?` | publique | 200 |
| POST | `/v1/locations` | `{ slug, displayName, city, type }` | `x-api-key` admin | 201, 400, 401, 403, 409 |
| PUT | `/v1/locations/{slug}` | `{ displayName?, city?, type? }` | `x-api-key` admin | 200, 400, 401, 403, 404 |

### Collecte (écriture, protégée par `x-api-key` device)
| Méthode | Endpoint | Corps | Codes |
|---|---|---|---|
| POST | `/v1/measurements` | `{ type, value, unit, locationSlug, timestamp, deviceId? }` | 201, 400, 401, 403, 404, 422 |
| POST | `/v1/observations` | `{ locationSlug, density, proximity, vibe, notes?, timestamp }` | 201, 400, 401, 403, 404, 422 |
| POST | `/v1/measurements/batch` | `[ { type, value, unit, locationSlug, timestamp }, ... ]` | 207, 400, 401, 403 |

### Consultation brute (publique)
| Méthode | Endpoint | Filtres |
|---|---|---|
| GET | `/v1/measurements` | `locationSlug?, type?, from?, to?, last?, page?, perPage?, sort?` |
| GET | `/v1/observations` | `locationSlug?, vibe?, density?, from?, to?, last?, page?, perPage?, sort?` |

### Endpoints sémantiques (publics)
| Méthode | Endpoint | Paramètres |
|---|---|---|
| GET | `/v1/ambiance/{slug}/now` | `window?` = `15m`\|`30m`\|`1h` (défaut `30m`) |
| GET | `/v1/ambiance/{slug}/quiet-hours` | `days?`=`7`\|`14`\|`30`, `threshold?` (dB), `dayOfWeek?`=0–6 |
| GET | `/v1/ambiance/compare` | `locations` (slugs séparés par virgule), `window?` |
| GET | `/v1/ambiance/where-to-go` | `window?`=`15m`\|`30m`\|`1h`, `city?`, `type?` — classe tous les lieux du plus calme au plus animé (Phase 3, Tâche 1) |
| GET | `/v1/ambiance/{slug}/history` | `last?` ou `from`/`to`, `bucket?`=`5m`\|`15m`\|`30m`\|`1h` |

Notes :
- **`/now`** : si la fenêtre courante ne contient aucune mesure (`ambianceLabel: "inconnu"`), la réponse inclut un champ optionnel **`lastKnown`** `{ ambianceLabel, noise, asOf }` — la dernière ambiance calculable, datée — à condition que la dernière mesure ait **moins de 2 heures**. Champ optionnel, rétrocompatible.
- **`/quiet-hours`** : les créneaux (jour + plage de 30 min) sont exprimés en **heure locale de Montréal** (`America/Montreal`, changements d'heure inclus) ; `dayOfWeek` s'interprète aussi en jour local.

### Temps réel (Phase 2, bonus SSE)
| Méthode | Endpoint | Paramètres | Auth |
|---|---|---|---|
| GET | `/v1/events` | `locationSlug?` (filtre sur un lieu) | publique |

Flux **Server-Sent Events** : chaque nouvelle mesure ou observation est diffusée
aux clients connectés sous la forme `event: measurement|observation` avec
`data: { kind, locationSlug, at }`. Le client React s'y abonne (EventSource) pour
rafraîchir le marqueur du lieu concerné sur la carte et le portrait détaillé
**sans rechargement de page** (indicateur « Mis à jour en direct » dans la vue
détaillée). Test rapide : `curl -N http://localhost:3000/v1/events` puis postez
une mesure dans un autre terminal.

### Authentification utilisateur (Phase 2)
| Méthode | Endpoint | Corps | Auth | Codes |
|---|---|---|---|---|
| POST | `/v1/auth/register` | `{ username, email, password }` | publique | 201, 400, 409 |
| POST | `/v1/auth/login` | `{ username, password }` | publique | 200, 400, 401 |
| POST | `/v1/auth/favorites` | `{ locationSlug }` | JWT token | 200, 400, 401 |
| DELETE | `/v1/auth/favorites/{locationSlug}` | — | JWT token | 200, 401 |
| GET | `/v1/auth/favorites` | — | JWT token | 200, 401 |
| GET | `/v1/auth/my-locations` | — | JWT token | 200, 401 |

`GET /v1/auth/my-locations` renvoie le récapitulatif des lieux où l'utilisateur connecté a soumis des observations (« ses lieux ») : nom, type, coordonnées, nombre d'observations, date de la dernière écoute et statut favori, triés de la plus récente à la plus ancienne.

### Soumission d'observations utilisateur (Phase 2)
| Méthode | Endpoint | Corps | Auth | Codes |
|---|---|---|---|---|
| POST | `/v1/observations/user` | `{ locationSlug, density, proximity, vibe, notes? }` | JWT token | 201, 400, 401, 404 |

**Valeurs validées** : `type=noise_level`, `unit=dB`, `value` ∈ [0,140] ; `density` ∈ {Vide, Modéré, Fréquenté, Bondé} ; `vibe` ∈ {Calme, Concentré, Sociable, Bruyante, Festive, Tendue} ; `proximity` ∈ {Isolé, Espacé, Fréquenté, Serré}. Combiner `last` avec `from`/`to` renvoie `400`.

## Authentification (Phase 1 et Phase 2)

### Authentification device (Phase 1)
Les endpoints d'**écriture** (`POST /measurements`, `POST /observations`, `POST /measurements/batch`) sont protégés par une clé API transmise dans l'en-tête **`x-api-key`**. Le serveur vérifie qu'elle correspond à un device enregistré :

- **401** `MISSING_AUTH` — en-tête absent
- **403** `FORBIDDEN` — clé invalide / device inexistant
- sinon la requête est autorisée et `lastSeenAt` du device est mis à jour

Les requêtes de **lecture** (`GET`) restent **publiques**. Les endpoints de gestion (`DELETE /devices`, `POST`/`PUT /locations`) utilisent une **clé d'administration** (`ADMIN_API_KEY`), via le même en-tête `x-api-key`.

### Authentification utilisateur (Phase 2)
L'application client React utilise l'authentification JWT pour les utilisateurs :
- **POST /v1/auth/register** : Création d'un compte utilisateur
- **POST /v1/auth/login** : Connexion et obtention d'un token JWT
- Les endpoints utilisateur (`/v1/auth/favorites`, `/v1/auth/my-locations`, `/v1/observations/user`) sont protégés par le middleware `userAuth` qui vérifie le token JWT dans l'en-tête `Authorization: Bearer <token>`
- Le token est stocké dans le localStorage du navigateur pour maintenir la session


## Modifications de l'infrastructure (Phase 2)

### Modèle Location
Ajout des champs `latitude` et `longitude` pour stocker les coordonnées géographiques des lieux, nécessaires pour l'affichage sur la carte.

### Modèle Observation
Ajout du champ `author` (référence au modèle User) pour lier les observations à leur auteur, permettant de suivre les contributions des utilisateurs.

### Modèle User (nouveau)
Création du modèle User pour gérer l'authentification des utilisateurs :
- `username` : nom d'utilisateur unique
- `email` : email unique
- `password` : mot de passe hashé avec bcrypt
- `favoriteLocations` : tableau des slugs des lieux favoris

### Endpoints ambiance
Les endpoints sémantiques (`/v1/ambiance/{slug}/now`, etc.) exposent maintenant le champ `ambianceLabel` pour indiquer la classification de l'ambiance (calme, modéré, animé, inconnu).

### Faille volontaire : `POST /devices` non protégé

En Phase 1, `POST /devices` n'exige **aucune** authentification : n'importe qui peut créer un device et obtenir une `apiKey` valide, donc pousser de fausses mesures et fausser les vues sémantiques (et, par volume, déclencher le rate-limit pour les autres). **Solution proposée** : exiger la clé d'administration (`x-api-key` admin) sur `POST /devices`, comme pour les autres endpoints de gestion — le middleware `adminAuth` existe déjà et il suffit de l'ajouter à la route. Compléments envisageables : enrôlement par jeton d'invitation à usage unique, ou validation d'un compte propriétaire avant émission de la clé.

## Fonctionnalité additionnelle — « Où aller ? » (Phase 3 — Tâche 1)

Un bouton **« Où aller ? »** (visible connecté ou non) ouvre une vue qui classe
**tous les lieux du plus calme au plus animé, en direct**, met en avant le lieu
**recommandé**, et permet de choisir la fenêtre d'analyse (15 min / 30 min / 1 h).
La liste se rafraîchit automatiquement via SSE. Elle s'appuie sur le nouvel
endpoint `GET /v1/ambiance/where-to-go`.

**Justification.** Le vrai besoin de l'utilisateur n'est pas « quelle est
l'ambiance du lieu X ? » mais « **où puis-je aller maintenant ?** ». Auparavant,
il fallait ouvrir chaque lieu un par un sur la carte pour comparer. La
fonctionnalité répond directement à cette décision, reste pleinement dans le
domaine de l'application (l'ambiance des lieux) et **réutilise l'infrastructure
existante** : la fonction pure `rankByAmbiance` (partagée avec `/compare` et
couverte par les tests) et le bus d'événements SSE. Gain d'expérience important
pour très peu de code neuf.

## Stratégie de cache (Phase 3 — Tâche 4)

Le cache est mis en œuvre **des deux côtés**, avec des rôles complémentaires : le
frontend évite les allers-retours réseau, le backend évite de recalculer les
agrégations MongoDB. Un en-tête HTTP `Cache-Control` relie les deux et autorise
la mise en cache par les navigateurs et proxys.

### Côté backend (serveur Express)

| Question | Réponse |
|---|---|
| **Quoi ?** | Le corps JSON des **lectures publiques** (`GET`) : vues d'ambiance (`/ambiance/*`), listes `measurements`, `observations`, `locations`, `devices`. |
| **Où ?** | Cache **en mémoire du processus** (`node-cache`, [`src/services/cacheService.ts`](src/services/cacheService.ts)), activé par le middleware [`cacheControl`](src/middlewares/cache.ts). Clé = URL complète (`req.originalUrl`, paramètres inclus). |
| **Combien de temps ?** | TTL par endpoint : ambiance temps réel (`now`, `compare`, `where-to-go`) **30 s** ; `history`/`quiet-hours` **5 min** ; `measurements`/`observations` **60 s** ; `locations` **1 h** ; `devices` **30 min**. |
| **Invalidation ?** | À chaque **écriture**, la route appelle `cacheService.delPattern(<segment>)` (ex. un `POST /measurements` purge `ambiance` + `measurements`). Comme la clé est l'URL — qui contient ce segment — les entrées concernées sont supprimées immédiatement. À défaut d'écriture, l'entrée expire à son TTL. Le cache est aussi perdu au redémarrage du serveur (acceptable : il se reconstruit à la demande). |
| **En-tête** | `Cache-Control: public, max-age=<TTL>` + `X-Cache: HIT\|MISS` pour observer l'origine de la réponse. |

### Côté frontend (client React)

| Question | Réponse |
|---|---|
| **Quoi ?** | Les réponses des `GET` publics, interceptées de façon transparente par axios ([`client/src/api/ambianceApi.js`](client/src/api/ambianceApi.js) + [`client/src/utils/cache.js`](client/src/utils/cache.js)). |
| **Où ?** | `localStorage` du navigateur (préfixe `ambiance_cache_`), clé = URL + paramètres. Persiste donc entre les rechargements de page. |
| **Combien de temps ?** | TTL par endpoint défini dans `CACHE_CONFIG` (mêmes ordres de grandeur que le backend : ambiance 30 s, history/quiet-hours 5 min, locations 1 h…), 5 min par défaut. |
| **Invalidation ?** | Après une écriture réussie, l'intercepteur de réponse appelle `deleteCachePattern(<segment>)` (une observation soumise purge `ambiance` + `observations`). Sinon expiration au TTL. |

### Ce qui n'est **jamais** mis en cache

- Toutes les **écritures** (`POST`/`PUT`/`DELETE`) — ni au front, ni au back.
- L'**authentification** (`/v1/auth/*` : register, login, favoris, `my-locations`) — données par utilisateur / sensibles : middleware [`noCache`](src/middlewares/cache.ts) côté serveur, exclusion explicite `/auth/` côté client.
- Le **flux temps réel** SSE (`/v1/events`) — par nature non cacheable.

> **Limite connue** (voir aussi Tâche 6) : un rafraîchissement déclenché par un
> événement SSE **provenant d'un autre client** peut être servi depuis le cache
> local pendant la durée du TTL (jusqu'à 30 s pour l'ambiance), car
> l'invalidation frontend ne se déclenche que sur les écritures **de ce
> navigateur**. Le délai reste borné par le TTL court des vues temps réel.

## Optimisations & faiblesses restantes (Phase 3 — Tâche 6)

### Optimisations mises en place

**Performance / charge**
- **Cache à deux niveaux** (voir section précédente) : mémoire serveur (`node-cache`) + `localStorage` client, reliés par `Cache-Control`, avec invalidation ciblée sur les écritures.
- **Index MongoDB composés** `{ locationSlug: 1, timestamp: -1 }` sur `measurements` et `observations` ([src/models/Measurement.ts](src/models/Measurement.ts), [src/models/Observation.ts](src/models/Observation.ts)) : les requêtes par lieu et fenêtre temporelle (cœur des vues d'ambiance) sont servies par index, sans balayage complet. Index unique `{ name, locationSlug }` sur les devices.
- **Requêtes parallélisées** (`Promise.all`) pour lire mesures et observations d'un lieu simultanément ([ambiance.ts](src/routes/ambiance.ts), [LocationDetail.jsx](client/src/components/LocationDetail.jsx)).
- **Pagination bornée** (`perPage` plafonné par `MAX_PER_PAGE`) et **rate limiting** (130 req/min par défaut) pour protéger le serveur.
- **Temps réel par push (SSE)** plutôt que polling : seul le lieu concerné est rafraîchi à chaque nouvelle donnée.

**Maintenabilité / réutilisabilité (Tâche 2)**
- Logique métier **pure et isolée** (`src/services/`, `src/utils/`), découplée de Mongoose et d'Express → testée (27 tests unitaires) et **réutilisée** par les routes ET la fonctionnalité « Où aller ? » (`rankByAmbiance` partagé entre `/compare` et `/where-to-go`).
- Frontend découpé par responsabilité : **contexte** (auth, favoris), **hook** (`useLocations`), **store** Zustand (`uiStore`), **composants réutilisables** (`StateMessage`, utilitaires `ambiance.js` partagés carte/recommandation). `App.jsx` réduit à un orchestrateur (~135 lignes).

### Faiblesses restantes

- **Faille volontaire `POST /devices` non authentifié** (Phase 1, documentée plus haut) : toujours présente, non corrigée par choix pédagogique. Correctif connu : ajouter le middleware `adminAuth`.
- **Bundle frontend volumineux (> 500 kB)** : Leaflet et Chart.js sont chargés au démarrage, sans *code-splitting*. Piste : imports dynamiques (`React.lazy`) pour la carte et les graphiques.
- **Cache serveur en mémoire du processus** : perdu au redémarrage et non partagé en cas de *scaling horizontal* (plusieurs instances). Piste : Redis pour un cache distribué.
- **Tension cache / temps réel** : un rafraîchissement déclenché par un événement SSE **d'un autre client** peut servir des données périmées jusqu'au TTL (≤ 30 s), car l'invalidation frontend ne se déclenche que sur les écritures locales.
- **Requêtes N+1 dans `/where-to-go` et `/compare`** : une paire de requêtes par lieu (boucle) plutôt qu'une agrégation groupée. Acceptable au volume actuel (peu de lieux), à revoir si le nombre de lieux croît fortement.
- **Couverture de tests partielle** : les services métier sont couverts, mais pas les routes (pas de tests d'intégration) ni le frontend.
- **Authentification sans *refresh token*** : le JWT expire à 7 jours et l'utilisateur est déconnecté (pas de renouvellement silencieux).
- **CORS ouvert à toutes les origines** (`cors()`) : pratique pour la démo, à restreindre à l'origine du frontend en production.
- **Cold start (Render, plan gratuit)** : le backend s'endort après ~15 min d'inactivité ; premier appel ~50 s.

## Mécanisme de collecte — le bridge (Phase 1)

`bridge/bridge.js` interroge l'API distante de **Phyphox** à intervalle régulier et **POST** chaque relevé sonore vers `POST /v1/measurements` avec l'en-tête `x-api-key`.

**Pourquoi un bridge ?** Il découple la collecte du serveur : le téléphone n'a pas à connaître MongoDB ni la logique métier, il expose seulement ses buffers via l'API REST locale de Phyphox. Le bridge joue le rôle de client capteur, applique l'authentification et le format du protocole. **Fallback obligatoire** : si Phyphox est indisponible ou le réseau instable, on bascule sur la **saisie manuelle** (`POST /v1/observations`), comme prévu au rapport.

```bash
# 1) créez un device et récupérez sa clé (ou via npm run seed)
# 2) exportez la config puis lancez le bridge
export PHYPHOX_URL=http://<ip-du-tel>:8080
export DEVICE_API_KEY=dev_xxx
export LOCATION_SLUG=cafeteria-roger-gaudry
npm run bridge
```

## Tests (Postman)

Importez `postman/ambiance.postman_collection.json`. Réglez les variables de collection `baseUrl`, `deviceKey` (une clé issue du seed) et `adminKey` (= `ADMIN_API_KEY`). La collection couvre : santé, lecture publique, création de device, `POST` mesure **avec** et **sans** clé (201 vs 401), observation, les 4 endpoints d'ambiance, et la suppression admin de device.

Scénarios clés à vérifier :
- `POST /measurements` sans `x-api-key` → **401** ; avec mauvaise clé → **403** ; avec clé du seed → **201**
- `POST /measurements` `value=999` → **422** ; champ manquant → **400**
- `GET /ambiance/cafeteria-roger-gaudry/now` → label d'ambiance calculé
- `GET /measurements?last=3h&from=...` → **400** (fenêtres contradictoires)

## Collecte de données (Phase 1)

Réaliser au moins **3 sessions de 20 min** à des moments différents (ex. matin calme, midi animé, après-midi). Lancer le serveur, puis le bridge pendant chaque session ; compléter par quelques observations manuelles. Le seed fournit déjà 14 jours de données simulées pour valider les endpoints sémantiques sans attendre une collecte complète.

## `.env.example`

Le fichier `.env.example` est fourni à la racine ; copiez-le en `.env` et renseignez vos secrets (jamais committés, `.env` est dans `.gitignore`).

## Dépannage : erreur `querySrv ECONNREFUSED` à la connexion MongoDB

Sur certaines machines (typiquement quand un adaptateur réseau virtuel — VirtualBox, VPN — est actif), le résolveur DNS interne de Node échoue à résoudre les URI `mongodb+srv://`. Le serveur intègre un contournement automatique (`ensureSrvResolvable` dans `src/config/db.ts`) : si la résolution SRV échoue, il bascule sur des DNS publics avant de se connecter. Aucune action n'est requise ; l'URI `mongodb+srv://` d'Atlas peut être utilisée telle quelle dans le `.env`.
