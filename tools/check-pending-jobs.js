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
 * Filtro de contratos 'gerado' elegíveis para envio (com PDF e e-mail).
 * @constant
 * @type {object}
 */
const GERADO_ELIGIBLE_FILTER = {
  status: "gerado",
  "documents.originalUrl": { $exists: true, $ne: null, $ne: "" },
  $or: [
    { "client.representante.email": { $exists: true, $ne: null, $ne: "" } },
    { "signer.email": { $exists: true, $ne: null, $ne: "" } },
    { email: { $exists: true, $ne: null, $ne: "" } },
    { clientEmail: { $exists: true, $ne: null, $ne: "" } },
  ],
};

/**
 * Consulta e exibe o estado atual da fila de jobs e contratos elegíveis no MongoDB.
 * @async
 * @returns {Promise<void>}
 */
async function run() {
  console.log(`\x1b[1m=== DIAGNÓSTICO DE JOBS E CONTRATOS PENDENTES (ROBÔ DOCUSIGN) ===\x1b[0m\n`);

  const primaryUri = process.env.MONGO_URI || process.env.MONGO_URI_CLIENT_SERVER;
  if (!primaryUri) {
    console.error("❌ Nenhuma URI de conexão com o MongoDB encontrada no .env.dev ou .env");
    process.exit(1);
  }

  const maskedUri = primaryUri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
  console.log(`Conectando ao MongoDB (${maskedUri})...\n`);

  let connection;
  try {
    connection = mongoose.createConnection(primaryUri);
    await connection.asPromise();

    const client = connection.client;
    const dbFunil = client.db("db_crm_funil");
    const dbContracts = client.db("crm_contracts");

    // 1. Configuração do Robô
    console.log(`\x1b[36m⚙️  1. CONFIGURAÇÃO GERAL DO ROBÔ (db_crm_funil.systemconfigs)\x1b[0m`);
    const configDoc = await dbFunil.collection("systemconfigs").findOne({ key: "robot_docusign" });
    if (configDoc && configDoc.value) {
      const { enabled, mode, pollIntervalSeconds, autoTriggerOnContractCreated } = configDoc.value;
      console.log(`  - Robô Ativo: ${enabled ? "\x1b[32mSIM\x1b[0m" : "\x1b[31mNÃO\x1b[0m"}`);
      console.log(`  - Modo de Envio: \x1b[33m${mode || "robot"}\x1b[0m`);
      console.log(`  - Intervalo de Polling: ${pollIntervalSeconds || 15}s`);
      console.log(`  - Disparo Automático: ${autoTriggerOnContractCreated ? "Ativo" : "Desativado"}`);
    } else {
      console.log(`  \x1b[90m(Configuração 'robot_docusign' não encontrada no banco. Usando padrões.)\x1b[0m`);
    }
    console.log("");

    // 2. Fila de Jobs (robot_jobs)
    console.log(`\x1b[36m📋 2. FILA DE EXECUÇÃO (crm_contracts.robot_jobs)\x1b[0m`);
    const pendingJobs = await dbContracts
      .collection("robot_jobs")
      .find({ status: { $in: ["pending", "retrying", "processing"] } })
      .sort({ createdAt: 1 })
      .toArray();

    if (pendingJobs.length === 0) {
      console.log(`  \x1b[32m✓ Nenhum job pendente ou em execução na fila robot_jobs.\x1b[0m`);
    } else {
      console.log(`  \x1b[33m⚠️ Encontrados ${pendingJobs.length} job(s) em andamento:\x1b[0m`);
      pendingJobs.forEach((j, idx) => {
        console.log(
          `  ${idx + 1}. ID: \x1b[35m${j._id}\x1b[0m | Contrato: \x1b[34m${j.contract_id || j.contractId}\x1b[0m | Status: \x1b[33m${j.status}\x1b[0m | Ação: ${j.action || "send"} | Travado por: ${j.locked_by || "nenhum"}`
        );
      });
    }
    console.log("");

    // 3. Contratos com Status 'gerado' e Elegibilidade
    console.log(`\x1b[36m📄 3. CONTRATOS GERADOS AGUARDANDO ENVIO (crm_contracts.contracts)\x1b[0m`);
    const allGerados = await dbContracts
      .collection("contracts")
      .find({ status: "gerado" })
      .sort({ createdAt: 1 })
      .toArray();

    const eligibleContracts = await dbContracts
      .collection("contracts")
      .find(GERADO_ELIGIBLE_FILTER)
      .sort({ createdAt: 1 })
      .toArray();

    if (allGerados.length === 0) {
      console.log(`  \x1b[32m✓ Nenhum contrato com status 'gerado' no banco.\x1b[0m`);
    } else {
      console.log(`  Total de contratos com status 'gerado': \x1b[33m${allGerados.length}\x1b[0m`);
      console.log(`  Contratos elegíveis (com PDF + e-mail prontos para o robô): \x1b[32m${eligibleContracts.length}\x1b[0m\n`);

      allGerados.forEach((c, idx) => {
        const hasPdfDoc = Array.isArray(c.documents) && c.documents.some((d) => d?.originalUrl && String(d.originalUrl).trim().length > 0);
        const recipientEmail =
          c?.client?.representante?.email || c?.signer?.email || c?.email || c?.clientEmail || "";
        const isEligible = hasPdfDoc && recipientEmail.trim().length > 0;

        const icon = isEligible ? "\x1b[32m✓ [ELEGÍVEL]\x1b[0m" : "\x1b[31m✗ [INCOMPLETO]\x1b[0m";
        const title = c.name || c.clientName || c.client?.razaoSocial || "Contrato sem título";

        console.log(`  ${idx + 1}. ${icon} ID: \x1b[35m${c._id}\x1b[0m - ${title}`);
        console.log(`     - PDF anexado: ${hasPdfDoc ? "\x1b[32mSIM\x1b[0m" : "\x1b[31mNÃO\x1b[0m"}`);
        console.log(`     - E-mail destinatário: ${recipientEmail ? `\x1b[32m${recipientEmail}\x1b[0m` : "\x1b[31m(Vazio)\x1b[0m"}`);
      });
    }
    console.log("");

    // 4. Instâncias do Robô Conectadas
    console.log(`\x1b[36m🤖 4. INSTÂNCIAS REGISTRADAS DO ROBÔ (crm_contracts.robot_instances)\x1b[0m`);
    const instances = await dbContracts
      .collection("robot_instances")
      .find({})
      .sort({ last_heartbeat: -1 })
      .limit(5)
      .toArray();

    if (instances.length === 0) {
      console.log(`  \x1b[90m(Nenhuma instância registrada recentemente)\x1b[0m`);
    } else {
      instances.forEach((inst, idx) => {
        const diffSeconds = inst.last_heartbeat ? Math.round((Date.now() - new Date(inst.last_heartbeat).getTime()) / 1000) : null;
        const statusColor = diffSeconds !== null && diffSeconds < 60 ? "\x1b[32mONLINE\x1b[0m" : "\x1b[90mOFFLINE\x1b[0m";
        console.log(
          `  ${idx + 1}. [${statusColor}] ID: \x1b[35m${inst.instance_id}\x1b[0m | Host: ${inst.hostname || "N/A"} | Último Heartbeat: ${diffSeconds !== null ? `${diffSeconds}s atrás` : "Nunca"}`
        );
      });
    }
  } catch (error) {
    console.error(`\x1b[31m❌ Erro durante a consulta: ${error.message}\x1b[0m\n`);
  } finally {
    if (connection) {
      await connection.close();
    }
  }

  console.log(`\n\x1b[1m===================================================================\x1b[0m`);
}

run().catch((err) => {
  console.error("Erro fatal na execução:", err);
  process.exit(1);
});
