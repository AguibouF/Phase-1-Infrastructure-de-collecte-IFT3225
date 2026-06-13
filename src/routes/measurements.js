/**
 * Ressource `/v1/measurements/*` — collecte des mesures de niveau sonore.
 *
 * Squelette à implémenter par Personne A.
 * Les routes d'écriture (POST) sont protégées par clé API.
 */

import { Router } from "express";
import { requireApiKey } from "../middlewares/auth.js";

const router = Router();

// POST /v1/measurements — mesure unique (protégé)
router.post("/", requireApiKey, (req, res) => {
  res.status(501).json({
    status: "error",
    error: { code: "NOT_IMPLEMENTED", message: "À implémenter par Personne A" },
    meta: { generatedAt: new Date().toISOString() },
  });
});

// POST /v1/measurements/batch — lot de mesures (protégé)
router.post("/batch", requireApiKey, (req, res) => {
  res.status(501).json({
    status: "error",
    error: { code: "NOT_IMPLEMENTED", message: "À implémenter par Personne A" },
    meta: { generatedAt: new Date().toISOString() },
  });
});

// GET /v1/measurements — liste paginée des mesures
router.get("/", (req, res) => {
  res.status(501).json({
    status: "error",
    error: { code: "NOT_IMPLEMENTED", message: "À implémenter par Personne A" },
    meta: { generatedAt: new Date().toISOString() },
  });
});

export default router;
