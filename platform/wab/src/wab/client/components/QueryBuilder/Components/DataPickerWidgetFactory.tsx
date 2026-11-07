import ContextMenuIndicator from "@/wab/client/components/ContextMenuIndicator/ContextMenuIndicator";
import DataPicker, {
  DataPickerTypesSchema,
} from "@/wab/client/components/sidebar-tabs/DataBinding/DataPicker";
import { IconLinkButton } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import CloseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import { zIndex } from "@/wab/client/z-index";
import { cx } from "@/wab/shared/common";
import {
  ExprCtx,
  createExprForDataPickerValue,
  extractValueSavedFromDataPicker,
  summarizeExpr,
} from "@/wab/shared/core/exprs";
import {
  CustomCode,
  ObjectPath,
  TemplatedString,
  isKnownCustomCode,
  isKnownObjectPath,
  isKnownTemplatedString,
} from "@/wab/shared/model/classes";
import { Menu, Popover } from "antd";
import * as React from "react";

export interface DataPickerWidgetFactoryProps {
  value: unknown;
  disabled?: boolean;
  setValue: (expr: CustomCode | ObjectPath | null | undefined) => void;
  data: Record<string, any> | undefined;
  schema?: DataPickerTypesSchema;
  renderOriginalWidget: () => React.ReactElement;
  exprCtx: ExprCtx;
}

export function mkUndefinedObjectPath() {
  return new ObjectPath({ path: ["undefined"], fallback: undefined });
}

function isDynamicQueryValue(
  value: any,
): value is ObjectPath | CustomCode | TemplatedString {
  return (
    isKnownObjectPath(value) ||
    isKnownCustomCode(value) ||
    isKnownTemplatedString(value)
  );
}

export function DataPickerWidgetFactory({
  value,
  disabled,
  setValue,
  data,
  schema,
  renderOriginalWidget,
  exprCtx,
}: DataPickerWidgetFactoryProps): React.ReactElement {
  const [defaultOpenDataPicker, setDefaultOpenDataPicker] =
    React.useState(false);
  const switchToDynamicValue = React.useCallback(() => {
    if (disabled) {
      return;
    }
    setDefaultOpenDataPicker(true);
    setValue(mkUndefinedObjectPath());
  }, [setDefaultOpenDataPicker, disabled, setValue]);

  const isDynamicValue = isDynamicQueryValue(value);

  if (disabled) {
    return isDynamicValue ? (
      <DynamicValueWidget
        value={value}
        setValue={setValue}
        data={data}
        schema={schema}
        exprCtx={exprCtx}
        disabled
      />
    ) : (
      renderOriginalWidget()
    );
  }

  let contextMenu: React.ReactNode;
  let widget: React.ReactNode;
  if (isDynamicValue) {
    contextMenu = (
      <Menu>
        <Menu.Item
          id="remove-dynamic-value-btn"
          key="remove-dynamic-value"
          onClick={() => {
            setValue(undefined);
          }}
        >
          <UiText message={"Remove dynamic value"} />
        </Menu.Item>
      </Menu>
    );
    widget = (
      <DynamicValueWidget
        value={value}
        setValue={setValue}
        data={data}
        schema={schema}
        defaultOpenDataPicker={defaultOpenDataPicker}
        exprCtx={exprCtx}
      />
    );
  } else {
    contextMenu = (
      <Menu>
        <Menu.Item
          id="use-dynamic-value-btn"
          key="use-dynamic-value"
          onClick={switchToDynamicValue}
        >
          <UiText message={"Use dynamic value"} />
        </Menu.Item>
      </Menu>
    );
    widget = renderOriginalWidget();
  }

  return (
    <ContextMenuIndicator
      className="qb-custom-widget"
      menu={contextMenu}
      showMenuOnRightClick
      showDynamicValueButton={!isDynamicValue}
      onIndicatorClickDefault={switchToDynamicValue}
    >
      {widget}
    </ContextMenuIndicator>
  );
}

type DynamicValueWidgetProps = {
  disabled?: boolean;
  value: ObjectPath | CustomCode | TemplatedString;
  data: Record<string, any> | undefined;
  schema?: DataPickerTypesSchema;
  defaultOpenDataPicker?: boolean;
  deleteIcon?: boolean;
  expectedValues?: string;
  setValue: (newVal: ObjectPath | CustomCode | null | undefined) => void;
  exprCtx: ExprCtx;
};

export function DynamicValueWidget({
  data,
  schema,
  value,
  setValue,
  defaultOpenDataPicker,
  deleteIcon = true,
  disabled = false,
  expectedValues,
  exprCtx,
}: DynamicValueWidgetProps) {
  const { t: studioUiT } = useI18n();

  const [popoverVisible, setPopoverVisible] = React.useState(
    defaultOpenDataPicker ?? false,
  );

  const previewValue = summarizeExpr(value, exprCtx);
  const textValue = extractValueSavedFromDataPicker(value, exprCtx);

  return (
    <Popover
      zIndex={zIndex.dataPicker}
      content={
        <DataPicker
          value={textValue}
          onChange={(val) => {
            const newVal =
              val != null ? createExprForDataPickerValue(val) : val;
            if (!disabled) {
              setValue(newVal);
            }
            setPopoverVisible(false);
          }}
          onCancel={() => setPopoverVisible(false)}
          data={data}
          schema={schema}
          expectedValues={expectedValues}
        />
      }
      trigger={disabled ? [] : "click"}
      open={!disabled && popoverVisible}
      onOpenChange={(_visible) => {
        if (!disabled) {
          setPopoverVisible(_visible);
        }
      }}
      destroyOnHidden={true}
      overlayClassName="data-picker-popover-overlay"
    >
      <div
        contentEditable={false}
        className={cx("nowrap", "flex", "code-editor-input")}
      >
        <span
          className={cx("text-align-left", "text-ellipsis", {
            "text-set": previewValue,
            "text-unset": !previewValue,
          })}
        >
          {previewValue ?? studioUiT("unset")}
        </span>

        {deleteIcon && !disabled && (
          <div className="inline-block">
            <IconLinkButton
              className={cx(["dropdown-pill__deleter", "ml-sm"])}
              onMouseDown={(e) => {
                // Using onMouseDown instead of onClick to be ahead of
                // input element's blur event.  With onClick, sometimes
                // this fires before onBlur and sometiems after, not sure
                // why...
                e.preventDefault();
                e.stopPropagation();
                setValue(undefined);
              }}
            >
              <Icon icon={CloseIcon} className="no-line-height" />
            </IconLinkButton>
          </div>
        )}
      </div>
      {/*{evaluated && <ValuePreview val={evaluated.val} err={evaluated.err} />}*/}
    </Popover>
  );
}
