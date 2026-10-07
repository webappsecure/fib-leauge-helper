import { describe, expect, it } from "vitest";
import { ballparkQualityLabel, DEFAULT_BALLPARK_QUALITY } from "./ballpark";

describe("ballparkQualityLabel", () => {
  it("labels every quality, with a bullet on the semi ones", () => {
    expect(ballparkQualityLabel("pitchers")).toBe("Pitcher's Park");
    expect(ballparkQualityLabel("semi-pitchers")).toBe("Pitcher's Park•");
    expect(ballparkQualityLabel("neutral")).toBe("neutral");
    expect(ballparkQualityLabel("semi-hitters")).toBe("Hitter's Park•");
    expect(ballparkQualityLabel("hitters")).toBe("Hitter's Park");
  });

  it("labels the default quality", () => {
    expect(ballparkQualityLabel(DEFAULT_BALLPARK_QUALITY)).toBe("neutral");
  });
});
