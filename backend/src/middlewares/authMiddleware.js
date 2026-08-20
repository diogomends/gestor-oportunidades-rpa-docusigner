import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select("-senha");

      if (!req.user) {
        return res
          .status(401)
          .json({ message: "Não autorizado, usuário não encontrado" });
      }

      if (req.user.ativo === false) {
        return res
          .status(403)
          .json({ message: "Acesso negado: usuário inativo." });
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: "Não autorizado, token falhou" });
    }
  } else if (req.query && req.query.token) {
    try {
      // Get token from query parameter
      token = req.query.token;

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select("-senha");

      if (!req.user) {
        return res
          .status(401)
          .json({ message: "Não autorizado, usuário não encontrado" });
      }

      if (req.user.ativo === false) {
        return res
          .status(403)
          .json({ message: "Acesso negado: usuário inativo." });
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: "Não autorizado, token falhou" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Não autorizado, sem token" });
  }
};
