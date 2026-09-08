import path from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import mongoose from "mongoose";
import Contract from "../../../../models/Contract.js";
import gestorApiClient from "../../../../services/gestorApiClient.js";

/**
 * Faz stream do arquivo PDF do contrato para o robô anexar na automação DocuSign.
 * Prioriza leitura em disco local/volume Docker compartilhado (/app/uploads) e utiliza fallback HTTP via Gestor API.
 *
 * @async
 * @param {import("express").Request} req - Requisição Express (params contractId).
 * @param {import("express").Response} res - Resposta Express.
 * @returns {Promise<void|import("express").Response>} Pipe do PDF ou JSON com status 400/404/500.
 */
export const downloadContractPdf = async (req, res) => {
  try {
    const { contractId } = req.params;
    if (!contractId || !mongoose.Types.ObjectId.isValid(contractId)) {
      return res.status(400).json({
        error: "ID de contrato inválido",
        message: "ID de contrato inválido",
      });
    }

    const contract = await Contract.findById(contractId).lean();
    if (!contract) {
      return res.status(404).json({
        error: "Contrato não encontrado.",
        message: "Contrato não encontrado.",
      });
    }

    if (!contract.documents || contract.documents.length === 0) {
      return res.status(404).json({
        error: "Nenhum documento encontrado para este contrato.",
        message: "Nenhum documento encontrado para este contrato.",
      });
    }

    const doc = contract.documents.find((d) => d.originalUrl) || contract.documents[0];
    const originalUrl = doc.originalUrl || "";
    const cleanUrl = originalUrl.startsWith("/") ? originalUrl.slice(1) : originalUrl;

    // 1. Resolução em disco local (prioritária via volume compartilhado /app/uploads ou local)
    const candidatePaths = [
      path.resolve(process.cwd(), cleanUrl),
      path.resolve("/app", cleanUrl),
      path.resolve(process.cwd(), "uploads", cleanUrl.replace(/^uploads[\\/]/, "")),
      path.resolve("/app/uploads", cleanUrl.replace(/^uploads[\\/]/, "")),
    ];

    for (const filePath of candidatePaths) {
      if (fs.existsSync(filePath)) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="contrato_${contractId}.pdf"`);
        const fileStream = fs.createReadStream(filePath);
        return await pipeline(fileStream, res).catch((pipeErr) => {
          if (!res.headersSent) {
            console.warn(`[downloadContractPdf] Erro no pipeline do arquivo ${filePath}:`, pipeErr.message);
          }
        });
      }
    }

    // 2. Fallback resiliente: Busca stream HTTP via GestorApiClient
    if (originalUrl) {
      try {
        const fetchRes = await gestorApiClient.downloadContractDocumentStream(originalUrl);
        if (fetchRes.ok && fetchRes.body) {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="contrato_${contractId}.pdf"`);
          const webStream = Readable.fromWeb(fetchRes.body);
          return await pipeline(webStream, res).catch((pipeErr) => {
            if (!res.headersSent) {
              console.warn(`[downloadContractPdf] Erro no pipeline HTTP para ${originalUrl}:`, pipeErr.message);
            }
          });
        }
      } catch (streamErr) {
        console.warn(`[downloadContractPdf] Fallback HTTP falhou para ${originalUrl}:`, streamErr.message);
      }
    }

    return res.status(404).json({
      error: "Arquivo PDF não encontrado no disco do servidor nem via fallback HTTP.",
      message: "Arquivo PDF não encontrado no disco do servidor nem via fallback HTTP.",
    });
  } catch (error) {
    console.error("[downloadContractPdf] Erro ao servir PDF:", error);
    return res.status(500).json({ error: "Erro ao baixar PDF", message: error.message });
  }
};

export default downloadContractPdf;
