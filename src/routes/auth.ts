import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User';
import Observation from '../models/Observation';
import Location, { LocationDocument } from '../models/Location';
import { success, errors, ErrorDetail } from '../utils/responses';
import { userAuth } from '../middlewares/userAuth';

const router = express.Router();

const JWT_SECRET: string = process.env.JWT_SECRET || 'votre-secret-jet-a-changer-en-production';

// POST /v1/auth/register - Inscription
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password } = (req.body || {}) as Record<string, string | undefined>;

    if (!username || !email || !password) {
      const details: ErrorDetail[] = [
        { field: 'username', issue: !username ? 'missing' : undefined },
        { field: 'email', issue: !email ? 'missing' : undefined },
        { field: 'password', issue: !password ? 'missing' : undefined },
      ].filter((item) => item.issue) as ErrorDetail[];
      throw errors.validation('Champs requis manquants', details);
    }

    if (password.length < 6) {
      throw errors.validation('Le mot de passe doit contenir au moins 6 caractères', [
        { field: 'password', issue: 'too_short' },
      ]);
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }],
    });

    if (existingUser) {
      throw errors.conflict('USER_EXISTS', 'Un utilisateur avec ce nom ou email existe déjà');
    }

    const user = await User.create({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
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
        favoriteLocations: user.favoriteLocations,
      },
      token,
    });
  } catch (e) { next(e); }
});

// POST /v1/auth/login - Connexion
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = (req.body || {}) as Record<string, string | undefined>;

    if (!username || !password) {
      const details: ErrorDetail[] = [
        { field: 'username', issue: !username ? 'missing' : undefined },
        { field: 'password', issue: !password ? 'missing' : undefined },
      ].filter((item) => item.issue) as ErrorDetail[];
      throw errors.validation('Champs requis manquants', details);
    }

    const user = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }],
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
        favoriteLocations: user.favoriteLocations,
      },
      token,
    });
  } catch (e) { next(e); }
});

// POST /v1/auth/favorites - Ajouter un lieu aux favoris
router.post('/favorites', userAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationSlug } = (req.body || {}) as { locationSlug?: string };

    if (!locationSlug) {
      throw errors.validation('Champ requis manquant', [
        { field: 'locationSlug', issue: 'missing' },
      ]);
    }

    const user = await User.findById(req.user?.userId);
    if (!user) {
      throw errors.notFound('Utilisateur non trouvé');
    }

    if (!user.favoriteLocations.includes(locationSlug)) {
      user.favoriteLocations.push(locationSlug);
      await user.save();
    }

    success(res, 200, {
      favoriteLocations: user.favoriteLocations,
    });
  } catch (e) { next(e); }
});

// DELETE /v1/auth/favorites/:locationSlug - Retirer un lieu des favoris
router.delete('/favorites/:locationSlug', userAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationSlug } = req.params;

    const user = await User.findById(req.user?.userId);
    if (!user) {
      throw errors.notFound('Utilisateur non trouvé');
    }

    user.favoriteLocations = user.favoriteLocations.filter((slug) => slug !== locationSlug);
    await user.save();

    success(res, 200, {
      favoriteLocations: user.favoriteLocations,
    });
  } catch (e) { next(e); }
});

// GET /v1/auth/favorites - Récupérer les lieux favoris
router.get('/favorites', userAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user?.userId);
    if (!user) {
      throw errors.notFound('Utilisateur non trouvé');
    }

    success(res, 200, {
      favoriteLocations: user.favoriteLocations,
    });
  } catch (e) { next(e); }
});

interface MyLocationSummary {
  _id: string;
  observationCount: number;
  lastObservationAt: Date;
}

// GET /v1/auth/my-locations - Récapitulatif des lieux où l'utilisateur a effectué des écoutes
router.get('/my-locations', userAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user?.userId);
    if (!user) {
      throw errors.notFound('Utilisateur non trouvé');
    }

    // Regrouper les observations de l'utilisateur par lieu
    const summary = await Observation.aggregate<MyLocationSummary>([
      { $match: { author: new mongoose.Types.ObjectId(req.user?.userId) } },
      {
        $group: {
          _id: '$locationSlug',
          observationCount: { $sum: 1 },
          lastObservationAt: { $max: '$timestamp' },
        },
      },
      { $sort: { lastObservationAt: -1 } },
    ]);

    // Enrichir avec les informations du lieu (nom, type, coordonnées)
    const slugs = summary.map((s) => s._id);
    const locations = await Location.find({ slug: { $in: slugs } });
    const locationsBySlug: Record<string, LocationDocument> = {};
    for (const loc of locations) locationsBySlug[loc.slug] = loc;

    const myLocations = summary.map((s) => {
      const loc = locationsBySlug[s._id];
      return {
        locationSlug: s._id,
        displayName: loc ? loc.displayName : s._id,
        type: loc ? loc.type : null,
        city: loc ? loc.city : null,
        latitude: loc ? loc.latitude : null,
        longitude: loc ? loc.longitude : null,
        observationCount: s.observationCount,
        lastObservationAt: s.lastObservationAt,
        isFavorite: user.favoriteLocations.includes(s._id),
      };
    });

    success(res, 200, { myLocations }, {
      description: "Lieux où l'utilisateur connecté a soumis des observations, avec nombre d'écoutes et date de la dernière.",
    });
  } catch (e) { next(e); }
});

export default router;
