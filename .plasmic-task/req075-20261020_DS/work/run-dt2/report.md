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
  "collectedAt": "2026-10-25T03:59:13.684863+00:00",
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
    "pages.json": "6b45e28426118df261eee6e5d68a28954a7dfca5824fcee1bafd76da747da7da",
    "layouts.json": "9f9bfdf132b6964a85598e654fc352840d5257eb400d57b67dc59f63b99ce0d3"
  },
  "validation": {
    "componentUuids": [
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
      "pages": 1,
      "components": 1
    }
  },
  "pagePath": "/groups/detail"
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
        "path": "/groups/detail",
        "passed": true,
        "errors": [],
        "sources": [],
        "status": "not_applicable",
        "reason": "The catalog has no tabbed record-detail composition (RecordDetailPage is a single summary plus related table without Tab-scoped tables), so the page composes registered Card/Descriptions/Tabs/Table/Drawer directly.",
        "notChecked": [
          "correctness of the no-template-fit decision"
        ]
      }
    ],
    "content": [
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
  "checkedFields": 0,
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
