import { EventEmitter } from 'events';

// Bus d'événements interne pour le temps réel (bonus SSE) : les routes
// d'écriture publient ici, la route /v1/events relaie aux clients connectés.
export type AmbianceEventKind = 'measurement' | 'observation';

export interface AmbianceEvent {
  kind: AmbianceEventKind;
  locationSlug: string;
  at: string; // ISO 8601
}

class AmbianceEventBus extends EventEmitter {}

export const ambianceEvents = new AmbianceEventBus();
// Un flux SSE par client connecté : on relève la limite par défaut (10 listeners).
ambianceEvents.setMaxListeners(100);

export function emitAmbianceEvent(kind: AmbianceEventKind, locationSlug: string): void {
  const event: AmbianceEvent = { kind, locationSlug, at: new Date().toISOString() };
  ambianceEvents.emit('ambiance', event);
}
