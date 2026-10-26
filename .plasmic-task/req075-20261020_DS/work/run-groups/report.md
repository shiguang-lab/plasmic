# Plasmic automated verification

Automated gates: FAIL / INCOMPLETE

Project: `uSwwgCkC1ujK3EVVPvmHdW`

## Evidence identity

```json
{
  "projectId": "uSwwgCkC1ujK3EVVPvmHdW",
  "desktopVersion": "0.2.15",
  "build": {
    "kind": "release",
    "revision": "e5fd1fcf11163ecf2cbb259fa64d7dfac41de521",
    "dirty": false,
    "builtAt": "2026-10-25T01:22:17.122Z",
    "rendererHash": "62b48ea523424adc4821f4e978b47411acafd8c085b6c4d5370ae21933cbc06a",
    "desktopHash": "6dad1b3d886b27d74cdd86e05e277fe6d92709ffc74edfe9df09dab26142bcfe"
  },
  "collectedAt": "2026-10-25T03:46:25.706364+00:00",
  "before": {
    "projectId": "uSwwgCkC1ujK3EVVPvmHdW",
    "branchId": null,
    "sessionId": "5zXK8lDocMXa",
    "revision": 41,
    "changeCounter": 18
  },
  "after": {
    "projectId": "uSwwgCkC1ujK3EVVPvmHdW",
    "branchId": null,
    "sessionId": "5zXK8lDocMXa",
    "revision": 41,
    "changeCounter": 18
  },
  "files": {
    "overview.json": "c32da1aa060933d1824532153aa768a15d59d3c937dff5120a8ac9018a7a3e23",
    "pages.json": "7ca8800de064e70135c05fbec0102a294c0f7c051ecd58c273812db61ad47262",
    "layouts.json": "515062468cd1980908ba3319b84ea39ab217b96919267c750bd86f72b6d5b5a2"
  },
  "validation": {
    "componentUuids": [
      "eYMR4owU-V6_"
    ],
    "result": {
      "check": "model",
      "notChecked": [
        "visual-layout",
        "interactions",
        "responsive-breakpoints"
      ],
      "valid": true,
      "errors": [],
      "warnings": [],
      "pages": 1,
      "components": 1
    }
  },
  "pagePath": "/groups"
}
```

## Checked inputs

Exact verifier, inventory and intent file hashes are recorded in report.json under checkedInputs.

## evidence: passed

```json
{
  "passed": true,
  "errors": []
}
```

## model: passed

```json
{
  "passed": true,
  "errors": [],
  "result": {
    "check": "model",
    "notChecked": [
      "visual-layout",
      "interactions",
      "responsive-breakpoints"
    ],
    "valid": true,
    "errors": [],
    "warnings": [],
    "pages": 1,
    "components": 1
  }
}
```

## rendering: passed

```json
{
  "passed": true,
  "errors": [],
  "notChecked": [
    "visual hierarchy/fidelity",
    "hidden runtime states",
    "interaction and scroll behavior"
  ]
}
```

## structure: failed

