# Ant Design Icons reference index

Library: antd-icons, registered by @shiguang-lab/plasmic-antd-icons. Registrations match `plasmic-antd-icon-*`; the suffix, display name and importName are the actual catalog icon name. Match the imported library and native API through [library selection](../index.md).

## Dependencies

The maintained implementation uses @ant-design/icons 6.3.4. Verify the imported library's implementation and dependency version against this reference baseline. The dependency version does not form part of the registered library name.

## Icon usage and acceptance

Read when adding/changing icons in an editable prototype. Install Ant Design Icons through Component Store → Icons and confirm its imported library and specific icon registration in `read`. The top-level Icons entry is for project SVG assets; do not change it or inject the library into every host/project.

Use independently registered `@ant-design/icons` components, such as `plasmic-antd-icon-PlusOutlined`, through Button's real icon Slot and iconPlacement. A trigger with two icons uses the leading action icon in icon and a separate dropdown indicator beside the text. Inherit color through currentColor; do not use a generic Icon/name wrapper, copied SVG paths, new project SVG assets or Unicode characters to imitate available library icons.

Verify actual nodes, placement, inherited color and dropdown behavior in the delivered page, then save/reopen and reread.

## Variants and controls

Choose Outlined, Filled or Two Tone from the actual registered catalog and the design's consistent icon style. Each icon exposes spin and rotate; only Two Tone registrations expose twoToneColor. Inspect the chosen registration rather than assuming these are name-wrapper props. Keep native font-size/currentColor inheritance unless the actual control or design owns an explicit size/color. Rotation or spinning must express the intended direction/activity, not add arbitrary decoration.

The library uses one family reference rather than a file per icon. Verify the actual catalog name, importName and consuming control's Slot, plus readable meaning or the control's accessible name. Check normal/disabled/semantic colors and any active animation in the delivered theme; a decorative icon does not announce an operation outcome by itself.
