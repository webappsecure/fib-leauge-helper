import { describe, expect, it } from "vitest";
import { GRADES, type Grade } from "./grades";
import type { HrTendency } from "./pitchers";
import {
  bullpenQualities,
  closerQualities,
  teamQualities,
  type BullpenPitcher,
  type LineupGrades,
  type TeamQuality,
} from "./qualities";

const SLOTS = ["C", "1B", "2B", "SS", "3B", "LF", "CF", "RF", "DH"];

// Grades whose values add up to `sum` across `count` players, as evenly as
// the 1 to 7 range allows.
function gradesTotalling(sum: number, count: number): Grade[] {
  const values = Array.from({ length: count }, () => Math.floor(sum / count));
  for (let extra = 0; extra < sum % count; extra += 1) values[extra] += 1;
  if (values.some((value) => value < 1 || value > 7)) throw new Error(`cannot make ${sum}`);
  return values.map((value) => GRADES[value - 1]);
}

function lineup(
  sums: { hitting?: number; power?: number; defense?: number },
  useDh = true,
): LineupGrades[] {
  const slots = useDh ? SLOTS : SLOTS.slice(0, 8);
  const hitting = gradesTotalling(sums.hitting ?? 27, slots.length);
  const power = gradesTotalling(sums.power ?? 27, slots.length);
  // Defense is spread over the eight fielders; a DH gets an A+ that must not count.
  const defense = gradesTotalling(sums.defense ?? 28, 8);
  return slots.map((slot, index) => ({
    slot,
    hitting: hitting[index],
    power: power[index],
    defense: slot === "DH" ? "A+" : defense[index],
  }));
}

function label(quality: TeamQuality) {
  if (!quality.available) throw new Error("expected a quality");
  return quality.label;
}

describe("team Power", () => {
  it("reads every boundary of the table with a DH", () => {
    const at = (power: number) => label(teamQualities(lineup({ power }), true).power);
    expect([26, 27, 29, 30, 33, 34, 36, 37].map(at)).toEqual([
      "WEAK", "WEAK•", "WEAK•", "neutral", "neutral", "STRONG•", "STRONG•", "STRONG",
    ]);
  });

  it("drops every range by 3 without a DH", () => {
    const at = (power: number) => label(teamQualities(lineup({ power }, false), false).power);
    expect([23, 24, 26, 27, 30, 31, 33, 34].map(at)).toEqual([
      "WEAK", "WEAK•", "WEAK•", "neutral", "neutral", "STRONG•", "STRONG•", "STRONG",
    ]);
  });

  it("gives the tone, the sum and the working", () => {
    expect(teamQualities(lineup({ power: 36 }), true).power).toEqual({
      available: true,
      tone: "semi-high",
      label: "STRONG•",
      sum: 36,
      working: "Power 36",
    });
    expect(teamQualities(lineup({ power: 20 }), true).power).toMatchObject({ tone: "low" });
    expect(teamQualities(lineup({ power: 40 }), true).power).toMatchObject({ tone: "high" });
  });
});

describe("team Scoring", () => {
  it("reads every boundary of the table with a DH and no bonus", () => {
    const at = (hitting: number) => label(teamQualities(lineup({ hitting }), true).scoring);
    expect([26, 27, 29, 30, 39, 40, 42, 43].map(at)).toEqual([
      "LOW", "LOW•", "LOW•", "neutral", "neutral", "HIGH•", "HIGH•", "HIGH",
    ]);
  });

  it("drops every range by 3 without a DH", () => {
    const at = (hitting: number) =>
      label(teamQualities(lineup({ hitting, power: 24 }, false), false).scoring);
    expect([23, 24, 26, 27, 36, 37, 39, 40].map(at)).toEqual([
      "LOW", "LOW•", "LOW•", "neutral", "neutral", "HIGH•", "HIGH•", "HIGH",
    ]);
  });

  it("adds 6 for STRONG Power, 3 for STRONG• and nothing otherwise", () => {
    expect(teamQualities(lineup({ hitting: 38, power: 37 }), true).scoring).toEqual({
      available: true,
      tone: "high",
      label: "HIGH",
      sum: 44,
      working: "Hitting 38 + Power bonus 6 = 44",
    });
    // The prototype's sample team: Hitting 38, Power 36.
    expect(teamQualities(lineup({ hitting: 38, power: 36 }), true).scoring).toEqual({
      available: true,
      tone: "semi-high",
      label: "HIGH•",
      sum: 41,
      working: "Hitting 38 + Power bonus 3 = 41",
    });
    expect(teamQualities(lineup({ hitting: 38, power: 33 }), true).scoring).toEqual({
      available: true,
      tone: "neutral",
      label: "neutral",
      sum: 38,
      working: "Hitting 38",
    });
  });

  it("gives a no-DH team the bonus its lowered Power range earns", () => {
    // 34 is only STRONG• with a DH, but STRONG without one.
    const withoutDh = teamQualities(lineup({ hitting: 30, power: 34 }, false), false);
    expect(label(withoutDh.power)).toBe("STRONG");
    expect(withoutDh.scoring).toMatchObject({ sum: 36, label: "neutral" });

    const semi = teamQualities(lineup({ hitting: 34, power: 31 }, false), false);
    expect(label(semi.power)).toBe("STRONG•");
    expect(semi.scoring).toMatchObject({ sum: 37, label: "HIGH•" });
  });
});

