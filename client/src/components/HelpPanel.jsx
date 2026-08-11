import { useEffect } from 'react';
import { useUIStore } from '../store/uiStore';

// Aide en application « Comment ça marche » (modale) : explique en quelques
// lignes ce qu'est l'application, comment lire la carte et comment contribuer.
// Répond à l'heuristique « aide et documentation » de Nielsen.
const HelpPanel = () => {
  const helpOpen = useUIStore((s) => s.helpOpen);
  const closeHelp = useUIStore((s) => s.closeHelp);

  // Fermeture au clavier (Échap).
  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') closeHelp(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [helpOpen, closeHelp]);

  if (!helpOpen) return null;

  return (
    <div className="help-overlay" onClick={closeHelp}>
      <div
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="help-header">
          <h2 id="help-title">Comment ça marche&nbsp;?</h2>
          <button className="help-close" onClick={closeHelp} aria-label="Fermer l'aide">×</button>
        </div>

        <section className="help-section">
          <h3>Ce que montre l'application</h3>
          <p>
            Chaque lieu affiche son <strong>ambiance sonore</strong> — de <strong>calme</strong> à
            <strong> bruyant</strong> — calculée à partir des mesures d'un capteur et des observations
            des visiteurs, sur les 30 dernières minutes.
          </p>
        </section>

        <section className="help-section">
          <h3>Lire la carte</h3>
          <ul>
            <li>La <strong>couleur</strong> d'un marqueur indique l'ambiance (voir la légende sous la carte).</li>
            <li>Un marqueur <strong>estompé, à contour pointillé</strong> montre la dernière ambiance connue, avec son ancienneté.</li>
            <li>Un marqueur <strong>gris</strong> signifie qu'aucune donnée récente n'est disponible.</li>
            <li>Le bouton <strong>« Où aller ? »</strong> classe tous les lieux, du plus calme au plus animé, en direct.</li>
          </ul>
        </section>

        <section className="help-section">
          <h3>Contribuer</h3>
          <p>
            Créez un compte, ouvrez un lieu depuis la carte, puis <strong>« + Nouvelle observation »</strong>.
            Vous pouvez aussi gérer vos <strong>favoris</strong> (★) et retrouver vos lieux via
            <strong> « Mes lieux »</strong>.
          </p>
        </section>

        <button className="help-done" onClick={closeHelp}>Compris</button>
      </div>
    </div>
  );
};

export default HelpPanel;
