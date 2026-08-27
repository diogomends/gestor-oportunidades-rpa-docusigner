import fs from "fs";
import path from "path";
import docusign from "docusign-esign";
const {
  EnvelopesApi,
  ApiClient,
  Document,
  Signer,
  SignHere,
  Tabs,
  Recipients,
  EnvelopeDefinition,
  EventNotification,
  EnvelopeEvent,
  RecipientViewRequest,
} = docusign;

/**
 * Service responsible for interacting with the DocuSign eSignature REST API.
 * Handles JWT authentication, envelope lifecycle, recipient views, and status polling.
 */
class DocuSignService {
  /**
   * Initializes the DocuSign API client and default timeout.
   */
  constructor() {
    this.apiClient = new ApiClient();
    this.apiClient.setBasePath(
      process.env.DOCUSIGN_BASE_PATH || "https://demo.docusign.net/restapi"
    );
    // Timeout para chamadas de API (padrão de 15 segundos)
    this.apiClient.timeout = parseInt(process.env.DOCUSIGN_TIMEOUT_MS, 10) || 15000;
  }

  /**
   * Validates required environment variables and private key files for DocuSign JWT integration.
   * @returns {string[]} List of missing configuration keys or file errors.
   */
  getConfigIssues() {
    const missing = [];
    if (!process.env.DOCUSIGN_INTEGRATION_KEY)
      missing.push("DOCUSIGN_INTEGRATION_KEY");
    if (!process.env.DOCUSIGN_USER_ID) missing.push("DOCUSIGN_USER_ID");
    if (!process.env.DOCUSIGN_ACCOUNT_ID) missing.push("DOCUSIGN_ACCOUNT_ID");
    const rsaPath = path.resolve(
      process.cwd(),
      process.env.DOCUSIGN_RSA_PRIVATE_KEY_PATH || "./key/private.key"
    );
    if (!process.env.DOCUSIGN_RSA_PRIVATE_KEY_PATH)
      missing.push("DOCUSIGN_RSA_PRIVATE_KEY_PATH");
    if (!fs.existsSync(rsaPath))
      missing.push(`arquivo private.key não encontrado em: ${rsaPath}`);
    if (!process.env.DOCUSIGN_HMAC_KEY) missing.push("DOCUSIGN_HMAC_KEY");
    return missing;
  }

