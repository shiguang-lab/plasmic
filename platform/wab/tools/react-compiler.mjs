/** Compiler is always enabled; the audited scope expands with explicit store migrations. */
export const reactCompilerFiles = [
  "src/wab/client/components/coding/CodeDisplayContent.tsx",
  "src/wab/client/components/top-bar/DesktopDraftDialog.tsx",
  "src/wab/client/components/canvas/Multiplayer/FollowingPlayer.tsx",
  "src/wab/client/components/dashboard/SettingsPage.tsx",
  "src/wab/client/components/comments/CommentsDialogs.tsx",
  "src/wab/client/components/comments/RootComment.tsx",
  "src/wab/client/components/sidebar-tabs/ModelNameHeader.tsx",
  "src/wab/client/components/sidebar-tabs/PageMetaPanel.tsx",
  "src/wab/client/components/sidebar-tabs/PageParamsPanel.tsx",
  "src/wab/client/components/live/Preview.tsx",
];
export const reactCompilerInclude =
  /[\\/]src[\\/]wab[\\/]client[\\/]components[\\/](?:coding[\\/]CodeDisplayContent|top-bar[\\/]DesktopDraftDialog|canvas[\\/]Multiplayer[\\/]FollowingPlayer|dashboard[\\/]SettingsPage|comments[\\/](?:CommentsDialogs|RootComment)|sidebar-tabs[\\/](?:ModelNameHeader|PageMetaPanel|PageParamsPanel)|live[\\/]Preview)\.tsx$/;

/** @param {import('babel-plugin-react-compiler').Logger | null} [logger] */
export function reactCompilerOptions(logger = null) {
  return {
    compilationMode: /** @type {const} */ ("annotation"),
    target: /** @type {const} */ ("19"),
    panicThreshold: /** @type {const} */ ("all_errors"),
    sources: (/** @type {string} */ filename) =>
      reactCompilerInclude.test(filename),
    logger,
  };
}

export function reactCompilerBuildInfo() {
  return {
    enabled: true,
    target: "19",
    compilationMode: "annotation",
    files: reactCompilerFiles,
  };
}
