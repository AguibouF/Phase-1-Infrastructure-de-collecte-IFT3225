import type { DeviceDocument } from '../models/Device';

// Augmentation des types Express : propriétés ajoutées par nos middlewares
// (deviceAuth renseigne req.device, userAuth renseigne req.user).
declare global {
  namespace Express {
    interface Request {
      device?: DeviceDocument;
      user?: { userId: string; username: string };
    }
  }
}

export {};
