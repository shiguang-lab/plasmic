import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { Site } from "@/wab/shared/model/classes";
import { isEqual } from "lodash";
import { subscribeStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { useCanvasLoadError } from "@/wab/client/studio-ctx/canvas-load-state";
import { subscribeViewRegistry } from "@/wab/client/studio-ctx/arena-state";
import type { LocalAiContext } from "@/wab/shared/copilot/local-edit";
import {
  MentionableResources,
  findMissingMentions,
  getMentionUiId,
  mkMentionableResources,
} from "@/wab/client/components/copilot/resource-mention-utils";
import { usePreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { subscribeModalOpen } from "@/wab/client/components/widgets/open-modals";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import {
  selectIsCopilotChatOpen,
  selectPanelsHidden,
} from "@/wab/client/studio-ctx/left-panel-state";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { getLocalAiContext, subscribeLocalAiContextInputs } from "@/wab/client/copilot/local-ai-context";
import { fileDragMonitor } from "@/wab/client/file-drag/file-drag-monitor";
import { trackFrameInteractions } from "@/wab/client/frame-ctx/frame-interactions";
import {
  CopilotToolCallResult,
  HostFrameApi,
} from "@/wab/client/frame-ctx/host-frame-api";
import { useHostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { StudioAppUser, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ApiBranch, ArenaRef } from "@/wab/shared/ApiSchema";
import { getArenaRef } from "@/wab/shared/Arenas";
import { findAllDataSourceOpExprForComponent } from "@/wab/shared/cached-selectors";
import {
  ensure,
  filterFalsy,
  jsonClone,
  maybe,
  spawn,
  withoutNils,
} from "@/wab/shared/common";
import type { AiOutputFormat, CopilotCaller } from "@/wab/shared/copilot/copilot-tool-types";
import { isPageComponent } from "@/wab/shared/core/components";
import { formatErrorMessage } from "@/wab/shared/error-handling";
import { notification, message } from "antd";
import { ok } from "neverthrow";
import React from "react";
import { mutate as swrMutate } from "swr";

import { useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import { LocalizationConfig } from "@/wab/shared/localization";

export interface TopFrameObserverProps {
  preview?: boolean;
  studioReady?: boolean;
}

function notifyMentionedResourceGone() {
  notification.info({
    message: translate(getUiLocale(), "That resource no longer exists"),
    description: translate(
      getUiLocale(),
      "It may have been deleted since it was mentioned.",
    ),
  });
}

function trackArtboardFileDrags(studioCtx: StudioCtx): () => void {
  const untrackByViewCtx = new Map<ViewCtx, () => void>();
  let closed = false;
  // Each registered iframe owns a real DOM listener pair; a roster change
  // detaches the old window before attaching the replacement.
  const sync = () => {
    if (closed) {
      return;
    }
    const viewCtxs = new Set(
      studioCtx.arenaState.viewRegistry.store
        .getState()
        .map((entry) => entry.view),
    );
    for (const [vc, untrack] of untrackByViewCtx) {
      if (!viewCtxs.has(vc)) {
        untrack();
        untrackByViewCtx.delete(vc);
      }
    }
    for (const vc of viewCtxs) {
      if (!untrackByViewCtx.has(vc)) {
        untrackByViewCtx.set(
          vc,
          fileDragMonitor.addWindowListeners(vc.canvasCtx.win()),
        );
      }
    }
  };
  const stopRegistry = subscribeViewRegistry(
    studioCtx,
    (entries) => entries,
    sync,
  );
  const stop = () => {
    if (closed) {
      return;
    }
    closed = true;
    stopRegistry();
    untrackByViewCtx.forEach((untrack) => untrack());
    untrackByViewCtx.clear();
  };
  // Do not wait for the next roster notification: public iframes already live
  // when this observer mounts must receive their file-drag listeners now.
  sync();
  return stop;
}

/** Scope labels, selection, model ownership and access are published by their
 * native owners after a completed command. No model reaction is retained. */
export function observeLocalAiContext(
  studio: StudioCtx,
  enabled: () => boolean,
  publish: (context: LocalAiContext | undefined) => void,
): () => void {
  const observe = () => publish(enabled() ? getLocalAiContext(studio) : undefined);
  const stopInputs = subscribeLocalAiContextInputs(studio, observe);
  const stopPolicy = subscribeStudioRenderPolicy(studio, (state) => state.devMode, observe);
  observe();
  return () => { stopInputs(); stopPolicy(); };
}

type TopFramePrimitives = Parameters<ReturnType<typeof useTopFrameApi>["setPrimitiveValues"]>[0];

/** Host chrome consumes these two Site fields and the admitted DB revision.
 * A site replacement rebinds the fields after the new model owner is installed. */
export function observeTopFramePrimitiveValues(studio: StudioCtx, publish: (values: TopFramePrimitives) => void): () => void {
  const modelStops: (() => void)[] = [];
  let models = studio.modelSnapshots, site = studio.site, lifetime = studio.arenaState.lifetime();
  let flags: ModelFieldStore<Readonly<Site["flags"]>> | undefined;
  let role: ModelFieldStore<Site["defaultPageRoleId"]> | undefined;
  let previous: TopFramePrimitives | undefined;
  let closed = false;
  const releaseModelInputs = () => {
    modelStops.splice(0).forEach((stop) => stop());
    flags = undefined; role = undefined;
  };
  const sync = () => {
    if (closed || lifetime.aborted || models !== studio.modelSnapshots || site !== studio.site || !flags || !role) { return; }
    const currentFlags = flags.getState();
    const next: TopFramePrimitives = {
      revisionNum: studio.revisionNum,
      isLocalizationEnabled: !!currentFlags.usePlasmicTranslation,
      defaultPageRoleId: role.getState(),
      localizationScheme: currentFlags.keyScheme ? ({ keyScheme: currentFlags.keyScheme, tagPrefix: currentFlags.tagPrefix } as LocalizationConfig) : undefined,
    };
    if (!previous || !isEqual(previous, next)) { previous = next; publish(next); }
  };
  const bind = () => {
    releaseModelInputs();
    models = studio.modelSnapshots; site = studio.site; lifetime = studio.arenaState.lifetime();
    if (closed || lifetime.aborted) { return; }
    flags = models.field(site, "flags"); role = models.field(site, "defaultPageRoleId");
    const capturedLifetime = lifetime;
    capturedLifetime.addEventListener("abort", releaseModelInputs, { once: true });
    modelStops.push(flags.subscribe(sync), role.subscribe(sync), () => capturedLifetime.removeEventListener("abort", releaseModelInputs));
    sync();
  };
  const stops = [
    studio.dbCtx().subscribeVersionInputs(sync),
    studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { bind(); } }),
    studio.arenaState.readinessStore.subscribe((ready) => { if (ready && lifetime !== studio.arenaState.lifetime()) { bind(); } }),
  ];
  bind();
  return () => { closed = true; stops.forEach((stop) => stop()); releaseModelInputs(); };
}

/** Branch DTOs are owned by DB version inputs, and feature access by the native
 * UI environment. Unrelated revision changes do not resend an unchanged branch. */
export function observeActivatedBranch(studio: StudioCtx, publish: (branch: ApiBranch | undefined) => void): () => void {
  let hasPrevious = false;
  let previous: ApiBranch | undefined;
  const sync = () => {
    if (!studio.uiEnvironment.store.getState().showBranching) { return; }
    const next = jsonClone(studio.dbCtx().branchInfo ?? null) ?? undefined;
    if (!hasPrevious || !isEqual(previous, next)) { hasPrevious = true; previous = next; publish(next); }
  };
  const stops = [studio.dbCtx().subscribeVersionInputs(sync), studio.uiEnvironment.store.subscribe(sync)];
  sync();
  return () => stops.forEach((stop) => stop());
}

class CopilotToolCalls {
  private readonly controllers = new Map<string, AbortController>();
  start(requestId: string | undefined) {
    if (!requestId) { return undefined; }
    const controller = new AbortController(); this.controllers.set(requestId, controller); return controller;
  }
  cancel(requestId: string) { this.controllers.get(requestId)?.abort(); }
  finish(requestId: string | undefined) { if (requestId) { this.controllers.delete(requestId); } }
}

export const TopFrameObserver = React.memo(function TopFrameObserverContent({
  preview,
  studioReady = true,
}: TopFrameObserverProps) {
  const hostFrameCtx = useHostFrameCtx();
  const studioCtx = useStudioCtx();
  const previewCtx = usePreviewCtx();
  const topFrameApi = useTopFrameApi();
  const toolControllers = React.useMemo(() => new CopilotToolCalls(), [studioCtx]);

  const hostFrameApi = React.useMemo<HostFrameApi>(
    () => ({
      openCopilotChat: async (opts) => studioCtx.openCopilotChat(opts),
      switchLeftTab: async (tabKey, opts) =>
        studioCtx.switchLeftTab(tabKey, opts),
      refreshSiteInfo: async () => {
        await studioCtx.refreshSiteInfo();
      },
      calculateNextPublishVersion: async () => {
        const next = await studioCtx.calculateNextPublishVersion();
        return next
          ? {
              changeLog: next.changeLog,
              version: next.version,
              releaseType: next.releaseType,
            }
          : undefined;
      },
      getPublishPages: async () =>
        studioCtx.site.components
          .filter(isPageComponent)
          .map((component) => ({
            id: component.uuid,
            name: component.name,
            path: ensure(component.pageMeta, "Page metadata is required").path,
          })),
      getLatestPublishedVersionId: async () => studioCtx.releases[0]?.id,
      getProjectReleases: async (opts) => studioCtx.getProjectReleases(opts),
      publishVersion: async (versionTags, versionDesc, branchId) =>
        studioCtx.publish(versionTags, versionDesc, branchId),
      focusOnWindow: async () => {
        window.focus();
      },
      forwardShortcut: async ({
        code,
        ctrlKey,
        key,
        metaKey,
        shiftKey,
        keyCode,
      }) => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", {
            code,
            ctrlKey,
            key,
            metaKey,
            shiftKey,
            keyCode,
          }),
        );
        document.body.dispatchEvent(
          new KeyboardEvent("keypress", {
            code,
            ctrlKey,
            key,
            metaKey,
            shiftKey,
            keyCode,
          }),
        );
      },
      updateLocalizationProjectFlags: async (
        localization,
        keyScheme,
        tagPrefix,
      ) => {
        await studioCtx.change(() => {
          studioCtx.site.flags.usePlasmicTranslation = localization;
          if (keyScheme && localization) {
            studioCtx.site.flags.keyScheme = keyScheme;
            studioCtx.site.flags.tagPrefix = tagPrefix;
          } else {
            studioCtx.site.flags.keyScheme = undefined;
            studioCtx.site.flags.tagPrefix = undefined;
          }
          void message.success({
            content: translate(
              getUiLocale(),
              studioCtx.site.flags.usePlasmicTranslation
                ? "Localization is now enabled"
                : "Localization is now disabled",
            ),
          });
          return ok();
        });
      },
      async switchToBranch(branch: ApiBranch | undefined): Promise<void> {
        await studioCtx.switchToBranch(branch);
      },
      async mutateSWRKeys(keys: string[]): Promise<void> {
        await Promise.all(keys.map((key) => swrMutate(key)));
      },
      async getUsedRolesInProject(): Promise<
        { component: string; roleId: string }[]
      > {
        const roleUsage: { component: string; roleId: string }[] = [];
        for (const component of studioCtx.site.components) {
          if (isPageComponent(component)) {
            if (component.pageMeta?.roleId) {
              roleUsage.push({
                component: component.name,
                roleId: component.pageMeta.roleId,
              });
            }
          }

          const componentDataOps =
            findAllDataSourceOpExprForComponent(component);
          for (const componentDataOp of componentDataOps) {
            if (componentDataOp?.roleId) {
              roleUsage.push({
                component: component.name,
                roleId: componentDataOp.roleId,
              });
            }
          }
        }
        return roleUsage;
      },
      async setDefaultPageRoleId(
        roleId: string | null | undefined,
      ): Promise<void> {
        await studioCtx.change(() => {
          studioCtx.site.defaultPageRoleId = roleId;
          return ok();
        });
      },
      async logAsAppUser(appUser: StudioAppUser): Promise<void> {
        await studioCtx.logAsAppUser(appUser);
        await studioCtx.refreshAppUserProperties();
      },
      async handleBranchMerged(): Promise<void> {
        await studioCtx.handleBranchMerged();
      },
      async waitForStudioReady(): Promise<void> {
        await studioCtx.awaitStudioReady();
      },
      async flushDesktopDraft() {
        if (!studioCtx.hasUnsavedChanges()) {return true;}
        return await studioCtx.desktopDraft?.flush() ?? false;
      },
      async showDesktopDrafts() {
        if (studioCtx.desktopDraft?.store.getState().drafts.length) {studioCtx.desktopDraft.setDialogOpen(true);}
      },
      async blockChanges(): Promise<void> {
        studioCtx.setBlockChanges(true);
      },
      async cancelCopilotToolCall(requestId: string) {
        toolControllers.cancel(requestId);
      },
      async clearCopilotCallerActivity(callerId: string) {
        studioCtx.copilotActivity.clearCaller(callerId);
      },
      async executeCopilotToolCall(
        toolName: string,
        toolArgs: Record<string, unknown>,
        outputFormat?: AiOutputFormat,
        caller?: CopilotCaller,
        requestId?: string,
      ): Promise<CopilotToolCallResult> {
        const copilotTool = COPILOT_TOOLS[toolName];

        if (!copilotTool) {
          return {
            success: false,
            error: {
              message: `AI tool "${toolName}" not found.`,
              type: "TOOL_NOT_FOUND",
            },
          };
        }

        const controller = toolControllers.start(requestId);
        return await (async (): Promise<CopilotToolCallResult> => {
          const output = await copilotTool.execute(studioCtx, toolArgs, {
            outputFormat,
            caller,
            signal: controller?.signal,
          });
          return { success: true, output };
        })().catch(async (err): Promise<CopilotToolCallResult> => {
          return {
            success: false,
            error: {
              message: formatErrorMessage(err),
              type: "EXECUTION_FAILED",
              ...(err && typeof err === "object" && "operationExecuted" in err && err.operationExecuted === false ? { operationExecuted: false as const } : {}),
            },
          };
        }).finally(() => {
          toolControllers.finish(requestId);
        });
      },
      async setPreferredAiOutputFormat(format: AiOutputFormat): Promise<void> {
        studioCtx.setPreferredAiOutputFormat(format);
      },
      /**
       * List the project resources that can be `@`-mentioned in Copilot Chat.
       */
      async listMentionableResources(): Promise<MentionableResources> {
        const viewCtx = studioCtx.focusedViewCtx();
        return mkMentionableResources({
          site: studioCtx.site,
          focusedComponent: viewCtx?.currentComponent(),
          selectedTpls: withoutNils(viewCtx?.focusedTpls() ?? []),
          getDepName: (dep) =>
            studioCtx.projectDependencyManager.getNiceDepName(dep),
        });
      },
      async getCurrentArena(): Promise<ArenaRef | undefined> {
        return maybe(studioCtx.currentArena, getArenaRef);
      },
      async findMissingMentions(text: string): Promise<string[]> {
        return findMissingMentions(text, studioCtx.site);
      },
      async navigateToMentionedResource(kind, uuid): Promise<void> {
        const uiId = getMentionUiId(kind, uuid, studioCtx.site);
        if (!uiId) {
          notifyMentionedResourceGone();
          return;
        }
        studioCtx.uiActionBus.dispatch(uiId, "jump");
      },
      async onFileDragEventInTop(event): Promise<void> {
        fileDragMonitor.onRemoteEvent(event);
      },
    }),
    [studioCtx, toolControllers],
  );

  React.useEffect(() => {
    hostFrameCtx.onHostFrameApiReady(hostFrameApi);
  }, [hostFrameApi]);

  const canvasError = useCanvasLoadError(studioCtx);
  React.useEffect(() => {
    if (canvasError) { spawn(topFrameApi.setStudioError(canvasError)); }
  }, [canvasError, topFrameApi]);

  React.useEffect(() => {
    if (studioReady) {
      studioCtx.loadTimings.report("canvas-revealed");
      spawn(hostFrameCtx.revealStudio());
    }
  }, [studioReady, hostFrameCtx]);

  React.useEffect(
    () =>
      trackFrameInteractions(document, (event, source) => {
        // The canvas viewport forwards these locally before selection cancels them.
        if (
          source.target instanceof Element &&
          source.target.closest(".canvas-editor__canvas-clipper")
        ) {
          return;
        }
        spawn(topFrameApi.onFrameInteraction(event));
      }),
    [topFrameApi],
  );

  React.useEffect(() => trackArtboardFileDrags(studioCtx), [studioCtx]);
  React.useEffect(
    () =>
      fileDragMonitor.subscribeRemote((event) =>
        spawn(topFrameApi.onFileDragEventInHost(event)),
      ),
    [topFrameApi],
  );

  React.useEffect(() => {
    const dispose = subscribeModalOpen(open => {
      spawn(topFrameApi.setStudioModalOpen(open));
    });
    return () => {
      dispose();
      spawn(topFrameApi.setStudioModalOpen(false));
    };
  }, [topFrameApi]);

  React.useEffect(() => {
    const disposes = filterFalsy([
      (() => {
        let previous: boolean | undefined;
        const publish = () => {
          const state = studioCtx.leftPanelState.store.getState();
          const next =
            selectIsCopilotChatOpen(state) && !selectPanelsHidden(state);
          if (next === previous) {
            return;
          }
          previous = next;
          spawn(topFrameApi.setAiPanelOpen(next));
        };
        const stopStore = studioCtx.leftPanelState.store.subscribe(publish);
        publish();
        return stopStore;
      })(),
      observeLocalAiContext(
        studioCtx,
        () => !preview && studioCtx.showDevControls && studioCtx.canEditProject(),
        (context) => spawn(topFrameApi.setLocalAiContext(context)),
      ),
      observeTopFramePrimitiveValues(studioCtx, (values) => spawn(topFrameApi.setPrimitiveValues(values))),
      (() => {
        const syncLatest = () => {
          const latest = studioCtx.versionHistory.store.getState().releases[0];
          spawn(topFrameApi.setLatestPublishedVersionData(latest?.revisionId ? { revisionId: latest.revisionId, version: latest.version } : undefined));
        };
        syncLatest();
        return studioCtx.versionHistory.store.subscribe((next, previous) => {
          const latest = next.releases[0], before = previous.releases[0];
          const revisionChanged = latest?.revisionId !== before?.revisionId;
          const versionChanged = latest?.version !== before?.version;
          if (revisionChanged || versionChanged) { syncLatest(); }
        });
      })(),
      observeActivatedBranch(studioCtx, (branch) => spawn(topFrameApi.setActivatedBranch(branch))),
    ]);
    return () => disposes.forEach((f) => f());
  }, [studioCtx, previewCtx, preview, topFrameApi]);

  return null;
});
