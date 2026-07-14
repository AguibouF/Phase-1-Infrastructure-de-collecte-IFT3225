const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'votre-secret-jet-a-changer-en-production';

const userAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        error: { code: 'NO_TOKEN', message: 'Token d\'authentification manquant' }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    req.user = {
      userId: decoded.userId,
      username: decoded.username
    };
    
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      error: { code: 'INVALID_TOKEN', message: 'Token d\'authentification invalide ou expiré' }
    });
  }
};

module.exports = { userAuth };
