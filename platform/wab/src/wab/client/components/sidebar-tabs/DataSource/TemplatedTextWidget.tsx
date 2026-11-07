import ContextMenuIndicator from "@/wab/client/components/ContextMenuIndicator/ContextMenuIndicator";
import {
  TemplatedTextEditor,
  TemplatedTextEditorProps,
} from "@/wab/client/components/sidebar-tabs/ComponentProps/TemplatedTextEditor";
import { DataPickerTypesSchema } from "@/wab/client/components/sidebar-tabs/DataBinding/DataPicker";
import { useI18n } from "@/wab/client/i18n";
import { ExprCtx } from "@/wab/shared/core/exprs";
import {
  CustomCode,
  ObjectPath,
  TemplatedString,
  isKnownTemplatedString,
} from "@/wab/shared/model/classes";
import React from "react";

interface TemplatedTextWidgetProps {
  value?: string;
  disabled?: boolean;
  setValue: (expr: TemplatedString) => void;
  placeholder?: string;
  data: Record<string, any> | undefined;
  schema?: DataPickerTypesSchema;
  bindings?: Record<string, TemplatedString | CustomCode | ObjectPath>;
  exprCtx: ExprCtx;
  "data-plasmic-prop"?: string;
}

export function TemplatedTextWidget(props: TemplatedTextWidgetProps) {
  const { value, bindings, setValue, ...rest } = props;
  const realValue =
    bindings && value && bindings[value]
      ? isKnownTemplatedString(bindings[value]) ? bindings[value] : new TemplatedString({text: [bindings[value]]})
      : new TemplatedString({ text: value ? [value] : [] });

  return (
    <TemplatedTextEditorWithMenuIndicator
      className="templated-string-input"
      {...rest}
      onChange={setValue}
      value={realValue}
    />
  );
}

export function TemplatedTextEditorWithMenuIndicator(
  props: TemplatedTextEditorProps,
) {
  const { t: uiT } = useI18n();
  return (
    <ContextMenuIndicator
      showDynamicValueButton={!props.disabled}
      tooltip={uiT("Append dynamic value")}
      className="qb-custom-widget"
      fullWidth
    >
      <TemplatedTextEditor {...props} />
      {/*{evaluated && <ValuePreview val={evaluated.val} err={evaluated.err} />}*/}
    </ContextMenuIndicator>
  );
}
