import { StringPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/StringPropEditor";
import { ColorButton } from "@/wab/client/components/style-controls/ColorButton";
import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import { DimTokenSpinner } from "@/wab/client/components/widgets/DimTokenSelector";
import { fontWeightOptions } from "@/wab/client/typography-utils";
import { parseCssNumericNew } from "@/wab/shared/css";
import { LENGTH_UNITS } from "@/wab/shared/css/types";
import { ConnectorLine } from "@/wab/client/components/widgets/ConnectorLine";
import { Icon } from "@/wab/client/components/widgets/Icon";
import MenuButton from "@/wab/client/components/widgets/MenuButton";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useI18n } from "@/wab/client/i18n";
import type { MessageKey } from "@/wab/client/i18n/locales";
import CodeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Code";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import MinusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Minus";
import {
  isPlainObjectPropType,
  maybePropTypeToDisplayName,
  type StudioPropType,
} from "@/wab/shared/code-components/code-components";
import { mkTokenRef, tokenTypeDimOpts, tryParseTokenRef } from "@/wab/commons/StyleToken";
import { siteFinalStyleTokensAllDepsDict } from "@/wab/shared/core/site-style-tokens";
import { isExactlyStyleTokenRef, StyleTokenRef } from "@/wab/shared/model/classes";
import { tryCatchElse } from "@/wab/shared/common";
import { smartHumanize } from "@/wab/shared/strs";
import type { PropType } from "@plasmicapp/host";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Menu, Popover, Tooltip } from "antd";
import { isPlainObject } from "lodash";
import * as React from "react";
import styles from "@/wab/client/components/sidebar-tabs/ComponentProps/SemanticObjectPropEditor.module.scss";

type Fields = Record<string, PropType<any>>;
type ObjectValue = Record<string, unknown>;

const cssProperties = {
  backgroundColor: { label: "Fill", initial: "transparent" },
  color: { label: "Text color", initial: "inherit" },
  paddingInline: { label: "Horizontal padding", initial: 0 },
  paddingBlock: { label: "Vertical padding", initial: 0 },
  borderRadius: { label: "Corner radius", initial: 0 },
  borderColor: { label: "Border color", initial: "currentColor" },
  borderWidth: { label: "Border width", initial: 0 },
  fontSize: { label: "Font size", initial: "inherit" },
  fontWeight: { label: "Weight", initial: "inherit" },
  minHeight: { label: "Min Height", initial: 0 },
  boxShadow: { label: "Shadow", initial: "none" },
} satisfies Record<
  string,
  { label: MessageKey; initial: string | number }
>;

type DimensionOptions = Pick<React.ComponentProps<typeof DimTokenSpinner>,
  "allowedUnits" | "allowFunctions" | "tokenType" | "min" | "max" | "extraOptions" | "shorthand"
>;

const dimensionOptions: Record<string, DimensionOptions> = {
  paddingInline: { ...tokenTypeDimOpts("Spacing"), tokenType: "Spacing", min: 0, shorthand: true },
  paddingBlock: { ...tokenTypeDimOpts("Spacing"), tokenType: "Spacing", min: 0, shorthand: true },
  borderRadius: { ...tokenTypeDimOpts("Spacing"), tokenType: "Spacing", min: 0, shorthand: true },
  borderWidth: { allowedUnits: LENGTH_UNITS, allowFunctions: true, tokenType: "Spacing", min: 0, shorthand: true, extraOptions: ["thin", "medium", "thick"] },
  fontSize: { ...tokenTypeDimOpts("FontSize"), tokenType: "FontSize", min: 0, extraOptions: ["xx-small", "x-small", "small", "medium", "large", "x-large", "xx-large", "xxx-large", "smaller", "larger"] },
  fontWeight: { allowedUnits: [""], allowFunctions: true, min: 1, max: 1000, extraOptions: [...fontWeightOptions, "normal", "bold", "bolder", "lighter"] },
  minHeight: { ...tokenTypeDimOpts("Spacing"), tokenType: "Spacing", min: 0, extraOptions: ["auto", "min-content", "max-content", "fit-content", "stretch"] },
  lineHeight: { ...tokenTypeDimOpts("LineHeight"), tokenType: "LineHeight", extraOptions: ["normal"] },
  letterSpacing: { ...tokenTypeDimOpts("Spacing"), tokenType: "Spacing", extraOptions: ["normal"] },
  opacity: { ...tokenTypeDimOpts("Opacity"), tokenType: "Opacity" },
};

const cssChoices = Object.entries(cssProperties);

export function isSemanticObjectProp(
  propType: StudioPropType<any>,
): propType is Extract<PropType<any>, { type: "object" }> & { fields: Fields } {
  return (
    isPlainObjectPropType(propType) &&
    propType.type === "object" &&
    propType.editor === "semantic" &&
    !!propType.fields
  );
}

