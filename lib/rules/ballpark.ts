// A bullet marks a "semi" quality, as in the handbook.
export const BALLPARK_QUALITIES = [
  { value: "pitchers", label: "Pitcher's Park" },
  { value: "semi-pitchers", label: "Pitcher's Park•" },
  { value: "neutral", label: "neutral" },
  { value: "semi-hitters", label: "Hitter's Park•" },
  { value: "hitters", label: "Hitter's Park" },
] as const;

export type BallparkQuality = (typeof BALLPARK_QUALITIES)[number]["value"];

export const DEFAULT_BALLPARK_QUALITY: BallparkQuality = "neutral";
