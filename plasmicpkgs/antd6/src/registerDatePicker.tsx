import { DatePicker } from "antd";
import cls from "classnames";
import dayjs, { Dayjs } from "dayjs";
import React from "react";
import { CanvasOverlayProps, previewOpenProp, useCanvasOverlay } from "./canvas-overlay";
import { capitalize, Registerable, registerComponentHelper } from "./utils";

/**
 * onChangeIsoString uses ISO strings rather than dayjs.
 *
 */
export function AntdDatePicker(
  props: Omit<
    React.ComponentProps<typeof DatePicker>,
    "value" | "onChange" | "defaultValue"
  > & CanvasOverlayProps & {
    onChange?: (value: string | string[] | null) => void;
    value?: Dayjs | string | (Dayjs | string)[] | null;
    defaultValue?: string | string[];
    // Not sure why this is missing from DatePicker props!
    showTime?: boolean;
    popupScopeClassName?: string;
  },
) {
  const { props: canvasProps, open, isEditing } = useCanvasOverlay(props);
  const { picker, popupScopeClassName, classNames, ...rest } = canvasProps;

  return (
    <>
      <DatePicker
        key={isEditing ? "edit" : "runtime"}
        {...rest}
        open={open}
        onOpenChange={isEditing ? undefined : props.onOpenChange}
        onCalendarChange={isEditing ? undefined : props.onCalendarChange}
        onPanelChange={isEditing ? undefined : props.onPanelChange}
        picker={picker as any}
        value={
          props.value === undefined
            ? undefined
            : !props.value
              ? null
              : Array.isArray(props.value)
                ? props.value.map((value) => dayjs(value))
                : dayjs(props.value)
        }
        defaultValue={
          props.defaultValue === undefined
            ? undefined
            : Array.isArray(props.defaultValue)
              ? props.defaultValue.map((value) => dayjs(value))
              : dayjs(props.defaultValue)
        }
        classNames={(info) => {
          const names =
            typeof classNames === "function" ? classNames(info) : classNames;
          const popup =
            typeof names?.popup === "string"
              ? { root: names.popup }
              : names?.popup;
          return {
            ...names,
            popup: { ...popup, root: cls(popup?.root, popupScopeClassName) },
          };
        }}
        // dateString isn't a valid ISO string, and value is a dayjs object.
        onChange={(value, _dateString) => {
          if (isEditing) return;
          props.onChange?.(
            Array.isArray(value)
              ? value.map((date) => date.toISOString())
              : (value?.toISOString() ?? null),
          );
        }}
      />
    </>
  );
}

export const datePickerComponentName = "plasmic-antd6-date-picker";

export const datePickerHelpers = {
  states: {
    value: {
      onChangeArgsToValue: (value: string | string[] | null) => value,
      hidden: (ps: any) => !!ps.__plasmicFormField,
    },
  },
};

export function registerDatePicker(loader?: Registerable) {
  registerComponentHelper(loader, AntdDatePicker, {
    name: datePickerComponentName,
    canvasOverlay: {},
    displayName: "DatePicker",
    props: {
      previewOpen: previewOpenProp,
      multiple: { type: "boolean", defaultValueHint: false },
      value: {
        type: "object",
        editOnly: true,
        uncontrolledProp: "defaultValue",
        description:
          "The current date/time as an ISO string, Date object, or dayjs object",
        hidden: (ps: any) => !!ps.__plasmicFormField,
      },
      disabled: {
        type: "boolean",
        defaultValueHint: false,
      },
      autoFocus: {
        type: "boolean",
        description: "Focus when component is rendered",
        defaultValueHint: false,
        advanced: true,
      },
      onChange: {
        type: "eventHandler",
        argTypes: [{ name: "value", type: "object" }],
      },
      picker: {
        type: "choice",
        options: ["date", "week", "month", "quarter", "year"].map((value) => ({
          value,
          label: capitalize(value),
        })),
        defaultValueHint: "date",
      },
      popupScopeClassName: {
        type: "styleScopeClass",
        scopeName: "datePickerPopup",
      } as any,
      popupRootClassName: {
        type: "class",
        displayName: "Popup container",
        selectors: [
          {
            selector: ":datePickerPopup .ant-picker-panel-container",
            label: "Base",
          },
        ],
      },
      popupHeaderClassName: {
        type: "class",
        displayName: "Popup header",
        selectors: [
          {
            selector: ":datePickerPopup .ant-picker-header",
            label: "Base",
          },
        ],
      },
      popupBodyClassName: {
        type: "class",
        displayName: "Popup body",
        selectors: [
          {
            selector: ":datePickerPopup .ant-picker-body",
            label: "Base",
          },
        ],
      },
      popupFooterClassName: {
        type: "class",
        displayName: "Popup footer",
        selectors: [
          {
            selector: ":datePickerPopup .ant-picker-footer",
            label: "Base",
          },
        ],
      },
      showTime: {
        type: "boolean",
        description: "Enable time selection",
      },
      variant: {
        type: "choice",
        options: ["outlined", "borderless", "filled", "underlined"],
        defaultValueHint: "outlined",
      },
      // TODO - see how it works with plasmic-rich-components
      // format: {
      //   advanced: true
      // },
      showNow: {
        type: "boolean",
        advanced: true,
        description: 'Whether to show the "Now" button',
        defaultValueHint: true,
        hidden: (ps: any) => !ps.showTime,
      },
      showToday: {
        type: "boolean",
        advanced: true,
        description: 'Whether to show the "Today" button',
        defaultValueHint: true,
        hidden: (ps: any) => ps.showTime,
      },
      // disabledDate: {
      //   type: "function",
      //   advanced: true,
      //   description: "Dates to disable",
      // },
      // disabledTime: {
      //   type: "function",
      //   advanced: true,
      //   description: "Times to disable",
      // },
      allowClear: {
        type: "boolean",
        advanced: true,
        description: "Whether to show the clear button",
      },
    },
    states: {
      value: {
        type: "writable",
        valueProp: "value",
        onChangeProp: "onChange",
        variableType: "object",
        ...datePickerHelpers.states.value,
      },
    },
    componentHelpers: {
      helpers: datePickerHelpers,
      importName: "datePickerHelpers",
      importPath: "@shiguang-lab/plasmic-antd6/skinny/registerDatePicker",
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerDatePicker",
    importName: "AntdDatePicker",
  });
}
