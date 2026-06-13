/**
 * Ressource `/v1/observations/*` — collecte des relevés qualitatifs d'ambiance.
 *
 * Squelette à implémenter par Personne A.
 * La route d'écriture (POST) est protégée par clé API.
 */

import { Router } from "express";
import { requireApiKey } from "../middlewares/auth.js";

const router = Router();

// POST /v1/observations — création d'une observation (protégé)
router.post("/", requireApiKey, (req, res) => {
  res.status(501).json({
    status: "error",
    error: { code: "NOT_IMPLEMENTED", message: "À implémenter par Personne A" },
    meta: { generatedAt: new Date().toISOString() },
  });
});

// GET /v1/observations — liste paginée des observations
router.get("/", (req, res) => {
  res.status(501).json({
    status: "error",
    error: { code: "NOT_IMPLEMENTED", message: "À implémenter par Personne A" },
    meta: { generatedAt: new Date().toISOString() },
  });
});

export default router;
