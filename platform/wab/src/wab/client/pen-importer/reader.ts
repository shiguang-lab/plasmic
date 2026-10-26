import { PenFiles } from "@/wab/client/pen-importer/files";
import { runPenScript } from "@/wab/client/pen-importer/scripts";
import { PenStyles } from "@/wab/client/pen-importer/styles";
import type {
  PenChoice,
  PenDesign,
  PenDocument,
  PenFileEntry,
  PenLayer,
  PenNode,
} from "@/wab/client/pen-importer/types";
import { assert, ensure } from "@/wab/shared/common";
import { ParseError, parse } from "jsonc-parser";

interface Source {
  file: string;
  data: PenDocument;
  nodes: Map<string, PenNode>;
}
interface Overrides {
  source: Source;
  values: Record<string, PenNode>;
}

export class PenFileReader {
  private selectedFiles?: PenFiles;
  private get files() {
    return ensure(
      this.selectedFiles,
      "Choose a Pen file before reading canvases",
    );
  }
  private sources = new Map<string, Source>();

  read(entries: PenFileEntry[]): PenChoice[] {
    this.selectedFiles = new PenFiles(entries);
    this.sources.clear();
    const designs = [...this.files.files.keys()].filter((f) =>
      /\.pen$/i.test(f),
    );
    assert(
      designs.length > 0,
      "Choose a .pen file, a ZIP, or a folder containing a .pen file",
    );
    const preferred = designs.filter((f) => !/\.lib\.pen$/i.test(f));
    return (preferred.length ? preferred : designs).map((file) => ({
      id: file,
      name: file,
    }));
  }

  private source(file: string): Source {
    const cached = this.sources.get(file);
    if (cached) {return cached;}
    const errors: ParseError[] = [];
    const data = parse(this.files.text(file), errors, {
      allowTrailingComma: true,
    }) as PenDocument;
    assert(
      !errors.length && data && Array.isArray(data.children),
      `Invalid Pen document: ${file}`,
    );
    assert(
      /^2\.(17|18|19|20|21)$/.test(data.version),
      `Unsupported Pen version: ${data.version}`,
    );
    const nodes = new Map<string, PenNode>();
    let count = 0;
    const index = (value: any, depth: number) => {
      assert(
        depth <= 256 && ++count <= 500000,
        "Pen document is too large or deeply nested",
      );
      if (Array.isArray(value)) {value.forEach((v) => index(v, depth + 1));}
      else if (value && typeof value === "object") {
        if (typeof value.id === "string" && typeof value.type === "string") {
          assert(!nodes.has(value.id), `Duplicate Pen node ID: ${value.id}`);
          nodes.set(value.id, value);
        }
        Object.values(value).forEach((v) => index(v, depth + 1));
      }
    };
    index(data.children, 0);
    const source = { file, data, nodes };
    this.sources.set(file, source);
    return source;
  }

  async frames(file: string): Promise<PenChoice[]> {
    await this.files.load(file);
    return this.source(file)
      .data.children.filter((n) => n.enabled !== false)
      .map((n, i) => ({
        id: ensure(n.id, "Missing Pen layer ID"),
        name: n.name ?? `画布 ${i + 1}`,
      }));
  }

  private async loadSources(file: string, visited = new Set<string>()): Promise<void> {
    if (visited.has(file)) {return;}
    visited.add(file);
    await this.files.load(file);
    const source = this.source(file);
    for (const uri of Object.values(source.data.imports ?? {})) {
      await this.loadSources(this.files.resolve(file, uri), visited);
    }
  }

  private lookup(source: Source, key: string): { source: Source; key: string } {
    const colon = key.indexOf(":");
    if (colon < 0) {return { source, key };}
    const uri = ensure(
      source.data.imports?.[key.slice(0, colon)],
      `Missing Pen library: ${key}`,
    );
    return this.lookup(
      this.source(this.files.resolve(source.file, uri)),
      key.slice(colon + 1),
    );
  }

