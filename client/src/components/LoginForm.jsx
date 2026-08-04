import { useState } from 'react';
import { ambianceApi } from '../api/ambianceApi';
import { useAuth } from '../context/AuthContext';
import { useUIStore } from '../store/uiStore';

const LoginForm = () => {
  const { login } = useAuth();
  const closeAuth = useUIStore((s) => s.closeAuth);
  const clearNotice = useUIStore((s) => s.clearNotice);
  const openAuth = useUIStore((s) => s.openAuth);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await ambianceApi.login(username, password);
      login(response.data.user, response.data.token);
      clearNotice();
      closeAuth();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Erreur lors de la connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form">
      <h2>Connexion</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Nom d'utilisateur ou Email</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Mot de passe</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
      <p className="auth-switch">
        Pas encore de compte ?{' '}
        <button type="button" onClick={() => openAuth('register')}>
          S'inscrire
        </button>
      </p>
    </div>
  );
};

export default LoginForm;
