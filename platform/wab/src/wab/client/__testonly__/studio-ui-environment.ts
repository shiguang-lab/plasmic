import { captureComponentSectionPermissions, captureLeftTabPermissions } from "@/wab/client/studio-ctx/studio-ui-permissions";
import type { StudioUiEnvironmentState } from "@/wab/client/studio-ctx/studio-ui-environment";
import { MainBranchId } from "@/wab/shared/ApiSchema";
import { canEditStyleSection, getLeftTabPermission } from "@/wab/shared/ui-config-utils";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { createStore } from "zustand/vanilla";

export function createStudioUiEnvironmentFixture(initial: Partial<StudioUiEnvironmentState> = {}) {
  return { uiEnvironment: { store: createStore<StudioUiEnvironmentState>(() => ({
    hostUrl: DEVFLAGS.defaultHostUrl,
    brand: undefined,
    showBranching: true,
    branchName: MainBranchId,
    branchId: null,
    hasAppAuth: false,
    hasUserInfo: false,
    contentEditorMode: false,
    componentSectionPermissions: captureComponentSectionPermissions((key) => canEditStyleSection({}, key, { isContentCreator: false, defaultContentEditorVisible: false })),
    enableDataQueries: !!DEVFLAGS.enableDataQueries,
    isProjectEditor: false,
    canEditProject: true,
    tokenPanelReadOnly: false,
    dataTokenPanelReadOnly: false,
    currentArenaEmpty: false,
    leftTabPermissions: captureLeftTabPermissions((key) => getLeftTabPermission({}, key, { isContentCreator: false })),
    ...initial,
  })) } };
}
