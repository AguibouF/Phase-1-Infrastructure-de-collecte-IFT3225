# Rapport Phase 2 - Analyse des choix et limites

## Introduction

Ce rapport présente les choix technologiques et architecturaux effectués lors de la Phase 2 du projet "Ambiance des Lieux", ainsi que les fonctionnalités implémentées et les limites identifiées du système.

## Choix technologiques

### Frontend

**React**
- Choisi pour sa popularité, son écosystème riche et sa composabilité
- Permet de créer des interfaces utilisateur modulaires et réutilisables
- Virtual DOM pour des performances optimales
- Large communauté et documentation abondante

**Vite**
- Outil de build moderne et rapide pour les applications React
- Hot Module Replacement (HMR) pour un développement fluide
- Configuration minimale par défaut
- Temps de démarrage rapide comparé à Create React App

**react-leaflet**
- Bibliothèque React pour Leaflet (cartes interactives)
- Intégration native avec les composants React
- Utilisation d'OpenStreetMap comme fond de carte (gratuit)
- Support des marqueurs personnalisés et des popups

**Chart.js + react-chartjs-2**
- Bibliothèque de graphiques légère et responsive
- Support des graphiques linéaires pour l'historique des mesures
- Facile à intégrer dans React via react-chartjs-2
- Personnalisation des couleurs et des légendes

**axios**
- Client HTTP pour les appels API
- Support des promesses et de async/await
- Interceptors pour gérer l'authentification (headers JWT)
- Meilleure gestion des erreurs que fetch natif

### Backend

**JWT (JSON Web Tokens)**
- Standard pour l'authentification stateless
- Token signé cryptographiquement avec un secret
- Contient les informations utilisateur (userId, username)
- Validité configurable (7 jours dans notre implémentation)

**bcryptjs**
- Bibliothèque de hashage de mots de passe
- Algorithme bcrypt avec salt automatique
- Résistant aux attaques par force brute
- Standard industriel pour le stockage sécurisé des mots de passe

## Architecture

### Séparation Backend/Frontend

Le projet adopte une architecture clairement séparée entre backend et frontend :

**Backend** (dossier racine)
- API REST avec Express.js
- Base de données MongoDB via Mongoose
- Authentification device (clé API) et utilisateur (JWT)
- Endpoints sémantiques pour l'ambiance

**Frontend** (dossier client)
- Application React autonome
- Communication avec backend via API REST
- Gestion d'état locale avec useState
- Pas de dépendance directe avec MongoDB

**Avantages**
- Développement parallèle possible
- Déploiement indépendant
- Scalabilité séparée
- Réutilisation du backend pour d'autres clients (mobile, etc.)

### Organisation du code

**Backend**
```
src/
├── models/          # Schémas Mongoose
├── routes/          # Routes Express
├── middlewares/     # Middlewares (auth, rate limit)
├── utils/           # Utilitaires (pagination, time)
└── config/          # Configuration (DB)
```

**Frontend**
```
client/src/
├── components/      # Composants React
├── api/             # Client API
├── App.jsx          # Composant principal
└── main.jsx         # Point d'entrée
```

### Couche API client isolée

Le fichier `client/src/api/ambianceApi.js` centralise tous les appels API :
- Interface unique pour communiquer avec le backend
- Facilite les tests et la maintenance
- Permet de changer l'implémentation HTTP sans toucher aux composants
- Gestion centralisée des headers d'authentification

## Fonctionnalités implémentées

### 1. Vue publique (accès sans authentification)

**Carte interactive**
- Affichage des lieux sur une carte Leaflet
- Marqueurs colorés selon l'ambiance (calme=vert, modéré=orange, animé=rouge, inconnu=gris)
- Popup avec informations de base (nom, type, ambiance)
- Clic sur marqueur pour voir les détails

**Vue détaillée**
- Ambiance actuelle avec badge coloré
- Historique des mesures (graphique Chart.js)
- Créneaux calmes (heures les plus calmes)
- Métadonnées (échantillon, fenêtre temporelle)

### 2. Authentification utilisateur

**Inscription**
- Formulaire avec username, email, password
- Validation des champs (min 6 caractères pour le password)
- Vérification unicité username/email
- Hashage du password avec bcrypt
- Génération de token JWT

**Connexion**
- Formulaire avec username/email et password
- Vérification du password hashé
- Génération de token JWT
- Stockage dans localStorage (persistance de session)

**Déconnexion**
- Suppression du token et des infos utilisateur
- Nettoyage de localStorage
- Retour à l'état non connecté

### 3. Actions protégées

**Soumission d'observations**
- Formulaire accessible seulement aux utilisateurs connectés
- Champs : densité, proximité, ambiance, notes (optionnel)
- Validation côté client et serveur
- Lien automatique avec l'auteur (champ author dans Observation)
- Feedback visuel (succès/erreur)

### 4. Espace compte

**Gestion des favoris**
- Bouton favori dans la vue détaillée (connecté seulement)
- Ajout/suppression de lieu aux favoris
- Indicateur visuel (étoile orange quand favori)
- Chargement automatique des favoris à la connexion

**Filtrage par favoris**
- Bouton "Mes favoris" dans le header (connecté seulement)
- Filtre la carte pour n'afficher que les favoris
- Toggle entre "Tous les lieux" et "Mes favoris"
- Mise à jour dynamique de l'affichage

