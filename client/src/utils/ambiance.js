// Utilitaires d'affichage de l'ambiance, partagés entre les composants
// (carte, recommandation, détail) pour éviter la duplication des couleurs et
// des libellés — réutilisabilité (Tâche 2).

// Couleur associée à une étiquette d'ambiance (identique à la légende de la carte).
export function ambianceColor(label) {
  switch ((label || '').toLowerCase()) {
    case 'calme':
      return '#27ae60'; // Vert
    case 'modéré':
      return '#f39c12'; // Orange
    case 'animé':
      return '#e74c3c'; // Rouge
    case 'bruyant':
      return '#8e44ad'; // Violet
    default:
      return '#7f8c8d'; // Gris (inconnu / indisponible)
  }
}

// Libellé lisible pour l'utilisateur.
export function ambianceText(label) {
  const l = (label || '').toLowerCase();
  return l && l !== 'inconnu' ? l.charAt(0).toUpperCase() + l.slice(1) : 'Données non disponibles';
}
