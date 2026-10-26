import { PenFiles } from "@/wab/client/pen-importer/files";
import type {
  PenAsset,
  PenLayer,
  PenNode,
} from "@/wab/client/pen-importer/types";
import { assert } from "@/wab/shared/common";
import { icons } from "lucide";

const xml = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c] as string,
  );
const px = (n: number) => `${n}px`;
const alignment = (v: string) =>
  ({
    start: "flex-start",
    end: "flex-end",
    space_between: "space-between",
    space_around: "space-around",
  })[v] ?? v;

export class PenStyles {
  readonly assets: PenAsset[] = [];
  readonly warnings = new Set<string>();
  constructor(private files: PenFiles) {}

  private asset(
    data: string,
    name: string,
    svg?: string,
    width?: number,
    height?: number,
  ) {
    const existing = this.assets.find((a) => a.data === data && a.svg === svg);
    if (existing) {return existing.id;}
    const id = `__PEN_ASSET_${this.assets.length}__`;
    this.assets.push({ id, data, name, svg, width, height });
    return id;
  }

  private paints(fill: any, file: string): string[] {
    if (!fill) {return [];}
    return (Array.isArray(fill) ? fill : [fill])
      .flatMap((paint) => {
        if (typeof paint === "string")
          {return [`linear-gradient(${paint}, ${paint})`];}
        if (paint.enabled === false) {return [];}
        if (paint.type === "color")
          {return [`linear-gradient(${paint.color}, ${paint.color})`];}
        if (paint.type === "image") {
          assert(typeof paint.url === "string", "Pen image has no URL");
          const data = paint.url.startsWith("data:image/")
            ? paint.url
            : this.files.data(this.files.resolve(file, paint.url));
          const id = this.asset(
            data,
            paint.url.startsWith("data:")
              ? "Image"
              : (paint.url.split("/").pop() ?? "Image"),
          );
          if (paint.transform)
            {this.warnings.add("Image crop transforms are not preserved");}
          return [
            `${id} center / ${paint.mode === "stretch" ? "100% 100%" : (paint.mode ?? "cover")} no-repeat`,
          ];
        }
        if (paint.type === "gradient") {
          const stops = (paint.colors ?? [])
            .map((s: any) => `${s.color} ${s.position * 100}%`)
            .join(", ");
          if (!stops) {return [];}
          if (paint.gradientType === "angular")
            {return [
              `conic-gradient(from ${-(paint.rotation ?? 0)}deg, ${stops})`,
            ];}
          if (paint.gradientType === "radial")
            {return [
              `radial-gradient(ellipse at ${(paint.center?.x ?? 0.5) * 100}% ${(paint.center?.y ?? 0.5) * 100}%, ${stops})`,
            ];}
          return [`linear-gradient(${-(paint.rotation ?? 0)}deg, ${stops})`];
        }
        throw new Error(`Unsupported Pen fill: ${paint.type}`);
      })
      .reverse();
  }

