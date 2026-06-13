/**
 * Ressource `/v1/devices/*` — gestion des appareils de collecte.
 *
 * Squelette à implémenter par Personne A.
 *
 * Note de sécurité (Phase 1) : `POST /` n'est volontairement PAS protégé —
 * c'est la vulnérabilité documentée dans le rapport (création d'appareil ouverte).
 */

import { Router } from "express";
import { requireApiKey } from "../middlewares/auth.js";

const router = Router();

// POST /v1/devices — création d'un appareil (PAS d'auth en Phase 1, vulnérabilité documentée)
router.post("/", (req, res) => {
  res.status(501).json({
    status: "error",
    error: { code: "NOT_IMPLEMENTED", message: "À implémenter par Personne A" },
    meta: { generatedAt: new Date().toISOString() },
  });
});

// GET /v1/devices — liste des appareils (protégé)
router.get("/", requireApiKey, (req, res) => {
  res.status(501).json({
    status: "error",
    error: { code: "NOT_IMPLEMENTED", message: "À implémenter par Personne A" },
    meta: { generatedAt: new Date().toISOString() },
  });
});

// DELETE /v1/devices/:id — révocation d'un appareil (protégé)
router.delete("/:id", requireApiKey, (req, res) => {
  res.status(501).json({
    status: "error",
    error: { code: "NOT_IMPLEMENTED", message: "À implémenter par Personne A" },
    meta: { generatedAt: new Date().toISOString() },
  });
});

export default router;
