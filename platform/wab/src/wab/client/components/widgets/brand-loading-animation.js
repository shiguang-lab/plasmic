/** The same construction and waiting animation runs before and after React starts.
 * @param {SVGSVGElement} svg
 * @returns {(() => void) | undefined}
 */
exports.animateBrandLoading = function animateBrandLoading(svg) {
  const solid = svg.querySelector("[data-solid]");
  const scaffold = svg.querySelector("[data-scaffold]");
  const image = svg.parentElement?.querySelector("[data-construction]");
  const sheen = svg.parentElement?.querySelector("[data-sheen]");
  if (!solid || !scaffold || !image || !sheen) {
    return;
  }
  const duration = Number(image.dataset.duration);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let animations = [];
  let generation = 0;
  let request;
  let imageUrl;
  const showStatic = () => {
    image.style.opacity = "0";
    svg.style.opacity = "1";
    scaffold.setAttribute("opacity", "0");
    solid.setAttribute("opacity", "1");
  };
  const stop = () => {
    generation++;
    request?.abort();
    image.onload = image.onerror = null;
    image.removeAttribute("src");
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    imageUrl = undefined;
    animations.forEach((animation) => animation.cancel());
    animations = [];
    showStatic();
  };
  const start = () => {
    stop();
    if (reducedMotion.matches) {
      return;
    }
    const current = generation;
    scaffold.setAttribute("opacity", ".55");
    solid.setAttribute("opacity", "0");
    request = new AbortController();
    // Each instance needs its own image timeline: Chromium shares the playback
    // position of animated images with the same URL. Blob URLs replay from frame
    // zero without cache-busting the bundled asset or retaining decoded frames.
    fetch(image.dataset.src, { signal: request.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Loading animation unavailable");
        }
        return response.blob();
      })
      .then((blob) => {
        if (current !== generation) {
          return;
        }
        imageUrl = URL.createObjectURL(blob);
        image.onload = () => {
          if (current !== generation) {
            return;
          }
          image.style.opacity = "1";
          const fade = Array.from({ length: 65 }, (_, i) => {
            const x = Math.max(0, Math.min(1, ((i / 64) * 0.57 - 0.2) / 0.4));
            return {
              opacity: i === 64 ? 0 : 1 - x * x * (3 - 2 * x),
              offset: i / 64,
            };
          });
          // Animate the SVG root, which contains only the static, theme-aware
          // scaffold. Color reveal and moving paths are decoded off the main
          // thread; no animation frame callbacks or SVG repaint loop remain.
          animations.push(svg.animate(fade, { duration, fill: "forwards" }));
          animations.push(
            sheen.animate(
              [
                { transform: "translateX(-25%)", opacity: 0, offset: 0 },
                { transform: "translateX(-9%)", opacity: 1, offset: 0.08 },
                { transform: "translateX(139%)", opacity: 1, offset: 0.82 },
                { transform: "translateX(175%)", opacity: 0, offset: 1 },
              ],
              {
                duration: 2400,
                iterations: Infinity,
                easing: "linear",
                delay: duration,
                fill: "both",
              },
            ),
          );
        };
        image.onerror = () => {
          if (current === generation) {
            showStatic();
          }
        };
        image.src = imageUrl;
      })
      .catch(() => {
        if (current === generation) {
          showStatic();
        }
      });
  };
  reducedMotion.addEventListener("change", start);
  start();
  return () => {
    stop();
    reducedMotion.removeEventListener("change", start);
  };
};
