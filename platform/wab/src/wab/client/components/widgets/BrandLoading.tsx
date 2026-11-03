import { BrandGradient } from "@/wab/client/components/BrandLogo";
import styles from "@/wab/client/components/widgets/BrandLoading.module.scss";
import { useI18n } from "@/wab/client/i18n";
import brand from "@/wab/shared/branding.json";
import * as React from "react";

const duration = 2800;
const namespace = "http://www.w3.org/2000/svg";
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};

export function BrandLoading() {
  const { t } = useI18n();
  const id = `loading-${React.useId()}`;
  const svgRef = React.useRef<SVGSVGElement>(null);
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {return;}
    const solid = svg.querySelector<SVGGElement>("[data-solid]");
    const scaffold = svg.querySelector<SVGGElement>("[data-scaffold]");
    const grid = svg.querySelector<SVGGElement>("[data-grid]");
    const lights = svg.querySelector<SVGGElement>("[data-lights]");
    const front = svg.querySelector<SVGStopElement>("[data-front]");
    const tail = svg.querySelector<SVGStopElement>("[data-tail]");
    if (!solid || !scaffold || !grid || !lights || !front || !tail) {return;}
    const tracks = Array.from(
      svg.querySelectorAll<SVGPathElement>("[data-track]"),
    ).map((shape, index) => ({
      shape,
      index,
      length: shape.getTotalLength(),
      pieces: Array.from({ length: 56 }, () => {
        const node = document.createElementNS(namespace, "path");
        lights.appendChild(node);
        return node;
      }),
    }));
    const render = (progress: number) => {
      const ready = smooth((progress - 0.08) / 0.49);
      const fade = 1 - smooth((progress - 0.2) / 0.4);
      const edgeFade = 1 - smooth((progress - 0.39) / 0.18);
      for (const track of tracks) {
        const head = (progress / 0.64 + track.index * 0.28) % 1;
        track.pieces.forEach((node, i) => {
          const fraction = i / 55;
          const start = head - (1 - fraction) * 0.22;
          let d = "";
          for (let j = 0; j <= 3; j++) {
            const point = track.shape.getPointAtLength(
              ((((start + (j * 0.22) / 55 / 3) % 1) + 1) % 1) * track.length,
            );
            d += `${j ? "L" : "M"}${point.x.toFixed(3)} ${point.y.toFixed(3)}`;
          }
          node.setAttribute("d", d);
          node.setAttribute(
            "stroke",
            `rgb(${Math.round(96 + 111 * fraction)},${Math.round(67 + 125 * fraction)},${Math.round(176 + 79 * fraction)})`,
          );
          node.setAttribute(
            "opacity",
            String(Math.pow(fraction, 1.35) * edgeFade),
          );
        });
      }
      scaffold.setAttribute("opacity", String(fade * 0.55));
      solid.setAttribute("opacity", String(smooth((progress - 0.06) / 0.17)));
      grid.setAttribute("opacity", String(1 - smooth((progress - 0.14) / 0.5)));
      front.setAttribute("offset", String(Math.max(0, ready * 1.22 - 0.22)));
      tail.setAttribute("offset", String(Math.min(1, ready * 1.22)));
      if (ready === 1) {solid.removeAttribute("mask");}
      else {solid.setAttribute("mask", `url(#${id}-mask)`);}
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let started = performance.now();
    let last = 0;
    function tick(time: number) {
      const progress = reducedMotion.matches
        ? 1
        : clamp((time - started) / duration);
      if (time - last >= 30 || progress === 1) {
        render(progress);
        last = time;
      }
      if (progress < 1) {frame = requestAnimationFrame(tick);}
    }
    const reduceMotion = () => {
      cancelAnimationFrame(frame);
      if (reducedMotion.matches) {render(1);}
      else {
        started = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    reducedMotion.addEventListener("change", reduceMotion);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      reducedMotion.removeEventListener("change", reduceMotion);
      lights.replaceChildren();
    };
  }, [id]);
  return (
    <div
      className={styles.loading}
      role="status"
      aria-label={t("Loading…")}
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
        <g data-grid className={styles.grid}>
          <path d="M54 30V300M346 30V300M14 68H386M14 262H386" />
          <path
            strokeDasharray="4 5"
            d="M103 30V300M151 30V300M200 30V300M249 30V300M297 30V300M14 116H386M14 165H386M14 213H386M27 42L373 288M27 288L373 42"
          />
        </g>
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
