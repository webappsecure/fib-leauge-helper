"use client";

import { DICE_STORAGE_KEY, parseDiceSetting } from "@/lib/preferences/dice";

export function DiceToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = parseDiceSetting(root.dataset.dice) === "hidden" ? "shown" : "hidden";
    root.dataset.dice = next;
    try {
      localStorage.setItem(DICE_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the choice then lasts for this page only.
    }
  }

  // The label follows data-dice through CSS, so it is right before hydration
  // and needs no state that could disagree with the saved choice.
  return (
    <button
      type="button"
      onClick={toggle}
      className="cursor-pointer rounded-ui border border-navy-ink/60 px-2.5 py-1 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
    >
      <span className="dice-hidden:hidden">Hide dice</span>
      <span className="hidden dice-hidden:inline">Show dice</span>
    </button>
  );
}
