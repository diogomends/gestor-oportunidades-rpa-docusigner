import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

// Garante o carregamento correto do arquivo .env.dev ou .env a partir da raiz do projeto
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const envDevPath = path.resolve(rootDir, ".env.dev");
const envPath = path.resolve(rootDir, ".env");

if (fs.existsSync(envDevPath)) {
  dotenv.config({ path: envDevPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

/**
 * Executa a limpeza segura das coleções de contratos e envelopes no banco crm_contracts.
 * @async
 * @returns {Promise<void>}
 */
async function run() {
  console.log(`\x1b[1m=== LIMPEZA DE CONTRATOS E ENVELOPES (crm_contracts) ===\x1b[0m\n`);

  const primaryUri = process.env.MONGO_URI || process.env.MONGO_URI_CLIENT_SERVER;
  if (!primaryUri) {
    console.error("❌ Nenhuma URI de conexao com o MongoDB encontrada no .env.dev ou .env");
    process.exit(1);
  }

  const maskedUri = primaryUri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
  console.log(`Conectando ao MongoDB (${maskedUri})...\n`);

  let connection;
  try {
    connection = mongoose.createConnection(primaryUri);
    await connection.asPromise();

    const client = connection.client;
    const dbContracts = client.db("crm_contracts");

    const collectionsToClean = ["contracts", "docusign_envelopes", "client_doc_accesses"];

    console.log(`\x1b[36m📊 1. CONTAGEM ANTES DA LIMPEZA:\x1b[0m`);
    for (const colName of collectionsToClean) {
      const count = await dbContracts.collection(colName).countDocuments();
      console.log(`  - ${colName}: ${count} documentos`);
    }

    console.log(`\n\x1b[33m🧹 2. EXECUTANDO LIMPEZA...\x1b[0m`);
    for (const colName of collectionsToClean) {
      const result = await dbContracts.collection(colName).deleteMany({});
      console.log(`  - ${colName}: \x1b[32m${result.deletedCount} documentos removidos\x1b[0m`);
    }

    console.log(`\n\x1b[36m📊 3. CONTAGEM APOS A LIMPEZA:\x1b[0m`);
    for (const colName of collectionsToClean) {
      const count = await dbContracts.collection(colName).countDocuments();
      console.log(`  - ${colName}: ${count} documentos`);
    }

    console.log(`\n\x1b[32m✅ Limpeza concluida com sucesso no banco crm_contracts.\x1b[0m\n`);
  } catch (error) {
    console.error("❌ Erro durante a limpeza do banco:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

run();
