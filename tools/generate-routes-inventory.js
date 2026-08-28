#!/usr/bin/env node

/**
 * Gerador automático de inventário de rotas HTTP para o gestor-oportunidades-rpa-docusigner.
 *
 * Uso:
 *   node tools/generate-routes-inventory.js          # gera e grava em .specs/routes-inventory.md
 *   node tools/generate-routes-inventory.js --check  # apenas valida conformidade
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SPEC_FILE = path.join(ROOT, ".specs", "routes-inventory.md");
const CHECK = process.argv.includes("--check");

/**
 * Lê o conteúdo de um arquivo relativo à raiz do projeto.
 * @param {string} rel - Caminho relativo do arquivo.
 * @returns {string} Conteúdo em texto.
 */
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

/**
 * Descrições e observações mapeadas para cada endpoint da aplicação.
 * @type {Record<string, { desc: string, obs?: string }>}
 */
const ROUTE_METADATA = {
  "GET /health": {
    desc: "Health check",
    obs: "Fora do prefixo /api/robot-docusign",
  },
  "POST /api/robot-docusign/trigger": {
    desc: "Dispara job individual (body: contractId/contract_id)",
    obs: "HTTP 202, job criado em background",
  },
  "POST /api/robot-docusign/trigger-batch": {
    desc: "Dispara jobs em lote",
    obs: "body `{ contractIds: [] }`",
  },
  "GET /api/robot-docusign/status/:jobId": {
    desc: "Status de um job (por _id ou contract_id)",
    obs: "Busca $or: _id/contract_id/contractId",
  },
  "GET /api/robot-docusign/jobs/:jobId/stream": {
    desc: "SSE stream de progresso do job",
    obs: "token via ?token= para EventSource",
  },
  "GET /api/robot-docusign/jobs": {
    desc: "Lista jobs (filtros + paginação)",
    obs: "query: status, action, mode, contractId, page, limit",
  },
  "GET /api/robot-docusign/metrics": {
    desc: "Métricas agregadas",
    obs: "totalJobs, successRate, byMode, byAction",
  },
  "GET /api/robot-docusign/logs/:jobId": {
    desc: "Logs detalhados de um job",
    obs: "steps, error, attempts",
  },
  "GET /api/robot-docusign/config": {
    desc: "Buscar config do robô",
    obs: "Qualquer usuário autenticado",
  },
  "PUT /api/robot-docusign/config": {
    desc: "Atualizar config do robô",
    obs: "body: enabled, mode, credentials, token_notification_email, limits, retry",
  },
  "POST /api/robot-docusign/test-login": {
    desc: "Testa login no DocuSign",
    obs: "body opcional: email, password, otpCode (6 dígitos)",
  },
  "GET /api/robot-docusign/queue": {
    desc: "Fila de jobs pendentes/em processamento",
    obs: "status in [pending, processing, running, retrying]",
  },
  "POST /api/robot-docusign/process-pending": {
    desc: "Processa até 1 contrato pendente",
    obs: "Scheduler manual, respeita enabled/horário",
  },
  "GET /api/robot-docusign/instances": {
    desc: "Lista instâncias do robô (fleet monitoring)",
    obs: "Alias de /instance/instances",
  },
  "POST /api/robot-docusign/instance/auth": {
    desc: "Autenticação da instância",
    obs: "X-Robot-Key ou email/senha → JWT 30d + instance_id",
  },
  "GET /api/robot-docusign/instance/instances": {
    desc: "Lista instâncias (via sub-router)",
    obs: "Duplicata de /instances",
  },
  "GET /api/robot-docusign/instance/config": {
    desc: "Config da instância",
    obs: "Usado pelo robô .exe",
  },
  "GET /api/robot-docusign/instance/next-job": {
    desc: "Próximo job pendente (polling do robô)",
    obs: "Lock atômico locked_by/lock_expires_at",
  },
  "PATCH /api/robot-docusign/instance/job/:jobId/status": {
    desc: "Atualiza status do job",
    obs: "Reporta progresso do robô",
  },
  "POST /api/robot-docusign/instance/heartbeat": {
    desc: "Heartbeat da instância",
    obs: "Mantém instância viva",
  },
  "GET /api/robot-docusign/instance/contracts/:contractId/pdf": {
    desc: "Download de PDF do contrato",
    obs: "Usado pelo robô para upload DocuSign",
  },
};

