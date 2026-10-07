import { describe, expect, it } from "vitest";
import {
  validateLeagueInput,
  type RawLeagueInput,
  validateLeagueSettings,
} from "./validate";

const valid: RawLeagueInput = {
  name: "Great Lakes League",
  startYear: "2026",
  teamCount: "12",
  useDh: "on",
};

function errorsFor(overrides: Partial<RawLeagueInput>) {
  const result = validateLeagueInput({ ...valid, ...overrides });
  if (result.ok) throw new Error("expected validation to fail");
  return result.errors;
}

describe("validateLeagueInput", () => {
  it("accepts a valid league and returns cleaned values", () => {
    expect(validateLeagueInput({ ...valid, name: "  Great Lakes League  " })).toEqual({
      ok: true,
      value: {
        name: "Great Lakes League",
        startYear: 2026,
        teamCount: 12,
        useDh: true,
      },
    });
  });

  it("treats a missing DH checkbox as DH off", () => {
    const result = validateLeagueInput({ ...valid, useDh: null });
    expect(result.ok && result.value.useDh).toBe(false);
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(errorsFor({ name: "" })).toEqual({ name: "Enter a league name." });
    expect(errorsFor({ name: "   " })).toEqual({ name: "Enter a league name." });
    expect(errorsFor({ name: null })).toEqual({ name: "Enter a league name." });
  });

  it("allows 80 characters and rejects 81", () => {
    expect(validateLeagueInput({ ...valid, name: "a".repeat(80) }).ok).toBe(true);
    expect(errorsFor({ name: "a".repeat(81) })).toEqual({
      name: "Keep the name to 80 characters or fewer.",
    });
  });

  it("accepts years 1 and 9999 and rejects 0 and 10000", () => {
    expect(validateLeagueInput({ ...valid, startYear: "1" }).ok).toBe(true);
    expect(validateLeagueInput({ ...valid, startYear: "9999" }).ok).toBe(true);
    const message = "Enter a year between 1 and 9999.";
    expect(errorsFor({ startYear: "0" })).toEqual({ startYear: message });
    expect(errorsFor({ startYear: "10000" })).toEqual({ startYear: message });
  });

  it("rejects a missing, non-numeric, decimal or negative year", () => {
    const message = "Enter a year between 1 and 9999.";
    for (const startYear of ["", null, "abc", "2026.5", "-5", 2026.5]) {
      expect(errorsFor({ startYear })).toEqual({ startYear: message });
    }
  });

  it("accepts 2 and 100 teams and rejects 1 and 101", () => {
    expect(validateLeagueInput({ ...valid, teamCount: "2" }).ok).toBe(true);
    expect(validateLeagueInput({ ...valid, teamCount: "100" }).ok).toBe(true);
    const message = "Enter a number of teams between 2 and 100.";
    expect(errorsFor({ teamCount: "1" })).toEqual({ teamCount: message });
    expect(errorsFor({ teamCount: "101" })).toEqual({ teamCount: message });
  });

  it("rejects a missing, non-numeric or decimal team count", () => {
    const message = "Enter a number of teams between 2 and 100.";
    for (const teamCount of ["", null, "twelve", "12.5"]) {
      expect(errorsFor({ teamCount })).toEqual({ teamCount: message });
    }
  });

  it("reports every invalid field at once", () => {
    expect(errorsFor({ name: "", startYear: "0", teamCount: "1" })).toEqual({
      name: "Enter a league name.",
      startYear: "Enter a year between 1 and 9999.",
      teamCount: "Enter a number of teams between 2 and 100.",
    });
  });
});

describe("validateLeagueSettings", () => {
  it("accepts a valid name and year and returns cleaned values", () => {
    expect(validateLeagueSettings({ name: "  Great Lakes League ", startYear: " 1975 " })).toEqual({
      ok: true,
      value: { name: "Great Lakes League", startYear: 1975 },
    });
    expect(validateLeagueSettings({ name: "x", startYear: 2026 })).toEqual({
      ok: true,
      value: { name: "x", startYear: 2026 },
    });
  });

  it("uses the same name rules and messages as creating a league", () => {
    const error = (name: unknown) => {
      const result = validateLeagueSettings({ name, startYear: "2026" });
      return result.ok ? null : result.errors;
    };
    expect(error("")).toEqual({ name: "Enter a league name." });
    expect(error("   ")).toEqual({ name: "Enter a league name." });
    expect(error(null)).toEqual({ name: "Enter a league name." });
    expect(error(42)).toEqual({ name: "Enter a league name." });
    expect(error("a".repeat(80))).toBeNull();
    expect(error("é".repeat(80))).toBeNull();
    expect(error("a".repeat(81))).toEqual({ name: "Keep the name to 80 characters or fewer." });
  });

  it("uses the same year rules and messages as creating a league", () => {
    const error = (startYear: unknown) => {
      const result = validateLeagueSettings({ name: "Great Lakes League", startYear });
      return result.ok ? null : result.errors;
    };
    const message = { startYear: "Enter a year between 1 and 9999." };
    expect(error("1")).toBeNull();
    expect(error("9999")).toBeNull();
    for (const bad of ["0", "10000", "", "next year", "2026.5", "-5", null, undefined, 2026.5]) {
      expect(error(bad)).toEqual(message);
    }
  });

  it("reports both fields at once", () => {
    expect(validateLeagueSettings({ name: "", startYear: "soon" })).toEqual({
      ok: false,
      errors: { name: "Enter a league name.", startYear: "Enter a year between 1 and 9999." },
    });
  });
});
