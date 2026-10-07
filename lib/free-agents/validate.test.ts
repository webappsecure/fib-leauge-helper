import { describe, expect, it } from "vitest";
import { parsePerPosition, PER_POSITION_ERROR } from "./validate";

describe("parsePerPosition", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["10", 10],
    [" 3 ", 3],
  ])("accepts %j", (text, value) => {
    expect(parsePerPosition(text)).toEqual({ ok: true, value });
  });

  it.each(["", "  ", "0", "11", "2.5", "-1", "abc", "1e1", "0x2", 2, null, undefined])(
    "rejects %j with a message",
    (raw) => {
      expect(parsePerPosition(raw)).toEqual({ ok: false, error: PER_POSITION_ERROR });
    },
  );
});
