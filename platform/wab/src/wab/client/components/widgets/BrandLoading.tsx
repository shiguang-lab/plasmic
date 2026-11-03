import { animateBrandLoading } from "@/wab/client/components/widgets/brand-loading-animation";
import { BrandGradient } from "@/wab/client/components/BrandLogo";
import styles from "@/wab/client/components/widgets/BrandLoading.module.scss";
import { useI18n } from "@/wab/client/i18n";
import brand from "@/wab/shared/branding.json";
import * as React from "react";

export function BrandLoading({ label }: { label?: string } = {}) {
  const { t } = useI18n();
  const id = `loading-${React.useId()}`;
  const svgRef = React.useRef<SVGSVGElement>(null);
  React.useEffect(() => {
    const svg = svgRef.current;
    return svg ? animateBrandLoading(svg) : undefined;
  }, [id]);
  return (
    <div
      className={styles.loading}
      role="status"
      aria-label={label ?? t("Loading…")}
      aria-busy="true"
    >
      <svg
        ref={svgRef}
        className={styles.art}
        viewBox="0 0 400 330"
        aria-hidden="true"
      >
        <defs>
          <BrandGradient id={`${id}-fill`} />
          {brand.paths.map((d, i) => (
            <path key={d} id={`${id}-${i}`} data-track d={d} />
          ))}
          <clipPath id={`${id}-clip`}>
            {brand.paths.map((_, i) => (
              <use key={i} href={`#${id}-${i}`} />
            ))}
          </clipPath>
          <linearGradient id={`${id}-reveal`} x1="0" y1="0" x2="0" y2="1">
            <stop data-front offset="0" stopColor="white" />
            <stop data-tail offset="0" stopColor="black" />
          </linearGradient>
          <mask
            id={`${id}-mask`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="32"
            height="32"
          >
            <rect width="32" height="32" fill={`url(#${id}-reveal)`} />
          </mask>
        </defs>
        <g transform="translate(96 61) scale(6.5)">
          <g data-scaffold opacity=".55" className={styles.wire}>
            <g clipPath={`url(#${id}-clip)`}>
              {Array.from({ length: 40 }, (_, i) => {
                const y = (19 + i * 4.4) / 6.5;
                return (
                  <path
                    key={i}
                    d={`M-.77 ${y} Q16.15 ${y - 3.23} 32.3 ${y - 0.46}`}
                  />
                );
              })}
            </g>
            <g opacity=".3">
              {brand.paths.map((_, i) => (
                <use key={i} href={`#${id}-${i}`} />
              ))}
            </g>
          </g>
          <g
            data-lights
            fill="none"
            strokeWidth=".16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g
            data-solid
            fill={`url(#${id}-fill)`}
            mask={`url(#${id}-mask)`}
            opacity="0"
          >
            {brand.paths.map((_, i) => (
              <use key={i} href={`#${id}-${i}`} />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
