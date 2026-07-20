import express, { Request, Response } from 'express';
import { ambianceEvents, AmbianceEvent } from '../utils/events';

const router = express.Router();

// GET /v1/events — flux temps réel SSE (bonus Phase 2).
// Chaque nouvelle mesure ou observation est diffusée à tous les clients
// connectés sous la forme d'un événement { kind, locationSlug, at }.
// Filtre optionnel : ?locationSlug=<slug> pour ne recevoir qu'un lieu.
router.get('/', (req: Request, res: Response) => {
  const filterSlug = req.query.locationSlug ? String(req.query.locationSlug).toLowerCase() : null;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // évite la mise en tampon par un éventuel proxy
  });
  res.write(': connecté au flux ambiance\n\n');

  const onEvent = (event: AmbianceEvent) => {
    if (filterSlug && event.locationSlug !== filterSlug) return;
    res.write(`event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`);
  };
  ambianceEvents.on('ambiance', onEvent);

  // Keepalive : commentaire SSE toutes les 25 s pour maintenir la connexion.
  const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(keepAlive);
    ambianceEvents.off('ambiance', onEvent);
  });
});

export default router;
