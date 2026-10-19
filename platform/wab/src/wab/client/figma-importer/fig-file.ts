import type {
  FigmaData,
  JSONObject,
  Serializable,
} from "@/wab/client/figma-importer/types";
import { assert, ensure } from "@/wab/shared/common";
import { Buffer } from "buffer";
import { decompressSync, unzipSync } from "fflate";
import { decompress as decompressZstd } from "fzstd";
import { compileSchema, decodeBinarySchema } from "kiwi-schema";
import { inverse } from "transformation-matrix";

export interface FigPage {
  id: string;
  name: string;
}

export interface FigFileReader {
  read(bytes: Uint8Array): FigPage[];
  convert(pageId: string): FigmaData;
}

type Guid = { sessionID: number; localID: number };
type Point = { x: number; y: number };
type Color = { r: number; g: number; b: number; a?: number };
type Matrix = {
  m00: number;
  m01: number;
  m02: number;
  m10: number;
  m11: number;
  m12: number;
};
type Paint = {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: Color;
  colorVar?: any;
  blendMode?: string;
  transform?: Matrix;
  stops?: { position: number; color: Color; colorVar?: any }[];
  image?: { hash?: Uint8Array };
  imageScaleMode?: string;
  imageScale?: number;
};

// Kiwi fields are distinct from the plugin API fields consumed by figma.tsx.
// The embedded binary schema decodes these records before they are converted.
interface FigNode {
  [field: string]: any;
  guid: Guid;
  type: string;
  parentIndex?: { guid: Guid; position: string };
  name?: string;
  visible?: boolean;
  size?: Point;
  transform?: Matrix;
  fillPaints?: Paint[];
  strokePaints?: Paint[];
}

interface FigMessage {
  nodeChanges: FigNode[];
  blobs?: { bytes: Uint8Array }[];
}

const guidKey = (guid: Guid) => `${guid.sessionID}:${guid.localID}`;
const transform = (matrix?: Matrix): number[][] => [
  [matrix?.m00 ?? 1, matrix?.m01 ?? 0, matrix?.m02 ?? 0],
  [matrix?.m10 ?? 0, matrix?.m11 ?? 1, matrix?.m12 ?? 0],
];

function inflate(bytes: Uint8Array) {
  return bytes[0] === 0x28 &&
    bytes[1] === 0xb5 &&
    bytes[2] === 0x2f &&
    bytes[3] === 0xfd
    ? decompressZstd(bytes)
    : decompressSync(bytes);
}

