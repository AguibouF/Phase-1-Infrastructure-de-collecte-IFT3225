import mongoose from 'mongoose';

// Connexion au cluster MongoDB Atlas. L'URI vient des variables d'environnement (jamais en dur).
export async function connectDB(uri: string | undefined = process.env.MONGODB_URI): Promise<mongoose.Connection> {
  if (!uri) throw new Error('MONGODB_URI manquant : copiez .env.example vers .env et renseignez le cluster Atlas.');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { dbName: process.env.DB_NAME || undefined });
  // eslint-disable-next-line no-console
  console.log('✓ Connecté à MongoDB');
  return mongoose.connection;
}
