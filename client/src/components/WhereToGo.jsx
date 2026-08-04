import { useState, useEffect, useCallback } from 'react';
import { ambianceApi } from '../api/ambianceApi';
import { ambianceColor, ambianceText } from '../utils/ambiance';
import { Loading, ErrorMessage } from './common/StateMessage';

// Classe tous les lieux du plus calme au plus animé, en direct, pour aider
// l'utilisateur à choisir sa destination sans ouvrir chaque lieu un à un.
// Se rafraîchit automatiquement à chaque nouvelle mesure/observation (SSE).
const WhereToGo = ({ locations = [], onLocationClick }) => {
  const [windowStr, setWindowStr] = useState('30m');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRanking = useCallback(async (win) => {
    try {
      setError(null);
      const response = await ambianceApi.getWhereToGo({ window: win });
      setData(response.data);
    } catch (err) {
      console.error('Erreur where-to-go:', err);
      setError('Impossible de charger la recommandation. Réessayez.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchRanking(windowStr);
  }, [windowStr, fetchRanking]);

  // Temps réel : toute nouvelle donnée recalcule le classement (sans recharger la page).
  useEffect(() => {
    const source = ambianceApi.subscribeToAmbianceEvents(() => fetchRanking(windowStr));
    return () => source.close();
  }, [windowStr, fetchRanking]);

  // Retrouve l'objet lieu complet pour la navigation ; repli sur les métadonnées
  // renvoyées par l'API si le lieu n'est pas dans la liste courante.
  const openLocation = (entry) => {
    const full = locations.find((l) => l.slug === entry.location);
    onLocationClick(full || {
      slug: entry.location,
      displayName: entry.displayName,
      type: entry.type,
      latitude: entry.latitude,
      longitude: entry.longitude,
    });
  };

  if (loading) return <Loading message="Recherche du meilleur endroit…" />;
  if (error) return <ErrorMessage message={error} />;

  const ranked = data?.ranked ?? [];
  const unknown = data?.unknown ?? [];

  return (
    <div className="where-to-go">
      <div className="wtg-header">
        <div>
          <h2>Où aller maintenant ?</h2>
          <p className="wtg-subtitle">Les lieux classés du plus calme au plus animé, en direct.</p>
        </div>
        <label className="wtg-window">
          Fenêtre&nbsp;:
          <select value={windowStr} onChange={(e) => setWindowStr(e.target.value)}>
            <option value="15m">15 min</option>
            <option value="30m">30 min</option>
            <option value="1h">1 heure</option>
          </select>
        </label>
      </div>

      {ranked.length === 0 ? (
        <p className="wtg-empty">Aucune mesure récente dans cette fenêtre — impossible de recommander un lieu pour l'instant.</p>
      ) : (
        <>
          <div className="wtg-best" onClick={() => openLocation(ranked[0])} role="button" tabIndex={0}
               onKeyDown={(e) => e.key === 'Enter' && openLocation(ranked[0])}>
            <span className="wtg-best-badge">Recommandé</span>
            <strong>{ranked[0].displayName}</strong>
            <span className="wtg-chip" style={{ backgroundColor: ambianceColor(ranked[0].ambianceLabel) }}>
              {ambianceText(ranked[0].ambianceLabel)}
            </span>
            {ranked[0].score.noise != null && <span className="wtg-noise">{ranked[0].score.noise} dB</span>}
          </div>

          <ol className="wtg-list">
            {ranked.map((entry, i) => (
              <li key={entry.location} className="wtg-item" onClick={() => openLocation(entry)}
                  role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openLocation(entry)}>
                <span className="wtg-rank">{i + 1}</span>
                <span className="wtg-dot" style={{ backgroundColor: ambianceColor(entry.ambianceLabel) }} />
                <span className="wtg-name">
                  {entry.displayName}
                  {entry.type && <span className="wtg-type"> · {entry.type}</span>}
                </span>
                <span className="wtg-meta">
                  <span className="wtg-chip-sm" style={{ backgroundColor: ambianceColor(entry.ambianceLabel) }}>
                    {ambianceText(entry.ambianceLabel)}
                  </span>
                  {entry.score.noise != null && <span className="wtg-noise">{entry.score.noise} dB</span>}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      {unknown.length > 0 && (
        <div className="wtg-unknown">
          <h4>Sans mesure récente</h4>
          <ul>
            {unknown.map((entry) => (
              <li key={entry.location} onClick={() => openLocation(entry)}
                  role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openLocation(entry)}>
                {entry.displayName}
                {entry.type && <span className="wtg-type"> · {entry.type}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default WhereToGo;
