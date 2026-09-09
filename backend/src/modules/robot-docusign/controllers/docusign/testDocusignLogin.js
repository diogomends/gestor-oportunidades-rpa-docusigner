import { z } from "zod";
import robotOrchestrator from "../../seletorApiRobot/index.js";
import robotSession from "../../browserrobot/robotSession.js";

/**
 * Esquema de validação Zod para o teste de login.
 * @constant
 * @type {import("zod").ZodOptional}
 */
const testLoginSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().optional(),
    otpCode: z
      .string()
      .regex(/^\d{6}$/, "otpCode deve conter exatamente 6 dígitos numéricos")
      .optional(),
  })
  .optional();

/**
 * Testa o login no DocuSign via Playwright utilizando credenciais salvas ou fornecidas.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const testDocusignLogin = async (req, res) => {
  let browser = null;
  try {
    const parseResult = testLoginSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Credenciais de teste inválidas",
        details: parseResult.error.errors,
      });
    }

    let credentials = parseResult.data;
    if (!credentials?.email || !credentials?.password) {
      const config = await robotOrchestrator.getRobotConfig();
      credentials = config.credentials;
    }

    if (!credentials?.email || !credentials?.password) {
      return res.status(400).json({
        error: "Credenciais não fornecidas e nenhuma credencial salva encontrada",
      });
    }

    const { chromium } = await import("playwright");
    const launchOptions = {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    };
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }
    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext();
    const page = await context.newPage();

    const sessionResult = await robotSession.getOrRefreshSession(page, context, credentials);

    await browser.close();
    browser = null;

    return res.status(200).json({
      success: true,
      message: "Login no DocuSign testado e validado com sucesso",
      refreshed: sessionResult.refreshed,
      email: credentials.email,
    });
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch (cErr) {
        // Ignora erro de fechamento
      }
    }
    if (error?.code === "MFA_REQUIRED" || error?.code === "OTP_INVALID") {
      return res.status(401).json({ error: error.code, message: error.message });
    }
    console.error("[robotDocusignController] Erro ao testar login DocuSign:", error);
    return res.status(500).json({
      error: "Erro ao testar login no DocuSign",
      message: error.message,
    });
  }
};

export const testLogin = testDocusignLogin;
export default testDocusignLogin;
