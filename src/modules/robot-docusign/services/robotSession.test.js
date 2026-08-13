import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import RobotSession from "../models/RobotSession.js";
import {
  saveSession,
  getSession,
  isSessionValid,
  applySessionToContext,
  loginAndSaveSession,
  getOrRefreshSession,
  invalidateSession,
} from "./robotSession.js";

describe("robotSession Service", () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe("saveSession", () => {
    it("should save and update session cookies in MongoDB via upsert", async () => {
      const email = "user@example.com";
      const cookies = [{ name: "session_id", value: "12345", domain: "docusign.com" }];
      const options = {
        userAgent: "Mozilla/5.0 Test",
        expiresAt: new Date(Date.now() + 3600000),
      };

      const expectedDoc = {
        email,
        cookies,
        userAgent: options.userAgent,
        expiresAt: options.expiresAt,
      };

      mock.method(RobotSession, "findOneAndUpdate", async (query, update, opts) => {
        assert.deepStrictEqual(query, { email });
        assert.strictEqual(update.email, email);
        assert.deepStrictEqual(update.cookies, cookies);
        assert.strictEqual(opts.upsert, true);
        assert.strictEqual(opts.new, true);
        return expectedDoc;
      });

      const result = await saveSession(email, cookies, options);
      assert.deepStrictEqual(result, expectedDoc);
    });

    it("should throw error if email is missing", async () => {
      await assert.rejects(
        async () => {
          await saveSession("", []);
        },
        {
          name: "Error",
          message: "Email is required to save session",
        }
      );
    });
  });

  describe("getSession and isSessionValid", () => {
    it("should return null for getSession when email is missing or empty", async () => {
      const result = await getSession("");
      assert.strictEqual(result, null);
    });

    it("should find session by email", async () => {
      const mockDoc = { email: "user@example.com", cookies: [{ name: "c1", value: "v1" }] };
      mock.method(RobotSession, "findOne", async (query) => {
        assert.strictEqual(query.email, "user@example.com");
        return mockDoc;
      });

      const session = await getSession("user@example.com");
      assert.deepStrictEqual(session, mockDoc);
    });

    it("should validate active unexpired session correctly", () => {
      const validSession = {
        cookies: [{ name: "auth", value: "token" }],
        expiresAt: new Date(Date.now() + 100000),
      };
      assert.strictEqual(isSessionValid(validSession), true);
    });

    it("should return false for expired session", () => {
      const expiredSession = {
        cookies: [{ name: "auth", value: "token" }],
        expiresAt: new Date(Date.now() - 100000),
      };
      assert.strictEqual(isSessionValid(expiredSession), false);
    });

    it("should return false for null/empty session or session without cookies", () => {
      assert.strictEqual(isSessionValid(null), false);
      assert.strictEqual(isSessionValid({}), false);
      assert.strictEqual(isSessionValid({ cookies: [] }), false);
    });
  });

  describe("applySessionToContext", () => {
    it("should call context.addCookies with saved cookies", async () => {
      let addedCookies = null;
      const mockContext = {
        addCookies: async (cookies) => {
          addedCookies = cookies;
        },
      };
      const session = {
        cookies: [{ name: "auth_cookie", value: "abc" }],
      };

      const success = await applySessionToContext(mockContext, session);
      assert.strictEqual(success, true);
      assert.deepStrictEqual(addedCookies, session.cookies);
    });

    it("should return false if session has no cookies", async () => {
      const mockContext = {
        addCookies: async () => {},
      };
      const success = await applySessionToContext(mockContext, null);
      assert.strictEqual(success, false);
    });

    it("should throw error if context is invalid", async () => {
      await assert.rejects(
        async () => {
          await applySessionToContext(null, { cookies: [] });
        },
        {
          name: "Error",
          message: "Invalid browser context provided",
        }
      );
    });
  });

  describe("loginAndSaveSession", () => {
    it("should perform Playwright login flow, capture cookies and save session to DB", async () => {
      const actions = [];
      const mockPage = {
        goto: async (url) => actions.push(`goto:${url}`),
        fill: async (selector, value) => actions.push(`fill:${selector}:${value}`),
        click: async (selector) => actions.push(`click:${selector}`),
        evaluate: async () => "MockUserAgent/1.0",
      };

      const mockCookies = [{ name: "docusign_session", value: "secret" }];
      const mockContext = {
        cookies: async () => mockCookies,
      };

      const credentials = { email: "robot@docusign.com", password: "SecretPassword123" };
      const customSelectors = {
        email: "#email-input",
        password: "#pass-input",
        submitButton: "#btn-submit",
        loginUrl: "https://account.docusign.com/login",
      };

      let savedSessionArgs = null;
      mock.method(RobotSession, "findOneAndUpdate", async (query, update, opts) => {
        savedSessionArgs = { query, update, opts };
        return { ...update };
      });

      const result = await loginAndSaveSession(mockPage, mockContext, credentials, customSelectors);

      assert.deepStrictEqual(actions, [
        "goto:https://account.docusign.com/login",
        "fill:#email-input:robot@docusign.com",
        "click:#btn-submit",
        "fill:#pass-input:SecretPassword123",
        "click:#btn-submit",
      ]);

      assert.strictEqual(savedSessionArgs.query.email, credentials.email);
      assert.deepStrictEqual(savedSessionArgs.update.cookies, mockCookies);
      assert.strictEqual(savedSessionArgs.update.userAgent, "MockUserAgent/1.0");
      assert.strictEqual(result.email, credentials.email);
    });

    describe("regression: error propagation", () => {
      it("loginAndSaveSession lanca erro quando waitForSelector falha (sem .catch)", async () => {
        const mockPage = {
          url: () => "https://account.docusign.com",
          waitForSelector: async () => {
            throw new Error("Timeout waiting for selector");
          },
          fill: async () => {},
          click: async () => {},
        };
        const mockContext = { cookies: async () => [] };
        const credentials = { email: "robot@docusign.com", password: "SecretPassword123" };

        await assert.rejects(
          async () => {
            await loginAndSaveSession(mockPage, mockContext, credentials);
          },
          {
            name: "Error",
            message: "Timeout waiting for selector",
          }
        );
      });

      it("loginAndSaveSession lanca erro quando fill falha", async () => {
        const mockPage = {
          url: () => "https://account.docusign.com",
          waitForSelector: async () => {},
          fill: async () => {
            throw new Error("Fill failed");
          },
          click: async () => {},
        };
        const mockContext = { cookies: async () => [] };
        const credentials = { email: "robot@docusign.com", password: "SecretPassword123" };

        await assert.rejects(
          async () => {
            await loginAndSaveSession(mockPage, mockContext, credentials);
          },
          {
            name: "Error",
            message: "Fill failed",
          }
        );
      });

      it("loginAndSaveSession lanca erro quando click falha", async () => {
        const mockPage = {
          url: () => "https://account.docusign.com",
          waitForSelector: async () => {},
          fill: async () => {},
          click: async () => {
            throw new Error("Click failed");
          },
        };
        const mockContext = { cookies: async () => [] };
        const credentials = { email: "robot@docusign.com", password: "SecretPassword123" };

        await assert.rejects(
          async () => {
            await loginAndSaveSession(mockPage, mockContext, credentials);
          },
          {
            name: "Error",
            message: "Click failed",
          }
        );
      });

      it("loginAndSaveSession lanca erro quando passo anterior falha e nao alcanca waitForNavigation", async () => {
        let navCalled = false;
        const mockPage = {
          url: () => "https://account.docusign.com",
          waitForSelector: async () => {},
          fill: async () => {
            throw new Error("Fill step failed");
          },
          click: async () => {},
          waitForNavigation: async () => {
            navCalled = true;
          },
        };
        const mockContext = { cookies: async () => [] };
        const credentials = { email: "robot@docusign.com", password: "SecretPassword123" };

        await assert.rejects(
          async () => {
            await loginAndSaveSession(mockPage, mockContext, credentials);
          },
          {
            name: "Error",
            message: "Fill step failed",
          }
        );
        assert.strictEqual(navCalled, false);
      });
    });
  });

  describe("getOrRefreshSession", () => {
    it("should reuse valid existing session without performing login", async () => {
      const validSession = {
        email: "existing@example.com",
        cookies: [{ name: "valid_c", value: "val" }],
        expiresAt: new Date(Date.now() + 3600000),
      };

      mock.method(RobotSession, "findOne", async () => validSession);

      let addCookiesCalled = false;
      const mockContext = {
        addCookies: async (cookies) => {
          addCookiesCalled = true;
          assert.deepStrictEqual(cookies, validSession.cookies);
        },
      };

      const mockPage = {
        goto: async () => {
          assert.fail("goto should not be called when session is valid");
        },
      };

      const result = await getOrRefreshSession(mockPage, mockContext, { email: "existing@example.com", password: "p" });

      assert.strictEqual(result.refreshed, false);
      assert.deepStrictEqual(result.session, validSession);
      assert.strictEqual(addCookiesCalled, true);
    });

    it("should execute re-login when session is expired or non-existent", async () => {
      mock.method(RobotSession, "findOne", async () => null);

      const mockCookies = [{ name: "new_cookie", value: "new_val" }];
      const mockContext = {
        cookies: async () => mockCookies,
        addCookies: async () => {},
      };

      const mockPage = {
        goto: async () => {},
        fill: async () => {},
        click: async () => {},
        evaluate: async () => "UA",
      };

      mock.method(RobotSession, "findOneAndUpdate", async (query, update) => {
        return { ...update };
      });

      const result = await getOrRefreshSession(mockPage, mockContext, { email: "new@example.com", password: "pass" });

      assert.strictEqual(result.refreshed, true);
      assert.strictEqual(result.session.email, "new@example.com");
      assert.deepStrictEqual(result.session.cookies, mockCookies);
    });

    it("should accept robotSelectors keys (email_input, password_input, login_button)", async () => {
      const actions = [];
      const mockPage = {
        goto: async (url) => actions.push(`goto:${url}`),
        fill: async (selector, value) => actions.push(`fill:${selector}:${value}`),
        click: async (selector) => actions.push(`click:${selector}`),
        evaluate: async () => "MockUserAgent/1.0",
      };
      const mockContext = { cookies: async () => [{ name: "c", value: "v" }] };
      const credentials = { email: "robot@docusign.com", password: "SecretPassword123" };
      const robotSelectorsObj = {
        email_input: "#email-robot",
        password_input: "#password-robot",
        login_button: "#submit-robot",
      };

      mock.method(RobotSession, "findOneAndUpdate", async (query, update) => update);

      await loginAndSaveSession(mockPage, mockContext, credentials, robotSelectorsObj);

      assert.deepStrictEqual(actions, [
        "goto:https://account.docusign.com",
        "fill:#email-robot:robot@docusign.com",
        "click:#submit-robot",
        "fill:#password-robot:SecretPassword123",
        "click:#submit-robot",
      ]);
    });

    it("should throw error and capture screenshot when page url remains on login/OAuth after submit", async () => {
      let screenshotCaptured = false;
      const mockPage = {
        url: () => "https://account.docusign.com/oauth/auth",
        goto: async () => {},
        fill: async () => {},
        click: async () => {},
        screenshot: async () => {
          screenshotCaptured = true;
        },
      };
      const mockContext = { cookies: async () => [] };
      const credentials = { email: "robot@docusign.com", password: "SecretPassword123" };

      await assert.rejects(
        async () => {
          await loginAndSaveSession(mockPage, mockContext, credentials);
        },
        (err) => {
          return (
            err instanceof Error &&
            err.message.includes("A navegação permaneceu na tela de login/OAuth")
          );
        }
      );
      assert.strictEqual(screenshotCaptured, true);
    });
  });

  describe("invalidateSession", () => {
    it("should delete session from DB and return true when deleted", async () => {
      mock.method(RobotSession, "deleteOne", async (query) => {
        assert.strictEqual(query.email, "delete@example.com");
        return { deletedCount: 1 };
      });

      const res = await invalidateSession("delete@example.com");
      assert.strictEqual(res, true);
    });

    it("should return false if session was not found or email empty", async () => {
      assert.strictEqual(await invalidateSession(""), false);

      mock.method(RobotSession, "deleteOne", async () => ({ deletedCount: 0 }));
      const res = await invalidateSession("nonexistent@example.com");
      assert.strictEqual(res, false);
    });
  });
});
