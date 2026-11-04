import { BrandGradient } from "@/wab/client/components/BrandLogo";
import styles from "@/wab/client/components/widgets/BrandLoading.module.scss";
import { animateBrandLoading } from "@/wab/client/components/widgets/brand-loading-animation";
import { LoadingAnimationContext } from "@/wab/client/contexts/LoadingAnimationContext";
import { useI18n } from "@/wab/client/i18n";
import construction from "@/wab/shared/brand-loading.json";
import brand from "@/wab/shared/branding.json";
import { globalStatic } from "@/wab/shared/urls";
import * as React from "react";

export function BrandLoading({ label }: { label?: string } = {}) {
  const { t } = useI18n();
  const animationEnabled = React.useContext(LoadingAnimationContext);
  const id = `loading-${React.useId()}`;
  const svgRef = React.useRef<SVGSVGElement>(null);
  React.useEffect(() => {
    const svg = svgRef.current;
    return svg && animationEnabled ? animateBrandLoading(svg) : undefined;
  }, [id, animationEnabled]);
  if (!animationEnabled) {
    return null;
  }
  const maskImage = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${brand.paths.map((d) => `<path fill="white" d="${d}"/>`).join("")}</svg>`)}")`;
  return (
    <div
      className={styles.loading}
      role="status"
      aria-label={label ?? t("Loading…")}
      aria-busy="true"
    >
      <div className={styles.art}>
        <svg
          ref={svgRef}
          className={styles.logo}
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
          </defs>
          <g transform="translate(96 61) scale(6.5)">
            <g data-scaffold opacity=".55" className={styles.wire}>
              <g clipPath={`url(#${id}-clip)`}>
                {Array.from({ length: 44 }, (_, i) => {
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
            <g data-solid fill={`url(#${id}-fill)`} opacity="1">
              {brand.paths.map((_, i) => (
                <use key={i} href={`#${id}-${i}`} />
              ))}
            </g>
          </g>
        </svg>
        <img
          data-construction
          data-src={globalStatic(`img/${construction.file}`)}
          data-duration={construction.duration}
          className={styles.construction}
          width="200"
          height="200"
          alt=""
          aria-hidden="true"
          decoding="async"
        />
        <div
          className={styles.sheenClip}
          style={{ maskImage, WebkitMaskImage: maskImage }}
          aria-hidden="true"
        >
          <div data-sheen className={styles.sheen} />
        </div>
      </div>
    </div>
  );
}
