import VariantBadge from "@/wab/client/components/canvas/VariantsBar/VariantBadge";
import VariantsDrawer from "@/wab/client/components/canvas/VariantsBar/VariantsDrawer";
import styles from "@/wab/client/components/variants/VariantComboPicker.module.scss";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useAutoFocus } from "@/wab/client/hooks/useAutoFocus";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import type { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { VARIANTS_LOWER } from "@/wab/shared/Labels";
import { PinStateManager } from "@/wab/shared/PinManager";
import { BASE_VARIANT_NAME, VariantCombo } from "@/wab/shared/Variants";
import { arrayEq } from "@/wab/shared/common";
import { Component, Site, Variant } from "@/wab/shared/model/classes";
import { Dropdown } from "antd";
import React, {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

interface VariantComboPickerProps {
  site: Site;
  component: Component;
  value: VariantCombo;
  onDismiss?: () => void;
  onChange: (combo: VariantCombo) => void;
  onInputEnter?: (e: React.KeyboardEvent) => void;
  onVisibleChange?: (v: boolean) => void;
  autoFocus?: boolean;
  children?: React.ReactNode;
  hideBase?: boolean;
  hideInteractions?: boolean;
  hideScreen?: boolean;
}

export const VariantComboPicker = VariantComboPicker_;

function VariantComboPicker_({
  site,
  component,
  value,
  onChange,
  onDismiss,
  onVisibleChange,
  autoFocus,
  children,
  hideBase,
  hideInteractions,
  hideScreen,
}: VariantComboPickerProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // const preventDismissingRef = useRef(true);

  const machine = new PinStateManager(site, component, new Map());
  const models = useStudioCtx().modelSnapshots;
  const baseFlags = useBaseVariantFlags(models, value);
  const displayVariants = value.filter((_, index) => !baseFlags[index]);

  const onRemoveVariant = (variant: Variant) => {
    const newState = machine.removeSelectedVariants(
      { targetVariants: value, pinnedVariants: new Map() },
      [variant],
    );
    onChange(machine.selectedVariants(newState));
  };

  const handleRemoveVariant = (variant: Variant) => {
    const newState = machine.removeSelectedVariants(
      { targetVariants: value, pinnedVariants: new Map() },
      [variant],
    );
    onChange(machine.selectedVariants(newState));
  };

  const handleTargetVariant = (variant: Variant) => {
    const newState = machine.addSelectedVariants(
      { targetVariants: value, pinnedVariants: new Map() },
      [variant],
    );
    onChange(machine.selectedVariants(newState));
  };

  useAutoFocus(showDropdown && inputRef);

  if (autoFocus) {
    useLayoutEffect(() => {
      setShowDropdown(true);
    }, []);
  }

  return (
    <Dropdown
      transitionName=""
      trigger={["click"]}
      placement={"topLeft"}
      open={showDropdown}
      onOpenChange={(v) => {
        onVisibleChange?.(v);
        setShowDropdown(v);
      }}
      popupRender={() => (
        <VariantsDrawer
          component={component}
          hideBase={hideBase}
          hideInteractions={hideInteractions}
          hideScreen={hideScreen}
          searchInputRef={inputRef}
          targetedVariants={value}
          onTargetVariant={handleTargetVariant}
          onRemoveVariant={handleRemoveVariant}
          onDismiss={() => {
            onDismiss?.();
            setShowDropdown(false);
          }}
        />
      )}
    >
      <TriggerTarget>
        {children || (
          <div className={styles.valueContainer}>
            {displayVariants.length === 0 && (
              <div className={styles.placeholder}>
                <UiText
                  message={"Select a combination of {part1}"}
                  values={{ part1: <UiLabel text={VARIANTS_LOWER} /> }}
                />
              </div>
            )}
            {displayVariants.map((variant) => (
              <VariantBadge
                isUnpinnable
                isFocused
                component={component}
                isRecording={false}
                variant={variant}
                onUnpin={() => onRemoveVariant(variant)}
              />
            ))}
          </div>
        )}
      </TriggerTarget>
    </Dropdown>
  );
}

/**
 * The combo list is owned by the parent and can change at any time. Read each
 * variant's exact name field through the Studio snapshot owner, and expose only
 * the immutable base flags needed by this picker. Subscriptions are attached to
 * the current list by useSyncExternalStore and detached when it is replaced.
 */
function useBaseVariantFlags(
  models: ModelSnapshots,
  variants: readonly Variant[],
): readonly boolean[] {
  const source = useMemo(() => {
    const nameStores = variants.map((variant) => models.field(variant, "name"));
    const initialSnapshot = Object.freeze(
      nameStores.map((store) => store.getState() === BASE_VARIANT_NAME),
    );
    let snapshot = initialSnapshot;
    const getSnapshot = () => {
      const next = nameStores.map(
        (store) => store.getState() === BASE_VARIANT_NAME,
      );
      if (!arrayEq(snapshot, next)) {
        snapshot = Object.freeze(next);
      }
      return snapshot;
    };
    const getServerSnapshot = () => initialSnapshot;
    const subscribe = (listener: () => void) => {
      const stops = nameStores.map((store) => store.subscribe(listener));
      return () => stops.forEach((stop) => stop());
    };
    return { getSnapshot, getServerSnapshot, subscribe };
  }, [models, variants]);
  return useSyncExternalStore(
    source.subscribe,
    source.getSnapshot,
    source.getServerSnapshot,
  );
}
