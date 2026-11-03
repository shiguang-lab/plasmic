/** The same finite logo construction animation runs before and after React starts.
 * @param {SVGSVGElement} svg
 * @returns {(() => void) | undefined}
 */
exports.animateBrandLoading = function animateBrandLoading(svg) {
  const duration = 2800;
  const namespace = "http://www.w3.org/2000/svg";
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const smooth = (value) => {
    const x = clamp(value);
    return x * x * (3 - 2 * x);
  };

  const solid = svg.querySelector("[data-solid]");
  const scaffold = svg.querySelector("[data-scaffold]");
  const lights = svg.querySelector("[data-lights]");
  const front = svg.querySelector("[data-front]");
  const tail = svg.querySelector("[data-tail]");
  if (!solid || !scaffold || !lights || !front || !tail) {return;}
  const maskNode = svg.querySelector("mask");
  if (!maskNode) {return;}
  const mask = `url(#${maskNode.id})`;
  const tracks = Array.from(
    svg.querySelectorAll("[data-track]"),
  ).map((shape, index) => ({
    shape,
    index,
    length: shape.getTotalLength(),
    pieces: Array.from({ length: 56 }, () => {
      const node = svg.ownerDocument.createElementNS(namespace, "path");
      lights.appendChild(node);
      return node;
    }),
  }));
  const render = (progress) => {
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
    front.setAttribute("offset", String(Math.max(0, ready * 1.22 - 0.22)));
    tail.setAttribute("offset", String(Math.min(1, ready * 1.22)));
    if (ready === 1) {solid.removeAttribute("mask");}
    else {solid.setAttribute("mask", mask);}
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let started = performance.now();
  let last = 0;
  function tick(time) {
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
  render(reducedMotion.matches ? 1 : 0);
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    reducedMotion.removeEventListener("change", reduceMotion);
    lights.replaceChildren();
  };
};
