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

export function ballparkQualityLabel(value: BallparkQuality) {
  // Stored values are validated on save, so a miss means a quality was
  // removed from the list; show the stored value rather than nothing.
  return BALLPARK_QUALITIES.find((quality) => quality.value === value)?.label ?? value;
}