```json
{
  "passed": false,
  "expectedPageCount": 4,
  "actualPageCount": 4,
  "errors": [
    {
      "check": "expectation",
      "message": "Navigation source citation required",
      "rule": "references/requirement-alignment.md#structural-gate"
    },
    {
      "check": "recordPage",
      "path": "/groups/detail",
      "message": "Record Page must declare at least one route param",
      "rule": "references/design/record-context.md#detection"
    },
    {
      "check": "recordPage",
      "path": "/groups/detail",
      "message": "Record Page must declare where the record comes from",
      "rule": "references/design/record-context.md#detection"
    },
    {
      "check": "expectation",
      "message": "Static menuItems array required; verify dynamic menus in preview",
      "rule": "references/requirement-alignment.md#structural-gate"
    },
    {
      "check": "appContext",
      "message": "AppShell.appSource must bind the reviewed shared App context",
      "path": "/groups",
      "rule": "references/design/component-policy.md#app-context-inventory"
    },
    {
      "check": "appContext",
      "message": "AppSource change must update the same shared context, not only shell-local display",
      "path": "/groups",
      "rule": "references/design/component-policy.md#app-context-inventory"
    },
    {
      "check": "appContext",
      "node": "AllGroupTable",
      "message": "Required data/action consumer must use the same shared App context",
      "path": "/groups",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "appContext",
      "node": "MineGroupTable",
      "message": "Required data/action consumer must use the same shared App context",
      "path": "/groups",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "appContext",
      "node": "AllRowActions",
      "message": "Required data/action consumer must use the same shared App context",
      "path": "/groups",
      "rule": "references/libraries/react_ui/components/action-group.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MarketSelect",
      "registration": "plasmic-antd6-select",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "options"
      ],
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "AllGroupTable",
      "registration": "plasmic-antd6-table",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "data",
        "scroll"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "AllGroupTable",
      "registration": "plasmic-antd6-table",
      "message": "Pagination total belongs to the native showTotal binding",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "AllGroupIDColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "AllGroupKeyColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "AllTypeColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "AllScenarioColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "AllStatusColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "AllStatusBadge",
      "registration": "plasmic-antd6-badge",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "status"
      ],
      "rule": "references/libraries/antd_v6/components/badge.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "AllUpdatedColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "AllOwnerColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "AllActionsColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "AllRowActions",
      "registration": "plasmic-react-ui-action-group",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "items"
      ],
      "rule": "references/libraries/react_ui/components/action-group.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MineGroupTable",
      "registration": "plasmic-antd6-table",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "data",
        "scroll"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MineGroupTable",
      "registration": "plasmic-antd6-table",
      "message": "Pagination total belongs to the native showTotal binding",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MineGroupIDColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MineGroupKeyColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MineTypeColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MineScenarioColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MineStatusColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MineStatusBadge",
      "registration": "plasmic-antd6-badge",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "status"
      ],
      "rule": "references/libraries/antd_v6/components/badge.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MineUpdatedColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MineOwnerColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MineActionsColumn",
      "registration": "plasmic-antd6-table-column",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "width"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MineRowActions",
      "registration": "plasmic-react-ui-action-group",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "items"
      ],
      "rule": "references/libraries/react_ui/components/action-group.md"
    },
    {
      "check": "rowAction",
      "path": "/groups",
      "column": "AllActionsColumn",
      "message": "Row actions require native ActionGroup with the declared event inside Column.render",
      "rule": "references/libraries/react_ui/components/action-group.md"
    },
    {
      "check": "rowAction",
      "path": "/groups",
      "column": "MineActionsColumn",
      "message": "Row actions require native ActionGroup with the declared event inside Column.render",
      "rule": "references/libraries/react_ui/components/action-group.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "市场",
      "node": "FilterMarket",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/overseas/components/search-form.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "全部",
      "node": "MarketSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "墨西哥 MX",
      "node": "MarketSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "越南 VN",
      "node": "MarketSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "场景",
      "node": "FilterScenario",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/overseas/components/search-form.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "全部",
      "node": "ScenarioSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "获客",
      "node": "ScenarioSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "风险",
      "node": "ScenarioSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "客经",
      "node": "ScenarioSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "贷后",
      "node": "ScenarioSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "公共",
      "node": "ScenarioSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "类型",
      "node": "FilterType",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/overseas/components/search-form.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "全部",
      "node": "TypeSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "常规",
      "node": "TypeSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "一次性",
      "node": "TypeSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "状态",
      "node": "FilterStatus",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/overseas/components/search-form.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "全部",
      "node": "StatusSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "初始化",
      "node": "StatusSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "圈选中",
      "node": "StatusSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "圈选失败",
      "node": "StatusSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "启用",
      "node": "StatusSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "停用",
      "node": "StatusSelect",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "关键字",
      "node": "FilterKeyword",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/overseas/components/search-form.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "客群名称或 Key",
      "node": "KeywordInput",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/input.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "全部客群",
      "node": "AllTab",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/tabs.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "客群ID",
      "node": "AllGroupIDColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "客群Key",
      "node": "AllGroupKeyColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "名称",
      "node": "AllNameColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "类型",
      "node": "AllTypeColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "场景",
      "node": "AllScenarioColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "状态",
      "node": "AllStatusColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "更新时间",
      "node": "AllUpdatedColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "负责人",
      "node": "AllOwnerColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "操作",
      "node": "AllActionsColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "我负责的",
      "node": "MineTab",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/tabs.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "客群ID",
      "node": "MineGroupIDColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "客群Key",
      "node": "MineGroupKeyColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "名称",
      "node": "MineNameColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "类型",
      "node": "MineTypeColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "场景",
      "node": "MineScenarioColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "状态",
      "node": "MineStatusColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "更新时间",
      "node": "MineUpdatedColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "负责人",
      "node": "MineOwnerColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "操作",
      "node": "MineActionsColumn",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "新建客群",
      "node": "CreateGroupLabel",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "常规客群",
      "node": "CreateMenu",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/dropdown.md"
    },
    {
      "check": "uiCopy",
      "path": "/groups",
      "text": "一次性客群",
      "node": "CreateMenu",
      "message": "Declare copyTriage for every authored literal: perceive-now, perceive-on-demand or not-user-facing; long prose needs a reviewed decision",
      "rule": "references/libraries/antd_v6/components/dropdown.md"
    },
    {
      "check": "binding",
      "path": "/groups",
      "node": "AllGroupTable",
      "property": "data",
      "requiredStateReferences": [
        "allGroups",
        "appliedFilters",
        "currentUser"
      ],
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "check": "binding",
      "path": "/groups",
      "node": "AllRowActions",
      "missingEvent": "onAction",
      "rule": "references/libraries/react_ui/components/action-group.md"
    },
    {
      "check": "binding",
      "path": "/groups",
      "node": "MineRowActions",
      "missingEvent": "onAction",
      "rule": "references/libraries/react_ui/components/action-group.md"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "Sw67JNj_gusx",
      "tag": "span",
      "owner": {
        "nodeName": "AllTab",
        "slot": "label"
      },
      "text": "全部客群",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "wgPjQsQN6zeG",
      "tag": "span",
      "owner": {
        "nodeName": "AllGroupIDColumn",
        "slot": "title"
      },
      "text": "客群ID",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "bNjzDy72dOE1",
      "tag": "span",
      "owner": {
        "nodeName": "AllGroupKeyColumn",
        "slot": "title"
      },
      "text": "客群Key",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "CJnqCVLmIcRl",
      "tag": "span",
      "owner": {
        "nodeName": "AllNameColumn",
        "slot": "title"
      },
      "text": "名称",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "hTYoiz6-7MYW",
      "tag": "span",
      "owner": {
        "nodeName": "AllTypeColumn",
        "slot": "title"
      },
      "text": "类型",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "yQSRBwRZP44T",
      "tag": "span",
      "owner": {
        "nodeName": "AllScenarioColumn",
        "slot": "title"
      },
      "text": "场景",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "FqRCIxLlXU5n",
      "tag": "span",
      "owner": {
        "nodeName": "AllStatusColumn",
        "slot": "title"
      },
      "text": "状态",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "DLrsJSeLa52z",
      "tag": "span",
      "owner": {
        "nodeName": "AllUpdatedColumn",
        "slot": "title"
      },
      "text": "更新时间",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "Ubr7JXAlRU08",
      "tag": "span",
      "owner": {
        "nodeName": "AllOwnerColumn",
        "slot": "title"
      },
      "text": "负责人",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "n_pGwRtqBpWb",
      "tag": "span",
      "owner": {
        "nodeName": "AllActionsColumn",
        "slot": "title"
      },
      "text": "操作",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "kDod-bwNdbCa",
      "tag": "span",
      "owner": {
        "nodeName": "MineTab",
        "slot": "label"
      },
      "text": "我负责的",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "1e-Bsn_-EW7D",
      "tag": "span",
      "owner": {
        "nodeName": "MineGroupIDColumn",
        "slot": "title"
      },
      "text": "客群ID",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "wL_AMCMk_eDl",
      "tag": "span",
      "owner": {
        "nodeName": "MineGroupKeyColumn",
        "slot": "title"
      },
      "text": "客群Key",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "jGnwER1GH3b-",
      "tag": "span",
      "owner": {
        "nodeName": "MineNameColumn",
        "slot": "title"
      },
      "text": "名称",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "dKyFTevcgfQj",
      "tag": "span",
      "owner": {
        "nodeName": "MineTypeColumn",
        "slot": "title"
      },
      "text": "类型",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "9qBwzTClpYKl",
      "tag": "span",
      "owner": {
        "nodeName": "MineScenarioColumn",
        "slot": "title"
      },
      "text": "场景",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "L9gWjbdMFU0t",
      "tag": "span",
      "owner": {
        "nodeName": "MineStatusColumn",
        "slot": "title"
      },
      "text": "状态",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "lzlYid9z_Cse",
      "tag": "span",
      "owner": {
        "nodeName": "MineUpdatedColumn",
        "slot": "title"
      },
      "text": "更新时间",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "KdclgzqUcJCZ",
      "tag": "span",
      "owner": {
        "nodeName": "MineOwnerColumn",
        "slot": "title"
      },
      "text": "负责人",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups",
      "nodeName": null,
      "elementUuid": "iehnWKBQ2jtD",
      "tag": "span",
      "owner": {
        "nodeName": "MineActionsColumn",
        "slot": "title"
      },
      "text": "操作",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "appContext",
      "message": "AppShell.appSource must bind the reviewed shared App context",
      "rule": "references/design/component-policy.md#app-context-inventory"
    },
    {
      "path": "/groups",
      "check": "appContext",
      "message": "AppSource change must update the same shared context, not only shell-local display",
      "rule": "references/design/component-policy.md#app-context-inventory"
    },
    {
      "path": "/groups",
      "check": "appContext",
      "node": "AllGroupTable",
      "message": "Required data/action consumer must use the same shared App context",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "path": "/groups",
      "check": "appContext",
      "node": "MineGroupTable",
      "message": "Required data/action consumer must use the same shared App context",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "path": "/groups",
      "check": "appContext",
      "node": "AllRowActions",
      "message": "Required data/action consumer must use the same shared App context",
      "rule": "references/libraries/react_ui/components/action-group.md"
    },
    {
      "path": "/groups",
      "check": "feedback",
      "node": "AllRowActions",
      "message": "Expected qualified provider action plasmic-antd6-config-provider.showMessage wiring on the reviewed event; page Alert/notice state is not a substitute",
      "rule": "references/libraries/antd_v6/components/config-provider.md#feedback-action-calls"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "Sw67JNj_gusx",
      "tag": "span",
      "owner": {
        "nodeName": "AllTab",
        "slot": "label"
      },
      "text": "全部客群",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "wgPjQsQN6zeG",
      "tag": "span",
      "owner": {
        "nodeName": "AllGroupIDColumn",
        "slot": "title"
      },
      "text": "客群ID",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "bNjzDy72dOE1",
      "tag": "span",
      "owner": {
        "nodeName": "AllGroupKeyColumn",
        "slot": "title"
      },
      "text": "客群Key",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "CJnqCVLmIcRl",
      "tag": "span",
      "owner": {
        "nodeName": "AllNameColumn",
        "slot": "title"
      },
      "text": "名称",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "hTYoiz6-7MYW",
      "tag": "span",
      "owner": {
        "nodeName": "AllTypeColumn",
        "slot": "title"
      },
      "text": "类型",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "yQSRBwRZP44T",
      "tag": "span",
      "owner": {
        "nodeName": "AllScenarioColumn",
        "slot": "title"
      },
      "text": "场景",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "FqRCIxLlXU5n",
      "tag": "span",
      "owner": {
        "nodeName": "AllStatusColumn",
        "slot": "title"
      },
      "text": "状态",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "DLrsJSeLa52z",
      "tag": "span",
      "owner": {
        "nodeName": "AllUpdatedColumn",
        "slot": "title"
      },
      "text": "更新时间",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "Ubr7JXAlRU08",
      "tag": "span",
      "owner": {
        "nodeName": "AllOwnerColumn",
        "slot": "title"
      },
      "text": "负责人",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "n_pGwRtqBpWb",
      "tag": "span",
      "owner": {
        "nodeName": "AllActionsColumn",
        "slot": "title"
      },
      "text": "操作",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "kDod-bwNdbCa",
      "tag": "span",
      "owner": {
        "nodeName": "MineTab",
        "slot": "label"
      },
      "text": "我负责的",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "1e-Bsn_-EW7D",
      "tag": "span",
      "owner": {
        "nodeName": "MineGroupIDColumn",
        "slot": "title"
      },
      "text": "客群ID",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "wL_AMCMk_eDl",
      "tag": "span",
      "owner": {
        "nodeName": "MineGroupKeyColumn",
        "slot": "title"
      },
      "text": "客群Key",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "jGnwER1GH3b-",
      "tag": "span",
      "owner": {
        "nodeName": "MineNameColumn",
        "slot": "title"
      },
      "text": "名称",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "dKyFTevcgfQj",
      "tag": "span",
      "owner": {
        "nodeName": "MineTypeColumn",
        "slot": "title"
      },
      "text": "类型",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "9qBwzTClpYKl",
      "tag": "span",
      "owner": {
        "nodeName": "MineScenarioColumn",
        "slot": "title"
      },
      "text": "场景",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "L9gWjbdMFU0t",
      "tag": "span",
      "owner": {
        "nodeName": "MineStatusColumn",
        "slot": "title"
      },
      "text": "状态",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "lzlYid9z_Cse",
      "tag": "span",
      "owner": {
        "nodeName": "MineUpdatedColumn",
        "slot": "title"
      },
      "text": "更新时间",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "KdclgzqUcJCZ",
      "tag": "span",
      "owner": {
        "nodeName": "MineOwnerColumn",
        "slot": "title"
      },
      "text": "负责人",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "iehnWKBQ2jtD",
      "tag": "span",
      "owner": {
        "nodeName": "MineActionsColumn",
        "slot": "title"
      },
      "text": "操作",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AppShell",
      "at": "/props/menuItems/0/label",
      "text": "客群管理",
      "owner": "AppShell",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AppShell",
      "at": "/props/menuItems/0/children/0/label",
      "text": "客群列表",
      "owner": "AppShell",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AppShell",
      "at": "/props/menuItems/0/children/0/children/0/label",
      "text": "客群详情",
      "owner": "AppShell",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AppShell",
      "at": "/props/menuItems/0/children/0/children/1/label",
      "text": "新建一次性客群",
      "owner": "AppShell",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AppShell",
      "at": "/props/menuItems/0/children/1/label",
      "text": "客群圈选器",
      "owner": "AppShell",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "MarketSelect",
      "at": "/props/defaultValue",
      "text": "ALL",
      "owner": "MarketSelect",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "ScenarioSelect",
      "at": "/props/defaultValue",
      "text": "ALL",
      "owner": "ScenarioSelect",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "TypeSelect",
      "at": "/props/defaultValue",
      "text": "ALL",
      "owner": "TypeSelect",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "StatusSelect",
      "at": "/props/defaultValue",
      "text": "ALL",
      "owner": "StatusSelect",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": null,
      "at": "/text",
      "text": "全部客群客群ID客群Key名称类型场景状态更新时间负责人操作我负责的客群ID客群Key名称类型场景状态更新时间负责人操作",
      "owner": "AllTab",
      "slot": "label",
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AllStatusBadge",
      "at": "/props/text",
      "text": "{{ row.status }}",
      "owner": "AllStatusBadge",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AllRowActions",
      "at": "/props/items",
      "text": "{{ [{\"key\":\"detail\",\"label\":\"详情\"},row.status===`初始化`||row.status===`圈选失败`?{\"key\":\"edit\",\"label\":\"编辑\"}:false,row.status===`初始化`?{\"key\":\"online\",\"label\":\"上线\",\"confirm\":{\"title\":\"上线后开始正式圈选，确认上线？\",\"okText\":\"上线\",\"cancelText\":\"取消\"}}:false,row.status===`圈选失败`?{\"key\":\"reselect\",\"label\":\"重新圈选\"}:false,row.status===`停用`?{\"key\":\"enable\",\"label\":\"启用\",\"confirm\":{\"title\":\"启用将重新圈选，确认启用？\",\"okText\":\"启用\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"disable\",\"label\":\"停用\",\"confirm\":{\"title\":\"停用后该客群不可用于应用，确认停用？\",\"okText\":\"停用\",\"cancelText\":\"取消\"}}:false,{\"key\":\"copy\",\"label\":\"复制\"},row.status===`初始化`?{\"key\":\"delete\",\"label\":\"删除\",\"confirm\":{\"title\":\"删除后不可恢复，确认删除？\",\"okText\":\"删除\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"export\",\"label\":\"导出名单\"}:false] }}",
      "owner": "AllRowActions",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "MineStatusBadge",
      "at": "/props/text",
      "text": "{{ row.status }}",
      "owner": "MineStatusBadge",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "MineRowActions",
      "at": "/props/items",
      "text": "{{ [{\"key\":\"detail\",\"label\":\"详情\"},row.status===`初始化`||row.status===`圈选失败`?{\"key\":\"edit\",\"label\":\"编辑\"}:false,row.status===`初始化`?{\"key\":\"online\",\"label\":\"上线\",\"confirm\":{\"title\":\"上线后开始正式圈选，确认上线？\",\"okText\":\"上线\",\"cancelText\":\"取消\"}}:false,row.status===`圈选失败`?{\"key\":\"reselect\",\"label\":\"重新圈选\"}:false,row.status===`停用`?{\"key\":\"enable\",\"label\":\"启用\",\"confirm\":{\"title\":\"启用将重新圈选，确认启用？\",\"okText\":\"启用\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"disable\",\"label\":\"停用\",\"confirm\":{\"title\":\"停用后该客群不可用于应用，确认停用？\",\"okText\":\"停用\",\"cancelText\":\"取消\"}}:false,{\"key\":\"copy\",\"label\":\"复制\"},row.status===`初始化`?{\"key\":\"delete\",\"label\":\"删除\",\"confirm\":{\"title\":\"删除后不可恢复，确认删除？\",\"okText\":\"删除\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"export\",\"label\":\"导出名单\"}:false] }}",
      "owner": "MineRowActions",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AllTab",
      "at": "/slots/label/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AllGroupIDColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AllGroupKeyColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AllNameColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AllTypeColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AllScenarioColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AllStatusColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AllUpdatedColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AllOwnerColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "AllActionsColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "MineTab",
      "at": "/slots/label/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "MineGroupIDColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "MineGroupKeyColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "MineNameColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "MineTypeColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "MineScenarioColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "MineStatusColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "MineUpdatedColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "MineOwnerColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups",
      "check": "copyCoverage",
      "nodeName": "MineActionsColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    }
  ],
  "notChecked": [
    "source-interpretation",
    "runtime-behavior",
    "visual-quality",
    "dynamic UI-copy meaning and unlabeled visual heading inference"
  ],
  "selection": {
    "passed": false,
    "errors": [
      {
        "path": "/groups",
        "check": "appContext",
        "message": "AppShell.appSource must bind the reviewed shared App context",
        "rule": "references/design/component-policy.md#app-context-inventory"
      },
      {
        "path": "/groups",
        "check": "appContext",
        "message": "AppSource change must update the same shared context, not only shell-local display",
        "rule": "references/design/component-policy.md#app-context-inventory"
      },
      {
        "path": "/groups",
        "check": "appContext",
        "node": "AllGroupTable",
        "message": "Required data/action consumer must use the same shared App context",
        "rule": "references/libraries/antd_v6/components/table.md"
      },
      {
        "path": "/groups",
        "check": "appContext",
        "node": "MineGroupTable",
        "message": "Required data/action consumer must use the same shared App context",
        "rule": "references/libraries/antd_v6/components/table.md"
      },
      {
        "path": "/groups",
        "check": "appContext",
        "node": "AllRowActions",
        "message": "Required data/action consumer must use the same shared App context",
        "rule": "references/libraries/react_ui/components/action-group.md"
      },
      {
        "path": "/groups",
        "check": "feedback",
        "node": "AllRowActions",
        "message": "Expected qualified provider action plasmic-antd6-config-provider.showMessage wiring on the reviewed event; page Alert/notice state is not a substitute",
        "rule": "references/libraries/antd_v6/components/config-provider.md#feedback-action-calls"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "Sw67JNj_gusx",
        "tag": "span",
        "owner": {
          "nodeName": "AllTab",
          "slot": "label"
        },
        "text": "全部客群",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "wgPjQsQN6zeG",
        "tag": "span",
        "owner": {
          "nodeName": "AllGroupIDColumn",
          "slot": "title"
        },
        "text": "客群ID",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "bNjzDy72dOE1",
        "tag": "span",
        "owner": {
          "nodeName": "AllGroupKeyColumn",
          "slot": "title"
        },
        "text": "客群Key",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "CJnqCVLmIcRl",
        "tag": "span",
        "owner": {
          "nodeName": "AllNameColumn",
          "slot": "title"
        },
        "text": "名称",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "hTYoiz6-7MYW",
        "tag": "span",
        "owner": {
          "nodeName": "AllTypeColumn",
          "slot": "title"
        },
        "text": "类型",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "yQSRBwRZP44T",
        "tag": "span",
        "owner": {
          "nodeName": "AllScenarioColumn",
          "slot": "title"
        },
        "text": "场景",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "FqRCIxLlXU5n",
        "tag": "span",
        "owner": {
          "nodeName": "AllStatusColumn",
          "slot": "title"
        },
        "text": "状态",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "DLrsJSeLa52z",
        "tag": "span",
        "owner": {
          "nodeName": "AllUpdatedColumn",
          "slot": "title"
        },
        "text": "更新时间",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "Ubr7JXAlRU08",
        "tag": "span",
        "owner": {
          "nodeName": "AllOwnerColumn",
          "slot": "title"
        },
        "text": "负责人",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "n_pGwRtqBpWb",
        "tag": "span",
        "owner": {
          "nodeName": "AllActionsColumn",
          "slot": "title"
        },
        "text": "操作",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "kDod-bwNdbCa",
        "tag": "span",
        "owner": {
          "nodeName": "MineTab",
          "slot": "label"
        },
        "text": "我负责的",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "1e-Bsn_-EW7D",
        "tag": "span",
        "owner": {
          "nodeName": "MineGroupIDColumn",
          "slot": "title"
        },
        "text": "客群ID",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "wL_AMCMk_eDl",
        "tag": "span",
        "owner": {
          "nodeName": "MineGroupKeyColumn",
          "slot": "title"
        },
        "text": "客群Key",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "jGnwER1GH3b-",
        "tag": "span",
        "owner": {
          "nodeName": "MineNameColumn",
          "slot": "title"
        },
        "text": "名称",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "dKyFTevcgfQj",
        "tag": "span",
        "owner": {
          "nodeName": "MineTypeColumn",
          "slot": "title"
        },
        "text": "类型",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "9qBwzTClpYKl",
        "tag": "span",
        "owner": {
          "nodeName": "MineScenarioColumn",
          "slot": "title"
        },
        "text": "场景",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "L9gWjbdMFU0t",
        "tag": "span",
        "owner": {
          "nodeName": "MineStatusColumn",
          "slot": "title"
        },
        "text": "状态",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "lzlYid9z_Cse",
        "tag": "span",
        "owner": {
          "nodeName": "MineUpdatedColumn",
          "slot": "title"
        },
        "text": "更新时间",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "KdclgzqUcJCZ",
        "tag": "span",
        "owner": {
          "nodeName": "MineOwnerColumn",
          "slot": "title"
        },
        "text": "负责人",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "iehnWKBQ2jtD",
        "tag": "span",
        "owner": {
          "nodeName": "MineActionsColumn",
          "slot": "title"
        },
        "text": "操作",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AppShell",
        "at": "/props/menuItems/0/label",
        "text": "客群管理",
        "owner": "AppShell",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AppShell",
        "at": "/props/menuItems/0/children/0/label",
        "text": "客群列表",
        "owner": "AppShell",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AppShell",
        "at": "/props/menuItems/0/children/0/children/0/label",
        "text": "客群详情",
        "owner": "AppShell",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AppShell",
        "at": "/props/menuItems/0/children/0/children/1/label",
        "text": "新建一次性客群",
        "owner": "AppShell",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AppShell",
        "at": "/props/menuItems/0/children/1/label",
        "text": "客群圈选器",
        "owner": "AppShell",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "MarketSelect",
        "at": "/props/defaultValue",
        "text": "ALL",
        "owner": "MarketSelect",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "ScenarioSelect",
        "at": "/props/defaultValue",
        "text": "ALL",
        "owner": "ScenarioSelect",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "TypeSelect",
        "at": "/props/defaultValue",
        "text": "ALL",
        "owner": "TypeSelect",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "StatusSelect",
        "at": "/props/defaultValue",
        "text": "ALL",
        "owner": "StatusSelect",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": null,
        "at": "/text",
        "text": "全部客群客群ID客群Key名称类型场景状态更新时间负责人操作我负责的客群ID客群Key名称类型场景状态更新时间负责人操作",
        "owner": "AllTab",
        "slot": "label",
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AllStatusBadge",
        "at": "/props/text",
        "text": "{{ row.status }}",
        "owner": "AllStatusBadge",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AllRowActions",
        "at": "/props/items",
        "text": "{{ [{\"key\":\"detail\",\"label\":\"详情\"},row.status===`初始化`||row.status===`圈选失败`?{\"key\":\"edit\",\"label\":\"编辑\"}:false,row.status===`初始化`?{\"key\":\"online\",\"label\":\"上线\",\"confirm\":{\"title\":\"上线后开始正式圈选，确认上线？\",\"okText\":\"上线\",\"cancelText\":\"取消\"}}:false,row.status===`圈选失败`?{\"key\":\"reselect\",\"label\":\"重新圈选\"}:false,row.status===`停用`?{\"key\":\"enable\",\"label\":\"启用\",\"confirm\":{\"title\":\"启用将重新圈选，确认启用？\",\"okText\":\"启用\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"disable\",\"label\":\"停用\",\"confirm\":{\"title\":\"停用后该客群不可用于应用，确认停用？\",\"okText\":\"停用\",\"cancelText\":\"取消\"}}:false,{\"key\":\"copy\",\"label\":\"复制\"},row.status===`初始化`?{\"key\":\"delete\",\"label\":\"删除\",\"confirm\":{\"title\":\"删除后不可恢复，确认删除？\",\"okText\":\"删除\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"export\",\"label\":\"导出名单\"}:false] }}",
        "owner": "AllRowActions",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "MineStatusBadge",
        "at": "/props/text",
        "text": "{{ row.status }}",
        "owner": "MineStatusBadge",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "MineRowActions",
        "at": "/props/items",
        "text": "{{ [{\"key\":\"detail\",\"label\":\"详情\"},row.status===`初始化`||row.status===`圈选失败`?{\"key\":\"edit\",\"label\":\"编辑\"}:false,row.status===`初始化`?{\"key\":\"online\",\"label\":\"上线\",\"confirm\":{\"title\":\"上线后开始正式圈选，确认上线？\",\"okText\":\"上线\",\"cancelText\":\"取消\"}}:false,row.status===`圈选失败`?{\"key\":\"reselect\",\"label\":\"重新圈选\"}:false,row.status===`停用`?{\"key\":\"enable\",\"label\":\"启用\",\"confirm\":{\"title\":\"启用将重新圈选，确认启用？\",\"okText\":\"启用\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"disable\",\"label\":\"停用\",\"confirm\":{\"title\":\"停用后该客群不可用于应用，确认停用？\",\"okText\":\"停用\",\"cancelText\":\"取消\"}}:false,{\"key\":\"copy\",\"label\":\"复制\"},row.status===`初始化`?{\"key\":\"delete\",\"label\":\"删除\",\"confirm\":{\"title\":\"删除后不可恢复，确认删除？\",\"okText\":\"删除\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"export\",\"label\":\"导出名单\"}:false] }}",
        "owner": "MineRowActions",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AllTab",
        "at": "/slots/label/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AllGroupIDColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AllGroupKeyColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AllNameColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AllTypeColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AllScenarioColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AllStatusColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AllUpdatedColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AllOwnerColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "AllActionsColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "MineTab",
        "at": "/slots/label/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "MineGroupIDColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "MineGroupKeyColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "MineNameColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "MineTypeColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "MineScenarioColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "MineStatusColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "MineUpdatedColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "MineOwnerColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups",
        "check": "copyCoverage",
        "nodeName": "MineActionsColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      }
    ],
    "templates": [
      {
        "path": "/groups",
        "passed": true,
        "errors": [],
        "sources": [
          {
            "sourceProjectId": "145nN6S5QQBwgjtNUwuiQZ",
            "sourceVersion": null,
            "models": [
              {
                "name": "TabsTableSection",
                "uuid": "Lrdw4Jts1Zzd"
              }
            ],
            "sourceRead": "passed",
            "plannedMode": "reference",
            "actualReuse": "unverified"
          }
        ],
        "notChecked": [
          "source interpretation",
          "actual template insertion/detachment",
          "adaptation quality"
        ]
      }
    ],
    "content": [
      {
        "path": "/groups",
        "passed": false,
        "errors": [
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "Sw67JNj_gusx",
            "tag": "span",
            "owner": {
              "nodeName": "AllTab",
              "slot": "label"
            },
            "text": "全部客群",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "wgPjQsQN6zeG",
            "tag": "span",
            "owner": {
              "nodeName": "AllGroupIDColumn",
              "slot": "title"
            },
            "text": "客群ID",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "bNjzDy72dOE1",
            "tag": "span",
            "owner": {
              "nodeName": "AllGroupKeyColumn",
              "slot": "title"
            },
            "text": "客群Key",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "CJnqCVLmIcRl",
            "tag": "span",
            "owner": {
              "nodeName": "AllNameColumn",
              "slot": "title"
            },
            "text": "名称",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "hTYoiz6-7MYW",
            "tag": "span",
            "owner": {
              "nodeName": "AllTypeColumn",
              "slot": "title"
            },
            "text": "类型",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "yQSRBwRZP44T",
            "tag": "span",
            "owner": {
              "nodeName": "AllScenarioColumn",
              "slot": "title"
            },
            "text": "场景",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "FqRCIxLlXU5n",
            "tag": "span",
            "owner": {
              "nodeName": "AllStatusColumn",
              "slot": "title"
            },
            "text": "状态",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "DLrsJSeLa52z",
            "tag": "span",
            "owner": {
              "nodeName": "AllUpdatedColumn",
              "slot": "title"
            },
            "text": "更新时间",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "Ubr7JXAlRU08",
            "tag": "span",
            "owner": {
              "nodeName": "AllOwnerColumn",
              "slot": "title"
            },
            "text": "负责人",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "n_pGwRtqBpWb",
            "tag": "span",
            "owner": {
              "nodeName": "AllActionsColumn",
              "slot": "title"
            },
            "text": "操作",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "kDod-bwNdbCa",
            "tag": "span",
            "owner": {
              "nodeName": "MineTab",
              "slot": "label"
            },
            "text": "我负责的",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "1e-Bsn_-EW7D",
            "tag": "span",
            "owner": {
              "nodeName": "MineGroupIDColumn",
              "slot": "title"
            },
            "text": "客群ID",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "wL_AMCMk_eDl",
            "tag": "span",
            "owner": {
              "nodeName": "MineGroupKeyColumn",
              "slot": "title"
            },
            "text": "客群Key",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "jGnwER1GH3b-",
            "tag": "span",
            "owner": {
              "nodeName": "MineNameColumn",
              "slot": "title"
            },
            "text": "名称",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "dKyFTevcgfQj",
            "tag": "span",
            "owner": {
              "nodeName": "MineTypeColumn",
              "slot": "title"
            },
            "text": "类型",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "9qBwzTClpYKl",
            "tag": "span",
            "owner": {
              "nodeName": "MineScenarioColumn",
              "slot": "title"
            },
            "text": "场景",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "L9gWjbdMFU0t",
            "tag": "span",
            "owner": {
              "nodeName": "MineStatusColumn",
              "slot": "title"
            },
            "text": "状态",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "lzlYid9z_Cse",
            "tag": "span",
            "owner": {
              "nodeName": "MineUpdatedColumn",
              "slot": "title"
            },
            "text": "更新时间",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "KdclgzqUcJCZ",
            "tag": "span",
            "owner": {
              "nodeName": "MineOwnerColumn",
              "slot": "title"
            },
            "text": "负责人",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "iehnWKBQ2jtD",
            "tag": "span",
            "owner": {
              "nodeName": "MineActionsColumn",
              "slot": "title"
            },
            "text": "操作",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AppShell",
            "at": "/props/menuItems/0/label",
            "text": "客群管理",
            "owner": "AppShell",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AppShell",
            "at": "/props/menuItems/0/children/0/label",
            "text": "客群列表",
            "owner": "AppShell",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AppShell",
            "at": "/props/menuItems/0/children/0/children/0/label",
            "text": "客群详情",
            "owner": "AppShell",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AppShell",
            "at": "/props/menuItems/0/children/0/children/1/label",
            "text": "新建一次性客群",
            "owner": "AppShell",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AppShell",
            "at": "/props/menuItems/0/children/1/label",
            "text": "客群圈选器",
            "owner": "AppShell",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "MarketSelect",
            "at": "/props/defaultValue",
            "text": "ALL",
            "owner": "MarketSelect",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "ScenarioSelect",
            "at": "/props/defaultValue",
            "text": "ALL",
            "owner": "ScenarioSelect",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "TypeSelect",
            "at": "/props/defaultValue",
            "text": "ALL",
            "owner": "TypeSelect",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "StatusSelect",
            "at": "/props/defaultValue",
            "text": "ALL",
            "owner": "StatusSelect",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": null,
            "at": "/text",
            "text": "全部客群客群ID客群Key名称类型场景状态更新时间负责人操作我负责的客群ID客群Key名称类型场景状态更新时间负责人操作",
            "owner": "AllTab",
            "slot": "label",
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AllStatusBadge",
            "at": "/props/text",
            "text": "{{ row.status }}",
            "owner": "AllStatusBadge",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AllRowActions",
            "at": "/props/items",
            "text": "{{ [{\"key\":\"detail\",\"label\":\"详情\"},row.status===`初始化`||row.status===`圈选失败`?{\"key\":\"edit\",\"label\":\"编辑\"}:false,row.status===`初始化`?{\"key\":\"online\",\"label\":\"上线\",\"confirm\":{\"title\":\"上线后开始正式圈选，确认上线？\",\"okText\":\"上线\",\"cancelText\":\"取消\"}}:false,row.status===`圈选失败`?{\"key\":\"reselect\",\"label\":\"重新圈选\"}:false,row.status===`停用`?{\"key\":\"enable\",\"label\":\"启用\",\"confirm\":{\"title\":\"启用将重新圈选，确认启用？\",\"okText\":\"启用\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"disable\",\"label\":\"停用\",\"confirm\":{\"title\":\"停用后该客群不可用于应用，确认停用？\",\"okText\":\"停用\",\"cancelText\":\"取消\"}}:false,{\"key\":\"copy\",\"label\":\"复制\"},row.status===`初始化`?{\"key\":\"delete\",\"label\":\"删除\",\"confirm\":{\"title\":\"删除后不可恢复，确认删除？\",\"okText\":\"删除\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"export\",\"label\":\"导出名单\"}:false] }}",
            "owner": "AllRowActions",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "MineStatusBadge",
            "at": "/props/text",
            "text": "{{ row.status }}",
            "owner": "MineStatusBadge",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "MineRowActions",
            "at": "/props/items",
            "text": "{{ [{\"key\":\"detail\",\"label\":\"详情\"},row.status===`初始化`||row.status===`圈选失败`?{\"key\":\"edit\",\"label\":\"编辑\"}:false,row.status===`初始化`?{\"key\":\"online\",\"label\":\"上线\",\"confirm\":{\"title\":\"上线后开始正式圈选，确认上线？\",\"okText\":\"上线\",\"cancelText\":\"取消\"}}:false,row.status===`圈选失败`?{\"key\":\"reselect\",\"label\":\"重新圈选\"}:false,row.status===`停用`?{\"key\":\"enable\",\"label\":\"启用\",\"confirm\":{\"title\":\"启用将重新圈选，确认启用？\",\"okText\":\"启用\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"disable\",\"label\":\"停用\",\"confirm\":{\"title\":\"停用后该客群不可用于应用，确认停用？\",\"okText\":\"停用\",\"cancelText\":\"取消\"}}:false,{\"key\":\"copy\",\"label\":\"复制\"},row.status===`初始化`?{\"key\":\"delete\",\"label\":\"删除\",\"confirm\":{\"title\":\"删除后不可恢复，确认删除？\",\"okText\":\"删除\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"export\",\"label\":\"导出名单\"}:false] }}",
            "owner": "MineRowActions",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AllTab",
            "at": "/slots/label/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AllGroupIDColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AllGroupKeyColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AllNameColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AllTypeColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AllScenarioColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AllStatusColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AllUpdatedColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AllOwnerColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "AllActionsColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "MineTab",
            "at": "/slots/label/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "MineGroupIDColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "MineGroupKeyColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "MineNameColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "MineTypeColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "MineScenarioColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "MineStatusColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "MineUpdatedColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "MineOwnerColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "MineActionsColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          }
        ],
        "inventory": {
          "nodes": [
            {
              "nodeName": "GroupListPage",
              "elementUuid": "K0WPsp3gmB0B",
              "tag": "div",
              "owner": null,
              "text": ""
            },
            {
              "nodeName": "AppShell",
              "elementUuid": "mlTMiDc9uak5",
              "tag": "plasmic-component",
              "owner": null,
              "text": "",
              "component": "plasmicoverseasappshell"
            },
            {
              "nodeName": "ListBody",
              "elementUuid": "_Gi592N22bGs",
              "tag": "div",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "GroupFilters",
              "elementUuid": "G1SOYUJwDuPf",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicoverseassearchform"
            },
            {
              "nodeName": "FilterMarket",
              "elementUuid": "ilU24uwGR22M",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "GroupFilters",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicoverseassearchformitem"
            },
            {
              "nodeName": "MarketSelect",
              "elementUuid": "qwvatQSzJwgZ",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "FilterMarket",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6select"
            },
            {
              "nodeName": "FilterScenario",
              "elementUuid": "4ZJH1FOmhKVf",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "GroupFilters",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicoverseassearchformitem"
            },
            {
              "nodeName": "ScenarioSelect",
              "elementUuid": "2apn3HqfAADC",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "FilterScenario",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6select"
            },
            {
              "nodeName": "FilterType",
              "elementUuid": "y9Utm48SHd5Z",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "GroupFilters",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicoverseassearchformitem"
            },
            {
              "nodeName": "TypeSelect",
              "elementUuid": "ciO5wdJaBhx5",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "FilterType",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6select"
            },
            {
              "nodeName": "FilterStatus",
              "elementUuid": "dN3vc0FUTrJB",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "GroupFilters",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicoverseassearchformitem"
            },
            {
              "nodeName": "StatusSelect",
              "elementUuid": "SbACxWLDqjIL",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "FilterStatus",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6select"
            },
            {
              "nodeName": "FilterKeyword",
              "elementUuid": "yb6lJ99PdJFj",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "GroupFilters",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicoverseassearchformitem"
            },
            {
              "nodeName": "KeywordInput",
              "elementUuid": "4JjXTVCp8c_e",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "FilterKeyword",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6input"
            },
            {
              "nodeName": "GroupListCard",
              "elementUuid": "SYhB3Zpd4yZx",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6card"
            },
            {
              "nodeName": "ScopeTabs",
              "elementUuid": "yRgYMniBVtV6",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "GroupListCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tabs"
            },
            {
              "nodeName": "AllTab",
              "elementUuid": "wAnvWUf3hB3V",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ScopeTabs",
                "slot": "items"
              },
              "text": "",
              "component": "plasmicantd6tabitem"
            },
            {
              "nodeName": null,
              "elementUuid": "Sw67JNj_gusx",
              "tag": "span",
              "owner": {
                "nodeName": "AllTab",
                "slot": "label"
              },
              "text": "全部客群"
            },
            {
              "nodeName": "AllGroupTable",
              "elementUuid": "p1nHo6PSaRU8",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AllTab",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6table"
            },
            {
              "nodeName": "AllGroupIDColumn",
              "elementUuid": "oCtBPibGlLbi",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AllGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "wgPjQsQN6zeG",
              "tag": "span",
              "owner": {
                "nodeName": "AllGroupIDColumn",
                "slot": "title"
              },
              "text": "客群ID"
            },
            {
              "nodeName": "AllGroupKeyColumn",
              "elementUuid": "9S-mjddNX_sT",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AllGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "bNjzDy72dOE1",
              "tag": "span",
              "owner": {
                "nodeName": "AllGroupKeyColumn",
                "slot": "title"
              },
              "text": "客群Key"
            },
            {
              "nodeName": "AllNameColumn",
              "elementUuid": "zGkbWAL7r9lF",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AllGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "CJnqCVLmIcRl",
              "tag": "span",
              "owner": {
                "nodeName": "AllNameColumn",
                "slot": "title"
              },
              "text": "名称"
            },
            {
              "nodeName": "AllTypeColumn",
              "elementUuid": "v8kXG2O02EFP",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AllGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "hTYoiz6-7MYW",
              "tag": "span",
              "owner": {
                "nodeName": "AllTypeColumn",
                "slot": "title"
              },
              "text": "类型"
            },
            {
              "nodeName": "AllScenarioColumn",
              "elementUuid": "GiSRsQ_SE5Ys",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AllGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "yQSRBwRZP44T",
              "tag": "span",
              "owner": {
                "nodeName": "AllScenarioColumn",
                "slot": "title"
              },
              "text": "场景"
            },
            {
              "nodeName": "AllStatusColumn",
              "elementUuid": "RtZApHvpoYe0",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AllGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "FqRCIxLlXU5n",
              "tag": "span",
              "owner": {
                "nodeName": "AllStatusColumn",
                "slot": "title"
              },
              "text": "状态"
            },
            {
              "nodeName": "AllStatusBadge",
              "elementUuid": "a_szVrWWABn1",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AllStatusColumn",
                "slot": "render"
              },
              "text": "",
              "component": "plasmicantd6badge"
            },
            {
              "nodeName": "AllUpdatedColumn",
              "elementUuid": "RwdjFyzm57i4",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AllGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "DLrsJSeLa52z",
              "tag": "span",
              "owner": {
                "nodeName": "AllUpdatedColumn",
                "slot": "title"
              },
              "text": "更新时间"
            },
            {
              "nodeName": "AllOwnerColumn",
              "elementUuid": "Y0cNMWsPwLk_",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AllGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "Ubr7JXAlRU08",
              "tag": "span",
              "owner": {
                "nodeName": "AllOwnerColumn",
                "slot": "title"
              },
              "text": "负责人"
            },
            {
              "nodeName": "AllActionsColumn",
              "elementUuid": "7lnw8JBEOwKJ",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AllGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "n_pGwRtqBpWb",
              "tag": "span",
              "owner": {
                "nodeName": "AllActionsColumn",
                "slot": "title"
              },
              "text": "操作"
            },
            {
              "nodeName": "AllRowActions",
              "elementUuid": "-AhuLMR5s72B",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AllActionsColumn",
                "slot": "render"
              },
              "text": "",
              "component": "plasmicreactuiactiongroup"
            },
            {
              "nodeName": "MineTab",
              "elementUuid": "RdcqkKntdg8V",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ScopeTabs",
                "slot": "items"
              },
              "text": "",
              "component": "plasmicantd6tabitem"
            },
            {
              "nodeName": null,
              "elementUuid": "kDod-bwNdbCa",
              "tag": "span",
              "owner": {
                "nodeName": "MineTab",
                "slot": "label"
              },
              "text": "我负责的"
            },
            {
              "nodeName": "MineGroupTable",
              "elementUuid": "qohJ6UBL6YYu",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MineTab",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6table"
            },
            {
              "nodeName": "MineGroupIDColumn",
              "elementUuid": "z4RMdoQBLl7l",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MineGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "1e-Bsn_-EW7D",
              "tag": "span",
              "owner": {
                "nodeName": "MineGroupIDColumn",
                "slot": "title"
              },
              "text": "客群ID"
            },
            {
              "nodeName": "MineGroupKeyColumn",
              "elementUuid": "I8RFfNjKF3Xs",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MineGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "wL_AMCMk_eDl",
              "tag": "span",
              "owner": {
                "nodeName": "MineGroupKeyColumn",
                "slot": "title"
              },
              "text": "客群Key"
            },
            {
              "nodeName": "MineNameColumn",
              "elementUuid": "RZJ8GuTtpfnn",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MineGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "jGnwER1GH3b-",
              "tag": "span",
              "owner": {
                "nodeName": "MineNameColumn",
                "slot": "title"
              },
              "text": "名称"
            },
            {
              "nodeName": "MineTypeColumn",
              "elementUuid": "xUgybCbfO1s4",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MineGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "dKyFTevcgfQj",
              "tag": "span",
              "owner": {
                "nodeName": "MineTypeColumn",
                "slot": "title"
              },
              "text": "类型"
            },
            {
              "nodeName": "MineScenarioColumn",
              "elementUuid": "UGx7m7ddZs5r",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MineGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "9qBwzTClpYKl",
              "tag": "span",
              "owner": {
                "nodeName": "MineScenarioColumn",
                "slot": "title"
              },
              "text": "场景"
            },
            {
              "nodeName": "MineStatusColumn",
              "elementUuid": "XOzTISre559A",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MineGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "L9gWjbdMFU0t",
              "tag": "span",
              "owner": {
                "nodeName": "MineStatusColumn",
                "slot": "title"
              },
              "text": "状态"
            },
            {
              "nodeName": "MineStatusBadge",
              "elementUuid": "OoQdZvkZ2Opg",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MineStatusColumn",
                "slot": "render"
              },
              "text": "",
              "component": "plasmicantd6badge"
            },
            {
              "nodeName": "MineUpdatedColumn",
              "elementUuid": "t8Tjwhz0F-M_",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MineGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "lzlYid9z_Cse",
              "tag": "span",
              "owner": {
                "nodeName": "MineUpdatedColumn",
                "slot": "title"
              },
              "text": "更新时间"
            },
            {
              "nodeName": "MineOwnerColumn",
              "elementUuid": "ND1-CEghXhIw",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MineGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "KdclgzqUcJCZ",
              "tag": "span",
              "owner": {
                "nodeName": "MineOwnerColumn",
                "slot": "title"
              },
              "text": "负责人"
            },
            {
              "nodeName": "MineActionsColumn",
              "elementUuid": "Z0UPObdcgc9E",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MineGroupTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "iehnWKBQ2jtD",
              "tag": "span",
              "owner": {
                "nodeName": "MineActionsColumn",
                "slot": "title"
              },
              "text": "操作"
            },
            {
              "nodeName": "MineRowActions",
              "elementUuid": "e3VyPgUutO58",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MineActionsColumn",
                "slot": "render"
              },
              "text": "",
              "component": "plasmicreactuiactiongroup"
            },
            {
              "nodeName": "CreateMenu",
              "elementUuid": "MlcvBWT43KOy",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ScopeTabs",
                "slot": "tabBarExtraContentRight"
              },
              "text": "",
              "component": "plasmicantd6dropdown"
            },
            {
              "nodeName": "CreateGroupButton",
              "elementUuid": "bUSyY5juQHsq",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CreateMenu",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": "CreateMenuIcon",
              "elementUuid": "O-ZhOJtayDdi",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CreateGroupButton",
                "slot": "icon"
              },
              "text": "",
              "component": "plasmicantdiconplusoutlined"
            },
            {
              "nodeName": "CreateGroupContent",
              "elementUuid": "Z0MYnyIQ1CHA",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CreateGroupButton",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6space"
            },
            {
              "nodeName": "CreateGroupLabel",
              "elementUuid": "m_KB6BP4FiQY",
              "tag": "span",
              "owner": {
                "nodeName": "CreateGroupContent",
                "slot": "children"
              },
              "text": "新建客群"
            },
            {
              "nodeName": "CreateMenuIndicator",
              "elementUuid": "iZwsI6N8_T2A",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CreateGroupContent",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantdicondownoutlined"
            }
          ],
          "copy": [
            {
              "nodeName": "AppShell",
              "at": "/props/menuItems/0/label",
              "text": "客群管理",
              "owner": "AppShell",
              "slot": null
            },
            {
              "nodeName": "AppShell",
              "at": "/props/menuItems/0/children/0/label",
              "text": "客群列表",
              "owner": "AppShell",
              "slot": null
            },
            {
              "nodeName": "AppShell",
              "at": "/props/menuItems/0/children/0/children/0/label",
              "text": "客群详情",
              "owner": "AppShell",
              "slot": null
            },
            {
              "nodeName": "AppShell",
              "at": "/props/menuItems/0/children/0/children/1/label",
              "text": "新建一次性客群",
              "owner": "AppShell",
              "slot": null
            },
            {
              "nodeName": "AppShell",
              "at": "/props/menuItems/0/children/1/label",
              "text": "客群圈选器",
              "owner": "AppShell",
              "slot": null
            },
            {
              "nodeName": "FilterMarket",
              "at": "/props/label",
              "text": "市场",
              "owner": "FilterMarket",
              "slot": null
            },
            {
              "nodeName": "MarketSelect",
              "at": "/props/options/0/label",
              "text": "全部",
              "owner": "MarketSelect",
              "slot": null
            },
            {
              "nodeName": "MarketSelect",
              "at": "/props/options/1/label",
              "text": "墨西哥 MX",
              "owner": "MarketSelect",
              "slot": null
            },
            {
              "nodeName": "MarketSelect",
              "at": "/props/options/2/label",
              "text": "越南 VN",
              "owner": "MarketSelect",
              "slot": null
            },
            {
              "nodeName": "MarketSelect",
              "at": "/props/defaultValue",
              "text": "ALL",
              "owner": "MarketSelect",
              "slot": null
            },
            {
              "nodeName": "FilterScenario",
              "at": "/props/label",
              "text": "场景",
              "owner": "FilterScenario",
              "slot": null
            },
            {
              "nodeName": "ScenarioSelect",
              "at": "/props/options/0/label",
              "text": "全部",
              "owner": "ScenarioSelect",
              "slot": null
            },
            {
              "nodeName": "ScenarioSelect",
              "at": "/props/options/1/label",
              "text": "获客",
              "owner": "ScenarioSelect",
              "slot": null
            },
            {
              "nodeName": "ScenarioSelect",
              "at": "/props/options/2/label",
              "text": "风险",
              "owner": "ScenarioSelect",
              "slot": null
            },
            {
              "nodeName": "ScenarioSelect",
              "at": "/props/options/3/label",
              "text": "客经",
              "owner": "ScenarioSelect",
              "slot": null
            },
            {
              "nodeName": "ScenarioSelect",
              "at": "/props/options/4/label",
              "text": "贷后",
              "owner": "ScenarioSelect",
              "slot": null
            },
            {
              "nodeName": "ScenarioSelect",
              "at": "/props/options/5/label",
              "text": "公共",
              "owner": "ScenarioSelect",
              "slot": null
            },
            {
              "nodeName": "ScenarioSelect",
              "at": "/props/defaultValue",
              "text": "ALL",
              "owner": "ScenarioSelect",
              "slot": null
            },
            {
              "nodeName": "FilterType",
              "at": "/props/label",
              "text": "类型",
              "owner": "FilterType",
              "slot": null
            },
            {
              "nodeName": "TypeSelect",
              "at": "/props/options/0/label",
              "text": "全部",
              "owner": "TypeSelect",
              "slot": null
            },
            {
              "nodeName": "TypeSelect",
              "at": "/props/options/1/label",
              "text": "常规",
              "owner": "TypeSelect",
              "slot": null
            },
            {
              "nodeName": "TypeSelect",
              "at": "/props/options/2/label",
              "text": "一次性",
              "owner": "TypeSelect",
              "slot": null
            },
            {
              "nodeName": "TypeSelect",
              "at": "/props/defaultValue",
              "text": "ALL",
              "owner": "TypeSelect",
              "slot": null
            },
            {
              "nodeName": "FilterStatus",
              "at": "/props/label",
              "text": "状态",
              "owner": "FilterStatus",
              "slot": null
            },
            {
              "nodeName": "StatusSelect",
              "at": "/props/options/0/label",
              "text": "全部",
              "owner": "StatusSelect",
              "slot": null
            },
            {
              "nodeName": "StatusSelect",
              "at": "/props/options/1/label",
              "text": "初始化",
              "owner": "StatusSelect",
              "slot": null
            },
            {
              "nodeName": "StatusSelect",
              "at": "/props/options/2/label",
              "text": "圈选中",
              "owner": "StatusSelect",
              "slot": null
            },
            {
              "nodeName": "StatusSelect",
              "at": "/props/options/3/label",
              "text": "圈选失败",
              "owner": "StatusSelect",
              "slot": null
            },
            {
              "nodeName": "StatusSelect",
              "at": "/props/options/4/label",
              "text": "启用",
              "owner": "StatusSelect",
              "slot": null
            },
            {
              "nodeName": "StatusSelect",
              "at": "/props/options/5/label",
              "text": "停用",
              "owner": "StatusSelect",
              "slot": null
            },
            {
              "nodeName": "StatusSelect",
              "at": "/props/defaultValue",
              "text": "ALL",
              "owner": "StatusSelect",
              "slot": null
            },
            {
              "nodeName": "FilterKeyword",
              "at": "/props/label",
              "text": "关键字",
              "owner": "FilterKeyword",
              "slot": null
            },
            {
              "nodeName": "KeywordInput",
              "at": "/props/placeholder",
              "text": "客群名称或 Key",
              "owner": "KeywordInput",
              "slot": null
            },
            {
              "nodeName": null,
              "at": "/text",
              "text": "全部客群客群ID客群Key名称类型场景状态更新时间负责人操作我负责的客群ID客群Key名称类型场景状态更新时间负责人操作",
              "owner": "AllTab",
              "slot": "label"
            },
            {
              "nodeName": "AllStatusBadge",
              "at": "/props/text",
              "text": "{{ row.status }}",
              "owner": "AllStatusBadge",
              "slot": null
            },
            {
              "nodeName": "AllRowActions",
              "at": "/props/items",
              "text": "{{ [{\"key\":\"detail\",\"label\":\"详情\"},row.status===`初始化`||row.status===`圈选失败`?{\"key\":\"edit\",\"label\":\"编辑\"}:false,row.status===`初始化`?{\"key\":\"online\",\"label\":\"上线\",\"confirm\":{\"title\":\"上线后开始正式圈选，确认上线？\",\"okText\":\"上线\",\"cancelText\":\"取消\"}}:false,row.status===`圈选失败`?{\"key\":\"reselect\",\"label\":\"重新圈选\"}:false,row.status===`停用`?{\"key\":\"enable\",\"label\":\"启用\",\"confirm\":{\"title\":\"启用将重新圈选，确认启用？\",\"okText\":\"启用\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"disable\",\"label\":\"停用\",\"confirm\":{\"title\":\"停用后该客群不可用于应用，确认停用？\",\"okText\":\"停用\",\"cancelText\":\"取消\"}}:false,{\"key\":\"copy\",\"label\":\"复制\"},row.status===`初始化`?{\"key\":\"delete\",\"label\":\"删除\",\"confirm\":{\"title\":\"删除后不可恢复，确认删除？\",\"okText\":\"删除\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"export\",\"label\":\"导出名单\"}:false] }}",
              "owner": "AllRowActions",
              "slot": null
            },
            {
              "nodeName": "MineStatusBadge",
              "at": "/props/text",
              "text": "{{ row.status }}",
              "owner": "MineStatusBadge",
              "slot": null
            },
            {
              "nodeName": "MineRowActions",
              "at": "/props/items",
              "text": "{{ [{\"key\":\"detail\",\"label\":\"详情\"},row.status===`初始化`||row.status===`圈选失败`?{\"key\":\"edit\",\"label\":\"编辑\"}:false,row.status===`初始化`?{\"key\":\"online\",\"label\":\"上线\",\"confirm\":{\"title\":\"上线后开始正式圈选，确认上线？\",\"okText\":\"上线\",\"cancelText\":\"取消\"}}:false,row.status===`圈选失败`?{\"key\":\"reselect\",\"label\":\"重新圈选\"}:false,row.status===`停用`?{\"key\":\"enable\",\"label\":\"启用\",\"confirm\":{\"title\":\"启用将重新圈选，确认启用？\",\"okText\":\"启用\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"disable\",\"label\":\"停用\",\"confirm\":{\"title\":\"停用后该客群不可用于应用，确认停用？\",\"okText\":\"停用\",\"cancelText\":\"取消\"}}:false,{\"key\":\"copy\",\"label\":\"复制\"},row.status===`初始化`?{\"key\":\"delete\",\"label\":\"删除\",\"confirm\":{\"title\":\"删除后不可恢复，确认删除？\",\"okText\":\"删除\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"export\",\"label\":\"导出名单\"}:false] }}",
              "owner": "MineRowActions",
              "slot": null
            },
            {
              "nodeName": "CreateMenu",
              "at": "/props/menuItemsJson/0/label",
              "text": "常规客群",
              "owner": "CreateMenu",
              "slot": null
            },
            {
              "nodeName": "CreateMenu",
              "at": "/props/menuItemsJson/1/label",
              "text": "一次性客群",
              "owner": "CreateMenu",
              "slot": null
            },
            {
              "nodeName": "CreateGroupLabel",
              "at": "/text",
              "text": "新建客群",
              "owner": "CreateGroupContent",
              "slot": "children"
            }
          ]
        },
        "notChecked": [
          "Natural-language name/source meaning",
          "JS-produced copy and runtime data values",
          "Inherited library defaults; inspect contracts and Preview"
        ]
      }
    ],
    "notChecked": [
      "source meaning and completeness",
      "actual template insertion/detachment",
      "JS execution",
      "visual and runtime acceptance"
    ]
  }
}
```

