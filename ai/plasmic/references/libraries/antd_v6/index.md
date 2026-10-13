# Ant Design v6 reference index

Scope: @shiguang-lab/plasmic-antd6 registrations (plasmic-antd6-*), using native Ant Design 6. The current maintained implementation declares antd 6.6.5. This native dependency version is not a Studio published-library version. Read [library selection](../index.md) first and verify the target's live registration/version; this scope does not define v5 contracts.

Organize documents by the [Ant Design component catalog](https://ant.design/components/overview/): one file per main component. Items, groups, columns and picker variants are sections in their owner; separate Studio registrations do not require separate files. Titles use the public Antd component name, while the registration table preserves the actual Studio names and keys.

Use this library's theme tokens for color, typography, borders and radius. Read size options per component: most registered controls use medium, List uses default and Table defaults to large. Do not import another component/major's size spelling or defaults. Project composition spacing defaults are blocks 16px, inline actions 8px and Drawer footer actions 12px; explicit approved designs take precedence.

| Component | Covered Studio registrations |
| --- | --- |
| [Affix](components/affix.md) | Affix (`plasmic-antd6-affix`) |
| [Alert](components/alert.md) | Alert (`plasmic-antd6-alert`) |
| [Anchor](components/anchor.md) | Anchor (`plasmic-antd6-anchor`) |
| [AppShell](components/app-shell.md) | AppShell (`plasmic-antd6-app-shell`) |
| [AutoComplete](components/auto-complete.md) | Auto Complete (`plasmic-antd6-auto-complete`) |
| [Avatar](components/avatar.md) | Avatar (`plasmic-antd6-avatar`); Avatar.Group (`plasmic-antd6-avatar-group`) |
| [Badge](components/badge.md) | Badge (`plasmic-antd6-badge`); Badge.Ribbon (`plasmic-antd6-badge-ribbon`) |
| [BorderBeam](components/border-beam.md) | Border Beam (`plasmic-antd6-border-beam`) |
| [Breadcrumb](components/breadcrumb.md) | Breadcrumb (`plasmic-antd6-breadcrumb`); Breadcrumb.Item (`plasmic-antd6-breadcrumb-item`) |
| [Button](components/button.md) | Button (`plasmic-antd6-button`) |
| [Calendar](components/calendar.md) | Calendar (`plasmic-antd6-calendar`) |
| [Card](components/card.md) | Card (`plasmic-antd6-card`); Card.Grid (`plasmic-antd6-card-grid`); Card.Meta (`plasmic-antd6-card-meta`) |
| [Carousel](components/carousel.md) | Carousel (`plasmic-antd6-carousel`) |
| [Cascader](components/cascader.md) | Cascader (`plasmic-antd6-cascader`); Cascader.Panel (`plasmic-antd6-cascader-panel`) |
| [Checkbox](components/checkbox.md) | Checkbox (`plasmic-antd6-checkbox`); Checkbox.Group (`plasmic-antd6-checkbox-group`) |
| [Collapse](components/collapse.md) | Collapse (`plasmic-antd6-collapse`); Collapse.Panel (`plasmic-antd6-collapse-item`) |
| [ColorPicker](components/color-picker.md) | Color Picker (`plasmic-antd6-color-picker`) |
| [ConfigProvider](components/config-provider.md) | Ant Design System Settings (`plasmic-antd6-config-provider`) |
| [DatePicker](components/date-picker.md) | DatePicker (`plasmic-antd6-date-picker`); DatePicker.RangePicker (`plasmic-antd6-date-range-picker`) |
| [Descriptions](components/descriptions.md) | Descriptions (`plasmic-antd6-descriptions`); Descriptions.Item (`plasmic-antd6-descriptions-item`) |
| [Divider](components/divider.md) | Divider (`plasmic-antd6-divider`) |
| [Drawer](components/drawer.md) | Drawer (`plasmic-antd6-drawer`) |
| [Dropdown](components/dropdown.md) | Dropdown (`plasmic-antd6-dropdown`) |
| [Empty](components/empty.md) | Empty (`plasmic-antd6-empty`) |
| [Flex](components/flex.md) | Flex (`plasmic-antd6-flex`) |
| [FloatButton](components/float-button.md) | FloatButton.BackTop (`plasmic-antd6-back-top`); Float Button (`plasmic-antd6-float-button`); FloatButton.Group (`plasmic-antd6-float-button-group`) |
| [Form](components/form.md) | Form (`plasmic-antd6-form`); Form Field Group (`plasmic-antd6-form-group`); Form.Item (`plasmic-antd6-form-item`); Form.List (`plasmic-antd6-form-list`) |
| [Grid](components/grid.md) | Col (`plasmic-antd6-col`); Row (`plasmic-antd6-row`) |
| [Image](components/image.md) | Image (`plasmic-antd6-image`); Image.PreviewGroup (`plasmic-antd6-image-preview-group`) |
| [Input](components/input.md) | Input (`plasmic-antd6-input`); Input.OTP (`plasmic-antd6-input-otp`); Input.Password (`plasmic-antd6-input-password`); Input.Search (`plasmic-antd6-input-search`); Input.TextArea (`plasmic-antd6-textarea`) |
| [InputNumber](components/input-number.md) | Number Input (`plasmic-antd6-input-number`) |
| [Layout](components/layout.md) | Layout (`plasmic-antd6-layout`); Layout.Content (`plasmic-antd6-layout-content`); Layout.Footer (`plasmic-antd6-layout-footer`); Layout.Header (`plasmic-antd6-layout-header`); Layout.Sider (`plasmic-antd6-layout-sider`) |
| [List](components/list.md) | List (`plasmic-antd6-list`); List.Item (`plasmic-antd6-list-item`); List.Item.Meta (`plasmic-antd6-list-item-meta`) |
| [Listy](components/listy.md) | Listy (`plasmic-antd6-listy`) |
| [Masonry](components/masonry.md) | Masonry (`plasmic-antd6-masonry`) |
| [Mentions](components/mentions.md) | Mentions (`plasmic-antd6-mentions`) |
| [Menu](components/menu.md) | Menu (`plasmic-antd6-menu`); Menu.Divider (`plasmic-antd6-menu-divider`); Menu.Item (`plasmic-antd6-menu-item`); Menu.ItemGroup (`plasmic-antd6-menu-item-group`); Menu.SubMenu (`plasmic-antd6-submenu`) |
| [Modal](components/modal.md) | Modal (`plasmic-antd6-modal`) |
| [Pagination](components/pagination.md) | Pagination (`plasmic-antd6-pagination`) |
| [Popconfirm](components/popconfirm.md) | Popconfirm (`plasmic-antd6-popconfirm`) |
| [Popover](components/popover.md) | Popover (`plasmic-antd6-popover`) |
| [Progress](components/progress.md) | Progress (`plasmic-antd6-progress`) |
| [QRCode](components/qr-code.md) | Qr Code (`plasmic-antd6-qr-code`) |
| [Radio](components/radio.md) | Radio (`plasmic-antd6-radio`); Radio.Button (`plasmic-antd6-radio-button`); Radio.Group (`plasmic-antd6-radio-group`) |
| [Rate](components/rate.md) | Rate (`plasmic-antd6-rate`) |
| [Result](components/result.md) | Result (`plasmic-antd6-result`) |
| [Segmented](components/segmented.md) | Segmented (`plasmic-antd6-segmented`) |
| [Select](components/select.md) | Select.Option (`plasmic-antd6-option`); Select.OptGroup (`plasmic-antd6-option-group`); Select (`plasmic-antd6-select`) |
| [Skeleton](components/skeleton.md) | Skeleton (`plasmic-antd6-skeleton`); Skeleton.Avatar (`plasmic-antd6-skeleton-avatar`); Skeleton.Button (`plasmic-antd6-skeleton-button`); Skeleton.Image (`plasmic-antd6-skeleton-image`); Skeleton.Input (`plasmic-antd6-skeleton-input`); Skeleton.Node (`plasmic-antd6-skeleton-node`) |
| [Slider](components/slider.md) | Slider (`plasmic-antd6-slider`) |
| [Space](components/space.md) | Space (`plasmic-antd6-space`); Space.Compact (`plasmic-antd6-space-compact`) |
| [Spin](components/spin.md) | Spin (`plasmic-antd6-spin`) |
| [Splitter](components/splitter.md) | Splitter (`plasmic-antd6-splitter`); Splitter.Panel (`plasmic-antd6-splitter-panel`) |
| [Statistic](components/statistic.md) | Statistic (`plasmic-antd6-statistic`); Statistic.Timer (`plasmic-antd6-statistic-timer`) |
| [Steps](components/steps.md) | Steps (`plasmic-antd6-steps`) |
| [Switch](components/switch.md) | Switch (`plasmic-antd6-switch`) |
| [Table](components/table.md) | Table (`plasmic-antd6-table`); Table.Column (`plasmic-antd6-table-column`); Table.ColumnGroup (`plasmic-antd6-table-column-group`) |
| [Tabs](components/tabs.md) | Tabs.TabPane (`plasmic-antd6-tab-item`); Tabs (`plasmic-antd6-tabs`) |
| [Tag](components/tag.md) | Tag (`plasmic-antd6-tag`); Tag.CheckableTag (`plasmic-antd6-tag-checkable`) |
| [TimePicker](components/time-picker.md) | Time Picker (`plasmic-antd6-time-picker`); TimePicker.RangePicker (`plasmic-antd6-time-range-picker`) |
| [Timeline](components/timeline.md) | Timeline (`plasmic-antd6-timeline`) |
| [Tooltip](components/tooltip.md) | Tooltip (`plasmic-antd6-tooltip`) |
| [Tour](components/tour.md) | Tour (`plasmic-antd6-tour`) |
| [Transfer](components/transfer.md) | Transfer (`plasmic-antd6-transfer`) |
| [Tree](components/tree.md) | Tree.DirectoryTree (`plasmic-antd6-directory-tree`); Tree (`plasmic-antd6-tree`) |
| [TreeSelect](components/tree-select.md) | Tree Select (`plasmic-antd6-tree-select`) |
| [Typography](components/typography.md) | Typography (`plasmic-antd6-typography`); Typography.Link (`plasmic-antd6-typography-link`); Typography.Paragraph (`plasmic-antd6-typography-paragraph`); Typography.Text (`plasmic-antd6-typography-text`); Typography.Title (`plasmic-antd6-typography-title`) |
| [Upload](components/upload.md) | Upload (`plasmic-antd6-upload`); Upload.Dragger (`plasmic-antd6-upload-dragger`) |
| [Watermark](components/watermark.md) | Watermark (`plasmic-antd6-watermark`) |

## Compositions and dependent libraries

Read only the actual arrangement: [Form layout](compositions/form-layout.md), [Descriptions + Statistic + Card](compositions/summary-metrics.md), [Modal + Drawer](compositions/modal-drawer.md), [action bars](compositions/action-bars.md) or [detail header](compositions/detail-header.md). Recipes declare cross-library participants. Overseas SearchForm and React UI ActionGroup are separate registrations; use their own indexes rather than treating them as Antd components.

For the affected workflow, read [content states](compositions/content-states.md), [Steps + Form](compositions/step-form.md), [Table bulk actions](compositions/bulk-actions.md) or [master-detail](compositions/master-detail.md). Sizing, spacing ownership, responsive scope and keyboard/focus principles remain in [shared layout](../../design/layout.md) and [accessibility](../../design/accessibility.md); component documents own actual registered layout APIs.

## Structural gates

The resource-root scripts verify_forms.py, verify_descriptions.py and verify_overlays.py recognize this Antd-v6 wrapper's identities/props; use only with this scope and their independently reviewed inventories. verify_slots.py and verify_structure.py additionally check task-supplied ownership/structure; their specific Card rules target this scope. Run them as described in the selected reference, then separately check real Preview behavior. An absent reference for another library is not a passed gate.
