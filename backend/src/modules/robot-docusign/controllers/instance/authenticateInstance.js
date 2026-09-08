import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../../../../models/User.js";
import RobotInstance from "../../models/RobotInstance.js";
import { getAclDb } from "../../../../config/database.js";
import { normalizeRole } from "../../utils/roleActions.js";

/**
 * Valida role e retorna normalizado ou __invalid__.
 * @param {string|undefined|null} role - Role recebido no payload/header.
 * @returns {string|null} Role normalizado, null se ausente ou "__invalid__" se inválido.
 */
function parseRoleOr400(role) {
  if (role === undefined || role === null || role === "") return null;
  const norm = normalizeRole(role);
  if (!norm) return "__invalid__";
  return norm;
}

/**
 * Zod Schema para autenticação da instância do robô via email/senha.
 * @constant
 * @type {import("zod").ZodObject<any>}
 */
const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  instance_id: z.string().min(1),
  role: z.string().optional().default("all"),
  machine_info: z
    .object({
      hostname: z.string().optional(),
      platform: z.string().optional(),
      arch: z.string().optional(),
      app_version: z.string().optional(),
    })
    .optional(),
});

/**
 * Realiza autenticação da instância do robô e retorna token JWT.
 * Suporta autenticação por API Key (header X-Robot-Key ou campo robot_key) ou credenciais de usuário (email/senha).
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<import("express").Response>} Resposta JSON com token JWT e dados da sessão.
 */
export const authenticateInstance = async (req, res) => {
  try {
    const rawRobotKey = req.headers["x-robot-key"] || req.body?.robot_key;

    // 1. Fluxo de autenticação por API Key (Robot Profile / Service Account)
    if (rawRobotKey && typeof rawRobotKey === "string" && rawRobotKey.trim().length > 0) {
      const robotKey = rawRobotKey.trim();
      const keyHash = crypto.createHash("sha256").update(robotKey).digest("hex");
      const aclDb = getAclDb();

      const apiKeyDoc = await aclDb.collection("robot_api_keys").findOne({
        key_hash: keyHash,
        active: true,
      });

      if (!apiKeyDoc) {
        return res.status(401).json({
          error: "Chave de robô (API Key) inválida ou inativa.",
          message: "Chave de robô (API Key) inválida ou inativa.",
        });
      }

      // Carregar usuário criador da chave para herdar permissões/cargo
      const user = await User.findById(apiKeyDoc.created_by);
      if (!user) {
        return res.status(401).json({
          error: "Usuário associado à chave não encontrado.",
          message: "Usuário associado à chave não encontrado.",
        });
      }

      if (user.ativo === false) {
        return res.status(403).json({
          error: "Usuário associado à chave está inativo.",
          message: "Usuário associado à chave está inativo.",
        });
      }

      const rawRole = req.body?.role;
      const parsedRole = parseRoleOr400(rawRole);
      if (parsedRole === "__invalid__") {
        return res.status(400).json({
          error: "role inválido",
          message: "role inválido",
        });
      }
      const role = parsedRole || "all";

      const instance_id = String(req.body?.instance_id || `robot-${apiKeyDoc.key_prefix || "profile"}`);
      const machine_info = typeof req.body?.machine_info === "object" && req.body?.machine_info !== null ? req.body.machine_info : {};

      const token = jwt.sign(
        {
          id: user._id,
          role: user.cargo,
          cargo: user.cargo,
          instance_id,
          isRobot: true,
          requestedBy: user._id,
        },
        process.env.JWT_SECRET || "default_jwt_secret_dev",
        { expiresIn: "30d" }
      );

      // Registra ou atualiza a instância
      await RobotInstance.findOneAndUpdate(
        { instance_id },
        {
          $set: {
            instance_id,
            status: "active",
            last_heartbeat: new Date(),
            machine_info,
            role,
          },
        },
        { upsert: true, new: true }
      );

      // Atualiza timestamp e IP do último uso da chave
      await aclDb.collection("robot_api_keys").updateOne(
        { _id: apiKeyDoc._id },
        {
          $set: {
            last_used_at: new Date(),
            last_used_ip: req.ip || req.socket?.remoteAddress || null,
          },
        }
      );

      return res.status(200).json({
        success: true,
        token,
        instance_id,
        role,
        isRobot: true,
        user: {
          id: user._id,
          nome: user.nome,
          email: user.email,
          cargo: user.cargo,
        },
      });
    }

    // 2. Fluxo legado: Autenticação via Email e Senha
    const parse = authSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: "Dados de autenticação inválidos",
        message: "Dados de autenticação inválidos",
        details: parse.error.errors,
      });
    }

    const { email, password, instance_id, machine_info, role: bodyRole } = parse.data;
    const parsedBodyRole = parseRoleOr400(bodyRole);
    if (parsedBodyRole === "__invalid__") {
      return res.status(400).json({
        error: "role inválido",
        message: "role inválido",
      });
    }
    const role = parsedBodyRole || "all";

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        error: "Credenciais inválidas.",
        message: "Credenciais inválidas.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: "Credenciais inválidas.",
        message: "Credenciais inválidas.",
      });
    }

    if (user.ativo === false) {
      return res.status(403).json({
        error: "Usuário inativo.",
        message: "Usuário inativo.",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.cargo,
        cargo: user.cargo,
        instance_id,
        isRobot: true,
        requestedBy: user._id,
      },
      process.env.JWT_SECRET || "default_jwt_secret_dev",
      { expiresIn: "30d" }
    );

    // Registra ou atualiza a instância
    await RobotInstance.findOneAndUpdate(
      { instance_id },
      {
        $set: {
          instance_id,
          status: "active",
          last_heartbeat: new Date(),
          machine_info: machine_info || {},
          role,
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      token,
      instance_id,
      role,
      isRobot: true,
      user: {
        id: user._id,
        nome: user.nome,
        email: user.email,
        cargo: user.cargo,
      },
    });
  } catch (error) {
    console.error("[authenticateInstance] Erro na autenticação:", error);
    return res.status(500).json({ error: "Erro interno no login do robô", message: error.message });
  }
};

export default authenticateInstance;
