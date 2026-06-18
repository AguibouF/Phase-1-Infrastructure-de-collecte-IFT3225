# Serveur de collecte environnementale — Ambiance des lieux

Autheur:
- Aguibou FOFANA -- 20332292

- Mamadou TRAORE -- 20290120
  
- Kofi OSEL -- 20272184

API REST (Express + MongoDB Atlas) qui collecte des **mesures** sonores (capteur Phyphox) et des **observations** humaines pour évaluer l'**ambiance** d'un lieu (calme, modéré, animé, bruyant). Le projet expose les ressources persistées (`devices`, `locations`, `measurements`, `observations`) et des **vues sémantiques calculées** (`ambiance/now`, `quiet-hours`, `compare`, `history`). Réalisé pour IFT3225 — Phase 1.

## Prérequis

- **Node.js ≥ 18** (le bridge et le serveur utilisent `fetch` natif)
- **Un cluster MongoDB Atlas** (gratuit M0 suffisant) + sa chaîne de connexion
- **Phyphox** sur un téléphone, avec « Allow remote access » activé (pour la collecte réelle ; optionnel pour tester avec le seed)

## Installation et lancement

```bash
npm install                 # installe les dépendances
cp .env.example .env        # puis renseignez MONGODB_URI et ADMIN_API_KEY
npm run seed                # (optionnel) peuple la base de données de démo
npm start                   # démarre le serveur sur http://localhost:3000
```

`npm run seed` affiche les **clés API des devices** créés : copiez-en une pour tester les `POST` (en-tête `x-api-key`) et pour configurer le bridge.

### Variables d'environnement (`.env`)

| Variable | Rôle |
|---|---|
| `PORT` | Port d'écoute (défaut 3000) |
| `MONGODB_URI` | Chaîne de connexion du cluster Atlas |
| `DB_NAME` | Nom de la base (défaut `ambiance`) |
| `ADMIN_API_KEY` | Clé d'administration des endpoints de gestion |
| `RATE_LIMIT_PER_MIN` | Limite de requêtes/min (défaut 130) |
| `MAX_PER_PAGE` | Pagination max (défaut 200) |

## Architecture

L'organisation sépare routes, modèles et middlewares (pas de mégafichier `index.js`) :

```
rapport/
├── index.js                 # point d'entrée : connecte la DB puis démarre Express
├── src/
│   ├── app.js               # construction de l'app Express (middlewares + montage des routes)
│   ├── config/db.js         # connexion Mongoose à MongoDB Atlas (URI via .env)
│   ├── models/              # schémas Mongoose : Device, Location, Measurement, Observation
│   ├── middlewares/         # auth (x-api-key), rate limit, gestion d'erreurs centralisée
│   ├── routes/              # devices, locations, measurements, observations, ambiance
│   └── utils/               # enveloppe de réponse, pagination, fenêtres temporelles, calculs d'ambiance
├── scripts/seed.js          # peuplement de données de démonstration
├── bridge/bridge.js         # collecte : Phyphox -> POST /v1/measurements
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

**Valeurs validées** : `type=noise_level`, `unit=dB`, `value` ∈ [0,140] ; `density` ∈ {Vide, Modéré, Fréquenté, Bondé} ; `vibe` ∈ {Calme, Concentré, Sociable, Bruyante, Festive, Tendue} ; `proximity` ∈ {Isolé, Espacé, Fréquenté, Serré}. Combiner `last` avec `from`/`to` renvoie `400`.

## Authentification (Tâche 5)

Les endpoints d'**écriture** (`POST /measurements`, `POST /observations`, `POST /measurements/batch`) sont protégés par une clé API transmise dans l'en-tête **`x-api-key`**. Le serveur vérifie qu'elle correspond à un device enregistré :

- **401** `MISSING_AUTH` — en-tête absent
- **403** `FORBIDDEN` — clé invalide / device inexistant
- sinon la requête est autorisée et `lastSeenAt` du device est mis à jour

Les requêtes de **lecture** (`GET`) restent **publiques**. Les endpoints de gestion (`DELETE /devices`, `POST`/`PUT /locations`) utilisent une **clé d'administration** (`ADMIN_API_KEY`), via le même en-tête `x-api-key`.

> **Note de conformité** : le rapport de conception (Tâche 2) mentionnait `Authorization: Bearer <apiKey>`. L'implémentation suit la consigne de la **Tâche 5** (`x-api-key`), qui est la version retenue pour la Phase 1.

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
