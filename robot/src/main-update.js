/**
 * Entrypoint dedicado para o robô de Atualização/Envio (update).
 * Wrapper 3L que define ROBOT_ROLE e delega para main.js
 */
process.env.ROBOT_ROLE = "update";
await import("./main.js");
