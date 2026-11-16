import { FilterEffectType } from "@/wab/shared/core/filter-effect-utils";
import React from "react";

const glyphs: Record<FilterEffectType | "none", React.ReactNode> = {
  blur: <>
    <circle cx="8" cy="8" r="6" strokeDasharray="1.5 2" />
    <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />
  </>,
  brightness: <>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v1M8 14v1M1 8h1M14 8h1M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" />
  </>,
  contrast: <>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 2a6 6 0 0 1 0 12Z" fill="currentColor" stroke="none" />
  </>,
  "drop-shadow": <>
    <rect x="2" y="2" width="9" height="9" rx="2" />
    <path d="M6 14h6a2 2 0 0 0 2-2V6" />
  </>,
  grayscale: <>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M6 3v10M10 3v10" />
    <path d="M6 3h4v10H6Z" fill="currentColor" opacity="0.35" stroke="none" />
    <path d="M10 3h2.5A1.5 1.5 0 0 1 14 4.5v7a1.5 1.5 0 0 1-1.5 1.5H10Z" fill="currentColor" stroke="none" />
  </>,
  "hue-rotate": <>
    <path d="M13.5 6a5.7 5.7 0 1 0-.5 5M13.5 2.5V6H10" />
    <path d="M8 4v4l3 2" />
  </>,
  invert: <>
    <path d="M2 5h11l-3-3M14 11H3l3 3" />
    <path d="M8 3v10" strokeDasharray="1 2" />
  </>,
  opacity: <>
    <rect x="2" y="2" width="12" height="12" rx="2" />
    <path d="M2 8h12M8 2v12" />
    <path d="M8 2h4a2 2 0 0 1 2 2v4H8ZM2 8h6v6H4a2 2 0 0 1-2-2Z" fill="currentColor" opacity="0.4" stroke="none" />
  </>,
  saturate: <>
    <path d="M8 1.5 3.8 7a5 5 0 1 0 8.4 0Z" />
    <path d="M8 6v7a3 3 0 0 0 2.5-4.5Z" fill="currentColor" stroke="none" />
  </>,
  sepia: <>
    <rect x="2" y="2" width="12" height="12" rx="2" />
    <circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
    <path d="m3 12 4-4 2 2 2-3 3 5" />
  </>,
  none: <>
    <circle cx="8" cy="8" r="6" />
    <path d="m4 4 8 8" />
  </>,
};

export function FilterEffectIcon({ type, backdrop, ...props }: React.ComponentProps<"svg"> & {
  type: FilterEffectType | "none";
  backdrop: boolean;
}) {
  return <svg {...props} width="16" height="16" viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {backdrop && <rect x="1" y="1" width="14" height="14" rx="3" />}
    <g transform={backdrop ? "translate(2.5 2.5) scale(.6875)" : undefined}>
      {glyphs[type]}
    </g>
  </svg>;
}
