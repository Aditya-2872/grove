// ---------------------------------------------------------------------------
// Small line-art icons (no emoji). All stroke currentColor so they inherit the
// active theme accent or text color.
// ---------------------------------------------------------------------------

import type { WidgetType } from "../types";

type P = { className?: string };

const svg = (className: string | undefined, children: React.ReactNode) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

/** A little sprout — the app mark. */
export const Logo = ({ className }: P) =>
  svg(
    className,
    <>
      <path d="M12 20v-7" />
      <path d="M12 13c0-3 2.4-5 5.2-5-.2 3-2.4 5-5.2 5Z" />
      <path d="M12 14c0-2.6-2-4.4-4.6-4.4C7.6 12 9.6 14 12 14Z" />
    </>,
  );

export const IconClose = ({ className }: P) =>
  svg(className, <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>);

export const IconPlus = ({ className }: P) =>
  svg(className, <><path d="M12 5v14" /><path d="M5 12h14" /></>);

export const IconTrash = ({ className }: P) =>
  svg(
    className,
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6.5 7l.8 11.2a1.8 1.8 0 0 0 1.8 1.8h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" />
      <path d="M10.5 11v5" />
      <path d="M13.5 11v5" />
    </>,
  );

export const IconScene = ({ className }: P) =>
  svg(className, <><circle cx="8" cy="7" r="2" /><path d="M3 18l5-6 4 4 3-4 6 6" /><path d="M3 20h18" /></>);

export const IconClock = ({ className }: P) =>
  svg(className, <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v4.8l3 1.8" /></>);

export const IconUsers = ({ className }: P) =>
  svg(className, <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M18 14.3a5.5 5.5 0 0 1 2.5 5.7" /></>);

export const IconLogout = ({ className }: P) =>
  svg(className, <><path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h9" /></>);

export const IconGear = ({ className }: P) =>
  svg(
    className,
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.66 6.34l-1.42 1.42M7.76 16.24l-1.42 1.42M17.66 17.66l-1.42-1.42M7.76 7.76L6.34 6.34" />
    </>,
  );

const IconNote = ({ className }: P) =>
  svg(className, <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8" /><path d="M8 13h5" /></>);

const IconChecklist = ({ className }: P) =>
  svg(className, <><path d="M4 7l1.5 1.5L8 6" /><path d="M11 7h9" /><path d="M4 13l1.5 1.5L8 12" /><path d="M11 13h9" /><path d="M4 18.5h.01" /><path d="M11 18h9" /></>);

const IconCounter = ({ className }: P) =>
  svg(className, <><circle cx="12" cy="12" r="8" /><path d="M9 12h6" /><path d="M12 9v6" /></>);

const IconTimer = ({ className }: P) =>
  svg(className, <><circle cx="12" cy="13" r="7" /><path d="M12 13V9" /><path d="M10 3h4" /></>);

const IconProgress = ({ className }: P) =>
  svg(className, <><rect x="3" y="10" width="18" height="4" rx="2" /><path d="M3 12h11" /></>);

const IconBmi = ({ className }: P) =>
  svg(className, <><path d="M4 20a8 8 0 0 1 16 0" /><path d="M12 20l4-5" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></>);

const IconMetric = ({ className }: P) =>
  svg(className, <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /></>);

const IconHabit = ({ className }: P) =>
  svg(className, <><path d="M12 3c1.6 2.6 4.5 3.8 4.5 7.5a4.5 4.5 0 0 1-9 0c0-1.6.7-2.8 1.7-3.7.1 1.2.9 2 1.9 2.2-.5-2.1.3-4.2.9-6Z" /></>);

export const WidgetIcon = ({ type, className }: { type: WidgetType; className?: string }) => {
  switch (type) {
    case "sticky_note":
      return <IconNote className={className} />;
    case "checklist":
      return <IconChecklist className={className} />;
    case "counter":
      return <IconCounter className={className} />;
    case "timer":
      return <IconTimer className={className} />;
    case "progress":
      return <IconProgress className={className} />;
    case "bmi":
      return <IconBmi className={className} />;
    case "metric":
      return <IconMetric className={className} />;
    case "habit":
      return <IconHabit className={className} />;
  }
};
