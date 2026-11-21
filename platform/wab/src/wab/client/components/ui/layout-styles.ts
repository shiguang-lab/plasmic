const applicationHeaderLayout = {
  top: 8,
  height: 42,
} as const;

export const editorLeftRailLayout = {
  left: 8,
  top: applicationHeaderLayout.top + applicationHeaderLayout.height + 8,
  bottom: 8,
  width: 36,
  panelGap: 8,
} as const;