  private variable(
    value: any,
    source: Source,
    theme: Record<string, string>,
    trail: string[] = [],
  ): any {
    if (typeof value === "string" && value.startsWith("$")) {
      const target = this.lookup(source, value.slice(1));
      const identity = `${target.source.file}:${target.key}`;
      assert(
        !trail.includes(identity) && trail.length < 128,
        `Cyclic Pen variable: ${value}`,
      );
      let raw = ensure(
        target.source.data.variables?.[target.key],
        `Missing Pen variable: ${value}`,
      ).value;
      if (Array.isArray(raw)) {
        const modes = {
          ...Object.fromEntries(
            Object.entries(target.source.data.themes ?? {}).map(
              ([key, values]) => [key, values[0]],
            ),
          ),
          ...theme,
        };
        raw = ensure(
          raw
            .filter((entry) =>
              Object.entries(entry.theme ?? {}).every(
                ([key, v]) => modes[key] === v,
              ),
            )
            .at(-1),
          `No Pen variable value for theme: ${value}`,
        ).value;
      }
      return this.variable(raw, target.source, theme, [...trail, identity]);
    }
    if (Array.isArray(value))
      {return value.map((v) => this.variable(v, source, theme, trail));}
    if (value && typeof value === "object")
      {return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          k,
          this.variable(v, source, theme, trail),
        ]),
      );}
    return value;
  }

  private async fields(
    n: PenNode,
    source: Source,
    theme: Record<string, string>,
  ): Promise<PenNode> {
    const fields = Object.fromEntries(
      Object.entries(n).filter(
        ([key]) => !["children", "descendants"].includes(key),
      ),
    );
    const resolved = this.variable(fields, source, theme) as PenNode;
    // Bind relative resources before crossing a library boundary.
    const bindPaint = async (paint: any): Promise<any> => {
      if (Array.isArray(paint)) {return Promise.all(paint.map(bindPaint));}
      if (
        paint?.type === "image" &&
        paint.url &&
        !paint.url.startsWith("data:image/")
      )
        {
          const path = this.files.resolve(source.file, paint.url);
          await this.files.load(path);
          return {
          ...paint,
          url: this.files.data(path),
        };}
      return paint;
    };
    if (resolved.fill) {resolved.fill = await bindPaint(resolved.fill);}
    if (resolved.scriptUri && this.files.files.has(resolved.scriptUri)) {
      /* Already bound. */
    } else if (resolved.scriptUri)
      {resolved.scriptUri = this.files.resolve(source.file, resolved.scriptUri);}
    return { ...resolved, children: n.children, descendants: n.descendants };
  }

  async convert(file: string, frame: string): Promise<PenDesign> {
    await this.loadSources(file);
    const source = this.source(file);
    const root = ensure(
      source.data.children.find((n) => n.id === frame),
      "Unknown Pen canvas",
    );
    const styles = new PenStyles(this.files);
    let count = 0;
    const dimension = (
      n: PenNode,
      key: "width" | "height",
      available: number,
    ) => {
      const v = n[key];
      if (typeof v === "number") {return v;}
      const fallback = typeof v === "string" && /\(([\d.]+)\)/.exec(v);
      if (fallback) {return Number(fallback[1]);}
      return available;
    };
    const expand = async (
      raw: PenNode,
      doc: Source,
      inherited: Record<string, string>,
      parent: PenNode | undefined,
      size: { width: number; height: number },
      overrides: Overrides[] = [],
      trail: string[] = [],
      depth = 0,
      childSource = doc,
    ): Promise<PenLayer | undefined> => {
      assert(
        depth <= 128 && ++count <= 100000,
        "Pen import expands to too many layers",
      );
      let n = { ...raw };
      let theme = { ...inherited, ...n.theme };
      const pending: Overrides[] = [];
      for (const group of overrides) {
        const rest: Record<string, PenNode> = {};
        for (const [path, patch] of Object.entries(group.values)) {
          const [head, ...tail] = path.split("/");
          if (head.split(":").pop() === raw.id) {
            if (tail.length) {rest[tail.join("/")] = patch;}
            else {
              const fields = await this.fields(patch, group.source, theme);
              n = patch.type
                ? fields
                : {
                    ...n,
                    ...Object.fromEntries(
                      Object.entries(fields).filter(([, v]) => v !== undefined),
                    ),
                  };
              if (patch.children) {childSource = group.source;}
              theme = { ...theme, ...patch.theme };
            }
          } else {rest[path] = patch;}
        }
        pending.push({ source: group.source, values: rest });
      }
      n = await this.fields(n, doc, theme);
      if (n.enabled === false) {return;}
      if (n.type === "ref") {
        const target = this.lookup(
          doc,
          ensure(n.ref, "Missing Pen component reference"),
        );
        const identity = `${target.source.file}:${target.key}`;
        assert(
          !trail.includes(identity),
          `Cyclic Pen component reference: ${n.ref}`,
        );
        const base = ensure(
          target.source.nodes.get(target.key),
          `Missing Pen component: ${n.ref}`,
        );
        const own = Object.fromEntries(
          Object.entries(n).filter(
            ([k, v]) =>
              !["type", "ref", "descendants", "children"].includes(k) &&
              v !== undefined,
          ),
        );
        const merged: PenNode = {
          ...base,
          ...own,
          inputs: { ...base.inputs, ...n.inputs },
          children: n.children ?? base.children,
        };
        // Instance descendants have precedence over a referenced origin's overrides.
        const groups = [
          ...(base.descendants
            ? [{ source: target.source, values: base.descendants }]
            : []),
          ...(n.descendants ? [{ source: doc, values: n.descendants }] : []),
          ...pending,
        ];
        delete merged.descendants;
        return expand(
          merged,
          target.source,
          theme,
          parent,
          size,
          groups,
          [...trail, identity],
          depth + 1,
          n.children ? childSource : target.source,
        );
      }
      const width = dimension(n, "width", size.width);
      const height = dimension(n, "height", size.height);
      let children = n.children ?? [];
      if (n.type === "script") {
        const identity = `script:${n.scriptUri}`;
        assert(!trail.includes(identity), `Cyclic Pen script: ${n.scriptUri}`);
        const scriptPath = ensure(n.scriptUri, "Pen script has no file");
        await this.files.load(scriptPath);
        const script = this.files.text(scriptPath);
        children = await runPenScript(script, { ...n, width, height });
        trail = [...trail, identity];
        n = { ...n, type: "frame", layout: "none" };
        if (
          typeof n.height !== "number" &&
          !String(n.height).startsWith("fill_container")
        )
          {n.height = Math.max(
            1,
            ...children.map(
              (c) => (c.y ?? 0) + (typeof c.height === "number" ? c.height : 0),
            ),
          );}
        childSource = doc;
      }
      assert(
        [
          "frame",
          "group",
          "rectangle",
          "text",
          "path",
          "ellipse",
          "polygon",
          "icon",
          "note",
          "prompt",
          "context",
        ].includes(n.type),
        `Unsupported Pen layer: ${n.type} (${n.name ?? n.id ?? ""})`,
      );
      const p = Array.isArray(n.padding) ? n.padding : [n.padding ?? 0];
      const horizontal =
        p.length === 4 ? p[1] + p[3] : p.length === 2 ? p[1] * 2 : p[0] * 2;
      const vertical = p.length === 4 ? p[0] + p[2] : p[0] * 2;
      const childSize = {
        width: Math.max(0, width - horizontal),
        height: Math.max(0, height - vertical),
      };
      const converted: PenLayer[] = [];
      for (const child of children) {
        const layer = await expand(
          child,
          childSource,
          theme,
          n,
          childSize,
          pending,
          trail,
          depth + 1,
        );
        if (layer) {converted.push(layer);}
      }
      return styles.layer(n, converted, doc.file, parent);
    };
    const defaults = Object.fromEntries(
      Object.entries(source.data.themes ?? {}).map(([key, values]) => [
        key,
        values[0],
      ]),
    );
    const resolvedRoot = await this.fields(root, source, {
      ...defaults,
      ...root.theme,
    });
    const width = dimension(resolvedRoot, "width", 1200);
    const height = dimension(resolvedRoot, "height", 800);
    const layer = ensure(
      await expand(root, source, defaults, undefined, { width, height }),
      "The selected Pen canvas has no visible layers",
    );
    layer.styles.position = "relative";
    delete layer.styles.left;
    delete layer.styles.top;
    return {
      root: layer,
      width,
      height,
      assets: styles.assets,
      warnings: [...styles.warnings],
    };
  }
}
