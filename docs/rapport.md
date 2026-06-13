# Rapport — Livrable 1
## Infrastructure de collecte d'ambiance — Cafétéria Roger-Gaudry

**Cours :** IFT3225
**Équipe :** [à compléter]
**Date de remise :** 15 juin 2026

---

> **Note d'avancement (à supprimer avant remise)**
>
> Sections rédigées à partir du document de protocole : 1, 2, 3, 5
> Sections nécessitant l'apport des coéquipiers : 4 (collecte, Phyphox, fallback)
> Section à enrichir collectivement après les sessions de collecte : 6

---

## 1. Ressources et endpoints

### 1.1 Vue d'ensemble

Le système expose une **API REST versionnée** (`/v1`) qui distingue deux familles d'endpoints :

- Les **ressources persistées**, qui correspondent à des entités stockées dans la base : appareils, lieux, mesures et observations.
- Les **vues sémantiques calculées**, regroupées sous `/ambiance/*`, qui ne stockent rien mais agrègent les ressources persistées pour répondre à des questions concrètes sur l'ambiance d'un lieu.

Cette séparation reflète une intuition simple : ce que produit le capteur (une mesure de niveau sonore à un instant donné) et ce que cherche un client (savoir si un café est calme cet après-midi) ne sont pas les mêmes objets, et il serait coûteux de calculer la deuxième question à partir de la première à chaque requête sans abstraction dédiée.

### 1.2 Découpage en ressources — justification

| Ressource | Pourquoi elle existe | Alternative écartée |
|---|---|---|
| `devices` | Un appareil est une source de collecte identifiable, avec une clé API qui peut être révoquée et un `lastSeenAt` qui permet de surveiller son activité. | Ne stocker que l'appareil dans le corps des mesures (sans entité dédiée). Écarté parce qu'on n'aurait alors aucun moyen de révoquer une clé compromise sans toucher à toutes les mesures associées. |
| `locations` | Un lieu est une entité stable et nommée que les clients consultent et filtrent. Sa séparation évite les fautes d'orthographe et les doublons. | Stocker le lieu comme simple chaîne dans chaque mesure. Écarté parce que les comparaisons et filtres deviennent fragiles (`"café-luminance"` ≠ `"Cafe Luminance"`). |
| `measurements` | Donnée numérique brute et objective produite par un capteur : type, valeur, unité, timestamp. Validée par plage. | Fusionner avec `observations`. Écarté parce qu'une mesure est numérique et automatisable, alors qu'une observation est qualitative et humaine — les deux exigent des validations différentes et des index distincts. |
| `observations` | Donnée qualitative humaine : densité, proximité, vibe, notes. Permet de capturer ce qu'un capteur audio ne peut pas (l'ambiance ressentie). | La stocker comme une mesure textuelle. Écarté parce que valider et indexer du texte libre est coûteux et peu utile pour l'agrégation. |
| `ambiance` | **Vue dérivée**, pas une ressource persistée. Calcule à la demande des indicateurs synthétiques (`ambianceLabel`, `score`, `quietSlots`) à partir des mesures et observations récentes. | Précalculer et stocker les valeurs d'ambiance. Écarté en Phase 1 parce que cela introduit une duplication d'état et un problème de cohérence — la décision pourra être révisée si la performance l'exige. |

### 1.3 Table complète des endpoints

#### Gestion des appareils

| Méthode | Endpoint | Corps / Paramètres | Réponse | Codes |
|---|---|---|---|---|
| POST | `/v1/devices` | `{ name, locationSlug }` | 201 + `{ id, name, locationSlug, apiKey }` | 201, 400, 409 |
| GET | `/v1/devices` | `?locationSlug&page&perPage&sort` | 200 + tableau `{ id, name, locationSlug, lastSeenAt }` | 200, 401, 403 |
| DELETE | `/v1/devices/{id}` | — (auth requise) | 204 (clé révoquée, appareil supprimé) | 204, 401, 403, 404 |

#### Gestion des lieux