function childFields(field: PropType<any>): Fields | undefined {
  return typeof field === "object" && field.type === "object"
    ? field.fields
    : undefined;
}

function isObjectValue(value: unknown): value is ObjectValue {
  return isPlainObject(value);
}

export function canEditSemanticValue(
  fields: Fields,
  value: unknown,
): value is ObjectValue | undefined {
  return (
    value === undefined ||
    (isObjectValue(value) &&
      Object.entries(fields).every(([key, field]) => {
        const entry = value[key];
        if (entry === undefined) {
          return true;
        }
        const children = childFields(field);
        if (children) {
          return canEditSemanticValue(children, entry);
        }
        return typeof field === "object" && field.type === "object"
          ? isObjectValue(entry) &&
              Object.values(entry).every(
                (style) =>
                  typeof style === "string" || typeof style === "number" || isExactlyStyleTokenRef(style),
              )
          : typeof entry === "string";
      }))
  );
}

function setField(value: ObjectValue, key: string, next: unknown) {
  const updated = { ...value };
  if (next === undefined) {
    delete updated[key];
  } else {
    updated[key] = next;
  }
  return Object.keys(updated).length ? updated : undefined;
}

export function SemanticObjectPropSection({
  attr,
  label,
  value,
  bindingStatus,
  menu,
  children,
}: {
  attr: string;
  label: string;
  value: unknown;
  bindingStatus?: React.ReactNode;
  menu?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const count = isObjectValue(value) ? Object.keys(value).length : 0;

  return (
    <div className={styles.editor} data-plasmic-prop={attr}>
      <div className={styles.heading}>
        <span className={styles.headingLabel}>{label}</span>
        <Popover
          trigger={["hover", "focus"]}
          placement="bottomLeft"
          content={<SemanticValuePreview value={value} />}
        >
          <button
            className={styles.iconButton}
            type="button"
            aria-label={t("View property value")}
          >
            <Icon icon={CodeIcon} />
          </button>
        </Popover>
        <span className={styles.count}>
          {bindingStatus ? (
            <span className={styles.configured}>{bindingStatus}</span>
          ) : count > 0 ? (
            t("{count} configured", { count })
          ) : null}
        </span>
        <MenuButton menu={menu} />
      </div>
      <div>{children}</div>
    </div>
  );
}

export function SemanticValuePreview({ value }: { value: unknown }) {
  const { t } = useI18n();
  const json = tryCatchElse({
    try: () => JSON.stringify(value, (_key, entry) => isExactlyStyleTokenRef(entry) ? mkTokenRef(entry.token) : entry, 2),
    catch: () => undefined,
  });
  return json === undefined ? (
    <span className={styles.count}>{t("Preview unavailable")}</span>
  ) : (
    <Scrollbar scrollX={false} style={{ maxHeight: 260 }}>
      <pre className={styles.json}>{json}</pre>
    </Scrollbar>
  );
}

export function SemanticObjectPropEditor({
  fields,
  value,
  disabled,
  onChange,
}: {
  fields: Fields;
  value: ObjectValue | undefined;
  disabled: boolean;
  onChange: (value: ObjectValue | undefined) => void;
}) {
  return (
    <div className={styles.fields}>
      <SemanticFields
        fields={fields}
        value={value ?? {}}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

export function SemanticBindingBody({
  source,
  value,
  usesFallback,
  invalidValue,
  fallback,
}: {
  source: React.ReactNode;
  value: unknown;
  usesFallback: boolean;
  invalidValue: boolean;
  fallback?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.binding}>
      {source}
      <div className={styles.bindingPreview}>
        <span className={styles.count}>
          {invalidValue
            ? t("Prop value not allowed")
            : usesFallback
              ? t("Using fallback")
              : t("Preview value")}
        </span>
        <SemanticValuePreview value={value} />
      </div>
      {fallback && (
        <details className={styles.fallback}>
          <summary>{t("Fallback")}</summary>
          {fallback}
        </details>
      )}
    </div>
  );
}

function SemanticFields({
  fields,
  value,
  disabled,
  onChange,
}: {
  fields: Fields;
  value: ObjectValue;
  disabled: boolean;
  onChange: (value: ObjectValue | undefined) => void;
}) {
  const { t } = useI18n();
  const entries = Object.entries(fields);
  return (
    <>
      {entries.map(([key, field], index) => {
        const label = maybePropTypeToDisplayName(field) ?? smartHumanize(key);
        const current = value[key];
        const children = childFields(field);
        const update = (next: unknown) => onChange(setField(value, key, next));
        const fieldLabel = (
          <Tooltip title={label}>
            <span className={styles.fieldLabel}>{key}</span>
          </Tooltip>
        );
        const count = isObjectValue(current) ? Object.keys(current).length : 0;
        const statusLabel = t("{count} configured", { count });
        const currentObject = isObjectValue(current) ? current : {};
        const choices = cssChoices.filter(
          ([name]) => !Object.hasOwn(currentObject, name)
        );
        const objectField =
          typeof field === "object" && field.type === "object";

        return (
          <ConnectorLine key={key} isLast={index === entries.length - 1}>
            {objectField ? (
              <div>
                <div className={styles.row}>
                  {fieldLabel}
                  <div className={styles.fieldActions}>
                    <Tooltip title={statusLabel}>
                      <span className={styles.countTag} aria-label={statusLabel}>
                        {count}
                      </span>
                    </Tooltip>
                    {!children && (
                      <IFrameAwareDropdownMenu
                        disabled={disabled || choices.length === 0}
                        menu={
                          <Menu
                            items={choices.map(([name, property]) => ({
                              key: name,
                              label: `${t(property.label)} · ${name}`,
                              onClick: () =>
                                update(setField(currentObject, name, property.initial)),
                            }))}
                          />
                        }
                      >
                        <button
                          className={styles.iconButton}
                          type="button"
                          disabled={disabled || choices.length === 0}
                          aria-label={t("Add CSS property")}
                        >
                          <Icon icon={PlusIcon} />
                        </button>
                      </IFrameAwareDropdownMenu>
                    )}
                  </div>
                </div>
                <div className={styles.fields}>
                  {children ? (
                    <SemanticFields
                      fields={children}
                      value={currentObject}
                      disabled={disabled}
                      onChange={update}
                    />
                  ) : (
                    <CssFields
                      value={currentObject}
                      disabled={disabled}
                      onChange={update}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.row}>
                {fieldLabel}
                <StringPropEditor
                  aria-label={key}
                  value={typeof current === "string" ? current : undefined}
                  disabled={disabled}
                  defaultValueHint={t("Default")}
                  onChange={(text) => update(text.trim() || undefined)}
                />
              </div>
            )}
          </ConnectorLine>
        );
      })}
    </>
  );
}

function CssFields({
  value,
  disabled,
  onChange,
}: {
  value: ObjectValue;
  disabled: boolean;
  onChange: (value: ObjectValue | undefined) => void;
}) {
  const { t } = useI18n();
  const studioCtx = useStudioCtx();
  const properties = Object.entries(value);
  return (
    <>
      {properties.map(([key, current], index) => {
        const property = Object.hasOwn(cssProperties, key)
          ? cssProperties[key as keyof typeof cssProperties]
          : undefined;
        const label = property ? t(property.label) : key;
        const update = (next: unknown) => onChange(setField(value, key, next));
        const dimOpts = dimensionOptions[key];
        const cssValue = isExactlyStyleTokenRef(current) ? mkTokenRef(current.token) : String(current);
        const updateCssValue = (next: string | undefined) => {
          if (next === undefined || !next.trim()) {
            update(undefined);
            return;
          }
          const token = tryParseTokenRef(next, siteFinalStyleTokensAllDepsDict(studioCtx.site));
          const numeric = parseCssNumericNew(next);
          update(token && next === mkTokenRef(token.base) ? new StyleTokenRef({ token: token.base })
            : numeric && (numeric.units === "" || (dimOpts && !dimOpts.allowedUnits.includes("") && numeric.units === "px"))
              ? numeric.num : next);
        };
        return (
          <ConnectorLine
            key={key}
            isLast={index === properties.length - 1}
          >
            <div className={styles.cssRow}>
              <Tooltip title={label}>
                <span className={styles.fieldLabel}>{key}</span>
              </Tooltip>
              {(typeof current === "string" || isExactlyStyleTokenRef(current)) &&
              (key === "color" || key.endsWith("Color")) ? (
                <ColorButton
                  sc={studioCtx}
                  aria-label={key}
                  color={isExactlyStyleTokenRef(current) ? mkTokenRef(current.token) : current}
                  floatingPicker
                  isDisabled={disabled}
                  onChange={updateCssValue}
                />
              ) : dimOpts ? (
                <DimTokenSpinner
                  {...dimOpts}
                  className={styles.cssInput}
                  fieldAriaProps={{ "aria-label": key }}
                  studioCtx={studioCtx}
                  value={typeof current === "number" && !dimOpts.allowedUnits.includes("") ? `${current}px` : cssValue}
                  disabled={disabled}
                  hideArrow={false}
                  extraOptions={[...(dimOpts.extraOptions ?? []), "inherit", "initial", "unset", "revert", "revert-layer"]}
                  onChange={updateCssValue}
                />
              ) : (
                <div className={styles.cssInput}>
                  <StringPropEditor
                    aria-label={key}
                    value={cssValue}
                    disabled={disabled}
                    onChange={updateCssValue}
                  />
                </div>
              )}
              <button
                className={styles.iconButton}
                type="button"
                disabled={disabled}
                aria-label={t("Remove CSS property {name}", { name: label })}
                onClick={() => update(undefined)}
              >
                <Icon icon={MinusIcon} />
              </button>
            </div>
          </ConnectorLine>
        );
      })}
    </>
  );
}
