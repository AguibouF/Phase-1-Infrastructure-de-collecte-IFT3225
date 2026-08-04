// Composants d'état réutilisables : uniformisent l'affichage des états de
// chargement et d'erreur, répétés dans presque tous les composants (carte,
// détail, mes lieux, recommandation).

export function Loading({ message = 'Chargement…' }) {
  return <div className="loading">{message}</div>;
}

export function ErrorMessage({ message = 'Une erreur est survenue.' }) {
  return <div className="error">{message}</div>;
}
