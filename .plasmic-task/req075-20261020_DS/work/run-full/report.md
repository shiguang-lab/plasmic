# Plasmic automated verification

Automated gates: PASS

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
  "collectedAt": "2026-10-25T03:59:17.844385+00:00",
  "before": {
    "projectId": "uSwwgCkC1ujK3EVVPvmHdW",
    "branchId": null,
    "sessionId": "5zXK8lDocMXa",
    "revision": 74,
    "changeCounter": 270
  },
  "after": {
    "projectId": "uSwwgCkC1ujK3EVVPvmHdW",
    "branchId": null,
    "sessionId": "5zXK8lDocMXa",
    "revision": 74,
    "changeCounter": 270
  },
  "files": {
    "overview.json": "c32da1aa060933d1824532153aa768a15d59d3c937dff5120a8ac9018a7a3e23",
    "pages.json": "4e8fdd3115ce1ed6c8eea0846ee7e3bc8a0e6e9543e510f50c32766802239c3d",
    "layouts.json": "b2540e90252fdff2f11d66dfdcb3c14d40ee368da4b073f1944a2e8c1e2c1a10"
  },
  "validation": {
    "componentUuids": [
      "eYMR4owU-V6_",
      "YW4MQIakrQnt",
      "cVcKW-ucQxXU",
      "NisuOsxUy7dG"
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
      "pages": 4,
      "components": 4
    }
  }
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
    "pages": 4,
    "components": 4
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

## structure: passed

