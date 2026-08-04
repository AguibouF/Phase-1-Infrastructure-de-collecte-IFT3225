import { useState, useEffect, useCallback } from 'react';
import { ambianceApi } from '../api/ambianceApi';

// Hook personnalisé : encapsule la récupération de la liste des lieux et ses
// états (chargement / erreur / données), pour que les composants n'aient pas à
// répéter cette logique. Expose `reload` pour rafraîchir à la demande.
export function useLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ambianceApi.getLocations();
      setLocations(response.data);
    } catch (err) {
      console.error(err);
      setError('Erreur lors du chargement des lieux');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { locations, loading, error, reload };
}