| Méthode | Endpoint | Corps / Paramètres | Réponse | Codes |
|---|---|---|---|---|
| GET | `/v1/locations` | `?city&type&page&perPage` | 200 + tableau `{ slug, displayName, city, type }` | 200 |
| POST | `/v1/locations` | `{ slug, displayName, city, type }` | 201 + lieu créé | 201, 400, 409 |
| PUT | `/v1/locations/{slug}` | `{ displayName?, city?, type? }` | 200 + lieu mis à jour | 200, 400, 404, 409 |

#### Collecte

| Méthode | Endpoint | Corps | Réponse | Codes |
|---|---|---|---|---|
| POST | `/v1/measurements` | `{ type, value, unit, locationSlug, timestamp, deviceId? }` | 201 + mesure (avec `receivedAt` ajouté par serveur) | 201, 400, 401, 403, 422 |
| POST | `/v1/observations` | `{ locationSlug, density, proximity, vibe, notes?, timestamp }` | 201 + observation | 201, 400, 401, 403, 422 |
| POST | `/v1/measurements/batch` | `[ { ... }, ... ]` | 207 + `{ accepted: [...], rejected: [...] }` | 207, 400, 401, 403, 422 |

#### Consultation brute

| Méthode | Endpoint | Filtres | Réponse | Codes |
|---|---|---|---|---|
| GET | `/v1/measurements` | `locationSlug, type, from, to, last, page, perPage, sort` | 200 + tableau paginé | 200, 400 |
| GET | `/v1/observations` | `locationSlug, vibe, density, from, to, last, page, perPage, sort` | 200 + tableau paginé | 200, 400 |

#### Endpoints sémantiques

| Méthode | Endpoint | Paramètres | Ce qu'il retourne | Codes |
|---|---|---|---|---|
| GET | `/v1/ambiance/{locationSlug}/now` | `window?` (15m, 30m, 1h ; défaut 30m) | Portrait courant : bruit moyen, densité, vibe dominante, `ambianceLabel` | 200, 404 |
| GET | `/v1/ambiance/{locationSlug}/quiet-hours` | `days?, threshold?, dayOfWeek?` | Liste de créneaux typiquement calmes avec `avgNoise` | 200, 400, 404 |
| GET | `/v1/ambiance/compare` | `locations` (slugs CSV), `window?` | Comparaison de lieux + `quietest` et `busiest` | 200, 400, 404 |
| GET | `/v1/ambiance/{locationSlug}/history` | `last? ou from/to`, `bucket?` | Série temporelle agrégée | 200, 400, 404 |

### 1.4 Gestion des lieux — décision

Nous avons retenu une **création explicite** des lieux via `POST /v1/locations`, plutôt qu'une création implicite à la première mesure. Cette décision impose un coût initial (créer le lieu avant de pouvoir collecter) mais évite trois problèmes : doublons silencieux dus à des fautes de frappe, métadonnées incomplètes (un lieu créé implicitement n'a ni `displayName` ni `city`), et impossibilité de modérer ce qui entre dans la base.

---

## 2. Conventions du protocole

Chaque convention est définie pour rendre le comportement du système **prévisible** du point de vue d'un client. Voici les choix retenus et leur intention.

### 2.1 Versionnement par préfixe d'URL

**Choix :** tous les chemins commencent par `/v1` (ex. `/v1/measurements`).

**Intention :** pouvoir publier une `/v2` avec des changements incompatibles sans casser les clients existants. Le prix à payer est une URL légèrement plus longue ; le bénéfice est une trajectoire d'évolution claire.

### 2.2 Nommage des ressources

**Choix :** noms en anglais, pluriels pour les collections (`/devices`, `/measurements`), slugs en `kebab-case` pour les identifiants lisibles (`cafeteria-roger-gaudry`).

**Intention :** convention REST largement reconnue. Les pluriels rendent les URLs prévisibles (`GET /measurements` = collection, `GET /measurements/{id}` = élément). Le `kebab-case` évite les ambiguïtés d'encodage des espaces et reste lisible.

### 2.3 Format des dates

**Choix :** ISO 8601 en UTC avec suffixe `Z` (ex. `2026-06-01T18:02:30Z`), ou heure locale avec offset explicite (`2026-06-01T14:02:30-04:00`).

