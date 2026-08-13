// ============================================================================
// BRIDGE PHYPHOX -> API
// ----------------------------------------------------------------------------
// Rôle : interroger le capteur (Phyphox, "remote access" activé) à intervalle
// régulier et POSTer chaque relevé de niveau sonore vers POST /v1/measurements,
// authentifié par l'en-tête x-api-key.
//
// Justification du choix (cf. README) : le bridge découple la collecte du
// serveur. Le téléphone n'a pas besoin de connaître MongoDB ni la logique
// métier ; il expose juste ses données via l'API REST locale de Phyphox. Le
// bridge agit comme client capteur et applique l'authentification + le format
// du protocole. Si Phyphox est indisponible, on bascule sur la saisie manuelle
// (observations) — le fallback obligatoire décrit dans le rapport.
//
// Phyphox "Allow remote access" expose :  http://<phone-ip>:8080/get?<buffers>
// On lit le buffer du sonomètre (souvent "dB" ou "dBA").
//
// Variables d'environnement (voir .env.example) :
//   PHYPHOX_URL      ex: http://192.168.1.42:8080
//   PHYPHOX_BUFFER   nom du buffer sonore (def: dB)
//   API_URL          ex: http://localhost:3000
//   DEVICE_API_KEY   clé x-api-key d'un device enregistré
//   LOCATION_SLUG    ex: cafeteria-roger-gaudry
//   POLL_INTERVAL_MS intervalle de polling (def: 5000)
// ============================================================================
require('dotenv').config();

const PHYPHOX_URL = (process.env.PHYPHOX_URL || 'http://192.168.1.42:8080').replace(/\/+$/, '');
const PHYPHOX_BUFFER = process.env.PHYPHOX_BUFFER || 'dB';
// Un slash final produirait `.../v1/measurements` précédé d'un double slash, que
// Express ne route pas -> 404 incompréhensible. On normalise.
const API_URL = (process.env.API_URL || 'http://localhost:3000').replace(/\/+$/, '');
const DEVICE_API_KEY = process.env.DEVICE_API_KEY;
const LOCATION_SLUG = process.env.LOCATION_SLUG || 'cafeteria-roger-gaudry';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS, 10) || 5000;

if (!DEVICE_API_KEY) {
  console.error('DEVICE_API_KEY manquant. Créez un device (POST /v1/devices) et exportez sa clé.');
  process.exit(1);
}

// Sans port explicite, Node tape sur le 80 alors que Phyphox écoute sur le 8080 :
// cause d'échec la plus fréquente, et invisible dans le message d'erreur de fetch.
if (!/:\d+$/.test(PHYPHOX_URL)) {
  console.warn(`⚠ PHYPHOX_URL=${PHYPHOX_URL} n'indique pas de port -> port 80 utilisé. Phyphox écoute sur 8080 (ex. ${PHYPHOX_URL}:8080).`);
}

// `fetch` échoue avec un message unique et opaque ("fetch failed") quelle que soit
// la cause réseau. On remonte le code bas niveau (ECONNREFUSED, EHOSTUNREACH,
// ETIMEDOUT...) pour distinguer un port fermé d'un hôte injoignable.
function describe(err) {
  const code = err?.cause?.code;
  return code ? `${err.message} (${code})` : err.message;
}

async function readPhyphox() {
  const url = `${PHYPHOX_URL}/get?${encodeURIComponent(PHYPHOX_BUFFER)}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  } catch (e) {
    throw new Error(`[phyphox] ${url} injoignable : ${describe(e)}`);
  }
  if (!res.ok) throw new Error(`[phyphox] HTTP ${res.status}`);
  const json = await res.json();
  // Format Phyphox : { buffer: { <name>: { buffer: [v1, v2, ...] } } }
  const buf = json.buffer?.[PHYPHOX_BUFFER]?.buffer;
  if (!Array.isArray(buf) || !buf.length)
    throw new Error(`[phyphox] buffer "${PHYPHOX_BUFFER}" vide (expérience en pause ? mauvais nom de buffer ?)`);
  const value = buf[buf.length - 1];
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error('[phyphox] valeur invalide');
  return value;
}

async function postMeasurement(value) {
  const url = `${API_URL}/v1/measurements`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': DEVICE_API_KEY },
      body: JSON.stringify({
        type: 'noise_level',
        value: Math.round(value * 10) / 10,
        unit: 'dB',
        locationSlug: LOCATION_SLUG,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    throw new Error(`[api] ${url} injoignable : ${describe(e)}`);
  }
  if (res.status === 401) throw new Error('[api] 401 x-api-key absent');
  if (res.status === 403) throw new Error('[api] 403 clé invalide');
  if (!res.ok && res.status !== 201) {
    const t = await res.text();
    throw new Error(`[api] POST échec ${res.status}: ${t}`);
  }
  return res.status;
}

let sent = 0;
let fails = 0;

async function tick() {
  try {
    const value = await readPhyphox();
    const status = await postMeasurement(value);
    sent++;
    console.log(`[${new Date().toISOString()}] ${value.toFixed(1)} dB -> ${status} (envoyées: ${sent})`);
    fails = 0;
  } catch (err) {
    fails++;
    console.warn(`[${new Date().toISOString()}] ⚠ ${err.message}` + (fails >= 3 ? '  (capteur instable -> envisager la saisie manuelle / fallback)' : ''));
  }
}

console.log(`Bridge démarré. Phyphox=${PHYPHOX_URL} buffer=${PHYPHOX_BUFFER} -> ${API_URL} | lieu=${LOCATION_SLUG} | toutes les ${POLL_INTERVAL_MS} ms`);
tick();
setInterval(tick, POLL_INTERVAL_MS);
