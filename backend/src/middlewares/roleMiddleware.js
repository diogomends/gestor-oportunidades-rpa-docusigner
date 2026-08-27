/**
 * Express middleware factory to restrict route access by user role(s).
 * Checks if `req.user.cargo` is included in allowed roles; responds with HTTP 403 if forbidden.
 * @param {...string} roles - Allowed role names (e.g. "admin", "robot").
 * @returns {import("express").RequestHandler} Express middleware handler.
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    if (!roles.includes(req.user.cargo)) {
      return res.status(403).json({
        message: `Cargo '${req.user.cargo}' não tem permissão para acessar este recurso`,
      });
    }
    next();
  };
};

