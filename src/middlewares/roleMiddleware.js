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
