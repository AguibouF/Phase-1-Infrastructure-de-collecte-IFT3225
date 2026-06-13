import mongoose from "mongoose";

/**
 * Établit la connexion à MongoDB en utilisant l'URI fournie via
 * la variable d'environnement `MONGODB_URI`.
 *
 * @throws {Error} si la connexion échoue (relancée pour que l'appelant
 *                 puisse interrompre le démarrage du serveur).
 */
export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connexion MongoDB établie.");
  } catch (err) {
    console.error("Échec connexion MongoDB :", err.message);
    throw err;
  }
}
