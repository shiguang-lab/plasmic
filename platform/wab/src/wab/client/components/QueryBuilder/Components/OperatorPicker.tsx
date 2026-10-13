import { SelectInput } from "@/wab/client/components/QueryBuilder/Components/SelectInput";
import { useI18n } from "@/wab/client/i18n";
import { FieldProps } from "@react-awesome-query-builder/antd";
import React from "react";

type Props = React.Attributes & FieldProps;

export function OperatorPicker(props: Props) {
  const { label } = useI18n();
  return (
    <SelectInput
      items={props.items.map((item) => ({ ...item, label: label(item.label) }))}
      value={props.selectedKey ?? undefined}
      onValueChanged={(value) => props.setField(value)}
    />
  );
}