function imageDataUri(bytes: Uint8Array): string {
  const mime =
    bytes[0] === 0xff && bytes[1] === 0xd8
      ? "image/jpeg"
      : bytes[0] === 0x47 && bytes[1] === 0x49
        ? "image/gif"
        : bytes[0] === 0x52 && bytes[8] === 0x57
          ? "image/webp"
          : "image/png";
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

function decodeCanvas(bytes: Uint8Array): FigMessage {
  assert(
    bytes.length >= 12 &&
      Buffer.from(bytes.subarray(0, 8)).toString() === "fig-kiwi",
    "Invalid Figma file header",
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  const chunks: Uint8Array[] = [];
  while (offset < bytes.length) {
    assert(offset + 4 <= bytes.length, "Truncated Figma file");
    const size = view.getUint32(offset, true);
    offset += 4;
    assert(
      size > 0 && size <= bytes.length - offset,
      "Invalid Figma chunk size",
    );
    chunks.push(bytes.subarray(offset, offset + size));
    offset += size;
  }
  assert(chunks.length >= 2, "Figma schema or document is missing");
  const schema = decodeBinarySchema(inflate(chunks[0]));
  // compileSchema generates JS. Never allow file-controlled names to become code.
  const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
  assert(
    schema.package === null || identifier.test(schema.package),
    "Invalid Figma schema package",
  );
  for (const definition of schema.definitions) {
    assert(identifier.test(definition.name), "Invalid Figma schema definition");
    for (const field of definition.fields) {
      assert(identifier.test(field.name), "Invalid Figma schema field");
      assert(
        field.type === null || identifier.test(field.type),
        "Invalid Figma schema type",
      );
    }
  }
  const codec = compileSchema(schema);
  assert(
    typeof codec.decodeMessage === "function",
    "Figma Message schema is missing",
  );
  const message: FigMessage = codec.decodeMessage(inflate(chunks[1]));
  assert(Array.isArray(message.nodeChanges), "Figma document has no node data");
  return message;
}

/** Reads both ZIP exports and the raw fig-kiwi stream, entirely in the browser. */
export class FigFile implements FigFileReader {
  private nodes = new Map<string, FigNode>();
  private children = new Map<string, FigNode[]>();
  private images: Record<string, Uint8Array> = {};
  private blobs: { bytes: Uint8Array }[] = [];
  private pages: FigPage[] = [];
  private references = new Map<string, FigNode>();

  read(bytes: Uint8Array): FigPage[] {
    this.nodes.clear();
    this.children.clear();
    this.references.clear();
    this.images = {};
    let canvas = bytes;
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      const files = unzipSync(bytes, {
        filter: (file) =>
          file.name === "canvas.fig" || file.name.startsWith("images/"),
      });
      canvas = ensure(files["canvas.fig"], "Figma ZIP has no canvas.fig");
      for (const [path, contents] of Object.entries(files)) {
        if (path.startsWith("images/") && contents.length) {
          this.images[path.slice("images/".length)] = contents;
        }
      }
    }
    const message = decodeCanvas(canvas);
    this.blobs = message.blobs ?? [];
    for (const node of message.nodeChanges) {
      if (node.guid && node.phase !== "REMOVED") {
        this.nodes.set(guidKey(node.guid), node);
        this.references.set(guidKey(node.guid), node);
        if (node.key) {
          this.references.set(node.key, node);
        }
        const setRef = this.referenceKey(node.variableSetID);
        if (node.type === "VARIABLE_SET" && setRef) {
          this.references.set(setRef, node);
        }
      }
    }
    for (const node of this.nodes.values()) {
      if (!node.parentIndex) {
        continue;
      }
      const parent = guidKey(node.parentIndex.guid);
      const siblings = this.children.get(parent) ?? [];
      siblings.push(node);
      this.children.set(parent, siblings);
    }
    for (const siblings of this.children.values()) {
      siblings.sort((a, b) => {
        const x = a.parentIndex?.position ?? "",
          y = b.parentIndex?.position ?? "";
        return x < y ? -1 : x > y ? 1 : 0;
      });
    }
    this.pages = (this.children.get("0:0") ?? [])
      .filter(
        (node) =>
          node.type === "CANVAS" &&
          node.visible !== false &&
          !node.internalOnly,
      )
      .map((node, index) => ({
        id: guidKey(node.guid),
        name: node.name || `Page${index + 1}`,
      }));
    return this.pages;
  }

  convert(pageId: string): FigmaData {
    assert(
      this.pages.some((page) => page.id === pageId),
      "Unknown Figma page",
    );
    const images: Record<string, string> = {};
    const vectors: Record<string, string> = {};
    let vectorIndex = 0;
    const convertPaints = (paints: Paint[] = []): JSONObject[] =>
      paints.flatMap((paint): JSONObject[] => {
        const base = {
          visible: paint.visible !== false,
          opacity: paint.opacity ?? 1,
          blendMode: paint.blendMode ?? "NORMAL",
        };
        if (paint.type === "SOLID" && paint.color) {
          return [
            {
              ...base,
              type: "SOLID",
              color: { ...paint.color },
              opacity: base.opacity * (paint.color.a ?? 1),
            },
          ];
        }
        if (paint.type.startsWith("GRADIENT_") && paint.stops) {
          return [
            {
              ...base,
              type: paint.type,
              gradientTransform: transform(paint.transform),
              gradientStops: paint.stops.map((stop) => ({
                position: stop.position,
                color: { ...stop.color },
              })),
            },
          ];
        }
        if (paint.type === "IMAGE" && paint.image?.hash) {
          const hash = Buffer.from(paint.image.hash).toString("hex");
          const bytes = ensure(
            this.images[hash],
            "Figma image is missing from the file",
          );
          images[hash] = imageDataUri(bytes);
          return [
            {
              ...base,
              type: "IMAGE",
              imageHash: hash,
              scaleMode:
                paint.imageScaleMode === "STRETCH"
                  ? "CROP"
                  : (paint.imageScaleMode ?? "FILL"),
              imageTransform: transform(paint.transform),
              scalingFactor: paint.imageScale ?? 1,
            },
          ];
        }
        return [];
      });

    const convert = (
      source: FigNode,
      ancestors: Set<string>,
      overrides: FigNode[] = [],
      inheritedModes = new Map<string, string>(),
      inheritedProps = new Map<string, any>(),
    ): JSONObject | undefined => {
      const id = guidKey(source.guid);
      assert(!ancestors.has(id), "Cyclic Figma node hierarchy");
      const path = new Set(ancestors).add(id);
      assert(path.size <= 512, "Figma hierarchy is too deep");
      let raw = { ...source };
      const nestedOverrides: FigNode[] = [];
      for (const override of overrides) {
        const guids: Guid[] = override.guidPath?.guids ?? [];
        const target = guids[0];
        if (
          !target ||
          guidKey(target) !== guidKey(raw.overrideKey ?? raw.guid)
        ) {
          continue;
        }
        if (guids.length === 1) {
          raw = { ...raw, ...override };
        } else {
          nestedOverrides.push({
            ...override,
            guidPath: { guids: guids.slice(1) },
          });
        }
      }
      let childSource = id;
      if (raw.type === "INSTANCE") {
        const ref: Guid | undefined =
          raw.overriddenSymbolID ?? raw.symbolData?.symbolID;
        const main = ref && this.nodes.get(guidKey(ref));
        if (main) {
          assert(
            !path.has(guidKey(main.guid)),
            "Cyclic Figma component instance",
          );
          path.add(guidKey(main.guid));
          raw = { ...main, ...raw };
          childSource = guidKey(main.guid);
          nestedOverrides.push(
            ...(raw.symbolData?.symbolOverrides ?? []),
            ...(raw.derivedSymbolData ?? []),
          );
        }
      }
      const modes = new Map(inheritedModes),
        properties = new Map(inheritedProps);
      for (const entry of raw.variableModeBySetMap?.entries ?? []) {
        const key = this.referenceKey(entry.variableSetID);
        if (key && entry.variableModeID) {
          modes.set(this.setKey(key), guidKey(entry.variableModeID));
        }
      }
      for (const definition of raw.componentPropDefs ?? []) {
        if (definition.id && !properties.has(guidKey(definition.id))) {
          properties.set(
            guidKey(definition.id),
            definition.varValue ?? { value: definition.initialValue },
          );
        }
      }
      for (const assignment of raw.componentPropAssignments ?? []) {
        if (assignment.defID) {
          properties.set(
            guidKey(assignment.defID),
            assignment.varValue ?? { value: assignment.value },
          );
        }
      }
      raw = this.resolveBindings(raw, modes, properties);
      const type =
        raw.type === "SYMBOL" ||
        raw.type === "INSTANCE" ||
        raw.type === "SECTION" ||
        raw.type === "BOOLEAN_OPERATION" ||
        raw.type === "GROUP"
          ? "FRAME"
          : raw.type === "ROUNDED_RECTANGLE"
            ? "RECTANGLE"
            : raw.type === "REGULAR_POLYGON"
              ? "POLYGON"
              : raw.type;
      if (
        ![
          "FRAME",
          "RECTANGLE",
          "TEXT",
          "ELLIPSE",
          "VECTOR",
          "LINE",
          "POLYGON",
          "STAR",
        ].includes(type)
      ) {
        return;
      }
      // Exported horizontal vector paths can have tiny negative float rounding.
      const width = Math.max(0, raw.size?.x ?? 0),
        height = Math.max(0, raw.size?.y ?? 0);
      assert(
        Number.isFinite(width) && Number.isFinite(height),
        "Invalid Figma node dimensions",
      );
      const matrix = transform(raw.transform);
      const node: JSONObject = {
        id,
        type,
        name: raw.name ?? type,
        visible: raw.visible !== false,
        locked: raw.locked ?? false,
        x: matrix[0][2],
        y: matrix[1][2],
        width,
        height,
        relativeTransform: matrix,
        opacity: raw.opacity ?? 1,
        blendMode: raw.blendMode ?? "PASS_THROUGH",
        isMask: raw.isMask ?? false,
        constraints: {
          horizontal: raw.horizontalConstraint ?? "MIN",
          vertical: raw.verticalConstraint ?? "MIN",
        },
        fills: convertPaints(raw.fillPaints),
        strokes: convertPaints(raw.strokePaints),
        strokeWeight: raw.strokeWeight ?? 1,
        strokeAlign: raw.strokeAlign ?? "INSIDE",
        strokeCap: raw.strokeCap ?? "NONE",
        strokeJoin: raw.strokeJoin ?? "MITER",
        dashPattern: raw.dashPattern ?? [],
        cornerRadius: raw.cornerRadius ?? 0,
        topLeftRadius:
          raw.rectangleTopLeftCornerRadius ?? raw.cornerRadius ?? 0,
        topRightRadius:
          raw.rectangleTopRightCornerRadius ?? raw.cornerRadius ?? 0,
        bottomLeftRadius:
          raw.rectangleBottomLeftCornerRadius ?? raw.cornerRadius ?? 0,
        bottomRightRadius:
          raw.rectangleBottomRightCornerRadius ?? raw.cornerRadius ?? 0,
        effects: (raw.effects ?? []).map((effect: any) => ({
          ...effect,
          type: effect.type === "FOREGROUND_BLUR" ? "LAYER_BLUR" : effect.type,
          visible: effect.visible !== false,
          radius: effect.radius ?? 0,
          offset: effect.offset ?? { x: 0, y: 0 },
          color: effect.color ?? { r: 0, g: 0, b: 0, a: 1 },
        })),
        layoutAlign:
          raw.stackChildAlignSelf === "STRETCH" ? "STRETCH" : "INHERIT",
        layoutGrow: raw.stackChildPrimaryGrow ? 1 : 0,
        layoutSizingHorizontal: "FIXED",
        layoutSizingVertical: "FIXED",
      };
      if (type === "FRAME") {
        const mode = ["HORIZONTAL", "VERTICAL"].includes(raw.stackMode)
          ? raw.stackMode
          : "NONE";
        Object.assign(node, {
          layoutMode: mode,
          primaryAxisSizingMode:
            raw.stackPrimarySizing === "FIXED" ? "FIXED" : "AUTO",
          counterAxisSizingMode:
            raw.stackCounterSizing === "RESIZE_TO_FIT_WITH_IMPLICIT_SIZE"
              ? "AUTO"
              : "FIXED",
          primaryAxisAlignItems: raw.stackPrimaryAlignItems ?? "MIN",
          counterAxisAlignItems:
            raw.stackCounterAlignItems === "BASELINE"
              ? "MIN"
              : (raw.stackCounterAlignItems ?? "MIN"),
          layoutWrap: raw.stackWrap === "WRAP" ? "WRAP" : "NO_WRAP",
          counterAxisAlignContent: "AUTO",
          paddingLeft: raw.stackHorizontalPadding ?? 0,
          paddingTop: raw.stackVerticalPadding ?? 0,
          paddingRight:
            raw.stackPaddingRight ?? raw.stackHorizontalPadding ?? 0,
          paddingBottom:
            raw.stackPaddingBottom ?? raw.stackVerticalPadding ?? 0,
          itemSpacing: raw.stackSpacing ?? 0,
          counterAxisSpacing: raw.stackCounterSpacing ?? 0,
          clipsContent:
            raw.type !== "GROUP" &&
            raw.type !== "BOOLEAN_OPERATION" &&
            !raw.frameMaskDisabled,
          children: (this.children.get(childSource) ?? []).flatMap((child) => {
            const result = convert(
              child,
              path,
              nestedOverrides,
              modes,
              properties,
            );
            return result ? [result] : [];
          }),
        });
      }
      if (type === "TEXT") {
        Object.assign(node, {
          characters: raw.textData?.characters ?? "",
          fontSize: raw.fontSize ?? 14,
          fontName: {
            family: raw.fontName?.family ?? "Arial",
            style: raw.fontName?.style ?? "Regular",
          },
          textAlignHorizontal: raw.textAlignHorizontal ?? "LEFT",
          textAlignVertical: raw.textAlignVertical ?? "TOP",
          textAutoResize: raw.textAutoResize ?? "NONE",
          textCase: raw.textCase ?? "ORIGINAL",
          textDecoration: raw.textDecoration ?? "NONE",
          letterSpacing: {
            value: raw.letterSpacing?.value ?? 0,
            unit: raw.letterSpacing?.units === "PERCENT" ? "PERCENT" : "PIXELS",
          },
          lineHeight:
            raw.lineHeight && raw.lineHeight.units !== "PERCENT"
              ? { value: raw.lineHeight.value, unit: "PIXELS" }
              : { unit: "AUTO" },
        });
      }
      if (["VECTOR", "ELLIPSE", "LINE", "POLYGON", "STAR"].includes(type)) {
        if (
          ![...(raw.fillPaints ?? []), ...(raw.strokePaints ?? [])].some(
            (paint) => paint.visible !== false,
          )
        ) {
          return;
        }
        // Instances can override the same source vector differently.
        const hash = `${id}:${vectorIndex++}`;
        vectors[hash] = this.svg(raw);
        node.svgHash = hash;
      }
      return node;
    };
    const nodes = (this.children.get(pageId) ?? []).flatMap((child) => {
      const node = convert(child, new Set());
      return node ? [node] : [];
    });
    return normalize(nodes, images, vectors);
  }

  private referenceKey(reference: any): string | undefined {
    return (
      reference?.assetRef?.key ??
      (reference?.guid ? guidKey(reference.guid) : undefined)
    );
  }

  private setKey(key: string) {
    const set = this.references.get(key);
    return set ? guidKey(set.guid) : key;
  }

  private variableValue(
    data: any,
    modes: Map<string, string>,
    properties: Map<string, any>,
    seen = new Set<string>(),
  ): any {
    const value = data?.value;
    if (value?.propRefValue?.defId) {
      const id = guidKey(value.propRefValue.defId);
      if (seen.has(id)) {
        return;
      }
      return this.variableValue(
        properties.get(id),
        modes,
        properties,
        new Set(seen).add(id),
      );
    }
    const key = this.referenceKey(value?.alias);
    if (!key) {
      return value;
    }
    if (seen.has(key)) {
      return;
    }
    const variable = this.references.get(key);
    const entries = variable?.variableDataValues?.entries;
    if (!entries?.length) {
      return;
    }
    const setKey = this.referenceKey(variable?.variableSetID);
    const set = setKey ? this.references.get(setKey) : undefined;
    const mode =
      (setKey ? modes.get(this.setKey(setKey)) : undefined) ??
      (set?.variableSetModes?.[0]?.id
        ? guidKey(set.variableSetModes[0].id)
        : undefined);
    const entry =
      entries.find(
        (item: any) => item.modeID && guidKey(item.modeID) === mode,
      ) ?? entries[0];
    return this.variableValue(
      entry.variableData,
      modes,
      properties,
      new Set(seen).add(key),
    );
  }

  private resolveBindings(
    source: FigNode,
    modes: Map<string, string>,
    properties: Map<string, any>,
  ): FigNode {
    const raw = { ...source };
    const fillStyle = this.references.get(
      this.referenceKey(raw.styleIdForFill) ?? "",
    );
    const strokeStyle = this.references.get(
      this.referenceKey(raw.styleIdForStrokeFill) ?? "",
    );
    const textStyle = this.references.get(
      this.referenceKey(raw.styleIdForText) ?? "",
    );
    if (!raw.fillPaints && fillStyle?.fillPaints) {
      raw.fillPaints = fillStyle.fillPaints;
    }
    if (!raw.strokePaints && strokeStyle?.strokePaints) {
      raw.strokePaints = strokeStyle.strokePaints;
    }
    if (textStyle) {
      for (const field of [
        "fontName",
        "fontSize",
        "letterSpacing",
        "lineHeight",
        "textCase",
        "textDecoration",
      ]) {
        if (raw[field] === undefined && textStyle[field] !== undefined) {
          raw[field] = textStyle[field];
        }
      }
    }
    const paints = (values?: Paint[]) =>
      values?.map((paint) => ({
        ...paint,
        color:
          this.variableValue(paint.colorVar, modes, properties)?.colorValue ??
          paint.color,
        stops: paint.stops?.map((stop) => ({
          ...stop,
          color:
            this.variableValue(stop.colorVar, modes, properties)?.colorValue ??
            stop.color,
        })),
      }));
    raw.fillPaints = paints(raw.fillPaints);
    raw.strokePaints = paints(raw.strokePaints);
    const numbers: Record<string, string> = {
      OPACITY: "opacity",
      FONT_SIZE: "fontSize",
      CORNER_RADIUS: "cornerRadius",
      STROKE_WEIGHT: "strokeWeight",
      RECTANGLE_TOP_LEFT_CORNER_RADIUS: "rectangleTopLeftCornerRadius",
      RECTANGLE_TOP_RIGHT_CORNER_RADIUS: "rectangleTopRightCornerRadius",
      RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS: "rectangleBottomLeftCornerRadius",
      RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS: "rectangleBottomRightCornerRadius",
      STACK_SPACING: "stackSpacing",
      STACK_COUNTER_SPACING: "stackCounterSpacing",
      STACK_PADDING_LEFT: "stackHorizontalPadding",
      STACK_PADDING_TOP: "stackVerticalPadding",
      STACK_PADDING_RIGHT: "stackPaddingRight",
      STACK_PADDING_BOTTOM: "stackPaddingBottom",
    };
    const bindings = [
      ...(raw.parameterConsumptionMap?.entries ?? []),
      ...(raw.componentPropRefs ?? []).map((ref: any) => ({
        variableField: ref.componentPropNodeField,
        variableData: { value: { propRefValue: { defId: ref.defID } } },
      })),
    ];
    for (const binding of bindings) {
      const value = this.variableValue(binding.variableData, modes, properties);
      if (!value) {
        continue;
      }
      const field = binding.variableField;
      if (numbers[field] && value.floatValue !== undefined) {
        raw[numbers[field]] = value.floatValue;
      }
      if (
        (field === "WIDTH" || field === "HEIGHT") &&
        value.floatValue !== undefined
      ) {
        raw.size = {
          x: raw.size?.x ?? 0,
          y: raw.size?.y ?? 0,
          [field === "WIDTH" ? "x" : "y"]: value.floatValue,
        };
      }
      if (field === "VISIBLE" && value.boolValue !== undefined) {
        raw.visible = value.boolValue;
      }
      if (field === "TEXT_DATA") {
        raw.textData =
          value.textDataValue ??
          (typeof value.textValue === "string"
            ? { characters: value.textValue }
            : (value.textValue ?? raw.textData));
      }
      if (field === "FONT_FAMILY" && value.textValue !== undefined) {
        raw.fontName = { ...raw.fontName, family: value.textValue };
      }
    }
    return raw;
  }

  private svg(raw: FigNode): string {
    const width = Math.max(0, raw.size?.x ?? 0),
      height = Math.max(0, raw.size?.y ?? 0);
    const definitions: string[] = [];
    const rgba = (color: Color, opacity = 1) =>
      `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${opacity * (color.a ?? 1)})`;
    const color = (paint?: Paint): string => {
      if (!paint || paint.visible === false) {
        return "none";
      }
      if (paint.type === "SOLID" && paint.color) {
        return rgba(paint.color, paint.opacity ?? 1);
      }
      const id = `paint${definitions.length}`;
      if (paint.type.startsWith("GRADIENT_") && paint.stops) {
        const m = paint.transform;
        const matrix = inverse({
          a: m?.m00 ?? 1,
          b: m?.m10 ?? 0,
          c: m?.m01 ?? 0,
          d: m?.m11 ?? 1,
          e: m?.m02 ?? 0,
          f: m?.m12 ?? 0,
        });
        const stops = paint.stops
          .map(
            (stop) =>
              `<stop offset="${stop.position}" stop-color="${rgba(stop.color, paint.opacity ?? 1)}"/>`,
          )
          .join("");
        const tag =
          paint.type === "GRADIENT_LINEAR"
            ? "linearGradient"
            : "radialGradient";
        definitions.push(
          `<${tag} id="${id}" gradientTransform="matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})" ${tag === "linearGradient" ? 'x1="0" y1="0.5" x2="1" y2="0.5"' : 'cx="0.5" cy="0.5" r="0.5"'}>${stops}</${tag}>`,
        );
        return `url(#${id})`;
      }
      if (paint.type === "IMAGE" && paint.image?.hash) {
        const bytes = ensure(
          this.images[Buffer.from(paint.image.hash).toString("hex")],
          "Missing Figma vector image",
        );
        definitions.push(
          `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${width}" height="${height}"><image href="${imageDataUri(bytes)}" width="${width}" height="${height}"/></pattern>`,
        );
        return `url(#${id})`;
      }
      return "none";
    };
    const geometry = (
      items: { commandsBlob: number; windingRule?: string }[] = [],
      paints: Paint[] = [],
    ) =>
      [...paints]
        .reverse()
        .map((paint) =>
          items
            .map((item) => {
              const bytes = ensure(
                this.blobs[item.commandsBlob]?.bytes,
                "Missing Figma vector geometry",
              );
              return `<path d="${pathCommands(bytes)}" fill="${color(paint)}" fill-rule="${item.windingRule === "ODD" ? "evenodd" : "nonzero"}"/>`;
            })
            .join(""),
        )
        .join("");
    let content =
      geometry(raw.fillGeometry, raw.fillPaints) +
      geometry(raw.strokeGeometry, raw.strokePaints);
    if (!content && raw.type === "ELLIPSE") {
      content = `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${color(raw.fillPaints?.[0])}" stroke="${color(raw.strokePaints?.[0])}" stroke-width="${raw.strokeWeight ?? 1}"/>`;
    }
    if (!content && raw.type === "LINE") {
      content = `<path d="M0 0L${width} ${height}" fill="none" stroke="${color(raw.strokePaints?.[0])}" stroke-width="${raw.strokeWeight ?? 1}"/>`;
    }
    assert(content, "Figma vector has no supported geometry");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, width)}" height="${Math.max(1, height)}" viewBox="0 0 ${Math.max(1, width)} ${Math.max(1, height)}"><defs>${definitions.join("")}</defs>${content}</svg>`;
  }
}

