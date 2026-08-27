/**
 * @file imapClient.test.js
 * @description Testes unitários e de integração do cliente IMAP nativo.
 * Reutiliza a suíte única de testes localizada no módulo robot/src/browser/imapClient.test.js
 * para garantir integridade e evitar drift entre os ambientes (PonyTail M3).
 * ponytail: path relativo frágil — mover robot/src/browser/imapClient.test.js quebra este import; atualizar ambos.
 */

import "../../../../../robot/src/browser/imapClient.test.js";

