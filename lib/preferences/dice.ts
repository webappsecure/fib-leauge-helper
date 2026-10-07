// Whether the rolls behind values are shown. Remembered in the browser, like
// the theme, and read by CSS through data-dice on <html>.
export type DiceSetting = "shown" | "hidden";

export const DICE_STORAGE_KEY = "dice";

// Dice are shown unless the commissioner has hidden them, so anything other
// than a saved "hidden" reads as shown.
export function parseDiceSetting(saved: string | null | undefined): DiceSetting {
  return saved === "hidden" ? "hidden" : "shown";
}

// Runs before first paint so hidden dice do not flash on load.
export const applySavedDiceSetting = `try{if(localStorage.getItem("${DICE_STORAGE_KEY}")==="hidden")document.documentElement.dataset.dice="hidden"}catch(e){}`;
