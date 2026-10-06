import type { ReactNode } from "react";

const buttonBase =
  "inline-flex items-center rounded-ui border px-2.5 py-1 text-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

export const buttonClass = {
  primary: `${buttonBase} border-accent bg-accent font-semibold text-accent-ink`,
  secondary: `${buttonBase} border-border bg-surface text-text hover:border-accent`,
};

export function PageTitle({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      <h1 className="text-xl font-bold">{title}</h1>
      <div className="flex-1 text-muted">{meta}</div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-4 overflow-hidden rounded-ui border border-border bg-surface">
      <h2 className="bg-navy px-3 py-1.5 text-sm font-bold tracking-wider text-navy-ink uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}
