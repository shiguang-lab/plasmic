import { Rate } from "antd";
import React, { useMemo } from "react";
import { Registerable, registerComponentHelper } from "./utils";

type AntdRateProps = Omit<React.ComponentProps<typeof Rate>, "tooltips"> & {
  tooltips?: { label: string }[];
  multiCharacter?: boolean;
  symbols?: React.ReactNode;
};

function getSymbols(symbols: React.ReactNode) {
  return React.Children.toArray(
    React.isValidElement(symbols) && Array.isArray(symbols.props.children)
      ? symbols.props.children
      : symbols,
  );
}

export function AntdRate(props: AntdRateProps) {
  const { character, count, tooltips, multiCharacter, symbols, ...rest } =
    props;

  const symbolsProp = useMemo(() => getSymbols(symbols), [symbols]);
  const countProp = useMemo(() => {
    if (!multiCharacter) {
      return count;
    }
    return symbolsProp.length || count;
  }, [count, multiCharacter, symbolsProp?.length]);

  const characterProp = useMemo(() => {
    if (!multiCharacter) {
      return character;
    }
    return symbolsProp?.length
      ? ({ index }: any) => symbolsProp[index]
      : character;
  }, [character, multiCharacter, symbolsProp]);

  return (
    <Rate
      tooltips={tooltips?.map((t) => t?.label)}
      count={countProp}
      character={characterProp}
      {...rest}
    />
  );
}

export const rateComponentName = "plasmic-antd6-rate";

export function registerRate(loader?: Registerable) {
  registerComponentHelper(loader, AntdRate, {
    name: rateComponentName,
    displayName: "Rate",
    props: {
      allowClear: {
        type: "boolean",
        advanced: true,
        defaultValueHint: true,
        description: "Clear the rating when the user clicks again",
      },
      allowHalf: {
        type: "boolean",
        advanced: true,
        defaultValueHint: false,
        description: "Allow fractional rating.",
      },
      autoFocus: {
        type: "boolean",
        description: "Focus when component is rendered",
        defaultValueHint: false,
        advanced: true,
      },
      character: {
        type: "slot",
        displayName: "Symbol",
        hidePlaceholder: true,
        hidden: (ps: AntdRateProps) => Boolean(ps.multiCharacter),
      },
      multiCharacter: {
        type: "boolean",
        displayName: "Multi Symbol",
        description:
          "Allow different symbols for rating. (You can add these symbols in the component slots if this is enabled)",
        advanced: true,
      },
      symbols: {
        type: "slot",
        displayName: "Symbols",
        hidePlaceholder: true,
        defaultValue: ["1", "2", "3", "4", "5"],
        hidden: (ps: AntdRateProps) => !ps.multiCharacter,
      },
      count: {
        type: "number",
        description: "Rating count",
        defaultValueHint: 5,
        advanced: true,
        hidden: (ps: AntdRateProps) => Boolean(ps.multiCharacter),
      },
      value: {
        type: "number",
        editOnly: true,
        uncontrolledProp: "defaultValue",
        description: "Default rating",
        defaultValueHint: 0,
      },
      disabled: {
        type: "boolean",
        description: "Read-only rating",
        defaultValueHint: false,
      },
      tooltips: {
        type: "array",
        description: "Rating labels",
        displayName: "Labels",
        advanced: true,
        hidden: (ps: AntdRateProps) => ps.count === 0 && !ps.multiCharacter,
        itemType: {
          type: "object",
          fields: {
            label: "string",
          },
          nameFunc: (value: any) => value.label,
        },
        validator: (value: any, ps: any) => {
          const count = ps.multiCharacter
            ? getSymbols(ps.symbols).length || (ps.count ?? 5)
            : (ps.count ?? 5);
          if (!Array.isArray(value) || value.length === 0) {
            return true;
          }
          if (value.length < count) {
            return `You need ${count - value.length} more labels`;
          }
          if (value.length > count) {
            return "You have too many labels. Some labels will not be used";
          }
          return true;
        },
      },
      onChange: {
        type: "eventHandler",
        advanced: true,
        argTypes: [{ name: "value", type: "number" }],
      },
      onBlur: {
        type: "eventHandler",
        advanced: true,
        argTypes: [],
      },
      onFocus: {
        type: "eventHandler",
        advanced: true,
        argTypes: [],
      },
      onHoverChange: {
        type: "eventHandler",
        advanced: true,
        description: "Callback when an item is hovered",
        argTypes: [{ name: "value", type: "number" }],
      },
      onKeyDown: {
        type: "eventHandler",
        advanced: true,
        argTypes: [{ name: "event", type: "object" }],
      },
    },
    states: {
      value: {
        type: "writable",
        valueProp: "value",
        onChangeProp: "onChange",
        variableType: "number",
      },
    },

    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerRate",
    importName: "AntdRate",
  });
}
