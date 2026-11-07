import {
  toFlatOptionArray,
  toFullOptionList,
  type Field,
} from "@react-querybuilder/core";
import {
  DatePicker,
  Input,
  InputNumber,
  Segmented,
  Select,
  TimePicker,
} from "antd";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import React from "react";
dayjs.extend(customParseFormat);

export interface NativeValueEditorProps {
  field: Field;
  operator: string;
  value: any;
  setValue: (value: any) => void;
  disabled?: boolean;
  "data-plasmic-prop"?: string;
}

/** Literal editor for a native rule value or list. Range endpoints use this same editor. */
export function NativeValueEditor(props: NativeValueEditorProps) {
  const { field, operator, value, setValue, disabled } = props;
  if (["null", "notNull"].includes(operator)) {
    return <></>;
  }
  const common = {
    disabled,
    size: "small" as const,
    "data-plasmic-prop": props["data-plasmic-prop"],
  };
  if (
    ["in", "notIn"].includes(operator) ||
    field.valueEditorType === "multiselect" ||
    field.valueEditorType === "select"
  ) {
    const multiple =
      ["in", "notIn"].includes(operator) ||
      field.valueEditorType === "multiselect";
    const options = toFlatOptionArray(toFullOptionList(field.values ?? [])).map(
      (option) => ({ value: option.value ?? option.name, label: option.label }),
    );
    return (
      <Select
        {...common}
        className="fill-width"
        allowClear
        showSearch
        options={options}
        mode={multiple ? "tags" : undefined}
        value={value === "" ? undefined : value}
        onChange={setValue}
        optionFilterProp="label"
      />
    );
  }
  if (field.datatype === "boolean" || field.valueEditorType === "checkbox") {
    return (
      <Segmented
        {...common}
        value={value === true ? "yes" : value === false ? "no" : undefined}
        options={[
          { value: "yes", label: "✓" },
          { value: "no", label: "✕" },
        ]}
        onChange={(next) => setValue(next === "yes")}
      />
    );
  }
  if (field.inputType === "number" || field.datatype === "number") {
    return (
      <InputNumber
        {...common}
        value={typeof value === "number" ? value : null}
        onChange={(next) => setValue(next ?? undefined)}
      />
    );
  }
  if (["date", "datetime-local", "time"].includes(field.inputType ?? "")) {
    const format =
      field.inputType === "date"
        ? "YYYY-MM-DD"
        : field.inputType === "time"
          ? "HH:mm:ss"
          : "YYYY-MM-DDTHH:mm:ss";
    const parsed =
      typeof value === "string"
        ? field.inputType === "time"
          ? dayjs(value, format, true)
          : dayjs(value)
        : null;
    const date = parsed?.isValid() ? parsed : null;
    const onChange = (next: dayjs.Dayjs | null) =>
      setValue(next?.format(format));
    return field.inputType === "time" ? (
      <TimePicker
        {...common}
        value={date}
        format="HH:mm:ss"
        onChange={onChange}
      />
    ) : (
      <DatePicker
        {...common}
        multiple={false}
        value={date}
        showTime={field.inputType === "datetime-local"}
        onChange={onChange}
      />
    );
  }
  return (
    <Input
      {...common}
      value={value == null ? "" : String(value)}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}