/**
 * Extrai o modificador de autenticação para a rota a partir do código fonte.
 * @param {string} code - Código fonte da rota.
 * @param {number} matchIndex - Posição do início da rota.
 * @param {boolean} routerHasProtect - Se o router possui `router.use(protect)` ativo.
 * @returns {string} Nível de auth formatado (Público, protect, protect + authorize("admin")).
 */
function extractAuthForRoute(code, matchIndex, routerHasProtect = false) {
  const snippet = code.substring(matchIndex, matchIndex + 300);
  const callEnd = snippet.indexOf(")");
  const callText = callEnd !== -1 ? snippet.substring(0, callEnd + 1) : snippet;

  const parts = [];

  if (routerHasProtect || /\b(?:protect|authMiddleware)\b/.test(callText)) {
    parts.push("protect");
  }

  const authMatch = callText.match(/(?:authorize|roleMiddleware)\(([^)]+)\)/);
  if (authMatch) {
    parts.push(`authorize(${authMatch[1]})`);
  }

  return parts.length === 0 ? "Público" : parts.join(" + ");
}

/**
 * Realiza o parse das rotas declaradas nos arquivos Express do backend.
 * @param {string} filePath - Caminho relativo do arquivo.
 * @param {string} prefix - Prefixo base da rota.
 * @returns {Array<{ method: string, path: string, auth: string, file: string }>} Lista de rotas extraídas.
 */