**Intention :** éviter toute ambiguïté de fuseau horaire et d'heure d'été. Le serveur convertit systématiquement en UTC pour stockage et comparaisons.

### 2.4 Timestamp de mesure vs. timestamp de réception

**Choix :** le client fournit `timestamp` (moment réel de la mesure) ; le serveur ajoute `receivedAt` (moment de réception).

**Intention :** la distinction est essentielle quand la collecte accumule des mesures avant de les envoyer en batch — par exemple si le téléphone perd la connexion Wi-Fi et bufferise localement. Une mesure prise à 14h00 et envoyée à 14h05 doit conserver son timestamp réel pour l'agrégation, sans quoi tous les histogrammes seraient décalés.

### 2.5 Enveloppe de réponse

**Choix :** toutes les réponses suivent une enveloppe uniforme.

Succès :
```json
{
  "status": "success",
  "data": { ... },
  "meta": { "generatedAt": "...", "page": 1, "perPage": 25, "total": 128 }
}
```

Erreur :
```json
{
  "status": "error",
  "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] },
  "meta": { "generatedAt": "..." }
}
```

**Intention :** le client sait toujours où trouver les données (`data`), les métadonnées (`meta`), et les erreurs (`error`). Une enveloppe explicite permet aussi d'ajouter ultérieurement des champs (`warnings`, `deprecation`) sans casser les clients.

### 2.6 Structure des erreurs

**Choix :** chaque erreur expose un code machine (`VALIDATION_ERROR`, `LOCATION_NOT_FOUND`, etc.), un message lisible, et un tableau `details` optionnel listant les champs problématiques.

**Intention :** le code machine permet au client de réagir programmatiquement (afficher un message localisé, par exemple) sans parser le message texte. Le tableau `details` est ce qui rend l'erreur actionnable — savoir que `value` manque est plus utile que de savoir qu'il y a "une erreur de validation".

### 2.7 Pagination

**Choix :** paramètres `page` et `perPage` (max 200), métadonnées `total` et `totalPages` retournées dans `meta`.

**Intention :** empêcher qu'un endpoint de consultation ne retourne potentiellement des dizaines de milliers de mesures et sature le client. Le maximum à 200 est un compromis — au-delà, la réponse devient lourde même en JSON.

### 2.8 Filtrage temporel — `from/to` vs. `last`

**Choix :** un endpoint peut être filtré par `from` et `to` (ISO 8601), **ou** par `last` (`3h`, `24h`, `7d`), mais pas les deux à la fois. Combiner les deux retourne `400 VALIDATION_ERROR`.

**Intention :** éviter une ambiguïté pour le client comme pour le serveur — quelle fenêtre temporelle a priorité si elles entrent en conflit ? Mieux vaut refuser la requête que de retourner un résultat surprenant.

### 2.9 Types et valeurs validées

| Champ | Plage / Valeurs |
|---|---|
| `measurement.type` | `noise_level` |
| `measurement.unit` | `dB` |
| `measurement.value` | 0 à 140 |
| `observation.density` | `Vide`, `Modéré`, `Fréquenté`, `Bondé` |
| `observation.vibe` | `Calme`, `Concentré`, `Sociable`, `Bruyante`, `Festive`, `Tendue` |

**Intention :** les énumérations pour les observations garantissent une consistance qui rend l'agrégation possible. Si un client envoie `vibe: "chill"`, le serveur retourne `422 INVALID_VALUE` plutôt que de stocker une valeur qui ne pourra jamais être comparée aux autres.

---

## 3. Authentification

### 3.1 Mécanisme retenu

L'API utilise une **clé d'API par appareil**, transmise dans l'en-tête `Authorization` selon le schéma `Bearer` :

```
Authorization: Bearer <apiKey>
```

> **Note :** le brief du livrable suggère l'en-tête `x-api-key`. Nous avons retenu `Authorization: Bearer` parce qu'il s'agit de la convention HTTP standard pour transporter un secret d'identification, ce qui rend le protocole reconnaissable pour tout client tiers. La sémantique reste équivalente — une clé statique vérifiée côté serveur.

### 3.2 Flux complet

