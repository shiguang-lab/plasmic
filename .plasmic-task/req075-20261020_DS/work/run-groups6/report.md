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
  "collectedAt": "2026-10-25T03:50:51.711804+00:00",
  "before": {
    "projectId": "uSwwgCkC1ujK3EVVPvmHdW",
    "branchId": null,
    "sessionId": "5zXK8lDocMXa",
    "revision": 50,
    "changeCounter": 58
  },
  "after": {
    "projectId": "uSwwgCkC1ujK3EVVPvmHdW",
    "branchId": null,
    "sessionId": "5zXK8lDocMXa",
    "revision": 50,
    "changeCounter": 58
  },
  "files": {
    "overview.json": "c32da1aa060933d1824532153aa768a15d59d3c937dff5120a8ac9018a7a3e23",
    "pages.json": "9fbbfd99c88efe0520f5930ea4e835a0009c3bd2be0af2f285e3f0c8dc27fadc",
    "layouts.json": "adc88ea4624db6c6e549ac881be41f016e473775eb8843df849f265ed1b257c8"
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
      "check": "recordPage",
      "path": "/groups/detail",
      "routePattern": "/groups/detail/[groupId]",
      "message": "Page path must match routePattern, one segment per param",
      "rule": "references/design/record-context.md#detection"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "MarketSelect",
      "registration": "plasmic-antd6-select",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "defaultValue"
      ],
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "ScenarioSelect",
      "registration": "plasmic-antd6-select",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "defaultValue"
      ],
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "TypeSelect",
      "registration": "plasmic-antd6-select",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "defaultValue"
      ],
      "rule": "references/libraries/antd_v6/components/select.md"
    },
    {
      "check": "componentUse",
      "path": "/groups",
      "node": "StatusSelect",
      "registration": "plasmic-antd6-select",
      "message": "Native props differ from the reviewed property constraints (null means deliberately unset)",
      "properties": [
        "defaultValue"
      ],
      "rule": "references/libraries/antd_v6/components/select.md"
    }
  ],
  "notChecked": [
    "source-interpretation",
    "runtime-behavior",
    "visual-quality",
    "dynamic UI-copy meaning and unlabeled visual heading inference"
  ],
  "selection": {
    "passed": true,
    "errors": [],
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
        "passed": true,
        "errors": [],
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
              "nodeName": "AllGroupsTabLabel",
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
              "nodeName": "AllGroupIDTitle",
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
              "nodeName": "AllGroupKeyTitle",
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
              "nodeName": "AllNameTitle",
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
              "nodeName": "AllTypeTitle",
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
              "nodeName": "AllScenarioTitle",
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
              "nodeName": "AllStatusTitle",
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
              "nodeName": "AllUpdatedTitle",
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
              "nodeName": "AllOwnerTitle",
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
              "nodeName": "AllActionsTitle",
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
              "nodeName": "MyGroupsTabLabel",
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
              "nodeName": "MineGroupIDTitle",
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
              "nodeName": "MineGroupKeyTitle",
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
              "nodeName": "MineNameTitle",
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
              "nodeName": "MineTypeTitle",
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
              "nodeName": "MineScenarioTitle",
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
              "nodeName": "MineStatusTitle",
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
              "nodeName": "MineUpdatedTitle",
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
              "nodeName": "MineOwnerTitle",
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
              "nodeName": "MineActionsTitle",
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
              "nodeName": "AllGroupsTabLabel",
              "at": "/text",
              "text": "全部客群",
              "owner": "AllTab",
              "slot": "label"
            },
            {
              "nodeName": "AllGroupIDTitle",
              "at": "/text",
              "text": "客群ID",
              "owner": "AllGroupIDColumn",
              "slot": "title"
            },
            {
              "nodeName": "AllGroupKeyTitle",
              "at": "/text",
              "text": "客群Key",
              "owner": "AllGroupKeyColumn",
              "slot": "title"
            },
            {
              "nodeName": "AllNameTitle",
              "at": "/text",
              "text": "名称",
              "owner": "AllNameColumn",
              "slot": "title"
            },
            {
              "nodeName": "AllTypeTitle",
              "at": "/text",
              "text": "类型",
              "owner": "AllTypeColumn",
              "slot": "title"
            },
            {
              "nodeName": "AllScenarioTitle",
              "at": "/text",
              "text": "场景",
              "owner": "AllScenarioColumn",
              "slot": "title"
            },
            {
              "nodeName": "AllStatusTitle",
              "at": "/text",
              "text": "状态",
              "owner": "AllStatusColumn",
              "slot": "title"
            },
            {
              "nodeName": "AllStatusBadge",
              "at": "/props/text",
              "text": "{{ row.status }}",
              "owner": "AllStatusBadge",
              "slot": null
            },
            {
              "nodeName": "AllUpdatedTitle",
              "at": "/text",
              "text": "更新时间",
              "owner": "AllUpdatedColumn",
              "slot": "title"
            },
            {
              "nodeName": "AllOwnerTitle",
              "at": "/text",
              "text": "负责人",
              "owner": "AllOwnerColumn",
              "slot": "title"
            },
            {
              "nodeName": "AllActionsTitle",
              "at": "/text",
              "text": "操作",
              "owner": "AllActionsColumn",
              "slot": "title"
            },
            {
              "nodeName": "AllRowActions",
              "at": "/props/items",
              "text": "{{ [{\"key\":\"detail\",\"label\":\"详情\"},row.status===`初始化`||row.status===`圈选失败`?{\"key\":\"edit\",\"label\":\"编辑\"}:false,row.status===`初始化`?{\"key\":\"online\",\"label\":\"上线\",\"confirm\":{\"title\":\"上线后开始正式圈选，确认上线？\",\"okText\":\"上线\",\"cancelText\":\"取消\"}}:false,row.status===`圈选失败`?{\"key\":\"reselect\",\"label\":\"重新圈选\"}:false,row.status===`停用`?{\"key\":\"enable\",\"label\":\"启用\",\"confirm\":{\"title\":\"启用将重新圈选，确认启用？\",\"okText\":\"启用\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"disable\",\"label\":\"停用\",\"confirm\":{\"title\":\"停用后该客群不可用于应用，确认停用？\",\"okText\":\"停用\",\"cancelText\":\"取消\"}}:false,{\"key\":\"copy\",\"label\":\"复制\"},row.status===`初始化`?{\"key\":\"delete\",\"label\":\"删除\",\"confirm\":{\"title\":\"删除后不可恢复，确认删除？\",\"okText\":\"删除\",\"cancelText\":\"取消\"}}:false,row.status===`启用`&&$state.currentUser.role===`管理员`?{\"key\":\"export\",\"label\":\"导出名单\"}:false] }}",
              "owner": "AllRowActions",
              "slot": null
            },
            {
              "nodeName": "MyGroupsTabLabel",
              "at": "/text",
              "text": "我负责的",
              "owner": "MineTab",
              "slot": "label"
            },
            {
              "nodeName": "MineGroupIDTitle",
              "at": "/text",
              "text": "客群ID",
              "owner": "MineGroupIDColumn",
              "slot": "title"
            },
            {
              "nodeName": "MineGroupKeyTitle",
              "at": "/text",
              "text": "客群Key",
              "owner": "MineGroupKeyColumn",
              "slot": "title"
            },
            {
              "nodeName": "MineNameTitle",
              "at": "/text",
              "text": "名称",
              "owner": "MineNameColumn",
              "slot": "title"
            },
            {
              "nodeName": "MineTypeTitle",
              "at": "/text",
              "text": "类型",
              "owner": "MineTypeColumn",
              "slot": "title"
            },
            {
              "nodeName": "MineScenarioTitle",
              "at": "/text",
              "text": "场景",
              "owner": "MineScenarioColumn",
              "slot": "title"
            },
            {
              "nodeName": "MineStatusTitle",
              "at": "/text",
              "text": "状态",
              "owner": "MineStatusColumn",
              "slot": "title"
            },
            {
              "nodeName": "MineStatusBadge",
              "at": "/props/text",
              "text": "{{ row.status }}",
              "owner": "MineStatusBadge",
              "slot": null
            },
            {
              "nodeName": "MineUpdatedTitle",
              "at": "/text",
              "text": "更新时间",
              "owner": "MineUpdatedColumn",
              "slot": "title"
            },
            {
              "nodeName": "MineOwnerTitle",
              "at": "/text",
              "text": "负责人",
              "owner": "MineOwnerColumn",
              "slot": "title"
            },
            {
              "nodeName": "MineActionsTitle",
              "at": "/text",
              "text": "操作",
              "owner": "MineActionsColumn",
              "slot": "title"
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
