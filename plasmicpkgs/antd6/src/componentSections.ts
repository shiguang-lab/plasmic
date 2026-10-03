// Categories follow https://ant.design/components/overview/.
const sections: Record<string, string[]> = {
  General: ["button", "float-button", "typography", "back-top"],
  Layout: ["divider", "flex", "row", "col", "layout", "masonry", "space", "splitter"],
  Navigation: ["anchor", "breadcrumb", "dropdown", "menu", "pagination", "steps", "tabs", "tab-item", "submenu"],
  "Data Entry": ["auto-complete", "cascader", "checkbox", "color-picker", "date-picker", "date-range-picker", "form", "input", "textarea", "mentions", "radio", "rate", "select", "option", "slider", "switch", "time-picker", "time-range-picker", "transfer", "tree-select", "upload"],
  "Data Display": ["avatar", "badge", "calendar", "card", "carousel", "collapse", "descriptions", "empty", "image", "list", "listy", "popover", "qr-code", "segmented", "statistic", "table", "tag", "timeline", "tooltip", "tour", "tree", "directory-tree"],
  Feedback: ["alert", "drawer", "modal", "popconfirm", "progress", "result", "skeleton", "spin", "watermark"],
  Other: ["affix", "border-beam"],
};

export function getComponentSection(name: string): string | undefined {
  const suffix = name.replace(/^plasmic-antd6-/, "");
  return Object.entries(sections).find(([, families]) =>
    families.some((family) => suffix === family || suffix.startsWith(`${family}-`))
  )?.[0];
}

// Only actual Antd static subcomponents use dotted names. Editor-only helpers
// (for example Form Field Group) retain their own names.
export const componentChildren: Record<string, { displayName: string; parent: string }> = {
  "avatar-group": { displayName: "Avatar.Group", parent: "avatar" },
  "badge-ribbon": { displayName: "Badge.Ribbon", parent: "badge" },
  "breadcrumb-item": { displayName: "Breadcrumb.Item", parent: "breadcrumb" },
  "card-grid": { displayName: "Card.Grid", parent: "card" },
  "card-meta": { displayName: "Card.Meta", parent: "card" },
  "cascader-panel": { displayName: "Cascader.Panel", parent: "cascader" },
  "float-button-group": { displayName: "FloatButton.Group", parent: "float-button" },
  "back-top": { displayName: "FloatButton.BackTop", parent: "float-button" },
  "image-preview-group": { displayName: "Image.PreviewGroup", parent: "image" },
  "list-item": { displayName: "List.Item", parent: "list" },
  "list-item-meta": { displayName: "List.Item.Meta", parent: "list-item" },
  "space-compact": { displayName: "Space.Compact", parent: "space" },
  "splitter-panel": { displayName: "Splitter.Panel", parent: "splitter" },
  "statistic-timer": { displayName: "Statistic.Timer", parent: "statistic" },
  "tag-checkable": { displayName: "Tag.CheckableTag", parent: "tag" },
  "input-otp": { displayName: "Input.OTP", parent: "input" },
  "input-search": { displayName: "Input.Search", parent: "input" },
  "input-password": { displayName: "Input.Password", parent: "input" },
  "textarea": { displayName: "Input.TextArea", parent: "input" },
  "upload-dragger": { displayName: "Upload.Dragger", parent: "upload" },
  "time-range-picker": { displayName: "TimePicker.RangePicker", parent: "time-picker" },
  "date-range-picker": { displayName: "DatePicker.RangePicker", parent: "date-picker" },
  "directory-tree": { displayName: "Tree.DirectoryTree", parent: "tree" },
  "option": { displayName: "Select.Option", parent: "select" },
  "option-group": { displayName: "Select.OptGroup", parent: "select" },
  "table-column": { displayName: "Table.Column", parent: "table" },
  "table-column-group": { displayName: "Table.ColumnGroup", parent: "table" },
  "checkbox-group": { displayName: "Checkbox.Group", parent: "checkbox" },
  "radio-button": { displayName: "Radio.Button", parent: "radio" },
  "radio-group": { displayName: "Radio.Group", parent: "radio" },
  "menu-item": { displayName: "Menu.Item", parent: "menu" },
  "menu-item-group": { displayName: "Menu.ItemGroup", parent: "menu" },
  "menu-divider": { displayName: "Menu.Divider", parent: "menu" },
  "submenu": { displayName: "Menu.SubMenu", parent: "menu" },
  "form-item": { displayName: "Form.Item", parent: "form" },
  "form-list": { displayName: "Form.List", parent: "form" },
  "collapse-item": { displayName: "Collapse.Panel", parent: "collapse" },
  "tab-item": { displayName: "Tabs.TabPane", parent: "tabs" },
  "layout-header": { displayName: "Layout.Header", parent: "layout" },
  "layout-footer": { displayName: "Layout.Footer", parent: "layout" },
  "layout-content": { displayName: "Layout.Content", parent: "layout" },
  "layout-sider": { displayName: "Layout.Sider", parent: "layout" },
  "skeleton-button": { displayName: "Skeleton.Button", parent: "skeleton" },
  "skeleton-input": { displayName: "Skeleton.Input", parent: "skeleton" },
  "skeleton-avatar": { displayName: "Skeleton.Avatar", parent: "skeleton" },
  "skeleton-image": { displayName: "Skeleton.Image", parent: "skeleton" },
  "skeleton-node": { displayName: "Skeleton.Node", parent: "skeleton" },
  "typography-text": { displayName: "Typography.Text", parent: "typography" },
  "typography-title": { displayName: "Typography.Title", parent: "typography" },
  "typography-paragraph": { displayName: "Typography.Paragraph", parent: "typography" },
  "typography-link": { displayName: "Typography.Link", parent: "typography" },
};
