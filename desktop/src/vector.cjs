const paper = require("paper");
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char],
  );
function makeVector(input) {
  const scope = new paper.PaperScope();
  scope.setup(new scope.Size(input.width, input.height));
  try {
    const paths = input.paths.map(
      (data) => new scope.CompoundPath({ pathData: data, insert: false }),
    );
    for (const path of paths) {
      if (
        !path.children.length ||
        path.children.some((child) =>
          child.segments.some(
            (segment) =>
              ![
                segment.point.x,
                segment.point.y,
                segment.handleIn.x,
                segment.handleIn.y,
                segment.handleOut.x,
                segment.handleOut.y,
              ].every(Number.isFinite),
          ),
        )
      )
        throw new Error("Invalid SVG path geometry");
      if (input.operation && path.children.some((child) => !child.closed))
        throw new Error("Boolean operations require closed paths");
    }
    let result = paths;
    if (input.operation)
      result = [
        paths
          .slice(1)
          .reduce(
            (left, right) => left[input.operation](right, { insert: false }),
            paths[0],
          ),
      ];
    result.forEach((path) => path.reorient(true, true));
    const fill = input.fill || "#1677ff";
    if (!/^(#[\da-f]{3,8}|none|currentColor|[a-z]+)$/i.test(fill))
      throw new Error("Use a hex or named solid fill");
    const pathData = result.map((path) => path.pathData);
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}">${pathData.map((data) => `<path d="${escape(data)}" fill="${escape(fill)}" fill-rule="nonzero"/>`).join("")}</svg>`,
      paths: pathData,
      area: result.reduce((total, path) => total + Math.abs(path.area), 0),
      bounds: result.map((path) => ({
        x: path.bounds.x,
        y: path.bounds.y,
        width: path.bounds.width,
        height: path.bounds.height,
      })),
    };
  } finally {
    scope.remove();
  }
}
module.exports = { makeVector };
