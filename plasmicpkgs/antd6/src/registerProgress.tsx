import { Progress } from "antd";
import React, { useMemo } from "react";
import { Registerable, registerComponentHelper } from "./utils";

export type AntdProgressProps = Omit<
  React.ComponentProps<typeof Progress>,
  "format" | "success" | "successPercent"
> & {
  successPercent?: number;
  successStrokeColor?: string;
  infoFormat?: (percent?: number, percentSuccess?: number) => string;
  stepColors?: { color: string }[];
  gradient: { color: string; percent: number }[];
};

export function AntdProgress(props: AntdProgressProps) {
  const {
    successPercent,
    successStrokeColor,
    stepColors,
    infoFormat,
    gradient,
    strokeColor,
    ...rest
  } = props;

  const success = useMemo(() => {
    if (!successPercent && !successStrokeColor) return undefined;
    const res: React.ComponentProps<typeof Progress>["success"] = {
      percent: successPercent,
      strokeColor: successStrokeColor,
    };
    return res;
  }, [successPercent, successStrokeColor]);

  const strokeColorProp = useMemo(() => {
    if (props.type === "line" && !!props.steps) {
      const colors = stepColors?.map((c) => c.color).filter((c) => c);
      if (colors?.length) {
        return colors;
      }
    }
    const res: Record<number, string> = {};
    gradient
      ?.filter((g) => g.color && g.percent !== undefined)
      .map((g) => {
        res[g.percent] = g.color;
      });
    if (Object.keys(res).length) return res;
    return strokeColor;
  }, [gradient, props.steps, props.type, stepColors, strokeColor]);

  return (
    <Progress
      strokeColor={strokeColorProp}
      success={success}
      format={infoFormat}
      {...rest}
    />
  );
}

export const progressComponentName = "plasmic-antd6-progress";

export function registerProgress(loader?: Registerable) {
  registerComponentHelper(loader, AntdProgress, {
    name: progressComponentName,
    displayName: "Progress",
    props: {
      type: {
        type: "choice",
        defaultValueHint: "line",
        options: ["line", "circle", "dashboard"],
      },
      percent: {
        type: "number",
        description: "The completion percentage",
        defaultValueHint: 0,
      },
      size: {
        type: "choice",
        defaultValueHint: "medium",
        description: `Size of progress`,
        advanced: true,
        options: ["medium", "small"],
      },
      showInfo: {
        type: "boolean",
        displayName: "Show text",
        defaultValueHint: true,
        advanced: true,
        description: "Display the progress value and the status icon",
      },
      status: {
        type: "choice",
        defaultValueHint: "normal",
        advanced: true,
        options: ["success", "exception", "normal", "active"],
      },
      strokeColor: {
        type: "color",
        description: "The color of progress bar",
      },
      strokeLinecap: {
        type: "choice",
        description: "Style of endpoints of the progress path",
        defaultValueHint: "round",
        advanced: true,
        options: ["round", "butt", "square"],
      },
      successPercent: {
        type: "number",
        advanced: true,
      },
      successStrokeColor: {
        type: "color",
        description: "Color of the progress path marked success",
        advanced: true,
        hidden: (ps: any) => !ps.successPercent,
      },
      railColor: {
        type: "color",
        advanced: true,
        description: "The color of unfilled part",
      },
      infoFormat: {
        type: "function" as const,
        displayName: "Format",
        defaultValueHint: ({ percent }: AntdProgressProps) =>
          `${percent || 0}%`,
        description: "Customize the progress text",
        advanced: true,
        hidden: (ps: AntdProgressProps) =>
          ps.showInfo === undefined ? false : !ps.showInfo,
        argNames: ["percent", "successPercent"],
        argValues: (_ps: AntdProgressProps) => [
          _ps.percent,
          _ps.successPercent,
        ],
      } as any,
      steps: {
        type: "number",
        hidden: (ps: any) => ps.type !== "line",
        advanced: true,
        description: "The total step count",
      },
      stepColors: {
        type: "array",
        hidden: (ps: any) => (ps.type !== "line" ? true : ps.steps == null),
        advanced: true,
        itemType: {
          type: "object",
          nameFunc: (item: any) => item.color,
          fields: {
            color: {
              type: "color",
            },
          },
        },
      },
      gradient: {
        type: "array",
        hidden: (ps: any) => ps.type === "line" && !!ps.steps,
        advanced: true,
        itemType: {
          type: "object",
          nameFunc: (item: any) => `${item.percent}%: ${item.color}`,
          fields: {
            color: {
              type: "color",
            },
            percent: {
              type: "number",
            },
          },
        },
      },
      gapDegree: {
        type: "number",
        hidden: (ps: any) => ps.type !== "dashboard",
        defaultValueHint: 75,
        advanced: true,
        description: "The gap degree of half circle",
        min: 0,
        max: 295,
      },
      gapPlacement: {
        type: "choice",
        hidden: (ps: any) => ps.type !== "dashboard",
        options: ["top", "bottom", "left", "right"],
        advanced: true,
        defaultValueHint: "bottom",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerProgress",
    importName: "AntdProgress",
  });
}