## Modifications de l'infrastructure

### Modèle Location

**Ajout des champs géographiques**
```javascript
latitude: Number,  // Coordonnée latitude
longitude: Number  // Coordonnée longitude
```

**Raison** : Nécessaire pour l'affichage sur la carte Leaflet. Les coordonnées sont optionnelles pour la compatibilité avec les données existantes de la Phase 1.

### Modèle Observation

**Ajout du champ auteur**
```javascript
author: { type: Schema.Types.ObjectId, ref: 'User' }
```

**Raison** : Permet de lier chaque observation à son auteur, facilitant le suivi des contributions utilisateur et l'analyse des données.

### Modèle User (nouveau)

**Schéma complet**
```javascript
{
  username: String (unique, required),
  email: String (unique, required),
  password: String (hashé avec bcrypt),
  favoriteLocations: [String] (tableau de slugs),
  createdAt: Date
}
```

**Méthodes**
- `hashPassword()` : Hashage du password avant sauvegarde
- `comparePassword()` : Comparaison du password fourni avec le hash

### Endpoints ambiance

**Exposition de ambianceLabel**
Les endpoints sémantiques (`/v1/ambiance/{slug}/now`, etc.) exposent maintenant le champ `ambianceLabel` pour indiquer la classification de l'ambiance :
- "calme" : < 50 dB
- "modéré" : 50-65 dB
- "animé" : > 65 dB
- "inconnu" : données insuffisantes

**Raison** : Permet au frontend d'afficher une classification lisible sans avoir à recalculer la logique côté client.

## Limites identifiées

### 1. Pas de rafraîchissement automatique

**Problème** : Les données d'ambiance ne se rafraîchissent pas automatiquement. L'utilisateur doit recharger la page pour voir les nouvelles mesures.

**Impact** : L'ambiance affichée peut être obsolète si l'utilisateur reste longtemps sur la page.

**Solution envisagée** : Implémenter un polling (ex: toutes les 30 secondes) ou utiliser WebSockets pour des mises à jour en temps réel.

### 2. Pas de validation email réelle

**Problème** : L'inscription vérifie seulement le format de l'email, pas sa validité. Un utilisateur peut s'inscrire avec un email inexistant.

**Impact** : Possibilité de comptes factices avec des emails invalides.

**Solution envisagée** : Envoyer un email de confirmation avec un lien de validation avant d'activer le compte.

### 3. JWT stocké en localStorage

**Problème** : Le token JWT est stocké dans localStorage du navigateur, ce qui le rend vulnérable aux attaques XSS.

**Impact** : Si une attaque XSS réussit, un attaquant peut voler le token et se faire passer pour l'utilisateur.

**Solution envisagée** : Utiliser httpOnly cookies pour stocker le token, qui ne sont pas accessibles via JavaScript.

### 4. Pas de tests unitaires frontend

**Problème** : Aucun test unitaire n'a été écrit pour les composants React et les fonctions utilitaires.

**Impact** : Risque plus élevé de régressions lors de modifications futures.

**Solution envisagée** : Ajouter Jest et React Testing Library pour tester les composants et les fonctions.

### 5. Pas de gestion d'erreurs robuste

**Problème** : Les erreurs API sont affichées simplement, sans mécanisme de retry ou de fallback.

**Impact** : Mauvaise expérience utilisateur en cas de problème réseau ou serveur.

**Solution envisagée** : Implémenter un système de retry avec backoff exponentiel et des messages d'erreur plus explicites.

### 6. Pas de pagination côté frontend

**Problème** : Le frontend charge tous les lieux en une seule requête, sans pagination.

**Impact** : Si le nombre de lieux augmente considérablement, le temps de chargement et la performance pourraient se dégrader.

**Solution envisagée** : Implémenter une pagination ou un chargement infini (infinite scroll) pour les lieux.

### 7. Pas de responsive design avancé

**Problème** : L'interface est basique et n'est pas optimisée pour les mobiles.

**Impact** : Expérience utilisateur médiocre sur les petits écrans.

**Solution envisagée** : Utiliser un framework CSS (Tailwind, Bootstrap) ou des media queries pour un design responsive.

### 8. Pas de validation côté frontend avancée

**Problème** : La validation des formulaires est minimale (champs requis, longueur minimale).

**Impact** : Possibilité de soumettre des données mal formatées qui seront rejetées par le serveur.

**Solution envisagée** : Utiliser une bibliothèque de validation comme Yup ou Zod pour une validation plus robuste côté client.

## Conclusion

La Phase 2 a permis d'ajouter une interface utilisateur moderne et fonctionnelle au projet "Ambiance des Lieux", avec authentification utilisateur et gestion des favoris. Les choix technologiques (React, JWT, Leaflet) sont standards et bien adaptés aux besoins du projet.

L'architecture séparée backend/frontend offre une bonne base pour l'évolution future, bien que certaines limites (pas de tests, localStorage pour JWT, pas de rafraîchissement automatique) devront être adressées pour une mise en production.

Les fonctionnalités implémentées répondent aux exigences de la Phase 2 et offrent une expérience utilisateur satisfaisante pour la consultation de l'ambiance des lieux et la contribution d'observations.
