# Registered library icons

Read when adding/changing icons in an editable prototype. Install Ant Design Icons through Component Store → Icons and confirm its imported library and specific icon registration in `read`. The top-level Icons entry is for project SVG assets; do not change it or inject the library into every host/project.

Use independently registered `@ant-design/icons` components, such as `plasmic-antd-icon-PlusOutlined`, through Button's real icon Slot and iconPlacement. A trigger with two icons uses the leading action icon in icon and a separate dropdown indicator beside the text. Inherit color through currentColor; do not use a generic Icon/name wrapper, copied SVG paths, new project SVG assets or Unicode characters to imitate available library icons.

Verify actual nodes, placement, inherited color and dropdown behavior in the delivered page, then save/reopen and reread.
