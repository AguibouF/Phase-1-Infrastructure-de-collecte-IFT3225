const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { success, errors } = require('../utils/responses');
const { userAuth } = require('../middlewares/userAuth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'votre-secret-jet-a-changer-en-production';

// POST /v1/auth/register - Inscription
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};
    
    if (!username || !email || !password) {
      throw errors.validation('Champs requis manquants', [
        { field: 'username', issue: !username ? 'missing' : null },
        { field: 'email', issue: !email ? 'missing' : null },
        { field: 'password', issue: !password ? 'missing' : null }
      ].filter(item => item.issue));
    }

    if (password.length < 6) {
      throw errors.validation('Le mot de passe doit contenir au moins 6 caractères', [
        { field: 'password', issue: 'too_short' }
      ]);
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ 
      $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] 
    });
    
    if (existingUser) {
      throw errors.conflict('USER_EXISTS', 'Un utilisateur avec ce nom ou email existe déjà');
    }

    const user = await User.create({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password
    });

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    success(res, 201, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        favoriteLocations: user.favoriteLocations
      },
      token
    });
  } catch (e) { next(e); }
});

// POST /v1/auth/login - Connexion
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    
    if (!username || !password) {
      throw errors.validation('Champs requis manquants', [
        { field: 'username', issue: !username ? 'missing' : null },
        { field: 'password', issue: !password ? 'missing' : null }
      ].filter(item => item.issue));
    }

    const user = await User.findOne({ 
      $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }] 
    });

    if (!user) {
      throw errors.unauthorized('INVALID_CREDENTIALS', 'Identifiants invalides');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw errors.unauthorized('INVALID_CREDENTIALS', 'Identifiants invalides');
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    success(res, 200, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        favoriteLocations: user.favoriteLocations
      },
      token
    });
  } catch (e) { next(e); }
});

// POST /v1/auth/favorites - Ajouter un lieu aux favoris
router.post('/favorites', userAuth, async (req, res, next) => {
  try {
    const { locationSlug } = req.body || {};
    
    if (!locationSlug) {
      throw errors.validation('Champ requis manquant', [
        { field: 'locationSlug', issue: 'missing' }
      ]);
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      throw errors.notFound('USER_NOT_FOUND', 'Utilisateur non trouvé');
    }

    if (!user.favoriteLocations.includes(locationSlug)) {
      user.favoriteLocations.push(locationSlug);
      await user.save();
    }

    success(res, 200, {
      favoriteLocations: user.favoriteLocations
    });
  } catch (e) { next(e); }
});

// DELETE /v1/auth/favorites/:locationSlug - Retirer un lieu des favoris
router.delete('/favorites/:locationSlug', userAuth, async (req, res, next) => {
  try {
    const { locationSlug } = req.params;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      throw errors.notFound('USER_NOT_FOUND', 'Utilisateur non trouvé');
    }

    user.favoriteLocations = user.favoriteLocations.filter(slug => slug !== locationSlug);
    await user.save();

    success(res, 200, {
      favoriteLocations: user.favoriteLocations
    });
  } catch (e) { next(e); }
});

// GET /v1/auth/favorites - Récupérer les lieux favoris
router.get('/favorites', userAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      throw errors.notFound('USER_NOT_FOUND', 'Utilisateur non trouvé');
    }

    success(res, 200, {
      favoriteLocations: user.favoriteLocations
    });
  } catch (e) { next(e); }
});

module.exports = router;
