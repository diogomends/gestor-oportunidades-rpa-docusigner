/**
 * Entrypoint dedicado para o robô de Consulta (query).
 * Wrapper 3L que define ROBOT_ROLE e delega para main.js
 */
process.env.ROBOT_ROLE = "query";
await import("./main.js");