describe("team Defense", () => {
  it("reads every boundary of the table and leaves out the DH", () => {
    const at = (defense: number) => teamQualities(lineup({ defense }), true).defense;
    expect([24, 25, 27, 28, 36, 37, 39, 40].map((sum) => label(at(sum)))).toEqual([
      "POROUS", "POROUS•", "POROUS•", "neutral", "neutral", "SOLID•", "SOLID•", "SOLID",
    ]);
    // The DH's A+ would add 7 if it were counted.
    expect(at(37)).toEqual({
      available: true,
      tone: "semi-high",
      label: "SOLID•",
      sum: 37,
      working: "Defense 37, DH excluded",
    });
  });

  it("uses the same ranges without a DH", () => {
    const at = (defense: number) => teamQualities(lineup({ defense }, false), false).defense;
    expect([24, 25, 27, 28, 36, 37, 39, 40].map((sum) => label(at(sum)))).toEqual([
      "POROUS", "POROUS•", "POROUS•", "neutral", "neutral", "SOLID•", "SOLID•", "SOLID",
    ]);
    expect(at(28)).toMatchObject({ working: "Defense 28" });
  });

  it("leaves out whoever is in the DH slot, whatever their natural position", () => {
    const players = lineup({ defense: 28 });
    // Swap the catcher and the DH: the A+ fielder now catches and counts.
    const swapped = players.map((player) =>
      player.slot === "C" ? { ...player, slot: "DH" } : player.slot === "DH" ? { ...player, slot: "C" } : player,
    );
    const catcherValue = GRADES.indexOf(players[0].defense) + 1;
    expect(teamQualities(swapped, true).defense).toMatchObject({ sum: 28 - catcherValue + 7 });
  });
});

describe("an incomplete lineup", () => {
  const missing = { available: false, reason: "Needs a full lineup" };

  it("gives no team quality when a slot is empty or nobody is rolled", () => {
    const short = lineup({}).filter((player) => player.slot !== "SS");
    expect(teamQualities(short, true)).toEqual({ scoring: missing, power: missing, defense: missing });
    expect(teamQualities([], true)).toEqual({ scoring: missing, power: missing, defense: missing });
  });

  it("needs a DH only in a DH league and ignores a DH in a league without one", () => {
    const eight = lineup({}, false);
    expect(teamQualities(eight, true).power).toEqual(missing);
    expect(teamQualities(eight, false).power.available).toBe(true);

    const nine = lineup({ power: 36 });
    const dhPower = GRADES.indexOf(nine[8].power) + 1;
    expect(teamQualities(nine, false).power).toMatchObject({ sum: 36 - dhPower });
  });
});

