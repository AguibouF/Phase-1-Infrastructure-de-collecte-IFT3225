import mongoose from 'mongoose';
import dns from 'dns';

// Contournement : sur certaines machines (ex. adaptateur virtuel VirtualBox actif),
// le résolveur DNS interne de Node pointe vers 127.0.0.1 et la résolution SRV des URI
// mongodb+srv:// échoue avec « querySrv ECONNREFUSED ». Dans ce cas, on bascule sur
// des DNS publics avant de laisser le driver résoudre l'adresse du cluster.
async function ensureSrvResolvable(uri: string): Promise<void> {
  if (!uri.startsWith('mongodb+srv://')) return;
  const host = uri.slice('mongodb+srv://'.length).split('@').pop()!.split('/')[0].split('?')[0];
  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
}

// Connexion au cluster MongoDB Atlas. L'URI vient des variables d'environnement (jamais en dur).
export async function connectDB(uri: string | undefined = process.env.MONGODB_URI): Promise<mongoose.Connection> {
  if (!uri) throw new Error('MONGODB_URI manquant : copiez .env.example vers .env et renseignez le cluster Atlas.');
  await ensureSrvResolvable(uri);
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { dbName: process.env.DB_NAME || undefined });
  // eslint-disable-next-line no-console
  console.log('✓ Connecté à MongoDB');
  return mongoose.connection;
}