function pathCommands(bytes: Uint8Array): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const commands = ["Z", "M", "L", "Q", "C"];
  const counts = [0, 2, 2, 4, 6];
  const result: (string | number)[] = [];
  for (let offset = 0; offset < bytes.length;) {
    const opcode = bytes[offset++];
    assert(opcode < commands.length, "Invalid Figma path command");
    result.push(commands[opcode]);
    assert(
      offset + counts[opcode] * 4 <= bytes.length,
      "Truncated Figma vector geometry",
    );
    for (let i = 0; i < counts[opcode]; i++, offset += 4) {
      const value = view.getFloat32(offset, true);
      assert(Number.isFinite(value), "Invalid Figma path coordinate");
      result.push(value);
    }
  }
  return result.join(" ");
}

// Reuse the existing plugin importer, including its parent links and SVG assets.
function normalize(
  nodes: JSONObject[],
  images: Record<string, string>,
  vectors: Record<string, string>,
): FigmaData {
  const keys: string[] = [],
    strings: string[] = [];
  const keyIndices = new Map<string, string>(),
    stringIndices = new Map<string, string>();
  const intern = (
    value: string,
    values: string[],
    indices: Map<string, string>,
  ) => {
    let index = indices.get(value);
    if (index === undefined) {
      index = values.length.toString(36);
      values.push(value);
      indices.set(value, index);
    }
    return index;
  };
  const object = (value: JSONObject): JSONObject =>
    Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== null && item !== undefined)
        .map(([key, item]) => [intern(key, keys, keyIndices), visit(item)]),
    );
  const visit = (value: Serializable): Serializable => {
    if (typeof value === "string") {
      return intern(value, strings, stringIndices);
    }
    if (Array.isArray(value)) {
      return value.map(visit);
    }
    if (value !== null && typeof value === "object") {
      return object(value);
    }
    return value;
  };
  return {
    i: images,
    v: vectors,
    k: keys,
    s: strings,
    n: nodes.map(object).reverse(),
  };
}
