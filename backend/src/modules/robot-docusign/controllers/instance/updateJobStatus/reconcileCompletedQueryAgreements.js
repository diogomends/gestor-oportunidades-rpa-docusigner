/**
 * @file Helper atômico para reconciliação em lote de acordos DocuSign pós execução do job query_agreements.
 */

import { z } from "zod";
import Contract from "../../../../../models/Contract.js";
import { syncContractStatus } from "../../../seletorApiRobot/contractSyncService.js";
import { mapEnvelopeStatusToContractStatus } from "../../../seletorApiRobot/statusSyncScheduler.js";
import { matchContractWithEnvelope } from "../../../seletorApiRobot/contractEnvelopeMatcher.js";

/**
 * Reconcilia acordos em lote quando a ação for query_agreements.
 *
 * @param {Array<object>} rawEnvelopes - Lista de envelopes recebidos do robô.
 * @returns {Promise<void>}
 * @async
 */
export async function reconcileCompletedQueryAgreements(rawEnvelopes) {
  try {
    const envelopesSchema = z.array(
      z.object({
        envelopeId: z.string().optional(),
        status: z.string().optional(),
        recipient: z.string().optional(),
        statusDetail: z.string().optional(),
        pendingSigner: z.string().optional(),
        rawStatus: z.string().optional(),
      }).passthrough()
    );
    const parsed = envelopesSchema.safeParse(rawEnvelopes);
    if (!parsed.success || parsed.data.length === 0) return;

    const envelopes = parsed.data;
    const activeContracts = await Contract.find({ status: { $in: ["enviado", "gerado"] } }).lean();

    for (const contract of activeContracts) {
      const cId = contract._id.toString();
      const storedEnvelopeId = contract.envelopeId || contract.docusign_envelope_id;
      // Delega o cruzamento contrato↔envelope ao matcher canônico (DRY — paridade com a varredura)
      const matched = matchContractWithEnvelope(contract, envelopes);
      if (!matched) continue;
      const targetStatus = mapEnvelopeStatusToContractStatus(matched.status || "");
      if (!targetStatus) {
        if (matched.envelopeId && !storedEnvelopeId) {
          await Contract.findByIdAndUpdate(cId, { envelopeId: matched.envelopeId }).catch(() => {});
        }
        continue;
      }
      const extraUpdate = {
        envelopeId: matched.envelopeId,
        pendingSigner: matched.pendingSigner || null,
        docusignStatusDetail: matched.statusDetail || matched.rawStatus || null,
        rawDocusignStatus: matched.rawStatus || null,
      };
      const isStatusChanged = targetStatus !== contract.status;
      const isSignerChanged = (matched.pendingSigner && matched.pendingSigner !== contract.pendingSigner);
      const isDetailChanged = (matched.statusDetail && matched.statusDetail !== contract.docusignStatusDetail);
      const isEnvelopeNew = (matched.envelopeId && !storedEnvelopeId);

      if (isStatusChanged || isSignerChanged || isDetailChanged || isEnvelopeNew) {
        await syncContractStatus(cId, targetStatus, extraUpdate).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("[reconcileCompletedQueryAgreements] Falha na reconciliação batch query_agreements:", e.message);
  }
}

/** Alias retrocompatível */
export const reconcileAgreementsBatch = reconcileCompletedQueryAgreements;

export default reconcileCompletedQueryAgreements;
