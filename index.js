import "dotenv/config";

import app from "./src/app.js";
import { connectDB } from "./src/data/db.js";

const PORT = process.env.PORT || 3000;

// Démarrage : on établit d'abord la connexion Mongo, puis on écoute.
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Serveur démarré sur http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Échec du démarrage du serveur :", err.message);
    process.exit(1);
  });
