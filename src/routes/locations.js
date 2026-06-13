/**
 * Ressource `/v1/locations/*` — gestion des lieux.
 *
 * Squelette à implémenter par Personne A. Routes publiques en Phase 1.
 */

import { Router } from "express";

const router = Router();

// POST /v1/locations — création d'un lieu
router.post("/", (req, res) => {
  res.status(501).json({
    status: "error",
    error: { code: "NOT_IMPLEMENTED", message: "À implémenter par Personne A" },
    meta: { generatedAt: new Date().toISOString() },
  });
});

// GET /v1/locations — liste des lieux
router.get("/", (req, res) => {
  res.status(501).json({
    status: "error",
    error: { code: "NOT_IMPLEMENTED", message: "À implémenter par Personne A" },
    meta: { generatedAt: new Date().toISOString() },
  });
});

// PUT /v1/locations/:slug — mise à jour d'un lieu
router.put("/:slug", (req, res) => {
  res.status(501).json({
    status: "error",
    error: { code: "NOT_IMPLEMENTED", message: "À implémenter par Personne A" },
    meta: { generatedAt: new Date().toISOString() },
  });
});

export default router;
