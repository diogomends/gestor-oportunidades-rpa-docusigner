import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "../../helpers/setup.js";
import { parseRoundcubeDate } from "../../../robot/src/browser/roundcube.js";

describe("Robot Standalone - Roundcube MFA Helper Tests", () => {
  describe("parseRoundcubeDate", () => {
    it("deve parsear horário simples '14:25' como data de hoje", () => {
      const parsed = parseRoundcubeDate("14:25");
      assert.ok(parsed instanceof Date);
      assert.equal(parsed.getHours(), 14);
      assert.equal(parsed.getMinutes(), 25);
    });

    it("deve parsear horário com segundos '09:15:30' como data de hoje", () => {
      const parsed = parseRoundcubeDate("09:15:30");
      assert.ok(parsed instanceof Date);
      assert.equal(parsed.getHours(), 9);
      assert.equal(parsed.getMinutes(), 15);
      assert.equal(parsed.getSeconds(), 30);
    });

    it("deve parsear formato relativo 'Hoje 16:40' ou 'Today 16:40'", () => {
      const ptParsed = parseRoundcubeDate("Hoje 16:40");
      assert.ok(ptParsed instanceof Date);
      assert.equal(ptParsed.getHours(), 16);
      assert.equal(ptParsed.getMinutes(), 40);

      const enParsed = parseRoundcubeDate("Today 11:20");
      assert.ok(enParsed instanceof Date);
      assert.equal(enParsed.getHours(), 11);
      assert.equal(enParsed.getMinutes(), 20);
    });

    it("deve parsear formato relativo 'Ontem 18:00' ou 'Yesterday 18:00'", () => {
      const yesterday = parseRoundcubeDate("Ontem 18:00");
      assert.ok(yesterday instanceof Date);
      assert.equal(yesterday.getHours(), 18);
      assert.equal(yesterday.getMinutes(), 0);
      const now = new Date();
      assert.notEqual(yesterday.getDate(), now.getDate());
    });

    it("deve retornar null para strings vazias ou nulas", () => {
      assert.equal(parseRoundcubeDate(""), null);
      assert.equal(parseRoundcubeDate(null), null);
      assert.equal(parseRoundcubeDate(undefined), null);
      assert.equal(parseRoundcubeDate("texto invalido"), null);
    });
  });
});
