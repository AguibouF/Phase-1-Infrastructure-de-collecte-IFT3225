import express from "express";
import cors from "cors";

import ambianceRoutes from "./routes/ambiance.js";
import devicesRoutes from "./routes/devices.js";
import locationsRoutes from "./routes/locations.js";
import measurementsRoutes from "./routes/measurements.js";
import observationsRoutes from "./routes/observations.js";

const app = express();

// Middlewares globaux
app.use(express.json());
app.use(cors());

// Montage des routes préfixées /v1
app.use("/v1/ambiance", ambianceRoutes);
app.use("/v1/devices", devicesRoutes);
app.use("/v1/locations", locationsRoutes);
app.use("/v1/measurements", measurementsRoutes);
app.use("/v1/observations", observationsRoutes);

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    status: "error",
    error: { code: "INTERNAL_ERROR", message: "Erreur interne du serveur." },
    meta: { generatedAt: new Date().toISOString() },
  });
});

export default app;
