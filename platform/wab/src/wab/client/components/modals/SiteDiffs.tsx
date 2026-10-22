import sty from "@/wab/client/components/modals/SiteDiffs.module.css";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { UiText } from "@/wab/client/i18n/UiText";
import ArrowRightIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__ArrowRight";
import CloseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import CodeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Code";
import ComponentIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Component";
import GlobeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Globe";
import ImageBlockIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__ImageBlock";
import MixinIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Mixin";
import PencilIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Pencil";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import SlotIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Slot";
import ThemeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Theme";
import TokenIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Token";
import VariantGroupIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__VariantGroup";
import TextInputIcon from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicIcon__TextInput";
import VariantIcon from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicIcon__Variant";
import RocketsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__RocketSvg";
import { ensure, withoutNils, xSetDefault } from "@/wab/shared/common";
import { SplitType } from "@/wab/shared/core/splits";
import type {
  ChangeLogEntry,
  SemVerSiteElement,
} from "@/wab/shared/site-diffs";
import L, { uniq } from "lodash";
import { observer } from "mobx-react";
import * as React from "react";

import { DataTokenIcon } from "@/wab/client/icons";

export const SiteDiffs = observer(function SideDiffs(props: {
  diffs: ChangeLogEntry[];
}) {
  const { diffs } = props;

  const parentNameByUuid = new Map<string, string>();
  const diffsByParent = new Map<string, ChangeLogEntry[]>();
  for (const diff of diffs) {
    xSetDefault(
      diffsByParent,
      diff.parentComponent === "global" ? "global" : diff.parentComponent.uuid,
      () => [],
    ).push(diff);
    if (diff.parentComponent !== "global") {
      parentNameByUuid.set(
        diff.parentComponent.uuid,
        diff.parentComponent.name,
      );
    }
  }

  const globalDiffs = diffsByParent.get("global") || [];

  return (
    <div className={sty.root}>
      {globalDiffs.length > 0 && (
        <div className={sty.componentCard}>
          <div className={sty.cardHeader}>
            <Icon icon={GlobeIcon} className="dimfg mr-sm" />
            <span className={sty.cardTitle}>
              <UiText message={"Global changes"} />
            </span>
          </div>
          <div className={sty.cardBody}>
            <ChangeSubSection diffs={globalDiffs} />
          </div>
        </div>
      )}
      {[...diffsByParent.entries()].map(([parent, subDiffs]) => {
        if (parent === "global") {
          return null;
        }
        const [patches, others] = L.partition(
          subDiffs,
          (d) => d.releaseType === "patch",
        );
        const compName = ensure(
          parentNameByUuid.get(parent),
          "Unexpected missing parent element in diffs",
        );
        return (
          <div key={parent} className={sty.componentCard}>
            <div className={sty.cardHeader}>
              <Icon icon={ComponentIcon} className="component-fg mr-sm" />
              <span className={sty.cardTypeTag}>
                <UiText message={"Component"} />
              </span>
              <span className={sty.cardTitle}>{compName}</span>
            </div>
            <div className={sty.cardBody}>
              <ChangeSubSection diffs={others} />
              {patches.length > 0 && (
                <div className={sty.patchItem}>
                  <Icon icon={ThemeIcon} className="dimfg mr-sm" />
                  <UiText message={"Styles and elements updated"} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export function getObjClassName(typename: SemVerSiteElement["type"]) {
  switch (typename) {
    case "Variant":
    case "Variant group":
      return "variant-fg";
    case "Param":
    case "Component":
      return "component-fg";
    case "Style token":
      return "token-fg";
    case "Data token":
      return "data-token-fg";
    case "Function":
      return "function-fg";
    case "Mixin":
      return "mixin-fg";
    case "Icon":
    case "Image":
    case "Element":
    default:
      return "tag-fg";
  }
}

export function objIcon(obj: SemVerSiteElement, tplIcon?: React.ReactNode) {
  const className = getObjClassName(obj.type);
  if (obj.type === "Variant group" || obj.type === "Global variant group") {
    return (
      <Icon
        className="variant-fg"
        icon={obj.type === "Variant group" ? VariantGroupIcon : GlobeIcon}
      />
    );
  } else if (obj.type === "Param") {
    return <Icon className={className} icon={SlotIcon} />;
  } else if (obj.type === "Variant") {
    return <Icon className={className} icon={VariantIcon} />;
  } else if (obj.type === "Style token") {
    return <Icon className={className} icon={TokenIcon} />;
  } else if (obj.type === "Mixin") {
    return <Icon className={className} icon={MixinIcon} />;
  } else if (obj.type === "Component") {
    return <Icon className={className} icon={ComponentIcon} />;
  } else if (obj.type === "Function") {
    return <Icon className={className} icon={CodeIcon} />;
  } else if (obj.type === "Icon" || obj.type === "Image") {
    return <Icon className={className} icon={ImageBlockIcon} />;
  } else if (obj.type === "Element") {
    return <span className={className}>{tplIcon}</span>;
  } else if (obj.type === "Data token") {
    return <Icon className={className} icon={DataTokenIcon} />;
  } else {
    return <Icon className={className} icon={ArrowRightIcon} />;
  }
}

export const SplitStatusUpdateSection = observer(
  function SplitStatusUpdateSection(props: { diffs: ChangeLogEntry[] }) {
    const { diffs } = props;
    const splitStatusUpdate = diffs.filter(
      (f) => f.description === "split-status-update",
    );
    return (
      <>
        {splitStatusUpdate.length > 0 && (
          <div className={sty.changeGroup}>
            <div className={sty.badgeUpdated}>
              <Icon icon={RocketsvgIcon} className="mr-xs" />
              <UiText message={"Split Status Updated"} />
            </div>
            <div className={sty.entityList}>
              {splitStatusUpdate.map((diff, i) => (
                <div key={i} className={sty.entityItem}>
                  <SplitChangeEntity diff={diff} />
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  },
);

export const SplitStatusUpdateSummarySection = observer(
  function SplitStatusUpdateSummarySection(props: { diffs: ChangeLogEntry[] }) {
    const { diffs } = props;
    const getTypeText = (type: string) => {
      switch (type) {
        case SplitType.Experiment: {
          return "A/B Tests";
        }
        case SplitType.Schedule: {
          return "Scheduled";
        }
        case SplitType.Segment: {
          return "Targeted";
        }
        default: {
          return "";
        }
      }
    };
    const splitTypesChanged = uniq(
      withoutNils(
        diffs.map((f) => {
          if (
            f.description === "split-status-update" &&
            f.newValue?.type === "Split Status"
          ) {
            return getTypeText(f.newValue.splitType);
          }
          return null;
        }),
      ),
    ).sort();
    if (splitTypesChanged.length === 0) {
      return null;
    }
    return (
      <div className={sty.headerItem}>
        <UiText
          message={"{part1} content changed."}
          values={{
            part1: splitTypesChanged.map((val, idx) => {
              const separator =
                idx === splitTypesChanged.length - 2
                  ? " and "
                  : idx < splitTypesChanged.length - 2
                    ? ", "
                    : "";
              return `${val}${separator}`;
            }),
          }}
        />
      </div>
    );
  },
);

const ChangeSubSection = observer(function ChangeSubSection(props: {
  diffs: ChangeLogEntry[];
}) {
  const { diffs } = props;
  const removeds = diffs.filter((f) => f.description === "removed");
  const addeds = diffs.filter((f) => f.description === "added");

  // We also ignore renaming of variants that are standalone, as renaming of the corresponding
  // variant group is sufficient
  const renameds = diffs.filter(
    (f) =>
      f.description === "renamed" &&
      (!(f.newValue?.type === "Variant") || !f.newValue.isStandalone),
  );
  const updateds = diffs.filter((f) => f.description === "updated");

  return (
    <div className={sty.subSection}>
      <SplitStatusUpdateSection diffs={diffs} />
      {addeds.length > 0 && (
        <div className={sty.changeGroup}>
          <div className={sty.badgeAdded}>
            <Icon icon={PlusIcon} className="mr-xs" />
            <UiText message={"Added"} />
          </div>
          <div className={sty.entityList}>
            {addeds.map((diff, i) => (
              <div key={i} className={sty.entityItem}>
                <ChangeEntity diff={diff} />
              </div>
            ))}
          </div>
        </div>
      )}
      {updateds.length > 0 && (
        <div className={sty.changeGroup}>
          <div className={sty.badgeUpdated}>
            <Icon icon={PencilIcon} className="mr-xs" />
            <UiText message={"Updated"} />
          </div>
          <div className={sty.entityList}>
            {updateds.map((diff, i) => (
              <div key={i} className={sty.entityItem}>
                <ChangeEntity diff={diff} />
              </div>
            ))}
          </div>
        </div>
      )}
      {renameds.length > 0 && (
        <div className={sty.changeGroup}>
          <div className={sty.badgeRenamed}>
            <Icon icon={TextInputIcon} className="mr-xs" />
            <UiText message={"Renamed"} />
          </div>
          <div className={sty.entityList}>
            {renameds.map((diff, i) => (
              <div key={i} className={sty.entityItem}>
                <ChangeRenamedEntity diff={diff} />
              </div>
            ))}
          </div>
        </div>
      )}
      {removeds.length > 0 && (
        <div className={sty.changeGroup}>
          <div className={sty.badgeRemoved}>
            <Icon icon={CloseIcon} className="mr-xs" />
            <UiText message={"Removed"} />
          </div>
          <div className={sty.entityList}>
            {removeds.map((diff, i) => (
              <div key={i} className={sty.entityItem}>
                <ChangeEntity diff={diff} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

function getEntityTypeLabel(type: SemVerSiteElement["type"]) {
  switch (type) {
    case "Component":
      return <UiText message={"Component"} />;
    case "Element":
      return <UiText message={"Element"} />;
    case "Param":
      return <UiText message={"Param"} />;
    case "Style token":
      return <UiText message={"Style token"} />;
    case "Data token":
      return <UiText message={"Data token"} />;
    case "Mixin":
      return <UiText message={"Style presets"} />;
    case "Function":
      return <UiText message={"Function"} />;
    case "Variant":
      return <UiText message={"Variant"} />;
    case "Variant group":
      return <UiText message={"Variant group"} />;
    default:
      return type;
  }
}

const ChangeEntity = observer(function ChangeEntity(props: {
  diff: ChangeLogEntry;
}) {
  const entity = props.diff.newValue ?? props.diff.oldValue;
  if (entity) {
    return (
      <div className={sty.entityRow}>
        <span className={sty.entityIcon}>{objIcon(entity)}</span>
        <span className={sty.entityType}>{getEntityTypeLabel(entity.type)}</span>
        <code className={sty.entityName}>{entity.name}</code>
      </div>
    );
  }
  return null;
});

const SplitChangeEntity = observer(function SplitChangeEntity(props: {
  diff: ChangeLogEntry;
}) {
  const oldValue = props.diff.oldValue;
  const newValue = props.diff.newValue;
  if (oldValue?.type === "Split Status" && newValue?.type === "Split Status") {
    return (
      <div className={sty.entityRow}>
        <span className={sty.entityIcon}>{objIcon(newValue)}</span>
        <code className={sty.entityName}>{newValue.name}</code>
        <span className={sty.renameArrow}>
          {oldValue.value} ➔ {newValue.value}
        </span>
      </div>
    );
  }
  return null;
});

const ChangeRenamedEntity = observer(function ChangeRenamedEntity(props: {
  diff: ChangeLogEntry;
}) {
  const { diff } = props;
  const entity = ensure(
    diff.oldValue,
    "Unexpected rename diff element without oldValue",
  );
  if (entity) {
    return (
      <div className={sty.entityRow}>
        <span className={sty.entityIcon}>{objIcon(entity)}</span>
        <span className={sty.entityType}>{getEntityTypeLabel(entity.type)}</span>
        <code className={sty.entityName}>{entity.name}</code>
        <span className={sty.renameArrow}>➔</span>
        <code className={sty.entityName}>
          {
            ensure(
              diff.newValue,
              "Unexpected Rename diff element without newValue",
            ).name
          }
        </code>
      </div>
    );
  }
  return null;
});