## page_layout: passed

```json
{
  "passed": true,
  "presets": [
    "Desktop"
  ],
  "pageCount": 4,
  "errors": []
}
```

## forms: unverified

```json
{
  "reason": "No reviewed gate configuration supplied"
}
```

## descriptions: unverified

```json
{
  "reason": "No reviewed gate configuration supplied"
}
```

## overlays: unverified

```json
{
  "reason": "No reviewed gate configuration supplied"
}
```

## slots: unverified

```json
{
  "reason": "No reviewed gate configuration supplied"
}
```

## shell_height: passed

```json
{
  "passed": true,
  "pages": [
    {
      "componentUuid": "eYMR4owU-V6_",
      "path": "/groups",
      "passed": true,
      "frameUuid": "YM8nQZR9qtx4",
      "viewportHeight": 1024,
      "viewportWidth": 1440,
      "measurements": [
        {
          "region": "AppShell",
          "top": 0,
          "height": 1024,
          "bottom": 1024,
          "left": 0,
          "width": 1440,
          "right": 1440
        },
        {
          "region": "Layout",
          "top": 0,
          "height": 1024,
          "bottom": 1024,
          "left": 0,
          "width": 1440,
          "right": 1440
        },
        {
          "region": "sidebar",
          "top": 0,
          "height": 1024,
          "bottom": 1024
        }
      ],
      "errors": [],
      "notChecked": [
        "subsequent-edit-sizing",
        "live-preview-scrolling",
        "save-reload-persistence"
      ]
    }
  ]
}
```

## references: not_applicable

```json
{
  "reason": "No reference gate configured; source coverage requires independent review"
}
```

## Not checked

- source-interpretation
- actual template insertion/detachment
- visual fidelity and hierarchy
- Preview interactions and scrolling
- keyboard/focus accessibility
- save/reopen persistence
