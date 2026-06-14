require('dotenv').config();
const { createApp } = require('./src/app');
const { connectDB } = require('./src/config/db');

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
    console.error('Échec du démarrage:', err.message);
    process.exit(1);
  }
})();
