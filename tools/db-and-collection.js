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
 * Renderiza a árvore de coleções de um banco de dados no terminal.
 * @param {string} dbName - Nome do banco de dados MongoDB.
 * @param {Array<{ name: string, count: number, error?: string }>} collections - Lista de coleções e quantidades de documentos.
 * @returns {void}
 */
function renderTree(dbName, collections) {
  console.log(`\x1b[36m📂 Database: ${dbName}\x1b[0m`);

  if (!collections || collections.length === 0) {
    console.log(` └── \x1b[90m(nenhuma colecao encontrada ou sem permissao)\x1b[0m\n`);
    return;
  }

  const sortedCollections = [...collections].sort((a, b) => a.name.localeCompare(b.name));

  sortedCollections.forEach((col, index) => {
    const isLast = index === sortedCollections.length - 1;
    const prefix = isLast ? " └── " : " ├── ";
    const docText = col.count === 1 ? "documento" : "documentos";
    console.log(`${prefix}\x1b[32m📄 ${col.name}\x1b[0m \x1b[90m(${col.count} ${docText})\x1b[0m`);
  });
  console.log("");
}

/**
 * Executa o diagnóstico e listagem completa dos bancos de dados e coleções do MongoDB.
 * @async
 * @returns {Promise<void>}
 */
async function run() {
  console.log(`\x1b[1m=== RELATORIO COMPLETO DE BANCOS E COLECOES DO SERVIDOR ===\x1b[0m\n`);

  const primaryUri = process.env.MONGO_URI || process.env.MONGO_URI_CLIENT_SERVER;
  if (!primaryUri) {
    console.error("❌ Nenhuma URI de conexao com o MongoDB encontrada no .env.dev ou .env");
    process.exit(1);
  }

  const maskedUri = primaryUri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
  console.log(`Conectando ao servidor MongoDB (${maskedUri})...\n`);

  let connection;
  try {
    connection = mongoose.createConnection(primaryUri);
    await connection.asPromise();

    const client = connection.client;
    const adminDb = client.db().admin();

    let dbList = [];
    try {
      const result = await adminDb.listDatabases();
      dbList = result.databases.map((d) => d.name);
    } catch (adminErr) {
      console.warn(`\x1b[33m⚠️ Nao foi possivel listar todos os bancos via listDatabases(): ${adminErr.message}\x1b[0m`);
      dbList = ["db_crm_funil", "crm_contracts"];
    }

    for (const dbName of dbList) {
      try {
        const db = client.db(dbName);
        const collectionsList = await db.listCollections().toArray();
        const collections = [];

        for (const col of collectionsList) {
          try {
            const count = await db.collection(col.name).countDocuments();
            collections.push({ name: col.name, count });
          } catch (countErr) {
            collections.push({ name: col.name, count: 0, error: countErr.message });
          }
        }

        renderTree(dbName, collections);
      } catch (dbErr) {
        console.error(`\x1b[31m❌ Erro ao acessar banco ${dbName}: ${dbErr.message}\x1b[0m\n`);
      }
    }
  } catch (error) {
    console.error(`\x1b[31m❌ Erro de conexao ao servidor MongoDB: ${error.message}\x1b[0m\n`);
  } finally {
    if (connection) {
      await connection.close();
    }
  }

  console.log(`\x1b[1m===========================================================\x1b[0m`);
}

run().catch((err) => {
  console.error("Erro fatal na execucao:", err);
  process.exit(1);
});
