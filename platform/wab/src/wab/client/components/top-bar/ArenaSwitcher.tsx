import { useContextMenu } from "@/wab/client/components/ContextMenu";
import { ArenaContextMenu } from "@/wab/client/components/sidebar-tabs/ProjectPanel/ArenaContextMenu";
import {
  DefaultArenaSwitcherProps,
  PlasmicArenaSwitcher,
} from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicArenaSwitcher";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useStudioArena } from "@/wab/client/studio-ctx/arena-state";
import * as React from "react";
import { useShallow } from "zustand/react/shallow";

export type ArenaSwitcherProps = DefaultArenaSwitcherProps;

const ArenaSwitcher = function ArenaSwitcher(props: ArenaSwitcherProps) {
  const studioCtx = useStudioCtx();
  const [current, kind, name] = useStudioArena(
    studioCtx,
    useShallow((state) => [state.current, state.kind, state.name] as const),
  );

  // The context menu still takes the opaque real model. Read it through the
  // canonical getter; the selected ref above only schedules this component
  // when the arena identity changes.
  const currentArena = current !== null ? studioCtx.currentArena : null;

  const contextMenuProps = useContextMenu({
    menu: currentArena ? (
      <ArenaContextMenu
        studioCtx={studioCtx}
        arena={currentArena}
        onSelectRename={undefined /* TODO: implement rename here */}
      />
    ) : null,
  });

  return (
    <PlasmicArenaSwitcher
      onClick={() => studioCtx.showProjectPanel()}
      arenaType={kind ?? "mixed"}
      root={{
        children: (
          <span
            className="fill-width text-ellipsis inline-block"
            style={{ maxWidth: 300 }}
          >
            {name}
          </span>
        ),
      }}
      id="proj-nav-button"
      {...contextMenuProps}
      {...props}
    />
  );
};

export default ArenaSwitcher;
