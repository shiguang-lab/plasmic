import { useContextMenu } from "@/wab/client/components/ContextMenu";
import { ArenaContextMenu } from "@/wab/client/components/sidebar-tabs/ProjectPanel/ArenaContextMenu";
import {
  DefaultArenaSwitcherProps,
  PlasmicArenaSwitcher,
} from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicArenaSwitcher";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  AnyArena,
  getArenaName,
  isComponentArena,
  isPageArena,
} from "@/wab/shared/Arenas";
import { observer } from "mobx-react";
import * as React from "react";

export type ArenaSwitcherProps = DefaultArenaSwitcherProps;

const ArenaSwitcher = observer(function ArenaSwitcher(
  props: ArenaSwitcherProps,
) {
  const studioCtx = useStudioCtx();
  const currentArena = studioCtx.currentArena as AnyArena;
  const currentArenaName = currentArena ? getArenaName(currentArena) : "";

  const contextMenuProps = useContextMenu({
    menu: (
      <ArenaContextMenu
        studioCtx={studioCtx}
        arena={currentArena}
        onSelectRename={undefined /* TODO: implement rename here */}
      />
    ),
  });

  return (
    <PlasmicArenaSwitcher
      onClick={() => studioCtx.showProjectPanel()}
      arenaType={
        isComponentArena(currentArena)
          ? "component"
          : isPageArena(currentArena)
            ? "page"
            : "mixed"
      }
      root={{
        children: (
          <span
            className="fill-width text-ellipsis inline-block"
            style={{ maxWidth: 300 }}
          >
            {currentArenaName}
          </span>
        ),
      }}
      id="proj-nav-button"
      {...contextMenuProps}
      {...props}
    />
  );
});

export default ArenaSwitcher;
