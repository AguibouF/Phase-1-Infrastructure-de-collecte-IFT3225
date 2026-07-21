# Serveur de collecte environnementale — Ambiance des lieux

Autheurs :
- Aguibou FOFANA

- Mamadou TRAORE

- Kofi OSEL

API REST (Express + MongoDB Atlas) qui collecte des **mesures** sonores (capteur Phyphox) et des **observations** humaines pour évaluer l'**ambiance** d'un lieu (calme, modéré, animé, bruyant). Le projet expose les ressources persistées (`devices`, `locations`, `measurements`, `observations`) et des **vues sémantiques calculées** (`ambiance/now`, `quiet-hours`, `compare`, `history`). Réalisé pour IFT3225 — Phase 1 et Phase 2.

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

## Architecture

L'organisation sépare routes, modèles et middlewares (pas de mégafichier `index.js`) :

```
├── index.ts                 # point d'entrée backend (TypeScript) : connecte la DB puis démarre Express
├── tsconfig.json            # configuration TypeScript (compilation vers dist/)
├── src/
│   ├── app.ts               # construction de l'app Express (middlewares + montage des routes)
│   ├── config/db.ts         # connexion Mongoose à MongoDB Atlas (URI via .env)
│   ├── models/              # schémas Mongoose typés : Device, Location, Measurement, Observation, User
│   ├── middlewares/         # auth (x-api-key), userAuth (JWT), rate limit, gestion d'erreurs
│   ├── routes/              # devices, locations, measurements, observations, ambiance, auth, events (SSE)
│   ├── types/               # augmentations de types Express (req.device, req.user)
│   └── utils/               # enveloppe de réponse, pagination, fenêtres temporelles, calculs d'ambiance, bus d'événements
├── scripts/seed.js          # peuplement de données de démonstration
├── bridge/bridge.js         # collecte : Phyphox -> POST /v1/measurements
├── client/                  # Application React (Phase 2)
│   ├── src/
│   │   ├── components/      # Composants React : MapView, LocationDetail, LoginForm, RegisterForm
│   │   ├── api/             # API client : ambianceApi
│   │   ├── App.jsx          # Composant principal
│   │   ├── main.jsx         # Point d'entrée React
│   │   └── App.css          # Styles globaux
│   └── package.json         # Dépendances frontend
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

## Mécanisme de collecte (Tâche 4) — le bridge

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

## Collecte de données (Tâche 6)

Réaliser au moins **3 sessions de 20 min** à des moments différents (ex. matin calme, midi animé, après-midi). Lancer le serveur, puis le bridge pendant chaque session ; compléter par quelques observations manuelles. Le seed fournit déjà 14 jours de données simulées pour valider les endpoints sémantiques sans attendre une collecte complète.

## `.env.example`

Le fichier `.env.example` est fourni à la racine ; copiez-le en `.env` et renseignez vos secrets (jamais committés, `.env` est dans `.gitignore`).

## Dépannage : erreur `querySrv ECONNREFUSED` à la connexion MongoDB

Sur certaines machines (typiquement quand un adaptateur réseau virtuel — VirtualBox, VPN — est actif), le résolveur DNS interne de Node échoue à résoudre les URI `mongodb+srv://`. Le serveur intègre un contournement automatique (`ensureSrvResolvable` dans `src/config/db.ts`) : si la résolution SRV échoue, il bascule sur des DNS publics avant de se connecter. Aucune action n'est requise ; l'URI `mongodb+srv://` d'Atlas peut être utilisée telle quelle dans le `.env`.
