import configSearch from "@/wab/client/components/style-controls/ConfigSearch.module.scss";
import { StringPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/StringPropEditor";
import { ColorButton } from "@/wab/client/components/style-controls/ColorButton";
import { ConnectorLine } from "@/wab/client/components/widgets/ConnectorLine";
import { Icon } from "@/wab/client/components/widgets/Icon";
import MenuButton from "@/wab/client/components/widgets/MenuButton";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useI18n } from "@/wab/client/i18n";
import type { MessageKey } from "@/wab/client/i18n/locales";
import CodeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Code";
import PencilSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__PencilSvg";
import {
  isPlainObjectPropType,
  maybePropTypeToDisplayName,
  type StudioPropType,
} from "@/wab/shared/code-components/code-components";
import { tryCatchElse } from "@/wab/shared/common";
import { smartHumanize } from "@/wab/shared/strs";
import type { PropType } from "@plasmicapp/host";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Popover, Select, Tooltip } from "antd";
import { isPlainObject } from "lodash";
import * as React from "react";
import styles from "@/wab/client/components/sidebar-tabs/ComponentProps/SemanticObjectPropEditor.module.scss";

type Fields = Record<string, PropType<any>>;
type ObjectValue = Record<string, unknown>;

const cssProperties = {
  backgroundColor: { label: "Fill", initial: "transparent" },
  color: { label: "Text color", initial: "inherit" },
  paddingInline: { label: "Horizontal padding", initial: 0, unit: "px" },
  paddingBlock: { label: "Vertical padding", initial: 0, unit: "px" },
  borderRadius: { label: "Corner radius", initial: 0, unit: "px" },
  borderColor: { label: "Border color", initial: "currentColor" },
  borderWidth: { label: "Border width", initial: 0, unit: "px" },
  fontSize: { label: "Font size", initial: "inherit", unit: "px" },
  fontWeight: { label: "Weight", initial: "inherit" },
  minHeight: { label: "Min Height", initial: 0, unit: "px" },
  boxShadow: { label: "Shadow", initial: "none" },
} satisfies Record<
  string,
  { label: MessageKey; initial: string | number; unit?: "px" }
>;

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
                  typeof style === "string" || typeof style === "number",
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
    try: () => JSON.stringify(value, null, 2),
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
        const statusLabel = count > 0
          ? t("{count} configured", { count })
          : disabled
            ? t("Not configured")
            : t("Not configured, click to edit");
        const objectField =
          typeof field === "object" && field.type === "object";

        return (
          <ConnectorLine key={key} isLast={index === entries.length - 1}>
            {objectField ? (
              <details>
                <summary className={styles.row}>
                  {fieldLabel}
                  <Tooltip title={statusLabel}>
                    <span className={styles.disclosure} aria-label={statusLabel}>
                      {count > 0 ? (
                        <span className={styles.configured}>{count}</span>
                      ) : (
                        <span>—</span>
                      )}
                      <Icon icon={PencilSvgIcon} aria-hidden="true" />
                    </span>
                  </Tooltip>
                </summary>
                <div className={styles.fields}>
                  {children ? (
                    <SemanticFields
                      fields={children}
                      value={isObjectValue(current) ? current : {}}
                      disabled={disabled}
                      onChange={update}
                    />
                  ) : (
                    <CssFields
                      value={isObjectValue(current) ? current : {}}
                      disabled={disabled}
                      onChange={update}
                    />
                  )}
                </div>
              </details>
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
  const choices = cssChoices.filter(([key]) => !Object.hasOwn(value, key));
  return (
    <>
      {properties.map(([key, current], index) => {
        const property = Object.hasOwn(cssProperties, key)
          ? cssProperties[key as keyof typeof cssProperties]
          : undefined;
        const label = property ? t(property.label) : key;
        const update = (next: unknown) => onChange(setField(value, key, next));
        return (
          <ConnectorLine
            key={key}
            isLast={
              (disabled || choices.length === 0) &&
              index === properties.length - 1
            }
          >
            <div className={styles.cssRow}>
              <Tooltip title={label}>
                <span className={styles.fieldLabel}>{key}</span>
              </Tooltip>
              {typeof current === "string" &&
              (key === "color" || key.endsWith("Color")) ? (
                <ColorButton
                  sc={studioCtx}
                  aria-label={key}
                  color={current}
                  hideTokenPicker
                  isDisabled={disabled}
                  onChange={update}
                />
              ) : (
                <div className={styles.cssInput}>
                  <StringPropEditor
                    aria-label={key}
                    value={String(current)}
                    disabled={disabled}
                    onChange={(text) => {
                      const normalized = text.trim();
                      const numeric = Number(normalized);
                      update(
                        !normalized
                          ? undefined
                          : /^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized) &&
                              Number.isFinite(numeric)
                            ? numeric
                            : normalized,
                      );
                    }}
                  />
                  {property &&
                    "unit" in property &&
                    typeof current === "number" && (
                      <span className={styles.count}>{property.unit}</span>
                    )}
                </div>
              )}
              <button
                className={styles.iconButton}
                type="button"
                disabled={disabled}
                aria-label={t("Remove CSS property {name}", { name: label })}
                onClick={() => update(undefined)}
              >
                ×
              </button>
            </div>
          </ConnectorLine>
        );
      })}
      {choices.length > 0 && !disabled && (
        <ConnectorLine isLast>
          <Select<string | null>
            className={`${styles.add} ${configSearch.select}`}
            aria-label={t("Add CSS property")}
            placeholder={`+ ${t("Add CSS property")}`}
            value={null}
            showSearch
            optionFilterProp="label"
            options={choices.map(([key, property]) => ({
              value: key,
              label: `${t(property.label)} · ${key}`,
            }))}
            onChange={(key) => {
              const choice = choices.find(([name]) => name === key);
              if (choice) {
                const [name, property] = choice;
                onChange(setField(value, name, property.initial));
              }
            }}
          />
        </ConnectorLine>
      )}
    </>
  );
}