```json
{
  "passed": true,
  "expectedPageCount": 4,
  "actualPageCount": 4,
  "errors": [],
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
      },
      {
        "path": "/groups/detail",
        "passed": true,
        "errors": [],
        "sources": [],
        "status": "not_applicable",
        "reason": "The catalog has no tabbed record-detail composition (RecordDetailPage is a single summary plus related table without Tab-scoped tables), so the page composes registered Card/Descriptions/Tabs/Table/Drawer directly.",
        "notChecked": [
          "correctness of the no-template-fit decision"
        ]
      },
      {
        "path": "/groups/onetime-create",
        "passed": true,
        "errors": [],
        "sources": [],
        "status": "not_applicable",
        "reason": "The staged SQL creation flow (Steps + read-only basics + SQL/预跑) matches no catalog composition; BasicFormPage has no Steps or SQL editor, so the page composes registered Steps/Descriptions/Form/Card instead.",
        "notChecked": [
          "correctness of the no-template-fit decision"
        ]
      },
      {
        "path": "/groups/selector",
        "passed": true,
        "errors": [],
        "sources": [],
        "status": "not_applicable",
        "reason": "Splits the SQL workflow into a basic-information Card and an SQL/校验 Card on one page; the catalog sections cover list, tabbed list, catalog tabs, detail and form pages only, so this staged SQL composition is not one of them.",
        "notChecked": [
          "correctness of the no-template-fit decision"
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
      },
      {
        "path": "/groups/detail",
        "passed": true,
        "errors": [],
        "inventory": {
          "nodes": [
            {
              "nodeName": "DetailPage",
              "elementUuid": "8Q_mlk_QekU7",
              "tag": "div",
              "owner": null,
              "text": ""
            },
            {
              "nodeName": "AppShell",
              "elementUuid": "W2TUCMOTQhNR",
              "tag": "plasmic-component",
              "owner": null,
              "text": "",
              "component": "plasmicoverseasappshell"
            },
            {
              "nodeName": "DetailBody",
              "elementUuid": "q5T-aMFQZatB",
              "tag": "div",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "ArchiveCard",
              "elementUuid": "oXVWXzXZuImD",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6card"
            },
            {
              "nodeName": "ArchiveGroups",
              "elementUuid": "nP-fUKulhVtr",
              "tag": "div",
              "owner": {
                "nodeName": "ArchiveCard",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "BasicDescriptions",
              "elementUuid": "hi2Mx4vhxyOL",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ArchiveCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptions"
            },
            {
              "nodeName": "BasicDescriptionsTitle",
              "elementUuid": "gdIFda8UsgX8",
              "tag": "span",
              "owner": {
                "nodeName": "BasicDescriptions",
                "slot": "title"
              },
              "text": "基础信息"
            },
            {
              "nodeName": "IdItem",
              "elementUuid": "coP7aIvT1k0Z",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "IdItemLabel",
              "elementUuid": "Nw6ZUzJX-ZH3",
              "tag": "span",
              "owner": {
                "nodeName": "IdItem",
                "slot": "label"
              },
              "text": "客群ID"
            },
            {
              "nodeName": "IdItemText",
              "elementUuid": "eZFMY9PuyqeG",
              "tag": "span",
              "owner": {
                "nodeName": "IdItem",
                "slot": "children"
              },
              "text": "1002"
            },
            {
              "nodeName": "KeyItem",
              "elementUuid": "NvZNsAlEfTMN",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "KeyItemLabel",
              "elementUuid": "mxtn0EqhMSA6",
              "tag": "span",
              "owner": {
                "nodeName": "KeyItem",
                "slot": "label"
              },
              "text": "客群Key"
            },
            {
              "nodeName": "KeyItemText",
              "elementUuid": "boFns1oVcLd6",
              "tag": "span",
              "owner": {
                "nodeName": "KeyItem",
                "slot": "children"
              },
              "text": "GRP_ONETIME_RECALL_20260820"
            },
            {
              "nodeName": "NameItem",
              "elementUuid": "leuq9fzw5fVr",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "NameItemLabel",
              "elementUuid": "D-_nikZb5I5h",
              "tag": "span",
              "owner": {
                "nodeName": "NameItem",
                "slot": "label"
              },
              "text": "客群名称"
            },
            {
              "nodeName": "NameItemText",
              "elementUuid": "xNYQvNR3DaH0",
              "tag": "span",
              "owner": {
                "nodeName": "NameItem",
                "slot": "children"
              },
              "text": "存量促活-7月客群"
            },
            {
              "nodeName": "CreatorItem",
              "elementUuid": "80T8wojSDCaz",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "CreatorItemLabel",
              "elementUuid": "kjgblVMvAI3Y",
              "tag": "span",
              "owner": {
                "nodeName": "CreatorItem",
                "slot": "label"
              },
              "text": "创建人"
            },
            {
              "nodeName": "CreatorItemText",
              "elementUuid": "I7RuwvDMRTJw",
              "tag": "span",
              "owner": {
                "nodeName": "CreatorItem",
                "slot": "children"
              },
              "text": "傅玮颖"
            },
            {
              "nodeName": "CreatedAtItem",
              "elementUuid": "a55WvBU0f32h",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "CreatedAtItemLabel",
              "elementUuid": "qZcQbfFGQw-A",
              "tag": "span",
              "owner": {
                "nodeName": "CreatedAtItem",
                "slot": "label"
              },
              "text": "创建时间"
            },
            {
              "nodeName": "CreatedAtItemText",
              "elementUuid": "GdBlgsy6gE1v",
              "tag": "span",
              "owner": {
                "nodeName": "CreatedAtItem",
                "slot": "children"
              },
              "text": "2026-08-20"
            },
            {
              "nodeName": "SelectionDescriptions",
              "elementUuid": "HLF6utu0B5ot",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ArchiveCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptions"
            },
            {
              "nodeName": "SelectionDescriptionsTitle",
              "elementUuid": "lGz0AzysRN7u",
              "tag": "span",
              "owner": {
                "nodeName": "SelectionDescriptions",
                "slot": "title"
              },
              "text": "圈选信息"
            },
            {
              "nodeName": "GroupTypeItem",
              "elementUuid": "7SA3m4K357CN",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectionDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "GroupTypeItemLabel",
              "elementUuid": "J8WvVvLrS9zJ",
              "tag": "span",
              "owner": {
                "nodeName": "GroupTypeItem",
                "slot": "label"
              },
              "text": "客群类型"
            },
            {
              "nodeName": "GroupTypeItemText",
              "elementUuid": "b1CPQTHLCobd",
              "tag": "span",
              "owner": {
                "nodeName": "GroupTypeItem",
                "slot": "children"
              },
              "text": "一次性"
            },
            {
              "nodeName": "OriginItem",
              "elementUuid": "Yg-ET4Mkirfl",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectionDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "OriginItemLabel",
              "elementUuid": "w7-icv3_tt2Z",
              "tag": "span",
              "owner": {
                "nodeName": "OriginItem",
                "slot": "label"
              },
              "text": "客群来源"
            },
            {
              "nodeName": "OriginItemText",
              "elementUuid": "vvBlbpGkKPOY",
              "tag": "span",
              "owner": {
                "nodeName": "OriginItem",
                "slot": "children"
              },
              "text": "写SQL"
            },
            {
              "nodeName": "StateItem",
              "elementUuid": "db3rVAcoYw3L",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectionDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "StateItemLabel",
              "elementUuid": "hTGK6Es0FIpW",
              "tag": "span",
              "owner": {
                "nodeName": "StateItem",
                "slot": "label"
              },
              "text": "状态"
            },
            {
              "nodeName": "StateItemText",
              "elementUuid": "_a2_mfcuHl1v",
              "tag": "span",
              "owner": {
                "nodeName": "StateItem",
                "slot": "children"
              },
              "text": "启用"
            },
            {
              "nodeName": "ExpireRangeItem",
              "elementUuid": "WXUJ5FP813PS",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectionDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "ExpireRangeItemLabel",
              "elementUuid": "ntNTzJiBCnvP",
              "tag": "span",
              "owner": {
                "nodeName": "ExpireRangeItem",
                "slot": "label"
              },
              "text": "有效期"
            },
            {
              "nodeName": "ExpireRangeItemText",
              "elementUuid": "cvHViUDqEzid",
              "tag": "span",
              "owner": {
                "nodeName": "ExpireRangeItem",
                "slot": "children"
              },
              "text": "2026-08-20 ~ 2026-09-03"
            },
            {
              "nodeName": "OwnerItem",
              "elementUuid": "uuQ2lu58xIoi",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectionDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "OwnerItemLabel",
              "elementUuid": "3K0xYuqxmkMl",
              "tag": "span",
              "owner": {
                "nodeName": "OwnerItem",
                "slot": "label"
              },
              "text": "负责人"
            },
            {
              "nodeName": "OwnerItemText",
              "elementUuid": "1I9aD92bNukh",
              "tag": "span",
              "owner": {
                "nodeName": "OwnerItem",
                "slot": "children"
              },
              "text": "傅玮颖"
            },
            {
              "nodeName": "StorageDescriptions",
              "elementUuid": "rsQmyiSt7AkK",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ArchiveCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptions"
            },
            {
              "nodeName": "StorageDescriptionsTitle",
              "elementUuid": "sRWRIhTmv9ma",
              "tag": "span",
              "owner": {
                "nodeName": "StorageDescriptions",
                "slot": "title"
              },
              "text": "数据存储"
            },
            {
              "nodeName": "TableItem",
              "elementUuid": "eWFP_EWHCCqb",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "StorageDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "TableItemLabel",
              "elementUuid": "xIfujbhxR8_t",
              "tag": "span",
              "owner": {
                "nodeName": "TableItem",
                "slot": "label"
              },
              "text": "存储表"
            },
            {
              "nodeName": "TableItemText",
              "elementUuid": "HFFSzq7t6Jfb",
              "tag": "span",
              "owner": {
                "nodeName": "TableItem",
                "slot": "children"
              },
              "text": "cg_mx_cg_88001"
            },
            {
              "nodeName": "RetentionItem",
              "elementUuid": "euYH5CHb_8WK",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "StorageDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "RetentionItemLabel",
              "elementUuid": "jJuOs0yHS6ro",
              "tag": "span",
              "owner": {
                "nodeName": "RetentionItem",
                "slot": "label"
              },
              "text": "保存天数"
            },
            {
              "nodeName": "RetentionItemText",
              "elementUuid": "F3LL4cz3Bo6i",
              "tag": "span",
              "owner": {
                "nodeName": "RetentionItem",
                "slot": "children"
              },
              "text": "3 天"
            },
            {
              "nodeName": "PartitionItem",
              "elementUuid": "h40-yxiAIibp",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "StorageDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "PartitionItemLabel",
              "elementUuid": "SqdLk4iEWLZ9",
              "tag": "span",
              "owner": {
                "nodeName": "PartitionItem",
                "slot": "label"
              },
              "text": "保留分区"
            },
            {
              "nodeName": "PartitionItemText",
              "elementUuid": "vMtNWs24HZb4",
              "tag": "span",
              "owner": {
                "nodeName": "PartitionItem",
                "slot": "children"
              },
              "text": "2026-08-29 ~ 2026-08-31"
            },
            {
              "nodeName": "DeadlineItem",
              "elementUuid": "QRenvd6kz10m",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "StorageDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "DeadlineItemLabel",
              "elementUuid": "bVtes-xDH_p2",
              "tag": "span",
              "owner": {
                "nodeName": "DeadlineItem",
                "slot": "label"
              },
              "text": "产出截止时间"
            },
            {
              "nodeName": "DeadlineItemText",
              "elementUuid": "tolDjsy3WYBa",
              "tag": "span",
              "owner": {
                "nodeName": "DeadlineItem",
                "slot": "children"
              },
              "text": "每日 18:00:00"
            },
            {
              "nodeName": "DetailCard",
              "elementUuid": "I2Gs8oOIrMZ8",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6card"
            },
            {
              "nodeName": "DetailTabs",
              "elementUuid": "iYKKnOztXYj2",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "DetailCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tabs"
            },
            {
              "nodeName": "OverviewTab",
              "elementUuid": "Gw3DG114EuFd",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "DetailTabs",
                "slot": "items"
              },
              "text": "",
              "component": "plasmicantd6tabitem"
            },
            {
              "nodeName": "OverviewTabLabel",
              "elementUuid": "Yi1bebpXIHGK",
              "tag": "span",
              "owner": {
                "nodeName": "OverviewTab",
                "slot": "label"
              },
              "text": "概览"
            },
            {
              "nodeName": "OverviewBody",
              "elementUuid": "6xk3SBxFktcs",
              "tag": "div",
              "owner": {
                "nodeName": "OverviewTab",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "OverviewKpi",
              "elementUuid": "FmU38XfN-xH-",
              "tag": "div",
              "owner": {
                "nodeName": "OverviewTab",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "KpiDescriptions",
              "elementUuid": "akgnOGQEaP3U",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OverviewTab",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptions"
            },
            {
              "nodeName": "KpiStateItem",
              "elementUuid": "MV8R_5foa0d5",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "KpiDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "KpiStateItemLabel",
              "elementUuid": "WYU5uLpyP-FR",
              "tag": "span",
              "owner": {
                "nodeName": "KpiStateItem",
                "slot": "label"
              },
              "text": "状态"
            },
            {
              "nodeName": "KpiStateItemText",
              "elementUuid": "9Ny7H8WBAE3J",
              "tag": "span",
              "owner": {
                "nodeName": "KpiStateItem",
                "slot": "children"
              },
              "text": "启用"
            },
            {
              "nodeName": "KpiLastSelectItem",
              "elementUuid": "IX1RZmgNSXDC",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "KpiDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "KpiLastSelectItemLabel",
              "elementUuid": "0dHjpaw-tcxg",
              "tag": "span",
              "owner": {
                "nodeName": "KpiLastSelectItem",
                "slot": "label"
              },
              "text": "上次圈选"
            },
            {
              "nodeName": "KpiLastSelectItemText",
              "elementUuid": "n_7IpoGYk5lh",
              "tag": "span",
              "owner": {
                "nodeName": "KpiLastSelectItem",
                "slot": "children"
              },
              "text": "2026-08-20 10:25"
            },
            {
              "nodeName": "KpiLastRefreshItem",
              "elementUuid": "U4rb12etuI6q",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "KpiDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "KpiLastRefreshItemLabel",
              "elementUuid": "bSi_x811dfbd",
              "tag": "span",
              "owner": {
                "nodeName": "KpiLastRefreshItem",
                "slot": "label"
              },
              "text": "上次刷新"
            },
            {
              "nodeName": "KpiLastRefreshItemText",
              "elementUuid": "0yyGVd_CYN5N",
              "tag": "span",
              "owner": {
                "nodeName": "KpiLastRefreshItem",
                "slot": "children"
              },
              "text": "2026-08-19 06:30"
            },
            {
              "nodeName": "MemberStatistic",
              "elementUuid": "EoJDWVP18Wkr",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OverviewTab",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6statistic"
            },
            {
              "nodeName": "MemberStatisticTitle",
              "elementUuid": "MeBfh0IJ4f6D",
              "tag": "span",
              "owner": {
                "nodeName": "MemberStatistic",
                "slot": "title"
              },
              "text": "成员数"
            },
            {
              "nodeName": "OverviewDescriptions",
              "elementUuid": "daWpxUweYbjq",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OverviewTab",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptions"
            },
            {
              "nodeName": "ConditionItem",
              "elementUuid": "0AwtJyrbdGW0",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OverviewDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "ConditionItemLabel",
              "elementUuid": "PpYFVNN9bZWX",
              "tag": "span",
              "owner": {
                "nodeName": "ConditionItem",
                "slot": "label"
              },
              "text": "圈选条件"
            },
            {
              "nodeName": "ConditionItemText",
              "elementUuid": "M2PfwYGhjcuw",
              "tag": "span",
              "owner": {
                "nodeName": "ConditionItem",
                "slot": "children"
              },
              "text": "写SQL · 一次性执行"
            },
            {
              "nodeName": "ScaleItem",
              "elementUuid": "U6OgiMrpQh4P",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OverviewDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "ScaleItemLabel",
              "elementUuid": "4RQT7wmWYAap",
              "tag": "span",
              "owner": {
                "nodeName": "ScaleItem",
                "slot": "label"
              },
              "text": "当前规模"
            },
            {
              "nodeName": "ScaleItemText",
              "elementUuid": "n-R_jrxZRpvl",
              "tag": "span",
              "owner": {
                "nodeName": "ScaleItem",
                "slot": "children"
              },
              "text": "12,340"
            },
            {
              "nodeName": "LastLogItem",
              "elementUuid": "5dsCvTrhOmvB",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OverviewDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "LastLogItemLabel",
              "elementUuid": "RsbDCYwTVJ5P",
              "tag": "span",
              "owner": {
                "nodeName": "LastLogItem",
                "slot": "label"
              },
              "text": "最近圈选记录"
            },
            {
              "nodeName": "LastLogItemText",
              "elementUuid": "FokCpEEDYSsu",
              "tag": "span",
              "owner": {
                "nodeName": "LastLogItem",
                "slot": "children"
              },
              "text": "成功 · 2026-08-20 10:25"
            },
            {
              "nodeName": "MembersTab",
              "elementUuid": "SBEvNGg9zb3g",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "DetailTabs",
                "slot": "items"
              },
              "text": "",
              "component": "plasmicantd6tabitem"
            },
            {
              "nodeName": "MembersTabLabel",
              "elementUuid": "rXk6Ov9isoTR",
              "tag": "span",
              "owner": {
                "nodeName": "MembersTab",
                "slot": "label"
              },
              "text": "成员"
            },
            {
              "nodeName": "MembersTable",
              "elementUuid": "yt6ockFq-WrX",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MembersTab",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6table"
            },
            {
              "nodeName": "MemberUidColumn",
              "elementUuid": "XwBeBQVow8U_",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MembersTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "MemberUidColumnTitle",
              "elementUuid": "9tVRp7_So1al",
              "tag": "span",
              "owner": {
                "nodeName": "MemberUidColumn",
                "slot": "title"
              },
              "text": "UID"
            },
            {
              "nodeName": "MemberPhoneColumn",
              "elementUuid": "N5jEXMxqaNEp",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MembersTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "MemberPhoneColumnTitle",
              "elementUuid": "y-wcYWvgMB4q",
              "tag": "span",
              "owner": {
                "nodeName": "MemberPhoneColumn",
                "slot": "title"
              },
              "text": "手机号"
            },
            {
              "nodeName": "MemberRegColumn",
              "elementUuid": "Z-wLrt7Qvro8",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MembersTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "MemberRegColumnTitle",
              "elementUuid": "myQj_litFcok",
              "tag": "span",
              "owner": {
                "nodeName": "MemberRegColumn",
                "slot": "title"
              },
              "text": "注册时间"
            },
            {
              "nodeName": "MemberSourceColumn",
              "elementUuid": "zcV234k_l_qY",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MembersTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "MemberSourceColumnTitle",
              "elementUuid": "-SXCd7Y_HTO8",
              "tag": "span",
              "owner": {
                "nodeName": "MemberSourceColumn",
                "slot": "title"
              },
              "text": "App来源"
            },
            {
              "nodeName": "MemberCreditColumn",
              "elementUuid": "HrovI1YFNyXQ",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MembersTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "MemberCreditColumnTitle",
              "elementUuid": "7eWpQcFM8LGl",
              "tag": "span",
              "owner": {
                "nodeName": "MemberCreditColumn",
                "slot": "title"
              },
              "text": "授信状态"
            },
            {
              "nodeName": "MemberCreditBadge",
              "elementUuid": "K8b3IM96pxqM",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MemberCreditColumn",
                "slot": "render"
              },
              "text": "",
              "component": "plasmicantd6badge"
            },
            {
              "nodeName": "MemberLoanColumn",
              "elementUuid": "2Dsox-ziCNDI",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MembersTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "MemberLoanColumnTitle",
              "elementUuid": "tlgWHPyUoNLb",
              "tag": "span",
              "owner": {
                "nodeName": "MemberLoanColumn",
                "slot": "title"
              },
              "text": "借据状态"
            },
            {
              "nodeName": "MemberLoanBadge",
              "elementUuid": "1vdocUVMxxzo",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "MemberLoanColumn",
                "slot": "render"
              },
              "text": "",
              "component": "plasmicantd6badge"
            },
            {
              "nodeName": "SelectLogTab",
              "elementUuid": "PV-52JN_sR4q",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "DetailTabs",
                "slot": "items"
              },
              "text": "",
              "component": "plasmicantd6tabitem"
            },
            {
              "nodeName": "SelectLogTabLabel",
              "elementUuid": "D7RxfS2eeUAw",
              "tag": "span",
              "owner": {
                "nodeName": "SelectLogTab",
                "slot": "label"
              },
              "text": "圈选记录"
            },
            {
              "nodeName": "SelectLogBody",
              "elementUuid": "UTX8sPtK829l",
              "tag": "div",
              "owner": {
                "nodeName": "SelectLogTab",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "SelectLogFilters",
              "elementUuid": "RF2Oup4ywcHd",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectLogTab",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicoverseassearchform"
            },
            {
              "nodeName": "SelectLogFiltersItem",
              "elementUuid": "PjnWDP89A3r1",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectLogFilters",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicoverseassearchformitem"
            },
            {
              "nodeName": "SelectLogFiltersControl",
              "elementUuid": "K12pj3dmBWRy",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectLogFiltersItem",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6select"
            },
            {
              "nodeName": "SelectLogTable",
              "elementUuid": "x0YD_7MgXh6N",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectLogTab",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6table"
            },
            {
              "nodeName": "SelectTimeColumn",
              "elementUuid": "Jg_v6k07vQyd",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "SelectTimeColumnTitle",
              "elementUuid": "LV4k_I9oHS4n",
              "tag": "span",
              "owner": {
                "nodeName": "SelectTimeColumn",
                "slot": "title"
              },
              "text": "圈选时间"
            },
            {
              "nodeName": "SelectTriggerColumn",
              "elementUuid": "Gw0EiArdMh32",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "SelectTriggerColumnTitle",
              "elementUuid": "9AXpuQhSS_VA",
              "tag": "span",
              "owner": {
                "nodeName": "SelectTriggerColumn",
                "slot": "title"
              },
              "text": "触发"
            },
            {
              "nodeName": "SelectStateColumn",
              "elementUuid": "84schth4hMqS",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "SelectStateColumnTitle",
              "elementUuid": "eYE2GR3lkIgQ",
              "tag": "span",
              "owner": {
                "nodeName": "SelectStateColumn",
                "slot": "title"
              },
              "text": "状态"
            },
            {
              "nodeName": "SelectStateBadge",
              "elementUuid": "NqBFhE39BixF",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectStateColumn",
                "slot": "render"
              },
              "text": "",
              "component": "plasmicantd6badge"
            },
            {
              "nodeName": "SelectCountColumn",
              "elementUuid": "_v7Aum1YkIi4",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "SelectCountColumnTitle",
              "elementUuid": "tKHb5IeqZCBm",
              "tag": "span",
              "owner": {
                "nodeName": "SelectCountColumn",
                "slot": "title"
              },
              "text": "命中成员数"
            },
            {
              "nodeName": "SelectReasonColumn",
              "elementUuid": "r0Fu_-A0N_r_",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SelectLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "SelectReasonColumnTitle",
              "elementUuid": "u3Tdy8N55yNK",
              "tag": "span",
              "owner": {
                "nodeName": "SelectReasonColumn",
                "slot": "title"
              },
              "text": "失败原因"
            },
            {
              "nodeName": "RefreshLogTab",
              "elementUuid": "uIf-LqPNjCjr",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "DetailTabs",
                "slot": "items"
              },
              "text": "",
              "component": "plasmicantd6tabitem"
            },
            {
              "nodeName": "RefreshLogTabLabel",
              "elementUuid": "3xfQyBCz5rmr",
              "tag": "span",
              "owner": {
                "nodeName": "RefreshLogTab",
                "slot": "label"
              },
              "text": "刷新记录"
            },
            {
              "nodeName": "RefreshLogBody",
              "elementUuid": "FLK7ptSoLlN_",
              "tag": "div",
              "owner": {
                "nodeName": "RefreshLogTab",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "RefreshLogTable",
              "elementUuid": "lDOncTpzvG42",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "RefreshLogTab",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6table"
            },
            {
              "nodeName": "RefreshTimeColumn",
              "elementUuid": "n8t-o1JRla_O",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "RefreshLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "RefreshTimeColumnTitle",
              "elementUuid": "KkNnV63Ab8yK",
              "tag": "span",
              "owner": {
                "nodeName": "RefreshTimeColumn",
                "slot": "title"
              },
              "text": "刷新时间"
            },
            {
              "nodeName": "RefreshTypeColumn",
              "elementUuid": "h41ejrMUBOyH",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "RefreshLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "RefreshTypeColumnTitle",
              "elementUuid": "Dw8tOy5GfzuS",
              "tag": "span",
              "owner": {
                "nodeName": "RefreshTypeColumn",
                "slot": "title"
              },
              "text": "类型"
            },
            {
              "nodeName": "RefreshCountColumn",
              "elementUuid": "cdPn3W3zdSTd",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "RefreshLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "RefreshCountColumnTitle",
              "elementUuid": "xFWtgKsgaEW5",
              "tag": "span",
              "owner": {
                "nodeName": "RefreshCountColumn",
                "slot": "title"
              },
              "text": "成员数"
            },
            {
              "nodeName": "RefreshStateColumn",
              "elementUuid": "DiIKteCtnMN4",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "RefreshLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "RefreshStateColumnTitle",
              "elementUuid": "cdq9zaijzgI9",
              "tag": "span",
              "owner": {
                "nodeName": "RefreshStateColumn",
                "slot": "title"
              },
              "text": "状态"
            },
            {
              "nodeName": "RefreshStateBadge",
              "elementUuid": "Md3a6cZknV5a",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "RefreshStateColumn",
                "slot": "render"
              },
              "text": "",
              "component": "plasmicantd6badge"
            },
            {
              "nodeName": "RefreshReasonColumn",
              "elementUuid": "IJhA2F4LSRm0",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "RefreshLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "RefreshReasonColumnTitle",
              "elementUuid": "ruiBWcYZ7CO1",
              "tag": "span",
              "owner": {
                "nodeName": "RefreshReasonColumn",
                "slot": "title"
              },
              "text": "原因"
            },
            {
              "nodeName": "ApplyLogTab",
              "elementUuid": "TP7VZ9LAtywm",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "DetailTabs",
                "slot": "items"
              },
              "text": "",
              "component": "plasmicantd6tabitem"
            },
            {
              "nodeName": "ApplyLogTabLabel",
              "elementUuid": "4DYM4h9TQ4TP",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyLogTab",
                "slot": "label"
              },
              "text": "应用记录"
            },
            {
              "nodeName": "ApplyLogBody",
              "elementUuid": "_4Pz4ylLrEQl",
              "tag": "div",
              "owner": {
                "nodeName": "ApplyLogTab",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "ApplyLogFilters",
              "elementUuid": "2fW8ig-PodGO",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyLogTab",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicoverseassearchform"
            },
            {
              "nodeName": "ApplyLogFiltersItem",
              "elementUuid": "0I7IEex6J9vo",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyLogFilters",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicoverseassearchformitem"
            },
            {
              "nodeName": "ApplyLogFiltersControl",
              "elementUuid": "v_MjLb9gWI6I",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyLogFiltersItem",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6select"
            },
            {
              "nodeName": "ApplyLogTable",
              "elementUuid": "LWziD0RS6wER",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyLogTab",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6table"
            },
            {
              "nodeName": "ApplyTypeColumn",
              "elementUuid": "IGKrbKRTaxJM",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "ApplyTypeColumnTitle",
              "elementUuid": "s-XLQdjLU9-Y",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyTypeColumn",
                "slot": "title"
              },
              "text": "应用类型"
            },
            {
              "nodeName": "ApplyTargetColumn",
              "elementUuid": "8EWVcQPbIbKE",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "ApplyTargetColumnTitle",
              "elementUuid": "i2P7OVlPzOEO",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyTargetColumn",
                "slot": "title"
              },
              "text": "目标活动"
            },
            {
              "nodeName": "ApplyStateColumn",
              "elementUuid": "usNouzlF-SA_",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "ApplyStateColumnTitle",
              "elementUuid": "ZNyN19Y4GDRr",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyStateColumn",
                "slot": "title"
              },
              "text": "状态"
            },
            {
              "nodeName": "ApplyStateBadge",
              "elementUuid": "5PPzvs0rFLVs",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyStateColumn",
                "slot": "render"
              },
              "text": "",
              "component": "plasmicantd6badge"
            },
            {
              "nodeName": "ApplyOperatorColumn",
              "elementUuid": "rdLhE-EIKI3j",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "ApplyOperatorColumnTitle",
              "elementUuid": "0C4d07xPvHZB",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyOperatorColumn",
                "slot": "title"
              },
              "text": "操作人"
            },
            {
              "nodeName": "ApplyTimeColumn",
              "elementUuid": "qAR8r5pnZNxh",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "ApplyTimeColumnTitle",
              "elementUuid": "oHWh8WIlCUTM",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyTimeColumn",
                "slot": "title"
              },
              "text": "时间"
            },
            {
              "nodeName": "ApplyActionsColumn",
              "elementUuid": "QGtnkpC0iZhS",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyLogTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "ApplyActionsColumnTitle",
              "elementUuid": "3yv9v5M10fYU",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyActionsColumn",
                "slot": "title"
              },
              "text": "操作"
            },
            {
              "nodeName": "ApplyRowActions",
              "elementUuid": "I6dFryCkIjN3",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyActionsColumn",
                "slot": "render"
              },
              "text": "",
              "component": "plasmicreactuiactiongroup"
            },
            {
              "nodeName": "ApplyDetailDrawer",
              "elementUuid": "I0Uq9oN9AwtD",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6drawer"
            },
            {
              "nodeName": "ApplyDrawerTitle",
              "elementUuid": "F5jK9w7vDQrO",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyDetailDrawer",
                "slot": "title"
              },
              "text": "应用详情"
            },
            {
              "nodeName": "ApplyDrawerBody",
              "elementUuid": "_Amg647Rd8kn",
              "tag": "div",
              "owner": {
                "nodeName": "ApplyDetailDrawer",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "ApplyDetailDescriptions",
              "elementUuid": "vo76Dvf_XVL-",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyDetailDrawer",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptions"
            },
            {
              "nodeName": "ApplyParamItem",
              "elementUuid": "CKqlixorv-i1",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyDetailDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "ApplyParamItemLabel",
              "elementUuid": "QDICI_Wpb3Xc",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyParamItem",
                "slot": "label"
              },
              "text": "应用参数"
            },
            {
              "nodeName": "ApplyParamItemText",
              "elementUuid": "Uv2-cfdfUZIW",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyParamItem",
                "slot": "children"
              },
              "text": "flow_id=FLOW_v2 · campaign=发券"
            },
            {
              "nodeName": "ApplyResultItem",
              "elementUuid": "uT3PJtPzoczI",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyDetailDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "ApplyResultItemLabel",
              "elementUuid": "smvrkDiHA94P",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyResultItem",
                "slot": "label"
              },
              "text": "返回信息"
            },
            {
              "nodeName": "ApplyResultItemText",
              "elementUuid": "KzncD4njF-rO",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyResultItem",
                "slot": "children"
              },
              "text": "request_no=20260822000031"
            },
            {
              "nodeName": "ApplyFailItem",
              "elementUuid": "gSTDTmWi8ykU",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ApplyDetailDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "ApplyFailItemLabel",
              "elementUuid": "WlbpMXhGAosF",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyFailItem",
                "slot": "label"
              },
              "text": "失败原因"
            },
            {
              "nodeName": "ApplyFailItemText",
              "elementUuid": "dPsD6H7WV2up",
              "tag": "span",
              "owner": {
                "nodeName": "ApplyFailItem",
                "slot": "children"
              },
              "text": "—"
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
              "nodeName": "BasicDescriptionsTitle",
              "at": "/text",
              "text": "基础信息",
              "owner": "BasicDescriptions",
              "slot": "title"
            },
            {
              "nodeName": "IdItemLabel",
              "at": "/text",
              "text": "客群ID",
              "owner": "IdItem",
              "slot": "label"
            },
            {
              "nodeName": "IdItemText",
              "at": "/text",
              "text": "1002",
              "owner": "IdItem",
              "slot": "children"
            },
            {
              "nodeName": "KeyItemLabel",
              "at": "/text",
              "text": "客群Key",
              "owner": "KeyItem",
              "slot": "label"
            },
            {
              "nodeName": "KeyItemText",
              "at": "/text",
              "text": "GRP_ONETIME_RECALL_20260820",
              "owner": "KeyItem",
              "slot": "children"
            },
            {
              "nodeName": "NameItemLabel",
              "at": "/text",
              "text": "客群名称",
              "owner": "NameItem",
              "slot": "label"
            },
            {
              "nodeName": "NameItemText",
              "at": "/text",
              "text": "存量促活-7月客群",
              "owner": "NameItem",
              "slot": "children"
            },
            {
              "nodeName": "CreatorItemLabel",
              "at": "/text",
              "text": "创建人",
              "owner": "CreatorItem",
              "slot": "label"
            },
            {
              "nodeName": "CreatorItemText",
              "at": "/text",
              "text": "傅玮颖",
              "owner": "CreatorItem",
              "slot": "children"
            },
            {
              "nodeName": "CreatedAtItemLabel",
              "at": "/text",
              "text": "创建时间",
              "owner": "CreatedAtItem",
              "slot": "label"
            },
            {
              "nodeName": "CreatedAtItemText",
              "at": "/text",
              "text": "2026-08-20",
              "owner": "CreatedAtItem",
              "slot": "children"
            },
            {
              "nodeName": "SelectionDescriptionsTitle",
              "at": "/text",
              "text": "圈选信息",
              "owner": "SelectionDescriptions",
              "slot": "title"
            },
            {
              "nodeName": "GroupTypeItemLabel",
              "at": "/text",
              "text": "客群类型",
              "owner": "GroupTypeItem",
              "slot": "label"
            },
            {
              "nodeName": "GroupTypeItemText",
              "at": "/text",
              "text": "一次性",
              "owner": "GroupTypeItem",
              "slot": "children"
            },
            {
              "nodeName": "OriginItemLabel",
              "at": "/text",
              "text": "客群来源",
              "owner": "OriginItem",
              "slot": "label"
            },
            {
              "nodeName": "OriginItemText",
              "at": "/text",
              "text": "写SQL",
              "owner": "OriginItem",
              "slot": "children"
            },
            {
              "nodeName": "StateItemLabel",
              "at": "/text",
              "text": "状态",
              "owner": "StateItem",
              "slot": "label"
            },
            {
              "nodeName": "StateItemText",
              "at": "/text",
              "text": "启用",
              "owner": "StateItem",
              "slot": "children"
            },
            {
              "nodeName": "ExpireRangeItemLabel",
              "at": "/text",
              "text": "有效期",
              "owner": "ExpireRangeItem",
              "slot": "label"
            },
            {
              "nodeName": "ExpireRangeItemText",
              "at": "/text",
              "text": "2026-08-20 ~ 2026-09-03",
              "owner": "ExpireRangeItem",
              "slot": "children"
            },
            {
              "nodeName": "OwnerItemLabel",
              "at": "/text",
              "text": "负责人",
              "owner": "OwnerItem",
              "slot": "label"
            },
            {
              "nodeName": "OwnerItemText",
              "at": "/text",
              "text": "傅玮颖",
              "owner": "OwnerItem",
              "slot": "children"
            },
            {
              "nodeName": "StorageDescriptionsTitle",
              "at": "/text",
              "text": "数据存储",
              "owner": "StorageDescriptions",
              "slot": "title"
            },
            {
              "nodeName": "TableItemLabel",
              "at": "/text",
              "text": "存储表",
              "owner": "TableItem",
              "slot": "label"
            },
            {
              "nodeName": "TableItemText",
              "at": "/text",
              "text": "cg_mx_cg_88001",
              "owner": "TableItem",
              "slot": "children"
            },
            {
              "nodeName": "RetentionItemLabel",
              "at": "/text",
              "text": "保存天数",
              "owner": "RetentionItem",
              "slot": "label"
            },
            {
              "nodeName": "RetentionItemText",
              "at": "/text",
              "text": "3 天",
              "owner": "RetentionItem",
              "slot": "children"
            },
            {
              "nodeName": "PartitionItemLabel",
              "at": "/text",
              "text": "保留分区",
              "owner": "PartitionItem",
              "slot": "label"
            },
            {
              "nodeName": "PartitionItemText",
              "at": "/text",
              "text": "2026-08-29 ~ 2026-08-31",
              "owner": "PartitionItem",
              "slot": "children"
            },
            {
              "nodeName": "DeadlineItemLabel",
              "at": "/text",
              "text": "产出截止时间",
              "owner": "DeadlineItem",
              "slot": "label"
            },
            {
              "nodeName": "DeadlineItemText",
              "at": "/text",
              "text": "每日 18:00:00",
              "owner": "DeadlineItem",
              "slot": "children"
            },
            {
              "nodeName": "OverviewTabLabel",
              "at": "/text",
              "text": "概览",
              "owner": "OverviewTab",
              "slot": "label"
            },
            {
              "nodeName": "KpiStateItemLabel",
              "at": "/text",
              "text": "状态",
              "owner": "KpiStateItem",
              "slot": "label"
            },
            {
              "nodeName": "KpiStateItemText",
              "at": "/text",
              "text": "启用",
              "owner": "KpiStateItem",
              "slot": "children"
            },
            {
              "nodeName": "KpiLastSelectItemLabel",
              "at": "/text",
              "text": "上次圈选",
              "owner": "KpiLastSelectItem",
              "slot": "label"
            },
            {
              "nodeName": "KpiLastSelectItemText",
              "at": "/text",
              "text": "2026-08-20 10:25",
              "owner": "KpiLastSelectItem",
              "slot": "children"
            },
            {
              "nodeName": "KpiLastRefreshItemLabel",
              "at": "/text",
              "text": "上次刷新",
              "owner": "KpiLastRefreshItem",
              "slot": "label"
            },
            {
              "nodeName": "KpiLastRefreshItemText",
              "at": "/text",
              "text": "2026-08-19 06:30",
              "owner": "KpiLastRefreshItem",
              "slot": "children"
            },
            {
              "nodeName": "MemberStatisticTitle",
              "at": "/text",
              "text": "成员数",
              "owner": "MemberStatistic",
              "slot": "title"
            },
            {
              "nodeName": "ConditionItemLabel",
              "at": "/text",
              "text": "圈选条件",
              "owner": "ConditionItem",
              "slot": "label"
            },
            {
              "nodeName": "ConditionItemText",
              "at": "/text",
              "text": "写SQL · 一次性执行",
              "owner": "ConditionItem",
              "slot": "children"
            },
            {
              "nodeName": "ScaleItemLabel",
              "at": "/text",
              "text": "当前规模",
              "owner": "ScaleItem",
              "slot": "label"
            },
            {
              "nodeName": "ScaleItemText",
              "at": "/text",
              "text": "12,340",
              "owner": "ScaleItem",
              "slot": "children"
            },
            {
              "nodeName": "LastLogItemLabel",
              "at": "/text",
              "text": "最近圈选记录",
              "owner": "LastLogItem",
              "slot": "label"
            },
            {
              "nodeName": "LastLogItemText",
              "at": "/text",
              "text": "成功 · 2026-08-20 10:25",
              "owner": "LastLogItem",
              "slot": "children"
            },
            {
              "nodeName": "MembersTabLabel",
              "at": "/text",
              "text": "成员",
              "owner": "MembersTab",
              "slot": "label"
            },
            {
              "nodeName": "MemberUidColumnTitle",
              "at": "/text",
              "text": "UID",
              "owner": "MemberUidColumn",
              "slot": "title"
            },
            {
              "nodeName": "MemberPhoneColumnTitle",
              "at": "/text",
              "text": "手机号",
              "owner": "MemberPhoneColumn",
              "slot": "title"
            },
            {
              "nodeName": "MemberRegColumnTitle",
              "at": "/text",
              "text": "注册时间",
              "owner": "MemberRegColumn",
              "slot": "title"
            },
            {
              "nodeName": "MemberSourceColumnTitle",
              "at": "/text",
              "text": "App来源",
              "owner": "MemberSourceColumn",
              "slot": "title"
            },
            {
              "nodeName": "MemberCreditColumnTitle",
              "at": "/text",
              "text": "授信状态",
              "owner": "MemberCreditColumn",
              "slot": "title"
            },
            {
              "nodeName": "MemberCreditBadge",
              "at": "/props/text",
              "text": "{{ row.creditStatus }}",
              "owner": "MemberCreditBadge",
              "slot": null
            },
            {
              "nodeName": "MemberLoanColumnTitle",
              "at": "/text",
              "text": "借据状态",
              "owner": "MemberLoanColumn",
              "slot": "title"
            },
            {
              "nodeName": "MemberLoanBadge",
              "at": "/props/text",
              "text": "{{ row.loanStatus }}",
              "owner": "MemberLoanBadge",
              "slot": null
            },
            {
              "nodeName": "SelectLogTabLabel",
              "at": "/text",
              "text": "圈选记录",
              "owner": "SelectLogTab",
              "slot": "label"
            },
            {
              "nodeName": "SelectLogFiltersItem",
              "at": "/props/label",
              "text": "触发",
              "owner": "SelectLogFiltersItem",
              "slot": null
            },
            {
              "nodeName": "SelectLogFiltersControl",
              "at": "/props/options/0/label",
              "text": "全部",
              "owner": "SelectLogFiltersControl",
              "slot": null
            },
            {
              "nodeName": "SelectLogFiltersControl",
              "at": "/props/options/1/label",
              "text": "上线",
              "owner": "SelectLogFiltersControl",
              "slot": null
            },
            {
              "nodeName": "SelectLogFiltersControl",
              "at": "/props/options/2/label",
              "text": "重新圈选",
              "owner": "SelectLogFiltersControl",
              "slot": null
            },
            {
              "nodeName": "SelectLogFiltersControl",
              "at": "/props/options/3/label",
              "text": "手动圈选",
              "owner": "SelectLogFiltersControl",
              "slot": null
            },
            {
              "nodeName": "SelectLogFiltersControl",
              "at": "/props/defaultValue",
              "text": "ALL",
              "owner": "SelectLogFiltersControl",
              "slot": null
            },
            {
              "nodeName": "SelectTimeColumnTitle",
              "at": "/text",
              "text": "圈选时间",
              "owner": "SelectTimeColumn",
              "slot": "title"
            },
            {
              "nodeName": "SelectTriggerColumnTitle",
              "at": "/text",
              "text": "触发",
              "owner": "SelectTriggerColumn",
              "slot": "title"
            },
            {
              "nodeName": "SelectStateColumnTitle",
              "at": "/text",
              "text": "状态",
              "owner": "SelectStateColumn",
              "slot": "title"
            },
            {
              "nodeName": "SelectStateBadge",
              "at": "/props/text",
              "text": "{{ row.status }}",
              "owner": "SelectStateBadge",
              "slot": null
            },
            {
              "nodeName": "SelectCountColumnTitle",
              "at": "/text",
              "text": "命中成员数",
              "owner": "SelectCountColumn",
              "slot": "title"
            },
            {
              "nodeName": "SelectReasonColumnTitle",
              "at": "/text",
              "text": "失败原因",
              "owner": "SelectReasonColumn",
              "slot": "title"
            },
            {
              "nodeName": "RefreshLogTabLabel",
              "at": "/text",
              "text": "刷新记录",
              "owner": "RefreshLogTab",
              "slot": "label"
            },
            {
              "nodeName": "RefreshTimeColumnTitle",
              "at": "/text",
              "text": "刷新时间",
              "owner": "RefreshTimeColumn",
              "slot": "title"
            },
            {
              "nodeName": "RefreshTypeColumnTitle",
              "at": "/text",
              "text": "类型",
              "owner": "RefreshTypeColumn",
              "slot": "title"
            },
            {
              "nodeName": "RefreshCountColumnTitle",
              "at": "/text",
              "text": "成员数",
              "owner": "RefreshCountColumn",
              "slot": "title"
            },
            {
              "nodeName": "RefreshStateColumnTitle",
              "at": "/text",
              "text": "状态",
              "owner": "RefreshStateColumn",
              "slot": "title"
            },
            {
              "nodeName": "RefreshStateBadge",
              "at": "/props/text",
              "text": "{{ row.status }}",
              "owner": "RefreshStateBadge",
              "slot": null
            },
            {
              "nodeName": "RefreshReasonColumnTitle",
              "at": "/text",
              "text": "原因",
              "owner": "RefreshReasonColumn",
              "slot": "title"
            },
            {
              "nodeName": "ApplyLogTabLabel",
              "at": "/text",
              "text": "应用记录",
              "owner": "ApplyLogTab",
              "slot": "label"
            },
            {
              "nodeName": "ApplyLogFiltersItem",
              "at": "/props/label",
              "text": "应用类型",
              "owner": "ApplyLogFiltersItem",
              "slot": null
            },
            {
              "nodeName": "ApplyLogFiltersControl",
              "at": "/props/options/0/label",
              "text": "全部",
              "owner": "ApplyLogFiltersControl",
              "slot": null
            },
            {
              "nodeName": "ApplyLogFiltersControl",
              "at": "/props/options/1/label",
              "text": "营销活动",
              "owner": "ApplyLogFiltersControl",
              "slot": null
            },
            {
              "nodeName": "ApplyLogFiltersControl",
              "at": "/props/options/2/label",
              "text": "通知触达",
              "owner": "ApplyLogFiltersControl",
              "slot": null
            },
            {
              "nodeName": "ApplyLogFiltersControl",
              "at": "/props/defaultValue",
              "text": "ALL",
              "owner": "ApplyLogFiltersControl",
              "slot": null
            },
            {
              "nodeName": "ApplyTypeColumnTitle",
              "at": "/text",
              "text": "应用类型",
              "owner": "ApplyTypeColumn",
              "slot": "title"
            },
            {
              "nodeName": "ApplyTargetColumnTitle",
              "at": "/text",
              "text": "目标活动",
              "owner": "ApplyTargetColumn",
              "slot": "title"
            },
            {
              "nodeName": "ApplyStateColumnTitle",
              "at": "/text",
              "text": "状态",
              "owner": "ApplyStateColumn",
              "slot": "title"
            },
            {
              "nodeName": "ApplyStateBadge",
              "at": "/props/text",
              "text": "{{ row.status }}",
              "owner": "ApplyStateBadge",
              "slot": null
            },
            {
              "nodeName": "ApplyOperatorColumnTitle",
              "at": "/text",
              "text": "操作人",
              "owner": "ApplyOperatorColumn",
              "slot": "title"
            },
            {
              "nodeName": "ApplyTimeColumnTitle",
              "at": "/text",
              "text": "时间",
              "owner": "ApplyTimeColumn",
              "slot": "title"
            },
            {
              "nodeName": "ApplyActionsColumnTitle",
              "at": "/text",
              "text": "操作",
              "owner": "ApplyActionsColumn",
              "slot": "title"
            },
            {
              "nodeName": "ApplyRowActions",
              "at": "/props/items/0/label",
              "text": "详情",
              "owner": "ApplyRowActions",
              "slot": null
            },
            {
              "nodeName": "ApplyDrawerTitle",
              "at": "/text",
              "text": "应用详情",
              "owner": "ApplyDetailDrawer",
              "slot": "title"
            },
            {
              "nodeName": "ApplyParamItemLabel",
              "at": "/text",
              "text": "应用参数",
              "owner": "ApplyParamItem",
              "slot": "label"
            },
            {
              "nodeName": "ApplyParamItemText",
              "at": "/text",
              "text": "flow_id=FLOW_v2 · campaign=发券",
              "owner": "ApplyParamItem",
              "slot": "children"
            },
            {
              "nodeName": "ApplyResultItemLabel",
              "at": "/text",
              "text": "返回信息",
              "owner": "ApplyResultItem",
              "slot": "label"
            },
            {
              "nodeName": "ApplyResultItemText",
              "at": "/text",
              "text": "request_no=20260822000031",
              "owner": "ApplyResultItem",
              "slot": "children"
            },
            {
              "nodeName": "ApplyFailItemLabel",
              "at": "/text",
              "text": "失败原因",
              "owner": "ApplyFailItem",
              "slot": "label"
            },
            {
              "nodeName": "ApplyFailItemText",
              "at": "/text",
              "text": "—",
              "owner": "ApplyFailItem",
              "slot": "children"
            }
          ]
        },
        "notChecked": [
          "Natural-language name/source meaning",
          "JS-produced copy and runtime data values",
          "Inherited library defaults; inspect contracts and Preview"
        ]
      },
      {
        "path": "/groups/onetime-create",
        "passed": true,
        "errors": [],
        "inventory": {
          "nodes": [
            {
              "nodeName": "OnetimePage",
              "elementUuid": "I24PtHbV0oEh",
              "tag": "div",
              "owner": null,
              "text": ""
            },
            {
              "nodeName": "AppShell",
              "elementUuid": "mGj04RXmNUwU",
              "tag": "plasmic-component",
              "owner": null,
              "text": "",
              "component": "plasmicoverseasappshell"
            },
            {
              "nodeName": "OnetimeBody",
              "elementUuid": "lWrcP32OCStp",
              "tag": "div",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "CreateSteps",
              "elementUuid": "87aMvYlZRkdz",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6steps"
            },
            {
              "nodeName": "BasicInfoCard",
              "elementUuid": "-rYQ6TRw7ULR",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6card"
            },
            {
              "nodeName": "BasicDescriptions",
              "elementUuid": "PVqgnKolYAX3",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicInfoCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptions"
            },
            {
              "nodeName": "BasicNameItem",
              "elementUuid": "ASZdNymiJGf7",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "BasicNameItemLabel",
              "elementUuid": "2wdxeybfivwh",
              "tag": "span",
              "owner": {
                "nodeName": "BasicNameItem",
                "slot": "label"
              },
              "text": "客群名称"
            },
            {
              "nodeName": "BasicNameItemText",
              "elementUuid": "Y7OCnYsz7ujO",
              "tag": "span",
              "owner": {
                "nodeName": "BasicNameItem",
                "slot": "children"
              },
              "text": "存量促活-7月客群"
            },
            {
              "nodeName": "BasicKeyItem",
              "elementUuid": "pv9OTRQGavGh",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "BasicKeyItemLabel",
              "elementUuid": "XinsPLwHhsib",
              "tag": "span",
              "owner": {
                "nodeName": "BasicKeyItem",
                "slot": "label"
              },
              "text": "客群Key"
            },
            {
              "nodeName": "BasicKeyItemText",
              "elementUuid": "4O3ima9bvlgq",
              "tag": "span",
              "owner": {
                "nodeName": "BasicKeyItem",
                "slot": "children"
              },
              "text": "GRP_ONETIME_CUNLIANG7YUE_20260820"
            },
            {
              "nodeName": "BasicTypeItem",
              "elementUuid": "RTUw2cd5f7Tj",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "BasicTypeItemLabel",
              "elementUuid": "2DA3tY0x_Ax3",
              "tag": "span",
              "owner": {
                "nodeName": "BasicTypeItem",
                "slot": "label"
              },
              "text": "客群类型"
            },
            {
              "nodeName": "BasicTypeItemText",
              "elementUuid": "dVrSMllQuNCm",
              "tag": "span",
              "owner": {
                "nodeName": "BasicTypeItem",
                "slot": "children"
              },
              "text": "一次性"
            },
            {
              "nodeName": "BasicScenarioItem",
              "elementUuid": "AEabrIHF5hc3",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "BasicScenarioItemLabel",
              "elementUuid": "VY9ggqEavvmT",
              "tag": "span",
              "owner": {
                "nodeName": "BasicScenarioItem",
                "slot": "label"
              },
              "text": "业务场景"
            },
            {
              "nodeName": "BasicScenarioItemText",
              "elementUuid": "f1MQ9dypjjlB",
              "tag": "span",
              "owner": {
                "nodeName": "BasicScenarioItem",
                "slot": "children"
              },
              "text": "客经"
            },
            {
              "nodeName": "BasicOwnerItem",
              "elementUuid": "-hLeZPcGAIwv",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "BasicOwnerItemLabel",
              "elementUuid": "6jstprXZtskl",
              "tag": "span",
              "owner": {
                "nodeName": "BasicOwnerItem",
                "slot": "label"
              },
              "text": "负责人"
            },
            {
              "nodeName": "BasicOwnerItemText",
              "elementUuid": "4O50zGbh7WbF",
              "tag": "span",
              "owner": {
                "nodeName": "BasicOwnerItem",
                "slot": "children"
              },
              "text": "傅玮颖"
            },
            {
              "nodeName": "BasicSourceItem",
              "elementUuid": "333iOyrXo6ku",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "BasicSourceItemLabel",
              "elementUuid": "_oKwPChRYFJr",
              "tag": "span",
              "owner": {
                "nodeName": "BasicSourceItem",
                "slot": "label"
              },
              "text": "App来源"
            },
            {
              "nodeName": "BasicSourceItemText",
              "elementUuid": "WlAKSfFTZDKS",
              "tag": "span",
              "owner": {
                "nodeName": "BasicSourceItem",
                "slot": "children"
              },
              "text": "TACO（入口带入）"
            },
            {
              "nodeName": "BasicInfoGap",
              "elementUuid": "ChAJhj_5GYzd",
              "tag": "div",
              "owner": {
                "nodeName": "BasicInfoCard",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "SourceForm",
              "elementUuid": "-D2_YuSf90bZ",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicInfoCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6form"
            },
            {
              "nodeName": "SourceRow",
              "elementUuid": "h6zUgHqlXCDw",
              "tag": "div",
              "owner": {
                "nodeName": "SourceForm",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "SourceItem",
              "elementUuid": "7W2pHE1CSMDO",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SourceForm",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6formitem"
            },
            {
              "nodeName": "SourceItemLabel",
              "elementUuid": "sQoonNMenr6W",
              "tag": "span",
              "owner": {
                "nodeName": "SourceItem",
                "slot": "label"
              },
              "text": "客群来源"
            },
            {
              "nodeName": "SourceRadio",
              "elementUuid": "_GFWav8NmIDo",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SourceItem",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6radiogroup"
            },
            {
              "nodeName": "ExpireItem",
              "elementUuid": "WmirJgJoYY3C",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SourceForm",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6formitem"
            },
            {
              "nodeName": "ExpireItemLabel",
              "elementUuid": "Dj2z6_5wPct_",
              "tag": "span",
              "owner": {
                "nodeName": "ExpireItem",
                "slot": "label"
              },
              "text": "有效期"
            },
            {
              "nodeName": "ExpireInput",
              "elementUuid": "tQkCgfGAOMTh",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "ExpireItem",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6inputnumber"
            },
            {
              "nodeName": "OnetimeSqlCard",
              "elementUuid": "VjrjNU6s7hdZ",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6card"
            },
            {
              "nodeName": "OnetimeSqlActions",
              "elementUuid": "7NsWeDnzgxu0",
              "tag": "div",
              "owner": {
                "nodeName": "OnetimeSqlCard",
                "slot": "extra"
              },
              "text": ""
            },
            {
              "nodeName": "OnetimeFormatButton",
              "elementUuid": "QYJH1gAmLN03",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OnetimeSqlCard",
                "slot": "extra"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": "OnetimeFormatButtonText",
              "elementUuid": "_V085Oh0VwrT",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimeFormatButton",
                "slot": "children"
              },
              "text": "格式化"
            },
            {
              "nodeName": "OnetimeValidateButton",
              "elementUuid": "8cPdsEf6zOtR",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OnetimeSqlCard",
                "slot": "extra"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": "OnetimeValidateButtonText",
              "elementUuid": "6WjCgSFKpHoh",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimeValidateButton",
                "slot": "children"
              },
              "text": "校验"
            },
            {
              "nodeName": "OnetimeSqlBody",
              "elementUuid": "VyS2SWRkb43_",
              "tag": "div",
              "owner": {
                "nodeName": "OnetimeSqlCard",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "OnetimeSqlEditor",
              "elementUuid": "IizOj5QCXdPv",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OnetimeSqlCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6textarea"
            },
            {
              "nodeName": "OnetimeCheckAlert",
              "elementUuid": "4RFCZpWYCk48",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OnetimeSqlCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6alert"
            },
            {
              "nodeName": "OnetimeCheckAlertTitle",
              "elementUuid": "gepgHKC4eqaa",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimeCheckAlert",
                "slot": "title"
              },
              "text": "校验通过"
            },
            {
              "nodeName": "OnetimeHitCount",
              "elementUuid": "DiY2LiFmq_R4",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OnetimeSqlCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6statistic"
            },
            {
              "nodeName": "OnetimeHitCountTitle",
              "elementUuid": "oQyXEHucorrS",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimeHitCount",
                "slot": "title"
              },
              "text": "命中规模"
            },
            {
              "nodeName": "OnetimeHitCountSuffix",
              "elementUuid": "fRsFXN4UQbVV",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimeHitCount",
                "slot": "suffix"
              },
              "text": "人"
            },
            {
              "nodeName": "OnetimePreviewTable",
              "elementUuid": "u9UbJA0FwiWu",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OnetimeSqlCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6table"
            },
            {
              "nodeName": "OnetimeUidColumn",
              "elementUuid": "2RHmSHXvC-5M",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OnetimePreviewTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "OnetimeUidColumnTitle",
              "elementUuid": "w2pdjf1qBLpU",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimeUidColumn",
                "slot": "title"
              },
              "text": "UID"
            },
            {
              "nodeName": "OnetimeRegColumn",
              "elementUuid": "TbByWgYHx4Ii",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OnetimePreviewTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "OnetimeRegColumnTitle",
              "elementUuid": "5NQVdYGbdzMO",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimeRegColumn",
                "slot": "title"
              },
              "text": "注册时间"
            },
            {
              "nodeName": "OnetimeSourceColumn",
              "elementUuid": "qprFH4MfZsSR",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OnetimePreviewTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "OnetimeSourceColumnTitle",
              "elementUuid": "zHg8aKaFX6_x",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimeSourceColumn",
                "slot": "title"
              },
              "text": "App来源"
            },
            {
              "nodeName": "OnetimeFooter",
              "elementUuid": "5i46GtlSs06e",
              "tag": "div",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "OnetimeSubmitButton",
              "elementUuid": "SOl_-gmLBeJd",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": "OnetimeSubmitButtonText",
              "elementUuid": "BK-K5G91SO_z",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimeSubmitButton",
                "slot": "children"
              },
              "text": "提交"
            },
            {
              "nodeName": "OnetimeSaveSqlButton",
              "elementUuid": "6rG7c_oy5JLR",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": "OnetimeSaveSqlButtonText",
              "elementUuid": "lXOJtajl3wut",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimeSaveSqlButton",
                "slot": "children"
              },
              "text": "保存 SQL"
            },
            {
              "nodeName": "OnetimeOnlineButton",
              "elementUuid": "HV0TscbzmXJ2",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": "OnetimeOnlineButtonText",
              "elementUuid": "ZMEwIgS2Xu_h",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimeOnlineButton",
                "slot": "children"
              },
              "text": "上线"
            },
            {
              "nodeName": "OnetimeCancelButton",
              "elementUuid": "9YZAMv2ArVfx",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": "OnetimeCancelButtonText",
              "elementUuid": "-_ZmtLI7jBQH",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimeCancelButton",
                "slot": "children"
              },
              "text": "取消"
            },
            {
              "nodeName": "OnetimePreflightModal",
              "elementUuid": "d6hZT0CyP0ik",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6modal"
            },
            {
              "nodeName": "OnetimePreflightTitle",
              "elementUuid": "ZToYkr23smBz",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimePreflightModal",
                "slot": "title"
              },
              "text": "预跑结果"
            },
            {
              "nodeName": "OnetimePreflightRunning",
              "elementUuid": "LDDw_u_0ZnmA",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OnetimePreflightModal",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6alert"
            },
            {
              "nodeName": "OnetimePreflightRunningTitle",
              "elementUuid": "Kx2OlGBSIJyA",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimePreflightRunning",
                "slot": "title"
              },
              "text": "预跑进行中，请稍候"
            },
            {
              "nodeName": "OnetimePreflightSuccess",
              "elementUuid": "A49OHBXK0pnh",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OnetimePreflightModal",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6alert"
            },
            {
              "nodeName": "OnetimePreflightSuccessTitle",
              "elementUuid": "XJG2UFFpvR3H",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimePreflightSuccess",
                "slot": "title"
              },
              "text": "预跑成功 · 命中规模 12,340 人"
            },
            {
              "nodeName": "OnetimePreflightFailed",
              "elementUuid": "9-gtMH2nW6U4",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "OnetimePreflightModal",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6alert"
            },
            {
              "nodeName": "OnetimePreflightFailedTitle",
              "elementUuid": "yf5Ezjm-SfB0",
              "tag": "span",
              "owner": {
                "nodeName": "OnetimePreflightFailed",
                "slot": "title"
              },
              "text": "预跑失败：底表分区缺失"
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
              "nodeName": "CreateSteps",
              "at": "/props/items/0/title",
              "text": "填写SQL校验",
              "owner": "CreateSteps",
              "slot": null
            },
            {
              "nodeName": "CreateSteps",
              "at": "/props/items/1/title",
              "text": "提交自动预跑",
              "owner": "CreateSteps",
              "slot": null
            },
            {
              "nodeName": "CreateSteps",
              "at": "/props/items/2/title",
              "text": "保存SQL",
              "owner": "CreateSteps",
              "slot": null
            },
            {
              "nodeName": "CreateSteps",
              "at": "/props/items/3/title",
              "text": "上线圈选",
              "owner": "CreateSteps",
              "slot": null
            },
            {
              "nodeName": "CreateSteps",
              "at": "/props/items/4/title",
              "text": "启用生效",
              "owner": "CreateSteps",
              "slot": null
            },
            {
              "nodeName": "BasicNameItemLabel",
              "at": "/text",
              "text": "客群名称",
              "owner": "BasicNameItem",
              "slot": "label"
            },
            {
              "nodeName": "BasicNameItemText",
              "at": "/text",
              "text": "存量促活-7月客群",
              "owner": "BasicNameItem",
              "slot": "children"
            },
            {
              "nodeName": "BasicKeyItemLabel",
              "at": "/text",
              "text": "客群Key",
              "owner": "BasicKeyItem",
              "slot": "label"
            },
            {
              "nodeName": "BasicKeyItemText",
              "at": "/text",
              "text": "GRP_ONETIME_CUNLIANG7YUE_20260820",
              "owner": "BasicKeyItem",
              "slot": "children"
            },
            {
              "nodeName": "BasicTypeItemLabel",
              "at": "/text",
              "text": "客群类型",
              "owner": "BasicTypeItem",
              "slot": "label"
            },
            {
              "nodeName": "BasicTypeItemText",
              "at": "/text",
              "text": "一次性",
              "owner": "BasicTypeItem",
              "slot": "children"
            },
            {
              "nodeName": "BasicScenarioItemLabel",
              "at": "/text",
              "text": "业务场景",
              "owner": "BasicScenarioItem",
              "slot": "label"
            },
            {
              "nodeName": "BasicScenarioItemText",
              "at": "/text",
              "text": "客经",
              "owner": "BasicScenarioItem",
              "slot": "children"
            },
            {
              "nodeName": "BasicOwnerItemLabel",
              "at": "/text",
              "text": "负责人",
              "owner": "BasicOwnerItem",
              "slot": "label"
            },
            {
              "nodeName": "BasicOwnerItemText",
              "at": "/text",
              "text": "傅玮颖",
              "owner": "BasicOwnerItem",
              "slot": "children"
            },
            {
              "nodeName": "BasicSourceItemLabel",
              "at": "/text",
              "text": "App来源",
              "owner": "BasicSourceItem",
              "slot": "label"
            },
            {
              "nodeName": "BasicSourceItemText",
              "at": "/text",
              "text": "TACO（入口带入）",
              "owner": "BasicSourceItem",
              "slot": "children"
            },
            {
              "nodeName": "SourceItemLabel",
              "at": "/text",
              "text": "客群来源",
              "owner": "SourceItem",
              "slot": "label"
            },
            {
              "nodeName": "SourceRadio",
              "at": "/props/options/0/label",
              "text": "写SQL",
              "owner": "SourceRadio",
              "slot": null
            },
            {
              "nodeName": "ExpireItem",
              "at": "/props/rules/0/message",
              "text": "请输入有效期天数",
              "owner": "ExpireItem",
              "slot": null
            },
            {
              "nodeName": "ExpireItemLabel",
              "at": "/text",
              "text": "有效期",
              "owner": "ExpireItem",
              "slot": "label"
            },
            {
              "nodeName": "OnetimeFormatButtonText",
              "at": "/text",
              "text": "格式化",
              "owner": "OnetimeFormatButton",
              "slot": "children"
            },
            {
              "nodeName": "OnetimeValidateButtonText",
              "at": "/text",
              "text": "校验",
              "owner": "OnetimeValidateButton",
              "slot": "children"
            },
            {
              "nodeName": "OnetimeSqlEditor",
              "at": "/props/value",
              "text": "{{ $state.sqlText }}",
              "owner": "OnetimeSqlEditor",
              "slot": null
            },
            {
              "nodeName": "OnetimeSqlEditor",
              "at": "/props/placeholder",
              "text": "请输入只读 SELECT 语句",
              "owner": "OnetimeSqlEditor",
              "slot": null
            },
            {
              "nodeName": "OnetimeCheckAlertTitle",
              "at": "/text",
              "text": "校验通过",
              "owner": "OnetimeCheckAlert",
              "slot": "title"
            },
            {
              "nodeName": "OnetimeHitCount",
              "at": "/props/value",
              "text": "{{ $state.hitCount }}",
              "owner": "OnetimeHitCount",
              "slot": null
            },
            {
              "nodeName": "OnetimeHitCountTitle",
              "at": "/text",
              "text": "命中规模",
              "owner": "OnetimeHitCount",
              "slot": "title"
            },
            {
              "nodeName": "OnetimeHitCountSuffix",
              "at": "/text",
              "text": "人",
              "owner": "OnetimeHitCount",
              "slot": "suffix"
            },
            {
              "nodeName": "OnetimeUidColumnTitle",
              "at": "/text",
              "text": "UID",
              "owner": "OnetimeUidColumn",
              "slot": "title"
            },
            {
              "nodeName": "OnetimeRegColumnTitle",
              "at": "/text",
              "text": "注册时间",
              "owner": "OnetimeRegColumn",
              "slot": "title"
            },
            {
              "nodeName": "OnetimeSourceColumnTitle",
              "at": "/text",
              "text": "App来源",
              "owner": "OnetimeSourceColumn",
              "slot": "title"
            },
            {
              "nodeName": "OnetimeSubmitButtonText",
              "at": "/text",
              "text": "提交",
              "owner": "OnetimeSubmitButton",
              "slot": "children"
            },
            {
              "nodeName": "OnetimeSaveSqlButtonText",
              "at": "/text",
              "text": "保存 SQL",
              "owner": "OnetimeSaveSqlButton",
              "slot": "children"
            },
            {
              "nodeName": "OnetimeOnlineButtonText",
              "at": "/text",
              "text": "上线",
              "owner": "OnetimeOnlineButton",
              "slot": "children"
            },
            {
              "nodeName": "OnetimeCancelButtonText",
              "at": "/text",
              "text": "取消",
              "owner": "OnetimeCancelButton",
              "slot": "children"
            },
            {
              "nodeName": "OnetimePreflightTitle",
              "at": "/text",
              "text": "预跑结果",
              "owner": "OnetimePreflightModal",
              "slot": "title"
            },
            {
              "nodeName": "OnetimePreflightRunningTitle",
              "at": "/text",
              "text": "预跑进行中，请稍候",
              "owner": "OnetimePreflightRunning",
              "slot": "title"
            },
            {
              "nodeName": "OnetimePreflightSuccessTitle",
              "at": "/text",
              "text": "预跑成功 · 命中规模 12,340 人",
              "owner": "OnetimePreflightSuccess",
              "slot": "title"
            },
            {
              "nodeName": "OnetimePreflightFailedTitle",
              "at": "/text",
              "text": "预跑失败：底表分区缺失",
              "owner": "OnetimePreflightFailed",
              "slot": "title"
            }
          ]
        },
        "notChecked": [
          "Natural-language name/source meaning",
          "JS-produced copy and runtime data values",
          "Inherited library defaults; inspect contracts and Preview"
        ]
      },
      {
        "path": "/groups/selector",
        "passed": true,
        "errors": [],
        "inventory": {
          "nodes": [
            {
              "nodeName": "SelectorPage",
              "elementUuid": "FcnEDvDKoMDi",
              "tag": "div",
              "owner": null,
              "text": ""
            },
            {
              "nodeName": "AppShell",
              "elementUuid": "NJATYyRzkI_k",
              "tag": "plasmic-component",
              "owner": null,
              "text": "",
              "component": "plasmicoverseasappshell"
            },
            {
              "nodeName": "SelectorBody",
              "elementUuid": "FTnN0yWhXfhy",
              "tag": "div",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "BasicInfoCard",
              "elementUuid": "_OAAMRoUlV-L",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6card"
            },
            {
              "nodeName": "BasicForm",
              "elementUuid": "7m2TWSJVSEUB",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicInfoCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6form"
            },
            {
              "nodeName": "BasicRowMain",
              "elementUuid": "0X9sQLmgk0Ye",
              "tag": "div",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "NameItem",
              "elementUuid": "IxJtZ1rPOPIK",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6formitem"
            },
            {
              "nodeName": "NameItemLabel",
              "elementUuid": "3itu8PJANOCy",
              "tag": "span",
              "owner": {
                "nodeName": "NameItem",
                "slot": "label"
              },
              "text": "客群名称"
            },
            {
              "nodeName": "NameInput",
              "elementUuid": "Jd-m9__XzPoP",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "NameItem",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6input"
            },
            {
              "nodeName": "RetentionItem",
              "elementUuid": "sZNEYv7q-vDa",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6formitem"
            },
            {
              "nodeName": "RetentionItemLabel",
              "elementUuid": "uF_Cl0qoTLL6",
              "tag": "span",
              "owner": {
                "nodeName": "RetentionItem",
                "slot": "label"
              },
              "text": "数据保存天数"
            },
            {
              "nodeName": "RetentionSelect",
              "elementUuid": "Rs1k5JmzFoiq",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "RetentionItem",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6select"
            },
            {
              "nodeName": "DeadlineItem",
              "elementUuid": "LXnAng1rFMKV",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6formitem"
            },
            {
              "nodeName": "DeadlineItemLabel",
              "elementUuid": "UzO3_GFWtCVL",
              "tag": "span",
              "owner": {
                "nodeName": "DeadlineItem",
                "slot": "label"
              },
              "text": "产出截止时间"
            },
            {
              "nodeName": "DeadlineTime",
              "elementUuid": "u-aWi0twfwmd",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "DeadlineItem",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6timepicker"
            },
            {
              "nodeName": "BasicRowMode",
              "elementUuid": "1VjyfvsxEbMO",
              "tag": "div",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "RefreshItem",
              "elementUuid": "GTfu_6QNtNn-",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6formitem"
            },
            {
              "nodeName": "RefreshItemLabel",
              "elementUuid": "aMWcxnLNn5lE",
              "tag": "span",
              "owner": {
                "nodeName": "RefreshItem",
                "slot": "label"
              },
              "text": "刷新模式"
            },
            {
              "nodeName": "RefreshSelect",
              "elementUuid": "C2Q7yzhDO2k1",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "RefreshItem",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6select"
            },
            {
              "nodeName": "TypeItem",
              "elementUuid": "Vyq-oWdZ9KAg",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6formitem"
            },
            {
              "nodeName": "TypeItemLabel",
              "elementUuid": "tshMkPvg50iQ",
              "tag": "span",
              "owner": {
                "nodeName": "TypeItem",
                "slot": "label"
              },
              "text": "客群类型"
            },
            {
              "nodeName": "TypeInput",
              "elementUuid": "FJOr-UdrpDTD",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "TypeItem",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6input"
            },
            {
              "nodeName": "SqlCard",
              "elementUuid": "JHicDolnEeXG",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6card"
            },
            {
              "nodeName": "SqlCardActions",
              "elementUuid": "X8dwfIWE9Qxo",
              "tag": "div",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "extra"
              },
              "text": ""
            },
            {
              "nodeName": "FormatButton",
              "elementUuid": "jv8opusj7uSl",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "extra"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": "FormatButtonText",
              "elementUuid": "WX72gZHLvvsA",
              "tag": "span",
              "owner": {
                "nodeName": "FormatButton",
                "slot": "children"
              },
              "text": "格式化"
            },
            {
              "nodeName": "ValidateButton",
              "elementUuid": "LyqdIbpQGV0W",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "extra"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": "ValidateButtonText",
              "elementUuid": "wy9DL0CidmoT",
              "tag": "span",
              "owner": {
                "nodeName": "ValidateButton",
                "slot": "children"
              },
              "text": "校验"
            },
            {
              "nodeName": "SqlCardBody",
              "elementUuid": "h8POLpKAzjIP",
              "tag": "div",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "SqlEditor",
              "elementUuid": "3QIs63yFUZF1",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6textarea"
            },
            {
              "nodeName": "CheckAlert",
              "elementUuid": "dDsfBjhpXyTp",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6alert"
            },
            {
              "nodeName": "CheckAlertTitle",
              "elementUuid": "t7ECUqIkAYMY",
              "tag": "span",
              "owner": {
                "nodeName": "CheckAlert",
                "slot": "title"
              },
              "text": "校验通过"
            },
            {
              "nodeName": "CheckDescriptions",
              "elementUuid": "P2DAK2461ubQ",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptions"
            },
            {
              "nodeName": "CheckSyntaxItem",
              "elementUuid": "nB53GhzXo4-t",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CheckDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "CheckSyntaxItemLabel",
              "elementUuid": "yLeYczPtA3ZL",
              "tag": "span",
              "owner": {
                "nodeName": "CheckSyntaxItem",
                "slot": "label"
              },
              "text": "语句合法性"
            },
            {
              "nodeName": "CheckSyntaxItemText",
              "elementUuid": "mzy4pg64nb46",
              "tag": "span",
              "owner": {
                "nodeName": "CheckSyntaxItem",
                "slot": "children"
              },
              "text": "仅 SELECT"
            },
            {
              "nodeName": "CheckSourceItem",
              "elementUuid": "O9COtS8XUGlQ",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CheckDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "CheckSourceItemLabel",
              "elementUuid": "sIBSXOSdvOB4",
              "tag": "span",
              "owner": {
                "nodeName": "CheckSourceItem",
                "slot": "label"
              },
              "text": "底表"
            },
            {
              "nodeName": "CheckSourceItemText",
              "elementUuid": "pqt09Jm0DqGc",
              "tag": "span",
              "owner": {
                "nodeName": "CheckSourceItem",
                "slot": "children"
              },
              "text": "dwt/cdm"
            },
            {
              "nodeName": "CheckRoleItem",
              "elementUuid": "3800h7n9InnM",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CheckDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "CheckRoleItemLabel",
              "elementUuid": "a2bFFs9D32Iz",
              "tag": "span",
              "owner": {
                "nodeName": "CheckRoleItem",
                "slot": "label"
              },
              "text": "权限"
            },
            {
              "nodeName": "CheckRoleItemText",
              "elementUuid": "U2bzXr2xY2RY",
              "tag": "span",
              "owner": {
                "nodeName": "CheckRoleItem",
                "slot": "children"
              },
              "text": "运营及以上"
            },
            {
              "nodeName": "CheckColumnItem",
              "elementUuid": "eCXM5XIcIHFB",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CheckDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "CheckColumnItemLabel",
              "elementUuid": "KszgwKSYPoey",
              "tag": "span",
              "owner": {
                "nodeName": "CheckColumnItem",
                "slot": "label"
              },
              "text": "结果字段"
            },
            {
              "nodeName": "CheckColumnItemText",
              "elementUuid": "xWskazsWW0Mr",
              "tag": "span",
              "owner": {
                "nodeName": "CheckColumnItem",
                "slot": "children"
              },
              "text": "uid+app_source"
            },
            {
              "nodeName": "CheckFilterItem",
              "elementUuid": "WI9cxtGISwA4",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CheckDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": "CheckFilterItemLabel",
              "elementUuid": "Npmkwq4k-FFd",
              "tag": "span",
              "owner": {
                "nodeName": "CheckFilterItem",
                "slot": "label"
              },
              "text": "结尾过滤"
            },
            {
              "nodeName": "CheckFilterItemText",
              "elementUuid": "GI2MYt5E4gJX",
              "tag": "span",
              "owner": {
                "nodeName": "CheckFilterItem",
                "slot": "children"
              },
              "text": "app_source"
            },
            {
              "nodeName": "HitCountStatistic",
              "elementUuid": "1JV16FcmNH8E",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6statistic"
            },
            {
              "nodeName": "HitCountStatisticTitle",
              "elementUuid": "jdpFjvcZlXdi",
              "tag": "span",
              "owner": {
                "nodeName": "HitCountStatistic",
                "slot": "title"
              },
              "text": "命中规模"
            },
            {
              "nodeName": "HitCountStatisticSuffix",
              "elementUuid": "hodB03LZ1iBD",
              "tag": "span",
              "owner": {
                "nodeName": "HitCountStatistic",
                "slot": "suffix"
              },
              "text": "人"
            },
            {
              "nodeName": "PreviewTable",
              "elementUuid": "q29c_hsvpDi7",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6table"
            },
            {
              "nodeName": "SampleUidColumn",
              "elementUuid": "fDZt8dQn8H3A",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreviewTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "SampleUidColumnTitle",
              "elementUuid": "XSIj38mtJQTH",
              "tag": "span",
              "owner": {
                "nodeName": "SampleUidColumn",
                "slot": "title"
              },
              "text": "UID"
            },
            {
              "nodeName": "SampleRegColumn",
              "elementUuid": "0nHJ6fGeMnzX",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreviewTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "SampleRegColumnTitle",
              "elementUuid": "Agg9q6yAwpSm",
              "tag": "span",
              "owner": {
                "nodeName": "SampleRegColumn",
                "slot": "title"
              },
              "text": "注册时间"
            },
            {
              "nodeName": "SampleSourceColumn",
              "elementUuid": "glFLHuDWWXBj",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreviewTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "SampleSourceColumnTitle",
              "elementUuid": "PdVxjozVMeR1",
              "tag": "span",
              "owner": {
                "nodeName": "SampleSourceColumn",
                "slot": "title"
              },
              "text": "App来源"
            },
            {
              "nodeName": "SampleCreditColumn",
              "elementUuid": "4ivIhXyg2YCv",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreviewTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "SampleCreditColumnTitle",
              "elementUuid": "BfrW_cj83mt4",
              "tag": "span",
              "owner": {
                "nodeName": "SampleCreditColumn",
                "slot": "title"
              },
              "text": "授信状态"
            },
            {
              "nodeName": "SampleCreditBadge",
              "elementUuid": "kivwgCBiDjhG",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SampleCreditColumn",
                "slot": "render"
              },
              "text": "",
              "component": "plasmicantd6badge"
            },
            {
              "nodeName": "SampleLoanColumn",
              "elementUuid": "b7ycfCEHKBeK",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreviewTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": "SampleLoanColumnTitle",
              "elementUuid": "HM9RECTudVvR",
              "tag": "span",
              "owner": {
                "nodeName": "SampleLoanColumn",
                "slot": "title"
              },
              "text": "借据状态"
            },
            {
              "nodeName": "SampleLoanBadge",
              "elementUuid": "mlx_sdxynldu",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SampleLoanColumn",
                "slot": "render"
              },
              "text": "",
              "component": "plasmicantd6badge"
            },
            {
              "nodeName": "SelectorFooter",
              "elementUuid": "3tquHIisD1hf",
              "tag": "div",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "SubmitButton",
              "elementUuid": "8FRpl3RRMUhG",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": "SubmitButtonText",
              "elementUuid": "cez-6kMjqEhY",
              "tag": "span",
              "owner": {
                "nodeName": "SubmitButton",
                "slot": "children"
              },
              "text": "提交"
            },
            {
              "nodeName": "SaveSqlButton",
              "elementUuid": "cAsaD1xVKdmG",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": "SaveSqlButtonText",
              "elementUuid": "cAuTRRfoLlm5",
              "tag": "span",
              "owner": {
                "nodeName": "SaveSqlButton",
                "slot": "children"
              },
              "text": "保存 SQL"
            },
            {
              "nodeName": "OnlineButton",
              "elementUuid": "PvdYVg_5b-d7",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": "OnlineButtonText",
              "elementUuid": "qxeznVB5nnZJ",
              "tag": "span",
              "owner": {
                "nodeName": "OnlineButton",
                "slot": "children"
              },
              "text": "上线"
            },
            {
              "nodeName": "CancelButton",
              "elementUuid": "ke9jsR1O_AL5",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": "CancelButtonText",
              "elementUuid": "im27CR5-Z7xx",
              "tag": "span",
              "owner": {
                "nodeName": "CancelButton",
                "slot": "children"
              },
              "text": "取消"
            },
            {
              "nodeName": "PreflightModal",
              "elementUuid": "E9zSliOX2PE6",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6modal"
            },
            {
              "nodeName": "PreflightTitle",
              "elementUuid": "oHOxRgtuyrkG",
              "tag": "span",
              "owner": {
                "nodeName": "PreflightModal",
                "slot": "title"
              },
              "text": "预跑结果"
            },
            {
              "nodeName": "PreflightRunning",
              "elementUuid": "V9fPs8DnBcZA",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreflightModal",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6alert"
            },
            {
              "nodeName": "PreflightRunningTitle",
              "elementUuid": "YLYBrWHg52_i",
              "tag": "span",
              "owner": {
                "nodeName": "PreflightRunning",
                "slot": "title"
              },
              "text": "预跑进行中，请稍候"
            },
            {
              "nodeName": "PreflightSuccessAlert",
              "elementUuid": "G1ghD5h-wjz8",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreflightModal",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6alert"
            },
            {
              "nodeName": "PreflightSuccessAlertTitle",
              "elementUuid": "krIT2Eq0-iH5",
              "tag": "span",
              "owner": {
                "nodeName": "PreflightSuccessAlert",
                "slot": "title"
              },
              "text": "预跑成功 · 命中规模 12,340 人"
            },
            {
              "nodeName": "PreflightFailedAlert",
              "elementUuid": "jf_YA7p2Qb2E",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreflightModal",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6alert"
            },
            {
              "nodeName": "PreflightFailedAlertTitle",
              "elementUuid": "wgDM6lnc-bcV",
              "tag": "span",
              "owner": {
                "nodeName": "PreflightFailedAlert",
                "slot": "title"
              },
              "text": "预跑失败：底表分区缺失"
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
              "nodeName": "NameItem",
              "at": "/props/rules/0/message",
              "text": "请输入客群名称",
              "owner": "NameItem",
              "slot": null
            },
            {
              "nodeName": "NameItemLabel",
              "at": "/text",
              "text": "客群名称",
              "owner": "NameItem",
              "slot": "label"
            },
            {
              "nodeName": "NameInput",
              "at": "/props/placeholder",
              "text": "请输入客群名称",
              "owner": "NameInput",
              "slot": null
            },
            {
              "nodeName": "RetentionItemLabel",
              "at": "/text",
              "text": "数据保存天数",
              "owner": "RetentionItem",
              "slot": "label"
            },
            {
              "nodeName": "RetentionSelect",
              "at": "/props/options/0/label",
              "text": "3 天",
              "owner": "RetentionSelect",
              "slot": null
            },
            {
              "nodeName": "RetentionSelect",
              "at": "/props/options/1/label",
              "text": "7 天",
              "owner": "RetentionSelect",
              "slot": null
            },
            {
              "nodeName": "RetentionSelect",
              "at": "/props/options/2/label",
              "text": "30 天",
              "owner": "RetentionSelect",
              "slot": null
            },
            {
              "nodeName": "RetentionSelect",
              "at": "/props/options/3/label",
              "text": "60 天",
              "owner": "RetentionSelect",
              "slot": null
            },
            {
              "nodeName": "RetentionSelect",
              "at": "/props/options/4/label",
              "text": "180 天",
              "owner": "RetentionSelect",
              "slot": null
            },
            {
              "nodeName": "RetentionSelect",
              "at": "/props/options/5/label",
              "text": "长期",
              "owner": "RetentionSelect",
              "slot": null
            },
            {
              "nodeName": "DeadlineItem",
              "at": "/props/rules/0/message",
              "text": "请选择产出截止时间",
              "owner": "DeadlineItem",
              "slot": null
            },
            {
              "nodeName": "DeadlineItemLabel",
              "at": "/text",
              "text": "产出截止时间",
              "owner": "DeadlineItem",
              "slot": "label"
            },
            {
              "nodeName": "RefreshItemLabel",
              "at": "/text",
              "text": "刷新模式",
              "owner": "RefreshItem",
              "slot": "label"
            },
            {
              "nodeName": "RefreshSelect",
              "at": "/props/options/0/label",
              "text": "T+1 动态",
              "owner": "RefreshSelect",
              "slot": null
            },
            {
              "nodeName": "TypeItemLabel",
              "at": "/text",
              "text": "客群类型",
              "owner": "TypeItem",
              "slot": "label"
            },
            {
              "nodeName": "FormatButtonText",
              "at": "/text",
              "text": "格式化",
              "owner": "FormatButton",
              "slot": "children"
            },
            {
              "nodeName": "ValidateButtonText",
              "at": "/text",
              "text": "校验",
              "owner": "ValidateButton",
              "slot": "children"
            },
            {
              "nodeName": "SqlEditor",
              "at": "/props/value",
              "text": "{{ $state.sqlText }}",
              "owner": "SqlEditor",
              "slot": null
            },
            {
              "nodeName": "SqlEditor",
              "at": "/props/placeholder",
              "text": "请输入只读 SELECT 语句",
              "owner": "SqlEditor",
              "slot": null
            },
            {
              "nodeName": "CheckAlertTitle",
              "at": "/text",
              "text": "校验通过",
              "owner": "CheckAlert",
              "slot": "title"
            },
            {
              "nodeName": "CheckSyntaxItemLabel",
              "at": "/text",
              "text": "语句合法性",
              "owner": "CheckSyntaxItem",
              "slot": "label"
            },
            {
              "nodeName": "CheckSyntaxItemText",
              "at": "/text",
              "text": "仅 SELECT",
              "owner": "CheckSyntaxItem",
              "slot": "children"
            },
            {
              "nodeName": "CheckSourceItemLabel",
              "at": "/text",
              "text": "底表",
              "owner": "CheckSourceItem",
              "slot": "label"
            },
            {
              "nodeName": "CheckSourceItemText",
              "at": "/text",
              "text": "dwt/cdm",
              "owner": "CheckSourceItem",
              "slot": "children"
            },
            {
              "nodeName": "CheckRoleItemLabel",
              "at": "/text",
              "text": "权限",
              "owner": "CheckRoleItem",
              "slot": "label"
            },
            {
              "nodeName": "CheckRoleItemText",
              "at": "/text",
              "text": "运营及以上",
              "owner": "CheckRoleItem",
              "slot": "children"
            },
            {
              "nodeName": "CheckColumnItemLabel",
              "at": "/text",
              "text": "结果字段",
              "owner": "CheckColumnItem",
              "slot": "label"
            },
            {
              "nodeName": "CheckColumnItemText",
              "at": "/text",
              "text": "uid+app_source",
              "owner": "CheckColumnItem",
              "slot": "children"
            },
            {
              "nodeName": "CheckFilterItemLabel",
              "at": "/text",
              "text": "结尾过滤",
              "owner": "CheckFilterItem",
              "slot": "label"
            },
            {
              "nodeName": "CheckFilterItemText",
              "at": "/text",
              "text": "app_source",
              "owner": "CheckFilterItem",
              "slot": "children"
            },
            {
              "nodeName": "HitCountStatistic",
              "at": "/props/value",
              "text": "{{ $state.hitCount }}",
              "owner": "HitCountStatistic",
              "slot": null
            },
            {
              "nodeName": "HitCountStatisticTitle",
              "at": "/text",
              "text": "命中规模",
              "owner": "HitCountStatistic",
              "slot": "title"
            },
            {
              "nodeName": "HitCountStatisticSuffix",
              "at": "/text",
              "text": "人",
              "owner": "HitCountStatistic",
              "slot": "suffix"
            },
            {
              "nodeName": "SampleUidColumnTitle",
              "at": "/text",
              "text": "UID",
              "owner": "SampleUidColumn",
              "slot": "title"
            },
            {
              "nodeName": "SampleRegColumnTitle",
              "at": "/text",
              "text": "注册时间",
              "owner": "SampleRegColumn",
              "slot": "title"
            },
            {
              "nodeName": "SampleSourceColumnTitle",
              "at": "/text",
              "text": "App来源",
              "owner": "SampleSourceColumn",
              "slot": "title"
            },
            {
              "nodeName": "SampleCreditColumnTitle",
              "at": "/text",
              "text": "授信状态",
              "owner": "SampleCreditColumn",
              "slot": "title"
            },
            {
              "nodeName": "SampleCreditBadge",
              "at": "/props/text",
              "text": "{{ row.creditStatus }}",
              "owner": "SampleCreditBadge",
              "slot": null
            },
            {
              "nodeName": "SampleLoanColumnTitle",
              "at": "/text",
              "text": "借据状态",
              "owner": "SampleLoanColumn",
              "slot": "title"
            },
            {
              "nodeName": "SampleLoanBadge",
              "at": "/props/text",
              "text": "{{ row.loanStatus }}",
              "owner": "SampleLoanBadge",
              "slot": null
            },
            {
              "nodeName": "SubmitButtonText",
              "at": "/text",
              "text": "提交",
              "owner": "SubmitButton",
              "slot": "children"
            },
            {
              "nodeName": "SaveSqlButtonText",
              "at": "/text",
              "text": "保存 SQL",
              "owner": "SaveSqlButton",
              "slot": "children"
            },
            {
              "nodeName": "OnlineButtonText",
              "at": "/text",
              "text": "上线",
              "owner": "OnlineButton",
              "slot": "children"
            },
            {
              "nodeName": "CancelButtonText",
              "at": "/text",
              "text": "取消",
              "owner": "CancelButton",
              "slot": "children"
            },
            {
              "nodeName": "PreflightTitle",
              "at": "/text",
              "text": "预跑结果",
              "owner": "PreflightModal",
              "slot": "title"
            },
            {
              "nodeName": "PreflightRunningTitle",
              "at": "/text",
              "text": "预跑进行中，请稍候",
              "owner": "PreflightRunning",
              "slot": "title"
            },
            {
              "nodeName": "PreflightSuccessAlertTitle",
              "at": "/text",
              "text": "预跑成功 · 命中规模 12,340 人",
              "owner": "PreflightSuccessAlert",
              "slot": "title"
            },
            {
              "nodeName": "PreflightFailedAlertTitle",
              "at": "/text",
              "text": "预跑失败：底表分区缺失",
              "owner": "PreflightFailedAlert",
              "slot": "title"
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

## forms: passed

```json
{
  "passed": true,
  "checkedFields": 7,
  "errors": []
}
```

## descriptions: passed

```json
{
  "passed": true,
  "errors": []
}
```

## overlays: passed

```json
{
  "passed": true,
  "errors": []
}
```

## slots: passed

```json
{
  "passed": true,
  "pages": [
    {
      "componentUuid": "eYMR4owU-V6_",
      "path": "/groups",
      "intentErrors": [],
      "duplicateComponents": [],
      "duplicateSlots": [],
      "missingComponents": [],
      "wrongComponents": [],
      "wrongSlotOwners": [],
      "emptyCards": [],
      "cardContentOutsideSlot": [],
      "wrongCardPadding": [],
      "tabsCardPolicy": [],
      "cardActionPlacement": [],
      "overlayCloseSlot": [],
      "unprovidedSlotChildren": [],
      "passed": true
    },
    {
      "componentUuid": "YW4MQIakrQnt",
      "path": "/groups/selector",
      "intentErrors": [],
      "duplicateComponents": [],
      "duplicateSlots": [],
      "missingComponents": [],
      "wrongComponents": [],
      "wrongSlotOwners": [],
      "emptyCards": [],
      "cardContentOutsideSlot": [],
      "wrongCardPadding": [],
      "tabsCardPolicy": [],
      "cardActionPlacement": [],
      "overlayCloseSlot": [],
      "unprovidedSlotChildren": [],
      "passed": true
    },
    {
      "componentUuid": "cVcKW-ucQxXU",
      "path": "/groups/onetime-create",
      "intentErrors": [],
      "duplicateComponents": [],
      "duplicateSlots": [],
      "missingComponents": [],
      "wrongComponents": [],
      "wrongSlotOwners": [],
      "emptyCards": [],
      "cardContentOutsideSlot": [],
      "wrongCardPadding": [],
      "tabsCardPolicy": [],
      "cardActionPlacement": [],
      "overlayCloseSlot": [],
      "unprovidedSlotChildren": [],
      "passed": true
    },
    {
      "componentUuid": "NisuOsxUy7dG",
      "path": "/groups/detail",
      "intentErrors": [],
      "duplicateComponents": [],
      "duplicateSlots": [],
      "missingComponents": [],
      "wrongComponents": [],
      "wrongSlotOwners": [],
      "emptyCards": [],
      "cardContentOutsideSlot": [],
      "wrongCardPadding": [],
      "tabsCardPolicy": [],
      "cardActionPlacement": [],
      "overlayCloseSlot": [],
      "unprovidedSlotChildren": [],
      "passed": true
    }
  ]
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
    },
    {
      "componentUuid": "YW4MQIakrQnt",
      "path": "/groups/selector",
      "passed": true,
      "frameUuid": "Udt1lrJAKU6t",
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
    },
    {
      "componentUuid": "cVcKW-ucQxXU",
      "path": "/groups/onetime-create",
      "passed": true,
      "frameUuid": "EkZRUyoxOsf-",
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
    },
    {
      "componentUuid": "NisuOsxUy7dG",
      "path": "/groups/detail",
      "passed": true,
      "frameUuid": "iEgb_79mxPZh",
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
