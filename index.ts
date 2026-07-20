// dotenv en PREMIER import : les modules suivants lisent process.env au chargement.
import 'dotenv/config';
import dns from 'dns';
import { createApp } from './src/app';
import { connectDB } from './src/config/db';

// Certains réseaux locaux refusent les requêtes DNS SRV utilisées par mongodb+srv.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await connectDB();
    const app = createApp();
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`✓ Serveur ambiance à l'écoute sur http://localhost:${PORT} (API: /v1)`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Échec du démarrage:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
