import { splitCssValue } from "@/wab/shared/css/parse";

export type FilterEffectType =
  | "blur"
  | "brightness"
  | "contrast"
  | "drop-shadow"
  | "grayscale"
  | "hue-rotate"
  | "invert"
  | "opacity"
  | "saturate"
  | "sepia";

export interface FilterEffect {
  type: FilterEffectType;
  args: string[];
  visible: boolean;
}

export const defaultFilterEffects: Record<FilterEffectType, FilterEffect> = {
  blur: {
    type: "blur",
    args: ["0px"],
    visible: true,
  },
  brightness: {
    type: "brightness",
    args: ["100%"],
    visible: true,
  },
  contrast: {
    type: "contrast",
    args: ["100%"],
    visible: true,
  },
  "drop-shadow": {
    type: "drop-shadow",
    args: ["10px", "10px", "10px", "#FFFFFF"],
    visible: true,
  },
  opacity: { type: "opacity", args: ["100%"], visible: true },
  grayscale: {
    type: "grayscale",
    args: ["0%"],
    visible: true,
  },
  "hue-rotate": {
    type: "hue-rotate",
    args: ["0deg"],
    visible: true,
  },
  invert: {
    type: "invert",
    args: ["0%"],
    visible: true,
  },
  saturate: {
    type: "saturate",
    args: ["100%"],
    visible: true,
  },
  sepia: {
    type: "sepia",
    args: ["0%"],
    visible: true,
  },
};

export const filterEffectEditorConfig: Record<Exclude<FilterEffectType, "drop-shadow">, {
  label: "Radius" | "Amount" | "Angle";
  max: number;
  allowedUnits: string[];
}> = {
  blur: {
    label: "Radius",
    max: 20,
    allowedUnits: ["px"],
  },
  brightness: {
    label: "Amount",
    max: 200,
    allowedUnits: ["%"],
  },
  contrast: {
    label: "Amount",
    max: 200,
    allowedUnits: ["%"],
  },
  "hue-rotate": {
    label: "Angle",
    max: 360,
    allowedUnits: ["deg"],
  },
  saturate: {
    label: "Amount",
    max: 200,
    allowedUnits: ["%"],
  },
  opacity: { label: "Amount", max: 100, allowedUnits: ["%"] },
  grayscale: {
    label: "Amount",
    max: 100,
    allowedUnits: ["%"],
  },
  invert: {
    label: "Amount",
    max: 100,
    allowedUnits: ["%"],
  },
  sepia: {
    label: "Amount",
    max: 100,
    allowedUnits: ["%"],
  },
};

const filterLabels = {
  blur: "Blur", brightness: "Brightness", contrast: "Contrast",
  "drop-shadow": "Drop shadow", grayscale: "Grayscale", "hue-rotate": "Hue rotate",
  invert: "Invert", opacity: "Opacity", saturate: "Saturation", sepia: "Sepia",
} as const;
export const getFilterEffectLabel = (effect: FilterEffectType) => filterLabels[effect];

export const fromFilterStringToObj = (rawFilter: string): FilterEffect => {
  const raw = splitCssValue("filter", rawFilter)[0] ?? "";
  const match = /^(hidden#)?([a-z-]+)\(([\s\S]*)\)$/.exec(raw);
  if (!match || !Object.hasOwn(defaultFilterEffects, match[2])) {
    return defaultFilterEffects.blur;
  }
  return {
    type: match[2] as FilterEffectType,
    args: splitCssValue("filter", match[3]),
    visible: !match[1],
  };
};

export const fromFilterObjToString = (filter: FilterEffect): string => {
  return `${!filter.visible ? "hidden#" : ""}${filter.type}(${filter.args.join(
    " ",
  )})`;
};