1. **Enregistrement.** Un administrateur crée un appareil via `POST /v1/devices` avec `name` et `locationSlug`.
2. **Délivrance de la clé.** Le serveur génère une clé aléatoire cryptographiquement sûre (`crypto.randomBytes(32).toString('hex')`) et la retourne **une seule fois** dans la réponse 201. Elle n'est plus jamais lisible ensuite.
3. **Utilisation.** Le client envoie chaque requête de collecte (`POST /v1/measurements`, `POST /v1/observations`, `POST /v1/measurements/batch`) avec l'en-tête `Authorization: Bearer <apiKey>`.
4. **Vérification.** Un middleware côté serveur extrait la clé, la hache (SHA-256), et la compare aux empreintes stockées en base. Si la clé existe et n'est pas révoquée, la requête passe.
5. **Révocation.** `DELETE /v1/devices/{id}` rend la clé immédiatement invalide. Toute requête ultérieure portant cette clé reçoit `403 FORBIDDEN`.

### 3.3 Comportement en cas d'authentification absente ou invalide

| Cas | Statut HTTP | Code machine |
|---|---|---|
| En-tête `Authorization` absent | 401 | `MISSING_AUTH` |
| En-tête présent mais clé inconnue ou révoquée | 403 | `FORBIDDEN` |
| Clé valide | requête traitée normalement | — |

Les endpoints de consultation (`GET /v1/measurements`, `GET /v1/observations`, `GET /v1/ambiance/*`) restent **publics** : aucune clé n'est exigée. Ce choix reflète le caractère ouvert des données d'ambiance dans le cadre du projet.

### 3.4 Vulnérabilité identifiée — `POST /v1/devices` non protégé

#### Description

En Phase 1, l'endpoint `POST /v1/devices` n'est pas protégé. **N'importe qui** peut donc enregistrer un nouvel appareil et obtenir une clé valide en émettant simplement :

```http
POST /v1/devices
Content-Type: application/json

{ "name": "attaquant", "locationSlug": "cafeteria-roger-gaudry" }
```

→ 201 + `{ "apiKey": "..." }`

L'attaquant peut alors injecter des mesures arbitraires dans la base, polluer l'agrégation (`/ambiance/.../now` peut retourner un score complètement faussé), et le faire à grande échelle sans limite — la rate-limit de 130 req/min étant elle-même appliquée *par clé*, il suffit de créer 100 appareils pour multiplier le débit d'attaque.

#### Conséquences

1. **Empoisonnement des données.** Les endpoints sémantiques produisent des résultats inutilisables.
2. **Dilution de l'identité.** Impossible de distinguer un appareil légitime de plusieurs appareils malveillants si la création est libre.
3. **Coûts d'opération.** Le rate-limiting par clé devient inefficace.

#### Solution proposée

Introduire une **clé d'administration** (ou un mécanisme d'authentification administrateur, type session OAuth2) qui devient obligatoire pour les opérations sensibles :

- `POST /v1/devices` (créer un appareil)
- `DELETE /v1/devices/{id}` (révoquer un appareil)
- `POST /v1/locations`, `PUT /v1/locations/{slug}` (gestion des lieux)

Trois implémentations possibles, du plus simple au plus robuste :

| Approche | Mise en œuvre | Limites |
|---|---|---|
| **Variable d'environnement** | Stocker `ADMIN_KEY` dans `.env`, comparer à un en-tête `X-Admin-Key` dans le middleware. | Clé statique partagée — pas de révocation granulaire, pas d'audit. |
| **Table `admins`** | Plusieurs admins, chacun avec sa propre clé hachée. Révocation par suppression de ligne. | Toujours pas d'audit fin ; toujours du secret partagé. |
| **OAuth2 / JWT** | Un fournisseur d'identité externe émet des tokens à durée de vie courte. | Complexité élevée pour la portée du projet. |

Pour la Phase 2, nous recommandons l'approche **Table `admins`** : équilibre raisonnable entre complexité et sécurité, et compatible avec les outils déjà en place (Mongo + middleware Express).

### 3.5 Autres considérations de sécurité

