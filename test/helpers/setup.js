import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");

// ponytail: carrega .env.dev se existir, senão .env.example; nunca commita segredo
const candidates = [
  path.join(rootDir, ".env.dev"),
  path.join(rootDir, ".env"),
  path.join(rootDir, ".env.example"),
];

for (const p of candidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: false });
    break;
  }
}

// Defaults seguros para testes — sobrescreve apenas se não vier do .env.dev
process.env.JWT_SECRET ??= "test_secret_key";
process.env.GESTOR_API_URL ??= "http://localhost:3000/api";
process.env.ROBOT_API_KEY ??= "test_robot_api_key_123";
process.env.MONGO_URI ??= "mongodb://127.0.0.1:27017/db_crm_funil_test";
process.env.MONGO_CONTRACTS_URI ??= "mongodb://127.0.0.1:27017/crm_contracts_test";
