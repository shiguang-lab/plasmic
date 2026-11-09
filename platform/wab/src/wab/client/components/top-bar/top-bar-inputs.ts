import { ModelFieldSelector } from "@/wab/client/stores/model-field-selector";
import { arrayEq } from "@/wab/shared/common";
import { isAdminTeamEmail } from "@/wab/shared/devflag-utils";
import { canEditProjectConfig, canPublishProject, getLeftTabPermission } from "@/wab/shared/ui-config-utils";
import { useShallow } from "zustand/react/shallow";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import * as React from "react";
import { useStore } from "zustand";

/** Chrome policy/account data is published by its native owners. The model
 * catalog supplies only preview choices; localization reads the Site flags. */
export function useTopBarInputs(studio: StudioCtx, preview: boolean) {
  useStore(studio.uiEnvironment.store, useShallow((state) => [state.canEditProject, state.contentEditorMode, state.canComment, state.hasAppAuth]));
  useStore(studio.projectMetadataStore, useShallow((state) => [state.id, state.name]));
  const catalog = React.useMemo(() => {
    const models = studio.modelSnapshots, site = studio.site;
    return new ModelFieldSelector(studio, (read) => {
      const values: unknown[] = [];
      if (preview) {
        values.push(read(site, "components"));
        for (const ref of read(site, "components")) {
          const component = models.resolve(ref);
          values.push(read(component, "name"), read(component, "type"), read(component, "pageMeta"), read(component, "codeComponentMeta"));
        }
      }
      return Object.freeze(values);
    }, arrayEq);
  }, [studio, studio.modelSnapshots, preview]);
  React.useSyncExternalStore(catalog.subscribe, catalog.getSnapshot, catalog.getSnapshot);
  const account = React.useMemo(() => {
    const read = () => JSON.stringify({
      selfInfo: studio.appCtx.selfInfo,
      debug: studio.appCtx.appConfig.debug,
      hasSecretTokenMenu: studio.appCtx.appConfig.secretApiTokenTeams?.includes(studio.siteInfo.teamId ?? ""),
      isAdmin: isAdminTeamEmail(studio.appCtx.selfInfo?.email, studio.appCtx.appConfig),
      canChat: studio.chatCopilotEnabled(),
      canConfigure: canEditProjectConfig(studio.getCurrentUiConfig()),
      canRename: canEditProjectConfig(studio.getCurrentUiConfig(), "rename"),
      canLocalize: canEditProjectConfig(studio.getCurrentUiConfig(), "localization"),
      canPublish: canPublishProject(studio.getCurrentUiConfig()),
      versionsAccess: getLeftTabPermission(studio.getCurrentUiConfig(), "versions", { isContentCreator: studio.contentEditorMode }),
      teamId: studio.siteInfo.teamId,
      workspaceId: studio.siteInfo.workspaceId,
    });
    const subscribe = (listener: () => void) => {
      const stops = [studio.appCtx.subscribeUiEnvironmentInputs(listener), studio.dbCtx().subscribeVersionInputs(listener), studio.uiEnvironment.store.subscribe(listener)];
      return () => stops.forEach((stop) => stop());
    };
    return { read, subscribe };
  }, [studio]);
  React.useSyncExternalStore(account.subscribe, account.read, account.read);
  const lifetime = studio.arenaState.lifetime();
  const flags = React.useMemo(() => {
    const models = studio.modelSnapshots, site = studio.site;
    const store = !lifetime.aborted ? models.field(site, "flags") : undefined;
    const read = () => !lifetime.aborted && models === studio.modelSnapshots ? !!store?.getState().usePlasmicTranslation : undefined;
    const subscribe = (listener: () => void) => {
      if (lifetime.aborted || !store) { return () => undefined; }
      const stop = store.subscribe(listener);
      const retire = () => { stop(); listener(); };
      lifetime.addEventListener("abort", retire, { once: true });
      return () => { stop(); lifetime.removeEventListener("abort", retire); };
    };
    return { read, subscribe };
  }, [studio, studio.modelSnapshots, studio.site, lifetime]);
  React.useSyncExternalStore(flags.subscribe, flags.read, flags.read);
}
