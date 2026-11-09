import { useDedicatedArenaInputs } from "@/wab/client/components/studio/arenas/dedicated-arena-inputs";
import { useCanvasZoom } from "@/wab/client/studio-ctx/viewport-state";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { makeFrameSizeMenu } from "@/wab/client/components/menus/FrameSizeMenu";
import ExperimentCanvasButton from "@/wab/client/components/splits/ExperimentCanvasButton";
import { VariantComboGhostFrame } from "@/wab/client/components/studio/arenas/ComponentArenaLayout";
import sty from "@/wab/client/components/studio/arenas/ComponentArenaLayout.module.sass";
import { GhostFrame } from "@/wab/client/components/studio/arenas/GhostFrame";
import { GridFramesLayout } from "@/wab/client/components/studio/arenas/GridFramesLayout";
import { useI18n } from "@/wab/client/i18n";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { spawn } from "@/wab/shared/common";
import { allComponentVariants } from "@/wab/shared/core/components";
import { allGlobalVariantGroups } from "@/wab/shared/core/sites";
import { isVariantUsedInSplits } from "@/wab/shared/core/splits";
import { COMBINATIONS_CAP } from "@/wab/shared/Labels";
import {
  ArenaFrame,
  ensureKnownVariant,
  PageArena,
} from "@/wab/shared/model/classes";
import { isBaseVariant, isStandaloneVariant } from "@/wab/shared/Variants";
import React from "react";

type PageArenaLayoutProps = {
  studioCtx: StudioCtx;
  arena: PageArena;
  onFrameLoad: (frame: ArenaFrame, canvasCtx: CanvasCtx) => void;
};
export const PageArenaLayout = React.memo(function PageArenaLayout(props: PageArenaLayoutProps) {
  const inputs = useDedicatedArenaInputs(props.studioCtx, props.arena);
  return inputs.isCurrent() ? <PageArenaLayoutContent {...props} isCurrent={inputs.isCurrent} /> : null;
});
function PageArenaLayoutContent(props: PageArenaLayoutProps & { isCurrent: () => boolean }) {
  const { t: uiT } = useI18n();
  const { studioCtx, arena, onFrameLoad } = props;
  const viewportZoom = useCanvasZoom(studioCtx);
  const component = arena.component;

  const componentVariants = allComponentVariants(component);
  const globalVariants = allGlobalVariantGroups(studioCtx.site, {
    includeDeps: "direct",
    excludeEmpty: true,
    excludeInactiveScreenVariants: true,
  });

  const allowCombos = componentVariants.length + globalVariants.length > 2;

  return (
    <div>
      <GridFramesLayout
        arena={arena}
        grid={arena.matrix}
        onFrameLoad={onFrameLoad}
        makeRowLabel={(row, _index) => {
          const variant = ensureKnownVariant(row.rowKey);
          if (isBaseVariant(variant)) {
            return null;
          } else if (isStandaloneVariant(variant)) {
            return variant.name;
          } else if (isVariantUsedInSplits(studioCtx.site, variant)) {
            return variant.parent?.param.variable.name ?? variant.name;
          } else {
            return `${variant.parent?.param.variable.name}: ${variant.name}`;
          }
        }}
        makeRowLabelControls={(row, _index) => {
          const variant = ensureKnownVariant(row.rowKey);
          if (
            isBaseVariant(variant) ||
            isStandaloneVariant(variant) ||
            !variant.parent
          ) {
            return null;
          }
          const group = variant.parent;
          return <ExperimentCanvasButton group={group} />;
        }}
        rowEndControls={(_row, _index) => {
          return (
            <GhostFrame
              tooltip={uiT("Add screen size")}
              data-event="page-arena-add-screen-size"
              menu={() =>
                makeFrameSizeMenu({
                  studioCtx,
                  onClick: (size) => {
                    if (!props.isCurrent()) { return; }
                    spawn(
                      studioCtx.changeUnsafe(() => {
                        if (props.isCurrent()) { studioCtx.siteOps().addScreenSizeToPageArenas(size); }
                      }),
                    );
                  },
                })
              }
            />
          );
        }}
      />
      {allowCombos && (
        <>
          <div className="overflow-hidden">
            <hr
              className={sty.customGridDivider}
              style={{ transform: `scale(${1 / viewportZoom})` }}
            />
          </div>
          <GridFramesLayout
            arena={arena}
            grid={arena.customMatrix}
            onFrameLoad={onFrameLoad}
            makeRowLabel={() => uiT(COMBINATIONS_CAP)}
            rowEndControls={() => (
              <VariantComboGhostFrame studioCtx={studioCtx} arena={arena} />
            )}
          />
        </>
      )}
    </div>
  );
}