describe("bullpen qualities", () => {
  function pen(grades: Grade[], tendencies: HrTendency[], closer = true): BullpenPitcher[] {
    const relievers = grades.map((grade, index) => ({
      slot: `RP${index + 1}`,
      grade,
      hrTendency: tendencies[index],
    }));
    return closer
      ? [...relievers, { slot: "CL", grade: "A+", hrTendency: "tough" }, { slot: "SP1", grade: "F", hrTendency: "shaky" }]
      : relievers;
  }
  const neutral: HrTendency[] = ["neutral", "neutral", "neutral", "neutral"];

  it("matches the prototype's sample bullpen and ignores the closer and starters", () => {
    const result = bullpenQualities(
      pen(["B+", "B", "C", "B"], ["neutral", "semi-tough", "neutral", "semi-shaky"]),
    );
    expect(result.grade).toEqual({
      available: true,
      grade: "B",
      sum: 16,
      working: "RP average 16 / 4 = 4.0",
    });
    expect(result.hrTendency).toEqual({
      available: true,
      tone: "neutral",
      label: "neutral",
      sum: 12,
      working: "RP average 12 / 4 = 3.0",
    });
  });

  it("rounds the grade down below a half, up above it, and up on an exact half", () => {
    const grade = (grades: Grade[]) => bullpenQualities(pen(grades, neutral)).grade;
    // 17 / 4 = 4.25, 19 / 4 = 4.75, 18 / 4 = 4.5.
    expect(grade(["B+", "B", "B", "B"])).toMatchObject({ grade: "B", working: "RP average 17 / 4 = 4.25" });
    expect(grade(["B+", "B+", "B+", "B"])).toMatchObject({ grade: "B+", working: "RP average 19 / 4 = 4.75" });
    expect(grade(["B+", "B+", "B", "B"])).toMatchObject({ grade: "B+", working: "RP average 18 / 4 = 4.5" });
    expect(grade(["F", "F", "F", "F"])).toMatchObject({ grade: "F" });
    expect(grade(["A+", "A+", "A+", "A+"])).toMatchObject({ grade: "A+" });
  });

  it("rounds the HR tendency the same way on its 1 to 5 scale", () => {
    const tendency = (values: HrTendency[]) =>
      bullpenQualities(pen(["B", "B", "B", "B"], values)).hrTendency;
    expect(tendency(["tough", "tough", "tough", "tough"])).toMatchObject({ tone: "high", label: "TOUGH" });
    expect(tendency(["shaky", "shaky", "shaky", "shaky"])).toMatchObject({ tone: "low", label: "SHAKY" });
    // 14 / 4 = 3.5 rounds up to TOUGH•; 13 / 4 = 3.25 stays neutral.
    expect(tendency(["semi-tough", "semi-tough", "neutral", "neutral"])).toMatchObject({
      tone: "semi-high",
      label: "TOUGH•",
      working: "RP average 14 / 4 = 3.5",
    });
    expect(tendency(["semi-tough", "neutral", "neutral", "neutral"])).toMatchObject({ label: "neutral" });
    // 9 / 4 = 2.25 is SHAKY•.
    expect(tendency(["semi-shaky", "semi-shaky", "semi-shaky", "neutral"])).toMatchObject({
      tone: "semi-low",
      label: "SHAKY•",
    });
  });

  it("gives nothing until all four relief slots are filled", () => {
    const missing = { available: false, reason: "Needs four relief pitchers" };
    expect(bullpenQualities(pen(["B", "B", "B"], neutral))).toEqual({ grade: missing, hrTendency: missing });
    expect(bullpenQualities([])).toEqual({ grade: missing, hrTendency: missing });
  });
});

describe("closer qualities", () => {
  const staff = (closer?: BullpenPitcher): BullpenPitcher[] => [
    { slot: "SP1", grade: "A+", hrTendency: "tough" },
    { slot: "RP1", grade: "F", hrTendency: "shaky" },
    ...(closer ? [closer] : []),
    { slot: "RP2", grade: "D", hrTendency: "semi-shaky" },
  ];

  it("gives each HR tendency its tone and label", () => {
    const tendencies: HrTendency[] = ["shaky", "semi-shaky", "neutral", "semi-tough", "tough"];
    expect(
      tendencies.map(
        (hrTendency) => closerQualities(staff({ slot: "CL", grade: "B", hrTendency }))?.hrTendency,
      ),
    ).toEqual([
      { tone: "low", label: "SHAKY" },
      { tone: "semi-low", label: "SHAKY•" },
      { tone: "neutral", label: "neutral" },
      { tone: "semi-high", label: "TOUGH•" },
      { tone: "high", label: "TOUGH" },
    ]);
  });

  it("passes the closer's own grade through, found by slot among the staff", () => {
    expect(closerQualities(staff({ slot: "CL", grade: "B+", hrTendency: "neutral" }))).toEqual({
      grade: "B+",
      hrTendency: { tone: "neutral", label: "neutral" },
    });
  });

  it("gives nothing when nobody is in the CL slot", () => {
    expect(closerQualities(staff())).toBeNull();
    expect(closerQualities([])).toBeNull();
  });
});
