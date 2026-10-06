"use client";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const isDark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage can be blocked; the choice then lasts for this page only.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark mode"
      className="cursor-pointer rounded-ui border border-navy-ink/60 px-2.5 py-1 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
    >
      Light / dark
    </button>
  );
}
