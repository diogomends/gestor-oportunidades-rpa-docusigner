/**
 * @file env.js
 * @description Helpers de ambiente para testes — centraliza defaults e evita hardcode de segredos.
 */
export const TEST_JWT_SECRET = process.env.JWT_SECRET || "test_secret_key";
export const TEST_GESTOR_API_URL = process.env.GESTOR_API_URL || "http://localhost:3000/api";
export const TEST_ROBOT_API_KEY = process.env.ROBOT_API_KEY || "test_robot_api_key_123";
export const TEST_EMAIL = process.env.TEST_EMAIL || "test@example.com";
export const TEST_IMAP_EMAIL = process.env.TEST_IMAP_EMAIL || "test@example.com";
export const TEST_IMAP_HOST = process.env.TEST_IMAP_HOST || "127.0.0.1";
