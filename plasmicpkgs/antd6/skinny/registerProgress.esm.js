import { Progress } from 'antd';
import React, { useMemo } from 'react';
import { r as registerComponentHelper } from './utils-CJsqmMg5.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

function AntdProgress(props) {
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
    if (successPercent === void 0 && successStrokeColor === void 0) {
      return void 0;
    }
    const res = {
      percent: successPercent,
      strokeColor: successStrokeColor
    };
    return res;
  }, [successPercent, successStrokeColor]);
  const strokeColorProp = useMemo(() => {
    if ((props.type === void 0 || props.type === "line") && !!props.steps) {
      const colors = stepColors?.map((c) => c.color).filter((c) => c);
      if (colors?.length) {
        return colors;
      }
    }
    const res = {};
    gradient?.filter((g) => g.color && g.percent !== void 0).map((g) => {
      res[g.percent] = g.color;
    });
    if (Object.keys(res).length) {
      return res;
    }
    return strokeColor;
  }, [gradient, props.steps, props.type, stepColors, strokeColor]);
  return /* @__PURE__ */ React.createElement(
    Progress,
    {
      strokeColor: strokeColorProp,
      success,
      format: infoFormat,
      ...rest
    }
  );
}
const progressComponentName = "plasmic-antd6-progress";
function registerProgress(loader) {
  registerComponentHelper(loader, AntdProgress, {
    name: progressComponentName,
    displayName: "Progress",
    props: {
      type: {
        type: "choice",
        defaultValueHint: "line",
        options: ["line", "circle", "dashboard"]
      },
      percent: {
        type: "number",
        description: "The completion percentage",
        defaultValueHint: 0
      },
      size: {
        type: "choice",
        defaultValueHint: "medium",
        description: `Size of progress`,
        advanced: true,
        options: ["medium", "small"]
      },
      showInfo: {
        type: "boolean",
        displayName: "Show text",
        defaultValueHint: true,
        advanced: true,
        description: "Display the progress value and the status icon"
      },
      status: {
        type: "choice",
        defaultValueHint: "normal",
        advanced: true,
        options: ["success", "exception", "normal", "active"]
      },
      strokeColor: {
        type: "color",
        description: "The color of progress bar"
      },
      strokeLinecap: {
        type: "choice",
        description: "Style of endpoints of the progress path",
        defaultValueHint: "round",
        advanced: true,
        options: ["round", "butt", "square"]
      },
      successPercent: {
        type: "number",
        advanced: true
      },
      successStrokeColor: {
        type: "color",
        description: "Color of the progress path marked success",
        advanced: true,
        hidden: (ps) => ps.successPercent === void 0
      },
      railColor: {
        type: "color",
        advanced: true,
        description: "The color of unfilled part"
      },
      infoFormat: {
        type: "function",
        displayName: "Format",
        defaultValueHint: ({ percent }) => `${percent || 0}%`,
        description: "Customize the progress text",
        advanced: true,
        hidden: (ps) => ps.showInfo === void 0 ? false : !ps.showInfo,
        argNames: ["percent", "successPercent"],
        argValues: (_ps) => [
          _ps.percent,
          _ps.successPercent
        ]
      },
      steps: {
        type: "number",
        hidden: (ps) => ps.type !== "line",
        advanced: true,
        description: "The total step count"
      },
      stepColors: {
        type: "array",
        hidden: (ps) => ps.type !== "line" ? true : ps.steps == null,
        advanced: true,
        itemType: {
          type: "object",
          nameFunc: (item) => item.color,
          fields: {
            color: {
              type: "color"
            }
          }
        }
      },
      gradient: {
        type: "array",
        hidden: (ps) => ps.type === "line" && !!ps.steps,
        advanced: true,
        itemType: {
          type: "object",
          nameFunc: (item) => `${item.percent}%: ${item.color}`,
          fields: {
            color: {
              type: "color"
            },
            percent: {
              type: "number"
            }
          }
        }
      },
      gapDegree: {
        type: "number",
        hidden: (ps) => ps.type !== "dashboard",
        defaultValueHint: 75,
        advanced: true,
        description: "The gap degree of half circle",
        min: 0,
        max: 295
      },
      gapPlacement: {
        type: "choice",
        hidden: (ps) => ps.type !== "dashboard",
        options: ["top", "bottom", "left", "right"],
        advanced: true,
        defaultValueHint: "bottom"
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerProgress",
    importName: "AntdProgress"
  });
}

export { AntdProgress, progressComponentName, registerProgress };
//# sourceMappingURL=registerProgress.esm.js.map