function parseRoutesFromFile(filePath, prefix = "") {
  const code = read(filePath);
  const routes = [];
  const normalized = filePath.replace(/\\/g, "/");

  const lines = code.split("\n");
  const getLineNum = (index) => code.substring(0, index).split("\n").length;

  const re = /(?:router|app)\.(get|post|put|patch|delete)\(\s*["`']([^"`']*)["`']/g;
  let m;

  while ((m = re.exec(code)) !== null) {
    const method = m[1].toUpperCase();
    const routePath = m[2];
    const lineNum = getLineNum(m.index);

    let hasProtectBefore = false;
    const codeBefore = code.substring(0, m.index);
    if (/router\.use\(\s*protect\s*\)/.test(codeBefore)) {
      hasProtectBefore = true;
    }

    const auth = extractAuthForRoute(code, m.index, hasProtectBefore);
    const fullPath = (prefix + (routePath === "/" ? "" : routePath)) || "/";

    routes.push({
      method,
      path: fullPath,
      auth,
      file: `${normalized}:${lineNum}`,
    });
  }

  return routes;
}

/**
 * Gera a especificação em markdown do inventário de rotas HTTP.
 * @param {Array<{ method: string, path: string, auth: string, file: string }>} routes - Lista de rotas inventariadas.
 * @returns {string} Markdown gerado.
 */
function generateMarkdown(routes) {
  const lines = [];
  lines.push("# Inventário de Rotas HTTP (REST) — gestor-oportunidades-rpa-docusigner");
  lines.push("");
  lines.push("> **Fonte da verdade:** `backend/src/app.js`, `backend/src/modules/robot-docusign/routes.js`, `backend/src/modules/robot-docusign/routes/robotInstanceRoutes.js`");
  lines.push(`> Atualizado em: ${new Date().toISOString().split("T")[0]}`);
  lines.push("");
  lines.push("## Registros");
  lines.push("");
  lines.push("| Método | Path completo | Descrição curta | Auth | Arquivo:linha | Observação |");
  lines.push("|--------|---------------|-----------------|------|---------------|------------|");

  for (const route of routes) {
    const meta = ROUTE_METADATA[`${route.method} ${route.path}`] || { desc: "—", obs: "—" };
    lines.push(`| ${route.method} | \`${route.path}\` | ${meta.desc} | ${route.auth} | \`${route.file}\` | ${meta.obs || "—"} |`);
  }

  lines.push("");
  lines.push("## Legenda");
  lines.push("");
  lines.push("| Notação | Significado |");
  lines.push("|---------|-------------|");
  lines.push("| Público | Sem autenticação JWT |");
  lines.push("| protect | Requer JWT válido via authMiddleware.protect (Bearer ou ?token= para SSE) |");
  lines.push("| protect + authorize(\"admin\") | JWT + role admin |");
  lines.push("");
  lines.push("## Observações");
  lines.push("");
  lines.push("1. `/api/robot-docusign/instances` e `/api/robot-docusign/instance/instances` apontam para o mesmo handler `getAllInstances` (duplicata intencional).");
  lines.push("2. `GET /jobs/:jobId/stream` aceita token via query `?token=` para compatibilidade com EventSource.");
  lines.push("3. `GET /health` é a única rota fora do prefixo `/api/robot-docusign`.");
  lines.push("4. O robô `.exe` faz polling em `GET /instance/next-job`, não em `GET /queue` (este é para debug/frontend).");
  lines.push("");

  const prefixCount = routes.filter((r) => r.path.startsWith("/api/robot-docusign")).length;
  const otherCount = routes.length - prefixCount;

  lines.push("## Resumo");
  lines.push("");
  lines.push(`- **Prefixo /api/robot-docusign:** ${prefixCount} endpoints`);
  lines.push(`- **Fora do prefixo:** ${otherCount} endpoint (/health)`);
  lines.push(`- **Total:** ${routes.length} endpoints`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Função principal de orquestração do gerador de inventário.
 * @returns {void}
 */
function main() {
  const routes = [];

  // 1. Root / health
  if (fs.existsSync(path.join(ROOT, "backend", "src", "app.js"))) {
    routes.push(...parseRoutesFromFile("backend/src/app.js", ""));
  }

  // 2. /api/robot-docusign
  if (fs.existsSync(path.join(ROOT, "backend", "src", "modules", "robot-docusign", "routes.js"))) {
    routes.push(...parseRoutesFromFile("backend/src/modules/robot-docusign/routes.js", "/api/robot-docusign"));
  }

  // 3. /api/robot-docusign/instance
  if (fs.existsSync(path.join(ROOT, "backend", "src", "modules", "robot-docusign", "routes", "robotInstanceRoutes.js"))) {
    routes.push(...parseRoutesFromFile("backend/src/modules/robot-docusign/routes/robotInstanceRoutes.js", "/api/robot-docusign/instance"));
  }

  const markdown = generateMarkdown(routes);

  if (CHECK) {
    if (!fs.existsSync(SPEC_FILE)) {
      console.error("ERRO: .specs/routes-inventory.md nao existe.");
      process.exit(1);
    }
    const existing = fs.readFileSync(SPEC_FILE, "utf-8");
    // Normaliza datas antes de checar se necessário ou compara estrutura
    if (existing.trim() === markdown.trim()) {
      console.log("OK: inventario de rotas esta atualizado.");
      process.exit(0);
    } else {
      console.error("ERRO: inventario de rotas desatualizado. Rode `make routes-inventory` para atualizar.");
      process.exit(1);
    }
  }

  if (!fs.existsSync(path.join(ROOT, ".specs"))) {
    fs.mkdirSync(path.join(ROOT, ".specs"), { recursive: true });
  }

  fs.writeFileSync(SPEC_FILE, markdown, "utf-8");
  console.log(`Inventario de rotas gerado com sucesso: ${routes.length} endpoints -> .specs/routes-inventory.md`);
}

main();