  layer(
    n: PenNode,
    children: PenLayer[],
    file: string,
    parent?: PenNode,
  ): PenLayer {
    const s: Record<string, string> = {
      position: "relative",
      "flex-shrink": "0",
    };
    const result: PenLayer = { name: n.name ?? n.type, styles: s, children };
    const free =
      parent?.layout === "none" ||
      parent?.type === "group" ||
      n.layoutPosition === "absolute";
    if (free) {
      s.position = "absolute";
      s.left = px(n.x ?? 0);
      s.top = px(n.y ?? 0);
    }
    for (const dimension of ["width", "height"]) {
      const value = n[dimension];
      if (typeof value === "number") {
        assert(Number.isFinite(value) && value >= 0, "Invalid Pen dimensions");
        s[dimension] = px(value);
      } else if (
        value === undefined ||
        /^fit_content(?:\([\d.]+\))?$/.test(value)
      )
        {s[dimension] = "wrap";}
      else if (/^fill_container(?:\([\d.]+\))?$/.test(value)) {
        const main = parent?.layout === "vertical" ? "height" : "width";
        if (parent && parent.layout !== "none" && dimension === main && !free) {
          s["flex-grow"] = "1";
          s["flex-basis"] = "0px";
          s[`min-${dimension}`] = "0px";
        } else {s[dimension] = "100%";}
      } else {throw new Error(`Unsupported Pen size: ${value}`);}
    }
    if (n.type === "frame" || n.type === "group") {
      if (n.type === "group" || n.layout === "none") {s.display = "block";}
      else {
        s.display = "flex";
        s["flex-direction"] = n.layout === "vertical" ? "column" : "row";
        s["align-items"] = alignment(n.alignItems ?? "start");
        s["justify-content"] = alignment(n.justifyContent ?? "start");
        if (n.gap !== undefined)
          {s[n.layout === "vertical" ? "row-gap" : "column-gap"] = px(n.gap);}
      }
      if (n.padding !== undefined) {
        const p = Array.isArray(n.padding) ? n.padding : [n.padding];
        const sides =
          p.length === 1
            ? [p[0], p[0], p[0], p[0]]
            : p.length === 2
              ? [p[0], p[1], p[0], p[1]]
              : p;
        ["top", "right", "bottom", "left"].forEach(
          (side, i) => (s[`padding-${side}`] = px(sides[i])),
        );
      }
    }
    if (n.type === "group") {
      // A Pen group derives its bounds from children; absolutely positioned
      // children do not contribute to CSS intrinsic sizing.
      for (const [dimension, offset] of [
        ["width", "left"],
        ["height", "top"],
      ]) {
        if (s[dimension] === "wrap")
          {s[dimension] = px(
            Math.max(
              1,
              ...children.map(
                (child) =>
                  (parseFloat(child.styles[offset]) || 0) +
                  (parseFloat(child.styles[dimension]) || 0),
              ),
            ),
          );}
      }
    }
    if (n.clip) {s.overflow = "hidden";}
    if (n.opacity !== undefined) {s.opacity = String(n.opacity);}
    if (n.rotation || n.flipX || n.flipY) {
      s["transform-origin"] = "top left";
      s.transform = `rotate(${-(n.rotation ?? 0)}deg) scale(${n.flipX ? -1 : 1}, ${n.flipY ? -1 : 1})`;
    }
    if (n.cornerRadius !== undefined) {
      const radii = Array.isArray(n.cornerRadius)
        ? n.cornerRadius
        : Array(4).fill(n.cornerRadius);
      ["top-left", "top-right", "bottom-right", "bottom-left"].forEach(
        (corner, i) => (s[`border-${corner}-radius`] = px(radii[i])),
      );
    }
    const bg = this.paints(n.fill, file);
    if (bg.length) {s.background = bg.join(", ");}
    if (n.stroke) {
      const paints = Array.isArray(n.stroke) ? n.stroke : [n.stroke];
      const paint = paints.find(
        (p: any) =>
          typeof p === "string" || (p.enabled !== false && p.type === "color"),
      );
      const color = typeof paint === "string" ? paint : paint?.color;
      if (color) {
        for (const side of ["top", "right", "bottom", "left"]) {
          s[`border-${side}-color`] = color;
          s[`border-${side}-style`] = "solid";
          s[`border-${side}-width`] = px(
            typeof n.strokeWidth === "object"
              ? (n.strokeWidth[side] ?? 0)
              : (n.strokeWidth ?? 1),
          );
        }
        if (n.strokeAlignment && n.strokeAlignment !== "inner")
          {this.warnings.add(
            "Centered and outer strokes are imported as inner borders",
          );}
      } else {this.warnings.add("Non-solid borders are not preserved");}
    }
    const shadows: string[] = [];
    for (const effect of n.effect
      ? Array.isArray(n.effect)
        ? n.effect
        : [n.effect]
      : []) {
      if (effect.enabled === false) {continue;}
      if (effect.type === "shadow")
        {shadows.push(
          `${effect.shadowType === "inner" ? "inset " : ""}${px(effect.offset?.x ?? 0)} ${px(effect.offset?.y ?? 0)} ${px(effect.blur ?? 0)} ${effect.color ?? "#00000040"}`,
        );}
      else if (effect.type === "blur")
        {s.filter = `blur(${px(effect.radius ?? 0)})`;}
      else if (effect.type === "background_blur")
        {s["backdrop-filter"] = `blur(${px(effect.radius ?? 0)})`;}
      else {throw new Error(`Unsupported Pen effect: ${effect.type}`);}
    }
    if (shadows.length) {s["box-shadow"] = shadows.join(", ");}
    if (["text", "note", "context", "prompt"].includes(n.type)) {
      result.text = String(n.content ?? "");
      const color =
        typeof n.fill === "string"
          ? n.fill
          : !Array.isArray(n.fill) && n.fill?.type === "color"
            ? n.fill.color
            : undefined;
      if (color) {
        s.color = color;
        delete s.background;
      }
      if (n.fontFamily) {s["font-family"] = n.fontFamily;}
      if (n.fontSize) {s["font-size"] = px(n.fontSize);}
      if (n.fontWeight) {s["font-weight"] = String(n.fontWeight);}
      if (n.fontStyle) {s["font-style"] = n.fontStyle;}
      if (n.lineHeight) {s["line-height"] = String(n.lineHeight);}
      if (n.letterSpacing) {s["letter-spacing"] = px(n.letterSpacing);}
      if (n.textAlign) {s["text-align"] = n.textAlign;}
      const decorations = [
        n.underline && "underline",
        n.strikethrough && "line-through",
      ].filter(Boolean);
      if (decorations.length) {s["text-decoration-line"] = decorations.join(" ");}
      s["white-space"] = "pre-wrap";
      if (!n.textGrowth || n.textGrowth === "auto") {
        s.width = "wrap";
        s.height = "wrap";
        s["white-space"] = "pre";
      } else if (n.textGrowth === "fixed-width") {s.height = "wrap";}
      if (
        n.textGrowth === "fixed-width-height" &&
        n.textAlignVertical &&
        n.textAlignVertical !== "top"
      ) {
        s.display = "flex";
        s["flex-direction"] = "column";
        s["justify-content"] =
          n.textAlignVertical === "bottom" ? "flex-end" : "center";
      }
    }
    if (["path", "ellipse", "polygon", "icon"].includes(n.type)) {
      const solid = (paint: any) =>
        !paint ||
        typeof paint === "string" ||
        (!Array.isArray(paint) && paint.type === "color");
      assert(
        solid(n.fill) && solid(n.stroke),
        `Unsupported Pen vector paint (${n.name ?? n.type})`,
      );
      const width = typeof n.width === "number" && n.width > 0 ? n.width : 24;
      const height =
        typeof n.height === "number" && n.height > 0 ? n.height : 24;
      let body: string, viewBox: number[];
      const fill =
        typeof n.fill === "string" ? n.fill : (n.fill?.color ?? "none");
      const stroke =
        typeof n.stroke === "string" ? n.stroke : (n.stroke?.color ?? "none");
      const attrs = `fill="${xml(fill)}" stroke="${xml(stroke)}" stroke-width="${xml(n.strokeWidth ?? 1)}"`;
      viewBox = n.viewBox ?? [0, 0, width, height];
      if (n.type === "icon") {
        assert(
          !n.library || n.library === "lucide",
          `Unsupported Pen icon library: ${n.library}`,
        );
        const key = String(n.icon ?? "")
          .split(/[-_ ]/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join("");
        const icon = (
          icons as Record<string, [string, Record<string, unknown>][]>
        )[key];
        assert(icon, `Unknown Lucide icon: ${n.icon}`);
        body = `<g fill="none" stroke="${xml(fill === "none" ? "#000000" : fill)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon
          .map(
            ([tag, props]) =>
              `<${tag} ${Object.entries(props)
                .filter(([k]) => k !== "key")
                .map(([k, v]) => `${k}="${xml(v)}"`)
                .join(" ")}/>`,
          )
          .join("")}</g>`;
        viewBox = [0, 0, 24, 24];
      } else if (n.type === "path")
        {body = `<path d="${xml(n.geometry ?? "")}" fill-rule="${n.fillRule === "evenodd" ? "evenodd" : "nonzero"}" ${attrs}/>`;}
      else if (n.type === "ellipse") {
        if (n.innerRadius || n.startAngle || n.sweepAngle)
          {this.warnings.add("Ellipse arcs are imported as complete ellipses");}
        body = `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" ${attrs}/>`;
      } else {
        const count = Math.min(100, Math.max(3, n.polygonCount ?? 3));
        const points = Array.from({ length: count }, (_, i) => {
          const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
          return `${width / 2 + (Math.cos(angle) * width) / 2},${height / 2 + (Math.sin(angle) * height) / 2}`;
        }).join(" ");
        body = `<polygon points="${points}" ${attrs}/>`;
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox.join(" ")}">${body}</svg>`;
      result.asset = this.asset("", result.name, svg, width, height);
      delete s.background;
      for (const prop of Object.keys(s))
        {if (prop.startsWith("border-")) {delete s[prop];}}
      s.width ??= px(width);
      s.height ??= px(height);
    }
    return result;
  }
}
