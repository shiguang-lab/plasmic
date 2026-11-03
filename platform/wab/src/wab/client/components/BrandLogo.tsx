import brand from "@/wab/shared/branding.json";
import * as React from "react";

export function BrandGradient({ id }: { id: string }) {
  const { stops, ...coordinates } = brand.gradient;
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" {...coordinates}>
      {stops.map(({ offset, color }) => (
        <stop key={offset} offset={offset} stopColor={color} />
      ))}
    </linearGradient>
  );
}

export function BrandLogo({
  title,
  ...props
}: React.ComponentProps<"svg"> & { title?: string }) {
  const gradientId = `brand-${React.useId()}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 32 32"
      role="img"
      aria-label={title ?? "Plasmic"}
      {...props}
    >
      {title && <title>{title}</title>}
      <defs>
        <BrandGradient id={gradientId} />
      </defs>
      <g fill={`url(#${gradientId})`}>
        {brand.paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