- **Stockage des clés.** Les clés sont stockées hachées (SHA-256) ; la clé en clair n'est retournée qu'une fois, à la création.
- **Transport.** En production, l'API devrait être servie uniquement en HTTPS pour éviter l'interception de la clé. En développement local, HTTP est acceptable.
- **Rotation.** Aucun mécanisme de rotation automatique n'est prévu en Phase 1 ; un administrateur peut révoquer puis recréer un appareil pour effectuer une rotation manuelle.

---

## 4. Collecte des données

> *Section à compléter avec [Personne B]. Plan ci-dessous comme guide.*

### 4.1 Données capteur — chaîne Phyphox → API

[Description du bridge : script qui interroge l'API Phyphox du téléphone via Wi-Fi local, à quelle fréquence, comment les valeurs sont mises en forme avant le POST vers l'API.]

[Justification du choix : pourquoi un bridge plutôt qu'une autre approche.]

[Format des batches si applicable : si le bridge accumule N mesures avant d'appeler `POST /v1/measurements/batch`, expliquer le seuil et le rationnel.]

### 4.2 Données environnementales

[Méthode retenue pour saisir : heure/jour automatiques, proximité, vibe, notes.]

[Outil : formulaire web, CLI, autre.]

### 4.3 Fallback manuel obligatoire

[Description du mécanisme de saisie manuelle si la collecte automatique échoue.]

[Procédure : comment l'opérateur saisit, à quelle fréquence.]

### 4.4 Sessions de collecte

| # | Date | Plage horaire | Durée | Conditions observées |
|---|---|---|---|---|
| 1 | [à remplir après session] | | 20 min | |
| 2 | | | 20 min | |
| 3 | | | 20 min | |

---

## 5. Agrégation — Comment les endpoints sémantiques calculent

Les quatre endpoints `/v1/ambiance/*` ne stockent rien. Ils interrogent la base à chaque requête et appliquent une logique d'agrégation pour produire des indicateurs synthétiques. Cette section décrit la logique de chacun.

### 5.1 Seuils de classification du bruit

L'`ambianceLabel` produit par plusieurs endpoints repose sur une classification du niveau sonore moyen :

| `ambianceLabel` | Plage d'amplitude (dB) |
|---|---|
| `calme` | < 45 |
| `modéré` | 45 – 60 |
| `animé` | 60 – 75 |
| `bruyant` | ≥ 75 |

⚠️ **Ces seuils sont des valeurs de départ.** Phyphox retourne probablement une mesure non calibrée en absolu — l'échelle dépend du microphone du téléphone. Après la session 1, nous prévoyons d'observer les valeurs réellement enregistrées dans la cafétéria et d'ajuster les seuils pour qu'ils discriminent effectivement les moments calmes des moments animés.

### 5.2 `GET /v1/ambiance/{locationSlug}/now`

**Question :** "Comment c'est en ce moment à *locationSlug* ?"

**Logique :**

1. Récupérer toutes les mesures de type `noise_level` pour `locationSlug` dans la fenêtre `window` (défaut 30 minutes).
2. Calculer la moyenne `noise`.
3. Récupérer toutes les observations dans la même fenêtre.
4. `vibe` retournée = vibe majoritaire ; `proximity` retournée = proximité majoritaire ; `occupancy` = moyenne de la densité encodée numériquement (`Vide`=0, `Modéré`=33, `Fréquenté`=66, `Bondé`=100).
5. `ambianceLabel` = classification de `noise` selon les seuils ci-dessus, ajustée par `occupancy` (si `noise` proche d'un seuil, l'occupancy peut faire basculer).

**Cas particuliers :**

- Aucune mesure dans la fenêtre → `ambianceLabel: "inconnu"`, `score.noise: null`
- Aucune observation dans la fenêtre → `score.vibe: null`, `score.proximity: null`

### 5.3 `GET /v1/ambiance/{locationSlug}/quiet-hours`

**Question :** "Quels créneaux sont typiquement calmes ?"

**Logique :**

1. Récupérer toutes les mesures sur `days` derniers jours (défaut 30).
2. Grouper par tranche horaire (par défaut 1 heure) **et** par jour de la semaine si `dayOfWeek` n'est pas fourni.
3. Calculer la moyenne `avgNoise` par groupe.
4. Filtrer les groupes dont `avgNoise < threshold` (défaut 55 dB).
5. Retourner sous forme `{ dayOfWeek, from, to, avgNoise }`.

**Pourquoi grouper par jour de la semaine :** un mardi à 8h n'est pas comparable à un dimanche à 8h. Sans cette ventilation, la moyenne globale masque les patterns.

### 5.4 `GET /v1/ambiance/compare`

**Question :** "Lequel de ces lieux est le plus calme en ce moment ?"

**Logique :**

1. Pour chaque slug listé dans `locations`, appliquer la logique de `/now` (même fenêtre).
2. Construire un tableau parallèle.
3. Identifier `quietest` (slug avec `noise` minimal) et `busiest` (slug avec `noise` maximal).

**Limite :** la comparaison n'est pertinente que si les lieux ont une activité de collecte comparable. Un lieu peu fréquenté par le capteur peut sembler artificiellement calme.

### 5.5 `GET /v1/ambiance/{locationSlug}/history`

**Question :** "Comment l'ambiance a évolué dans le temps ?"

**Logique :**

1. Définir la fenêtre temporelle (`last` ou `from/to`).
2. Découper en `bucket` (5m, 15m, 30m, 1h ; défaut 15m).
3. Pour chaque bucket, calculer la moyenne d'amplitude et l'`ambianceLabel`.
4. Retourner la série chronologique.

**Utilité :** identifier des pics récurrents (ex. heure du dîner), comparer la même heure sur plusieurs jours, ou voir l'effet d'un événement ponctuel.

---

## 6. Limites et évolution

### 6.1 Vulnérabilités assumées en Phase 1

- **`POST /v1/devices` non protégé.** Détaillée en section 3.4 ; correction prévue en Phase 2.
- **Pas de chiffrement en transit obligatoire.** En développement local, l'API tourne en HTTP. À mettre derrière HTTPS en production.
- **Pas d'audit log.** Aucune trace des opérations de gestion (qui a créé quel appareil, à quel moment).

### 6.2 Compromis assumés

- **Création explicite des lieux** plutôt qu'implicite. Plus de friction en setup, mais évite les doublons silencieux.
- **Authentification par clé statique** plutôt que tokens à durée de vie. Suffisant pour des capteurs en lieu fixe ; à reconsidérer pour des collectes mobiles ou collaboratives.
- **Vues d'ambiance calculées à la volée** plutôt que pré-agrégées. Simple et toujours fraîche, mais coûteuse si le volume de données croît significativement.

### 6.3 Calibration des seuils

Les seuils de classification du bruit (section 5.1) sont des **valeurs de départ**, choisies à partir de références standard pour les niveaux sonores ambiants en intérieur. Phyphox renvoie probablement une mesure non calibrée en absolu, donc ces seuils devront être ajustés après les premières sessions de collecte. Idéalement, une calibration croisée avec un sonomètre de référence améliorerait la robustesse, mais sort du cadre du livrable.

### 6.4 Ce que nous changerions avec plus de temps

- **Authentification administrateur réelle** (table `admins` + middleware dédié).
- **Précalcul périodique des agrégats** pour les fenêtres longues (`quiet-hours` sur 30 jours), avec invalidation à chaque nouvelle mesure.
- **WebSocket ou Server-Sent Events** pour pousser les mises à jour d'`/ambiance/now` aux clients connectés, plutôt qu'un polling.
- **Schéma d'observation plus riche** (température, luminosité, présence de musique).
- **Tests automatisés** (unit + intégration sur les endpoints sémantiques).
- **Documentation OpenAPI** générée depuis le code, pour faciliter l'intégration de nouveaux clients.

### 6.5 Évolution du protocole

Le préfixe `/v1` permet d'introduire des changements incompatibles dans une `/v2` sans casser les clients existants. Les évolutions probables :

- Authentification administrateur formalisée.
- Support de capteurs supplémentaires (`measurement.type` enrichi : `temperature`, `luminosity`...).
- Endpoints sémantiques additionnels selon les besoins remontés par l'usage.

---

*Fin du rapport.*