  /**
   * Generates the OAuth consent URL required for DocuSign JWT impersonation.
   * @returns {string} The consent authorization URL.
   * @throws {Error} If DOCUSIGN_INTEGRATION_KEY or DOCUSIGN_REDIRECT_URI is missing.
   */
  getConsentUrl() {
    const redirectUri = process.env.DOCUSIGN_REDIRECT_URI;
    const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;

    if (!integrationKey) {
      throw new Error("DOCUSIGN_INTEGRATION_KEY não configurada");
    }

    if (!redirectUri) {
      throw new Error(
        "DOCUSIGN_REDIRECT_URI não configurada. Cadastre um redirect URI no App & Keys da DocuSign e copie o mesmo valor para o .env."
      );
    }

    const baseUrl =
      process.env.DOCUSIGN_AUTH_BASE_URL ||
      "https://account-d.docusign.com/oauth/auth";
    const params = new URLSearchParams({
      response_type: "code",
      scope: "signature impersonation",
      client_id: integrationKey,
      redirect_uri: redirectUri,
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Obtains a valid JWT user access token from DocuSign and sets it on the API client.
   * @returns {Promise<string>} Bearer access token string.
   * @throws {Error} If configuration is invalid, private key is missing, or DocuSign API returns an error.
   */
  async getAccessToken() {
    try {
      const configIssues = this.getConfigIssues();
      if (configIssues.length > 0) {
        throw new Error(
          `Configuração DocuSign incompleta: ${configIssues.join(", ")}`
        );
      }

      const jwtLifeSec = 3600;
      const scopes = ["signature", "impersonation"];

      const rsaKeyPath = path.resolve(
        process.cwd(),
        process.env.DOCUSIGN_RSA_PRIVATE_KEY_PATH || "./key/private.key"
      );
      if (!fs.existsSync(rsaKeyPath)) {
        throw new Error(
          `Chave privada não encontrada no caminho: ${rsaKeyPath}`
        );
      }

      const privateKey = fs.readFileSync(rsaKeyPath);

      const results = await this.apiClient.requestJWTUserToken(
        process.env.DOCUSIGN_INTEGRATION_KEY,
        process.env.DOCUSIGN_USER_ID,
        scopes,
        privateKey,
        jwtLifeSec
      );

      const accessToken = results.body.access_token;
      this.apiClient.addDefaultHeader("Authorization", "Bearer " + accessToken);
      return accessToken;
    } catch (error) {
      console.error("Erro na autenticação JWT do DocuSign:", error);

      const apiError = error?.response?.data;
      if (
        apiError?.error === "consent_required" ||
        (apiError?.error_description &&
          apiError.error_description.includes("consent_required"))
      ) {
        throw new Error(
          "DocuSign: consent_required. O consentimento do administrador/usuário é necessário para a autenticação JWT. Acesse a URL de consentimento para conceder a permissão."
        );
      }

      if (apiError?.error === "user_not_found") {
        throw new Error(
          "DocuSign: user_not_found. Verifique se DOCUSIGN_USER_ID pertence a um usuário demo válido, se o consentimento JWT foi concedido para a integration key e se a conta DOCUSIGN_ACCOUNT_ID corresponde ao ambiente demo correto."
        );
      }

      if (apiError?.error_description) {
        throw new Error(`DocuSign: ${apiError.error_description}`);
      }

      throw error;
    }
  }

  /**
   * Creates and sends a DocuSign envelope with signer tabs, documents, and optional webhook callback.
   * @param {{ name: string, email: string, cpf?: string }} signer - Signer information.
   * @param {Array<{ name: string, path: string }>} pdfFiles - List of PDF files to attach.
   * @param {string} [callbackUrl] - Webhook URL for envelope status event notifications.
   * @returns {Promise<Object>} DocuSign EnvelopeSummary creation result.
   */
  async sendEnvelope(signer, pdfFiles, callbackUrl) {
    await this.getAccessToken();

    const envelopesApi = new EnvelopesApi(this.apiClient);

    const docs = pdfFiles.map((file, idx) => {
      const docBytes = fs.readFileSync(file.path);
      const docBase64 = Buffer.from(docBytes).toString("base64");

      const document = new Document();
      document.documentBase64 = docBase64;
      document.name = file.name;
      document.fileExtension = "pdf";
      document.documentId = String(idx + 1);
      return document;
    });

    const docusignSigner = Signer.constructFromObject({
      email: signer.email,
      name: signer.name,
      recipientId: "1",
      routingOrder: "1",
    });

    const signHere = SignHere.constructFromObject({
      anchorString: "CPF: " + signer.cpf,
      anchorYOffset: "10",
      anchorXOffset: "20",
      anchorUnits: "pixels",
      anchorIgnoreIfNotPresent: "true",
    });

    const signHereFallback = SignHere.constructFromObject({
      anchorString: signer.name,
      anchorYOffset: "-15",
      anchorXOffset: "10",
      anchorUnits: "pixels",
      anchorIgnoreIfNotPresent: "true",
    });

    const signerTabs = Tabs.constructFromObject({
      signHereTabs: [signHere, signHereFallback],
    });
    docusignSigner.tabs = signerTabs;

    const recipients = Recipients.constructFromObject({
      signers: [docusignSigner],
    });

    const envelopeDefinition = new EnvelopeDefinition();
    envelopeDefinition.emailSubject = `Assinatura de Contratos - ${signer.name}`;
    envelopeDefinition.documents = docs;
    envelopeDefinition.recipients = recipients;
    envelopeDefinition.status = "sent";

    if (callbackUrl) {
      const eventNotification = new EventNotification();
      eventNotification.url = callbackUrl;
      eventNotification.loggingEnabled = "true";
      eventNotification.requireAcknowledgment = "true";
      eventNotification.useSoapInterface = "false";
      eventNotification.includeCertificateWithSoap = "false";
      eventNotification.signMessageWithX509Cert = "false";
      eventNotification.includeDocuments = "true";
      eventNotification.includeEnvelopeVoidReason = "true";
      eventNotification.includeTimeZone = "true";
      eventNotification.includeSenderAccountAsHeader = "true";
      eventNotification.includeDocumentFields = "true";

      const envelopeEvents = [
        { envelopeEventStatusCode: "sent" },
        { envelopeEventStatusCode: "delivered" },
        { envelopeEventStatusCode: "completed" },
        { envelopeEventStatusCode: "declined" },
        { envelopeEventStatusCode: "voided" },
      ].map((evt) => EnvelopeEvent.constructFromObject(evt));

      eventNotification.envelopeEvents = envelopeEvents;
      envelopeDefinition.eventNotification = eventNotification;
    }

    const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    const results = await envelopesApi.createEnvelope(accountId, {
      envelopeDefinition,
    });
    return results;
  }

  /**
   * Retrieves current status and details of a DocuSign envelope.
   * @param {string} envelopeId - DocuSign Envelope ID.
   * @returns {Promise<Object>} DocuSign Envelope details.
   */
  async getEnvelopeStatus(envelopeId) {
    await this.getAccessToken();
    const envelopesApi = new EnvelopesApi(this.apiClient);
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    return await envelopesApi.getEnvelope(accountId, envelopeId);
  }

  /**
   * Downloads the combined signed documents for an envelope.
   * @param {string} envelopeId - DocuSign Envelope ID.
   * @returns {Promise<Buffer|string>} Combined document buffer/content.
   */
  async getSignedDocuments(envelopeId) {
    await this.getAccessToken();
    const envelopesApi = new EnvelopesApi(this.apiClient);
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    return await envelopesApi.getDocument(accountId, envelopeId, "combined");
  }

  /**
   * Resends notification emails to current envelope recipients.
   * @param {string} envelopeId - DocuSign Envelope ID.
   * @returns {Promise<Object>} DocuSign updateRecipients response.
   */
  async resendEnvelope(envelopeId) {
    try {
      console.log(`[DocuSign Service] Resending envelope notification. EnvelopeId: ${envelopeId}`);
      await this.getAccessToken();
      const envelopesApi = new EnvelopesApi(this.apiClient);
      const accountId = process.env.DOCUSIGN_ACCOUNT_ID;

      console.log(`[DocuSign Service] Fetching current recipients for EnvelopeId: ${envelopeId}`);
      const recipients = await envelopesApi.listRecipients(accountId, envelopeId);

      console.log(`[DocuSign Service] Executing updateRecipients with recipients body and resendEnvelope=true for AccountId: ${accountId}`);
      const result = await envelopesApi.updateRecipients(accountId, envelopeId, {
        recipients,
        resendEnvelope: 'true',
      });
      console.log(`[DocuSign Service] Resend envelope succeeded. Result:`, JSON.stringify(result || {}));
      return result;
    } catch (error) {
      console.error(`[DocuSign Service] Error resending envelope ${envelopeId}:`, error?.response?.data || error?.message || error);
      throw error;
    }
  }

  /**
   * Generates an embedded recipient signing URL (embedded view).
   * @param {string} envelopeId - DocuSign Envelope ID.
   * @param {{ clientUserId?: string, name: string, email: string, returnUrl: string }} recipientParams - Recipient view parameters.
   * @returns {Promise<string>} Embedded signing view URL.
   */
  async getRecipientViewUrl(envelopeId, recipientParams) {
    await this.getAccessToken();
    const envelopesApi = new EnvelopesApi(this.apiClient);
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID;

    const recipientViewRequest = new RecipientViewRequest();
    recipientViewRequest.authenticationMethod = "Password";
    recipientViewRequest.clientUserId = recipientParams.clientUserId || "1";
    recipientViewRequest.recipientId = "1";
    recipientViewRequest.userName = recipientParams.name;
    recipientViewRequest.email = recipientParams.email;
    recipientViewRequest.returnUrl = recipientParams.returnUrl;

    const results = await envelopesApi.createRecipientView(
      accountId,
      envelopeId,
      { recipientViewRequest }
    );
    return results.url;
  }
}

export default new DocuSignService();
