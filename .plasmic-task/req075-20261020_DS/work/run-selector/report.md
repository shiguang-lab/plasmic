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
  "collectedAt": "2026-10-25T03:51:47.330276+00:00",
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
    "pages.json": "677ed2666683b7cd79b3b2f5c1e22e94feae212d93930545837f58f492fe4ec4",
    "layouts.json": "de0a14cf6f66291b9edf7c6151e6e336c7ced7ee7158893c83f18e39b6c07ae8"
  },
  "validation": {
    "componentUuids": [
      "YW4MQIakrQnt"
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
  "pagePath": "/groups/selector"
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
  "errors": [
    {
      "check": "structurePlan",
      "path": "/groups/selector",
      "message": "components/1/owner needs nodeName and native slot",
      "rule": "references/requirement-alignment.md#structural-gate"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "FcnEDvDKoMDi",
      "tag": "div",
      "owner": null,
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "VS5FRUYZKAut",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "V2C0-SD3evpi",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "jx-GufpmBIKn",
      "tag": "span",
      "owner": {
        "nodeName": "NameItem",
        "slot": "label"
      },
      "text": "客群名称",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "H3iFXhx7kRkZ",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "MM6U2sO1n_Gl",
      "tag": "span",
      "owner": {
        "nodeName": "RetentionItem",
        "slot": "label"
      },
      "text": "数据保存天数",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "Ihynw3Ub3wyz",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "JK_5NM5GOwck",
      "tag": "span",
      "owner": {
        "nodeName": "DeadlineItem",
        "slot": "label"
      },
      "text": "产出截止时间",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "c28JK3soEiYq",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "ynCjWZ-9-yE5",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "g-CrdyBNdyqZ",
      "tag": "span",
      "owner": {
        "nodeName": "RefreshItem",
        "slot": "label"
      },
      "text": "刷新模式",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "BEslg-CQRVgk",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "IRXQb8n9dNb6",
      "tag": "span",
      "owner": {
        "nodeName": "TypeItem",
        "slot": "label"
      },
      "text": "客群类型",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "2hZP3QXkvxUt",
      "tag": "div",
      "owner": {
        "nodeName": "SqlCard",
        "slot": "extra"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "Sc6lsIWHVrA_",
      "tag": "span",
      "owner": {
        "nodeName": "FormatButton",
        "slot": "children"
      },
      "text": "格式化",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "7WMnEbsHrCQ_",
      "tag": "span",
      "owner": {
        "nodeName": "ValidateButton",
        "slot": "children"
      },
      "text": "校验",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "FAqsVzCvikJ2",
      "tag": "div",
      "owner": {
        "nodeName": "SqlCard",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "931ky6ocCQPX",
      "tag": "span",
      "owner": {
        "nodeName": "CheckAlert",
        "slot": "title"
      },
      "text": "校验通过 · 结果集含 uid + app_source",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "IUe4BHt0fXHZ",
      "tag": "span",
      "owner": {
        "nodeName": "CheckSyntaxItem",
        "slot": "label"
      },
      "text": "语句合法性",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "CVuEGGDAhJWw",
      "tag": "span",
      "owner": {
        "nodeName": "CheckSyntaxItem",
        "slot": "children"
      },
      "text": "通过",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "ebSjA3IxA57F",
      "tag": "span",
      "owner": {
        "nodeName": "CheckSourceItem",
        "slot": "label"
      },
      "text": "底表",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "d6z2uP4ONGR8",
      "tag": "span",
      "owner": {
        "nodeName": "CheckSourceItem",
        "slot": "children"
      },
      "text": "通过",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "fc7khYlXjIBX",
      "tag": "span",
      "owner": {
        "nodeName": "CheckRoleItem",
        "slot": "label"
      },
      "text": "权限",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "8x3ceTSCp7Ss",
      "tag": "span",
      "owner": {
        "nodeName": "CheckRoleItem",
        "slot": "children"
      },
      "text": "通过",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "fLijcEQDhPtT",
      "tag": "span",
      "owner": {
        "nodeName": "CheckColumnItem",
        "slot": "label"
      },
      "text": "结果字段",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "133FigqPtxSE",
      "tag": "span",
      "owner": {
        "nodeName": "CheckColumnItem",
        "slot": "children"
      },
      "text": "通过",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "OglZ_ZXgRFpl",
      "tag": "span",
      "owner": {
        "nodeName": "CheckFilterItem",
        "slot": "label"
      },
      "text": "结尾过滤",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "gguw66feqYw9",
      "tag": "span",
      "owner": {
        "nodeName": "CheckFilterItem",
        "slot": "children"
      },
      "text": "通过",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "f9nKztcxvomM",
      "tag": "span",
      "owner": {
        "nodeName": "HitCountStatistic",
        "slot": "title"
      },
      "text": "命中规模",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "3fCZPlFhpuVt",
      "tag": "span",
      "owner": {
        "nodeName": "HitCountStatistic",
        "slot": "suffix"
      },
      "text": "人",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "gH2SjYKmuth1",
      "tag": "span",
      "owner": {
        "nodeName": "SampleUidColumn",
        "slot": "title"
      },
      "text": "UID",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "k8QzetZmrccT",
      "tag": "span",
      "owner": {
        "nodeName": "SampleRegColumn",
        "slot": "title"
      },
      "text": "注册时间",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "UzRC0wgN4oyr",
      "tag": "span",
      "owner": {
        "nodeName": "SampleSourceColumn",
        "slot": "title"
      },
      "text": "App来源",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "vLrrj-HLgTIh",
      "tag": "span",
      "owner": {
        "nodeName": "SampleCreditColumn",
        "slot": "title"
      },
      "text": "授信状态",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "8brf2bnLDq4_",
      "tag": "span",
      "owner": {
        "nodeName": "SampleLoanColumn",
        "slot": "title"
      },
      "text": "借据状态",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "6TAdzPfc4U8q",
      "tag": "div",
      "owner": {
        "nodeName": "AppShell",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "T6KJTnNaEvVP",
      "tag": "span",
      "owner": {
        "nodeName": "AppShell",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "b_VkvW8jbK1V",
      "tag": "span",
      "owner": {
        "nodeName": "SubmitButton",
        "slot": "children"
      },
      "text": "提交",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "_IFYls8ynP-B",
      "tag": "span",
      "owner": {
        "nodeName": "SaveSqlButton",
        "slot": "children"
      },
      "text": "保存 SQL",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "1tbOyDiA8RbI",
      "tag": "span",
      "owner": {
        "nodeName": "OnlineButton",
        "slot": "children"
      },
      "text": "上线",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "n-wCl7AxURJy",
      "tag": "span",
      "owner": {
        "nodeName": "CancelButton",
        "slot": "children"
      },
      "text": "取消",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "LqAyknQ2adQz",
      "tag": "div",
      "owner": {
        "nodeName": "PreflightModal",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "lSeZyjofG3Jy",
      "tag": "div",
      "owner": {
        "nodeName": "PreflightModal",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "TpSnlJoYS055",
      "tag": "span",
      "owner": {
        "nodeName": "PreflightModal",
        "slot": "children"
      },
      "text": "预跑进行中，请稍候",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "iMAx4c7OI3CL",
      "tag": "div",
      "owner": {
        "nodeName": "PreflightModal",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "JonBx-3vUrVB",
      "tag": "span",
      "owner": {
        "nodeName": "PreflightSuccessAlert",
        "slot": "title"
      },
      "text": "预跑成功 · 命中规模 12,340 人",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "7LeAbYasEssa",
      "tag": "div",
      "owner": {
        "nodeName": "PreflightModal",
        "slot": "children"
      },
      "text": "",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "check": "naming",
      "path": "/groups/selector",
      "nodeName": null,
      "elementUuid": "Rq3FdqXfLxoL",
      "tag": "span",
      "owner": {
        "nodeName": "PreflightFailedAlert",
        "slot": "title"
      },
      "text": "预跑失败：底表分区缺失",
      "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "appContext",
      "node": "PreviewTable",
      "message": "Required data/action consumer must use the same shared App context",
      "rule": "references/libraries/antd_v6/components/table.md"
    },
    {
      "path": "/groups/selector",
      "check": "selectionCoverage",
      "node": "HitCountStatistic",
      "component": "plasmicantd6statistic",
      "message": "Every authored functional instance requires a source-reviewed selection, including hidden content",
      "rule": "references/libraries/antd_v6/components/statistic.md"
    },
    {
      "path": "/groups/selector",
      "check": "selectionCoverage",
      "node": "PreflightSuccessAlert",
      "component": "plasmicantd6alert",
      "message": "Every authored functional instance requires a source-reviewed selection, including hidden content",
      "rule": "references/libraries/antd_v6/components/alert.md"
    },
    {
      "path": "/groups/selector",
      "check": "selectionCoverage",
      "node": "PreflightFailedAlert",
      "component": "plasmicantd6alert",
      "message": "Every authored functional instance requires a source-reviewed selection, including hidden content",
      "rule": "references/libraries/antd_v6/components/alert.md"
    },
    {
      "path": "/groups/selector",
      "check": "feedback",
      "node": "SubmitButton",
      "message": "Expected qualified provider action plasmic-antd6-config-provider.showMessage wiring on the reviewed event; page Alert/notice state is not a substitute",
      "rule": "references/libraries/antd_v6/components/config-provider.md#feedback-action-calls"
    },
    {
      "path": "/groups/selector",
      "check": "feedback",
      "node": "ValidateButton",
      "message": "Expected qualified provider action plasmic-antd6-config-provider.showMessage wiring on the reviewed event; page Alert/notice state is not a substitute",
      "rule": "references/libraries/antd_v6/components/config-provider.md#feedback-action-calls"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "FcnEDvDKoMDi",
      "tag": "div",
      "owner": null,
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": "BasicInfoCard",
      "elementUuid": "ntoH2Jxb6C2h",
      "tag": "plasmic-component",
      "owner": {
        "nodeName": "AppShell",
        "slot": "children"
      },
      "text": "",
      "component": "plasmicantd6card",
      "expectedOwner": null,
      "message": "Actual semantic owner/Slot differs from the naming plan",
      "rule": "references/libraries/antd_v6/components/card.md"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "VS5FRUYZKAut",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "V2C0-SD3evpi",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "jx-GufpmBIKn",
      "tag": "span",
      "owner": {
        "nodeName": "NameItem",
        "slot": "label"
      },
      "text": "客群名称",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "H3iFXhx7kRkZ",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "MM6U2sO1n_Gl",
      "tag": "span",
      "owner": {
        "nodeName": "RetentionItem",
        "slot": "label"
      },
      "text": "数据保存天数",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "Ihynw3Ub3wyz",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "JK_5NM5GOwck",
      "tag": "span",
      "owner": {
        "nodeName": "DeadlineItem",
        "slot": "label"
      },
      "text": "产出截止时间",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "c28JK3soEiYq",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "ynCjWZ-9-yE5",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "g-CrdyBNdyqZ",
      "tag": "span",
      "owner": {
        "nodeName": "RefreshItem",
        "slot": "label"
      },
      "text": "刷新模式",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "BEslg-CQRVgk",
      "tag": "div",
      "owner": {
        "nodeName": "BasicForm",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "IRXQb8n9dNb6",
      "tag": "span",
      "owner": {
        "nodeName": "TypeItem",
        "slot": "label"
      },
      "text": "客群类型",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": "SqlCard",
      "elementUuid": "2OUODHx0GzSq",
      "tag": "plasmic-component",
      "owner": {
        "nodeName": "AppShell",
        "slot": "children"
      },
      "text": "",
      "component": "plasmicantd6card",
      "expectedOwner": null,
      "message": "Actual semantic owner/Slot differs from the naming plan",
      "rule": "references/libraries/antd_v6/components/card.md"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "2hZP3QXkvxUt",
      "tag": "div",
      "owner": {
        "nodeName": "SqlCard",
        "slot": "extra"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "Sc6lsIWHVrA_",
      "tag": "span",
      "owner": {
        "nodeName": "FormatButton",
        "slot": "children"
      },
      "text": "格式化",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "7WMnEbsHrCQ_",
      "tag": "span",
      "owner": {
        "nodeName": "ValidateButton",
        "slot": "children"
      },
      "text": "校验",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "FAqsVzCvikJ2",
      "tag": "div",
      "owner": {
        "nodeName": "SqlCard",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "931ky6ocCQPX",
      "tag": "span",
      "owner": {
        "nodeName": "CheckAlert",
        "slot": "title"
      },
      "text": "校验通过 · 结果集含 uid + app_source",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "IUe4BHt0fXHZ",
      "tag": "span",
      "owner": {
        "nodeName": "CheckSyntaxItem",
        "slot": "label"
      },
      "text": "语句合法性",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "CVuEGGDAhJWw",
      "tag": "span",
      "owner": {
        "nodeName": "CheckSyntaxItem",
        "slot": "children"
      },
      "text": "通过",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "ebSjA3IxA57F",
      "tag": "span",
      "owner": {
        "nodeName": "CheckSourceItem",
        "slot": "label"
      },
      "text": "底表",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "d6z2uP4ONGR8",
      "tag": "span",
      "owner": {
        "nodeName": "CheckSourceItem",
        "slot": "children"
      },
      "text": "通过",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "fc7khYlXjIBX",
      "tag": "span",
      "owner": {
        "nodeName": "CheckRoleItem",
        "slot": "label"
      },
      "text": "权限",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "8x3ceTSCp7Ss",
      "tag": "span",
      "owner": {
        "nodeName": "CheckRoleItem",
        "slot": "children"
      },
      "text": "通过",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "fLijcEQDhPtT",
      "tag": "span",
      "owner": {
        "nodeName": "CheckColumnItem",
        "slot": "label"
      },
      "text": "结果字段",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "133FigqPtxSE",
      "tag": "span",
      "owner": {
        "nodeName": "CheckColumnItem",
        "slot": "children"
      },
      "text": "通过",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "OglZ_ZXgRFpl",
      "tag": "span",
      "owner": {
        "nodeName": "CheckFilterItem",
        "slot": "label"
      },
      "text": "结尾过滤",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "gguw66feqYw9",
      "tag": "span",
      "owner": {
        "nodeName": "CheckFilterItem",
        "slot": "children"
      },
      "text": "通过",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": "HitCountStatistic",
      "elementUuid": "PBwbk30venId",
      "tag": "plasmic-component",
      "owner": {
        "nodeName": "SqlCard",
        "slot": "children"
      },
      "text": "",
      "component": "plasmicantd6statistic",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/libraries/antd_v6/components/statistic.md"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "f9nKztcxvomM",
      "tag": "span",
      "owner": {
        "nodeName": "HitCountStatistic",
        "slot": "title"
      },
      "text": "命中规模",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "3fCZPlFhpuVt",
      "tag": "span",
      "owner": {
        "nodeName": "HitCountStatistic",
        "slot": "suffix"
      },
      "text": "人",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "gH2SjYKmuth1",
      "tag": "span",
      "owner": {
        "nodeName": "SampleUidColumn",
        "slot": "title"
      },
      "text": "UID",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "k8QzetZmrccT",
      "tag": "span",
      "owner": {
        "nodeName": "SampleRegColumn",
        "slot": "title"
      },
      "text": "注册时间",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "UzRC0wgN4oyr",
      "tag": "span",
      "owner": {
        "nodeName": "SampleSourceColumn",
        "slot": "title"
      },
      "text": "App来源",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "vLrrj-HLgTIh",
      "tag": "span",
      "owner": {
        "nodeName": "SampleCreditColumn",
        "slot": "title"
      },
      "text": "授信状态",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "8brf2bnLDq4_",
      "tag": "span",
      "owner": {
        "nodeName": "SampleLoanColumn",
        "slot": "title"
      },
      "text": "借据状态",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": "SelectorFooter",
      "elementUuid": "Ma3PvaF0ocRh",
      "tag": "div",
      "owner": {
        "nodeName": "AppShell",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "6TAdzPfc4U8q",
      "tag": "div",
      "owner": {
        "nodeName": "AppShell",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "T6KJTnNaEvVP",
      "tag": "span",
      "owner": {
        "nodeName": "AppShell",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": "SubmitButton",
      "elementUuid": "B3G448iKAnU_",
      "tag": "plasmic-component",
      "owner": {
        "nodeName": "AppShell",
        "slot": "children"
      },
      "text": "",
      "component": "plasmicantd6button",
      "expectedOwner": null,
      "message": "Actual semantic owner/Slot differs from the naming plan",
      "rule": "references/libraries/antd_v6/components/button.md"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "b_VkvW8jbK1V",
      "tag": "span",
      "owner": {
        "nodeName": "SubmitButton",
        "slot": "children"
      },
      "text": "提交",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": "SaveSqlButton",
      "elementUuid": "VyP-fL2S8ax-",
      "tag": "plasmic-component",
      "owner": {
        "nodeName": "AppShell",
        "slot": "children"
      },
      "text": "",
      "component": "plasmicantd6button",
      "expectedOwner": null,
      "message": "Actual semantic owner/Slot differs from the naming plan",
      "rule": "references/libraries/antd_v6/components/button.md"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "_IFYls8ynP-B",
      "tag": "span",
      "owner": {
        "nodeName": "SaveSqlButton",
        "slot": "children"
      },
      "text": "保存 SQL",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": "OnlineButton",
      "elementUuid": "Qoa5-gIuph65",
      "tag": "plasmic-component",
      "owner": {
        "nodeName": "AppShell",
        "slot": "children"
      },
      "text": "",
      "component": "plasmicantd6button",
      "expectedOwner": null,
      "message": "Actual semantic owner/Slot differs from the naming plan",
      "rule": "references/libraries/antd_v6/components/button.md"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "1tbOyDiA8RbI",
      "tag": "span",
      "owner": {
        "nodeName": "OnlineButton",
        "slot": "children"
      },
      "text": "上线",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": "CancelButton",
      "elementUuid": "AwCL3YQe_LBZ",
      "tag": "plasmic-component",
      "owner": {
        "nodeName": "AppShell",
        "slot": "children"
      },
      "text": "",
      "component": "plasmicantd6button",
      "expectedOwner": null,
      "message": "Actual semantic owner/Slot differs from the naming plan",
      "rule": "references/libraries/antd_v6/components/button.md"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "n-wCl7AxURJy",
      "tag": "span",
      "owner": {
        "nodeName": "CancelButton",
        "slot": "children"
      },
      "text": "取消",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": "PreflightModal",
      "elementUuid": "8BaoliqK508U",
      "tag": "plasmic-component",
      "owner": {
        "nodeName": "AppShell",
        "slot": "children"
      },
      "text": "",
      "component": "plasmicantd6modal",
      "expectedOwner": null,
      "message": "Actual semantic owner/Slot differs from the naming plan",
      "rule": "references/libraries/antd_v6/components/modal.md"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "LqAyknQ2adQz",
      "tag": "div",
      "owner": {
        "nodeName": "PreflightModal",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "lSeZyjofG3Jy",
      "tag": "div",
      "owner": {
        "nodeName": "PreflightModal",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "TpSnlJoYS055",
      "tag": "span",
      "owner": {
        "nodeName": "PreflightModal",
        "slot": "children"
      },
      "text": "预跑进行中，请稍候",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "iMAx4c7OI3CL",
      "tag": "div",
      "owner": {
        "nodeName": "PreflightModal",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": "PreflightSuccessAlert",
      "elementUuid": "1ken_iRzRMwI",
      "tag": "plasmic-component",
      "owner": {
        "nodeName": "PreflightModal",
        "slot": "children"
      },
      "text": "",
      "component": "plasmicantd6alert",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/libraries/antd_v6/components/alert.md"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "JonBx-3vUrVB",
      "tag": "span",
      "owner": {
        "nodeName": "PreflightSuccessAlert",
        "slot": "title"
      },
      "text": "预跑成功 · 命中规模 12,340 人",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "7LeAbYasEssa",
      "tag": "div",
      "owner": {
        "nodeName": "PreflightModal",
        "slot": "children"
      },
      "text": "",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": "PreflightFailedAlert",
      "elementUuid": "Cuk2cO04aDxX",
      "tag": "plasmic-component",
      "owner": {
        "nodeName": "PreflightModal",
        "slot": "children"
      },
      "text": "",
      "component": "plasmicantd6alert",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/libraries/antd_v6/components/alert.md"
    },
    {
      "path": "/groups/selector",
      "check": "namingCoverage",
      "nodeName": null,
      "elementUuid": "Rq3FdqXfLxoL",
      "tag": "span",
      "owner": {
        "nodeName": "PreflightFailedAlert",
        "slot": "title"
      },
      "text": "预跑失败：底表分区缺失",
      "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
      "rule": "references/design/naming.md#editor-node-naming"
    },
    {
      "path": "/groups/selector",
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
      "path": "/groups/selector",
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
      "path": "/groups/selector",
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
      "path": "/groups/selector",
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
      "path": "/groups/selector",
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
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "NameItem",
      "at": "/props/rules/0/message",
      "text": "请输入客群名称",
      "owner": "NameItem",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": null,
      "at": "/text",
      "text": "客群名称数据保存天数产出截止时间刷新模式客群类型格式化校验校验通过 · 结果集含 uid + app_source语句合法性通过底表通过权限通过结果字段通过结尾过滤通过命中规模人UID注册时间App来源授信状态借据状态提交保存 SQL上线取消预跑进行中，请稍候预跑成功 · 命中规模 12,340 人预跑失败：底表分区缺失",
      "owner": "NameItem",
      "slot": "label",
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "RetentionItem",
      "at": "/props/rules/0/message",
      "text": "请选择数据保存天数",
      "owner": "RetentionItem",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "DeadlineItem",
      "at": "/props/rules/0/message",
      "text": "请选择产出截止时间",
      "owner": "DeadlineItem",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "DeadlineTime",
      "at": "/props/value",
      "text": "2026-08-19T18:00:00",
      "owner": "DeadlineTime",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "SqlEditor",
      "at": "/props/value",
      "text": "SELECT uid, app_source, register_date\nFROM cdm_mx_dim_customer_user_df\nWHERE register_date >= '2026-07-01'\n  AND app_source = 'TACO'\nLIMIT 1000",
      "owner": "SqlEditor",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "SqlEditor",
      "at": "/props/placeholder",
      "text": "请输入只读 SELECT 语句",
      "owner": "SqlEditor",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "HitCountStatistic",
      "at": "/props/value",
      "text": "{{ $state.hitCount }}",
      "owner": "HitCountStatistic",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "SampleCreditBadge",
      "at": "/props/text",
      "text": "{{ row.creditStatus }}",
      "owner": "SampleCreditBadge",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "SampleLoanBadge",
      "at": "/props/text",
      "text": "{{ row.loanStatus }}",
      "owner": "SampleLoanBadge",
      "slot": null,
      "expected": null,
      "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "NameItem",
      "at": "/slots/label/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "RetentionItem",
      "at": "/slots/label/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "DeadlineItem",
      "at": "/slots/label/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "RefreshItem",
      "at": "/slots/label/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "TypeItem",
      "at": "/slots/label/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "FormatButton",
      "at": "/slots/children/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "ValidateButton",
      "at": "/slots/children/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "CheckAlert",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "CheckSyntaxItem",
      "at": "/slots/label/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "CheckSourceItem",
      "at": "/slots/label/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "CheckRoleItem",
      "at": "/slots/label/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "CheckColumnItem",
      "at": "/slots/label/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "CheckFilterItem",
      "at": "/slots/label/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "SampleUidColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "SampleRegColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "SampleSourceColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "SampleCreditColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "SampleLoanColumn",
      "at": "/slots/title/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "SubmitButton",
      "at": "/slots/children/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "SaveSqlButton",
      "at": "/slots/children/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "OnlineButton",
      "at": "/slots/children/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "path": "/groups/selector",
      "check": "copyCoverage",
      "nodeName": "CancelButton",
      "at": "/slots/children/text",
      "message": "Reviewed UI copy is missing or moved to a different native location",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    }
  ],
  "selection": {
    "passed": false,
    "errors": [
      {
        "path": "/groups/selector",
        "check": "appContext",
        "node": "PreviewTable",
        "message": "Required data/action consumer must use the same shared App context",
        "rule": "references/libraries/antd_v6/components/table.md"
      },
      {
        "path": "/groups/selector",
        "check": "selectionCoverage",
        "node": "HitCountStatistic",
        "component": "plasmicantd6statistic",
        "message": "Every authored functional instance requires a source-reviewed selection, including hidden content",
        "rule": "references/libraries/antd_v6/components/statistic.md"
      },
      {
        "path": "/groups/selector",
        "check": "selectionCoverage",
        "node": "PreflightSuccessAlert",
        "component": "plasmicantd6alert",
        "message": "Every authored functional instance requires a source-reviewed selection, including hidden content",
        "rule": "references/libraries/antd_v6/components/alert.md"
      },
      {
        "path": "/groups/selector",
        "check": "selectionCoverage",
        "node": "PreflightFailedAlert",
        "component": "plasmicantd6alert",
        "message": "Every authored functional instance requires a source-reviewed selection, including hidden content",
        "rule": "references/libraries/antd_v6/components/alert.md"
      },
      {
        "path": "/groups/selector",
        "check": "feedback",
        "node": "SubmitButton",
        "message": "Expected qualified provider action plasmic-antd6-config-provider.showMessage wiring on the reviewed event; page Alert/notice state is not a substitute",
        "rule": "references/libraries/antd_v6/components/config-provider.md#feedback-action-calls"
      },
      {
        "path": "/groups/selector",
        "check": "feedback",
        "node": "ValidateButton",
        "message": "Expected qualified provider action plasmic-antd6-config-provider.showMessage wiring on the reviewed event; page Alert/notice state is not a substitute",
        "rule": "references/libraries/antd_v6/components/config-provider.md#feedback-action-calls"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "FcnEDvDKoMDi",
        "tag": "div",
        "owner": null,
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": "BasicInfoCard",
        "elementUuid": "ntoH2Jxb6C2h",
        "tag": "plasmic-component",
        "owner": {
          "nodeName": "AppShell",
          "slot": "children"
        },
        "text": "",
        "component": "plasmicantd6card",
        "expectedOwner": null,
        "message": "Actual semantic owner/Slot differs from the naming plan",
        "rule": "references/libraries/antd_v6/components/card.md"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "VS5FRUYZKAut",
        "tag": "div",
        "owner": {
          "nodeName": "BasicForm",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "V2C0-SD3evpi",
        "tag": "div",
        "owner": {
          "nodeName": "BasicForm",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "jx-GufpmBIKn",
        "tag": "span",
        "owner": {
          "nodeName": "NameItem",
          "slot": "label"
        },
        "text": "客群名称",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "H3iFXhx7kRkZ",
        "tag": "div",
        "owner": {
          "nodeName": "BasicForm",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "MM6U2sO1n_Gl",
        "tag": "span",
        "owner": {
          "nodeName": "RetentionItem",
          "slot": "label"
        },
        "text": "数据保存天数",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "Ihynw3Ub3wyz",
        "tag": "div",
        "owner": {
          "nodeName": "BasicForm",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "JK_5NM5GOwck",
        "tag": "span",
        "owner": {
          "nodeName": "DeadlineItem",
          "slot": "label"
        },
        "text": "产出截止时间",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "c28JK3soEiYq",
        "tag": "div",
        "owner": {
          "nodeName": "BasicForm",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "ynCjWZ-9-yE5",
        "tag": "div",
        "owner": {
          "nodeName": "BasicForm",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "g-CrdyBNdyqZ",
        "tag": "span",
        "owner": {
          "nodeName": "RefreshItem",
          "slot": "label"
        },
        "text": "刷新模式",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "BEslg-CQRVgk",
        "tag": "div",
        "owner": {
          "nodeName": "BasicForm",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "IRXQb8n9dNb6",
        "tag": "span",
        "owner": {
          "nodeName": "TypeItem",
          "slot": "label"
        },
        "text": "客群类型",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": "SqlCard",
        "elementUuid": "2OUODHx0GzSq",
        "tag": "plasmic-component",
        "owner": {
          "nodeName": "AppShell",
          "slot": "children"
        },
        "text": "",
        "component": "plasmicantd6card",
        "expectedOwner": null,
        "message": "Actual semantic owner/Slot differs from the naming plan",
        "rule": "references/libraries/antd_v6/components/card.md"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "2hZP3QXkvxUt",
        "tag": "div",
        "owner": {
          "nodeName": "SqlCard",
          "slot": "extra"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "Sc6lsIWHVrA_",
        "tag": "span",
        "owner": {
          "nodeName": "FormatButton",
          "slot": "children"
        },
        "text": "格式化",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "7WMnEbsHrCQ_",
        "tag": "span",
        "owner": {
          "nodeName": "ValidateButton",
          "slot": "children"
        },
        "text": "校验",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "FAqsVzCvikJ2",
        "tag": "div",
        "owner": {
          "nodeName": "SqlCard",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "931ky6ocCQPX",
        "tag": "span",
        "owner": {
          "nodeName": "CheckAlert",
          "slot": "title"
        },
        "text": "校验通过 · 结果集含 uid + app_source",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "IUe4BHt0fXHZ",
        "tag": "span",
        "owner": {
          "nodeName": "CheckSyntaxItem",
          "slot": "label"
        },
        "text": "语句合法性",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "CVuEGGDAhJWw",
        "tag": "span",
        "owner": {
          "nodeName": "CheckSyntaxItem",
          "slot": "children"
        },
        "text": "通过",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "ebSjA3IxA57F",
        "tag": "span",
        "owner": {
          "nodeName": "CheckSourceItem",
          "slot": "label"
        },
        "text": "底表",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "d6z2uP4ONGR8",
        "tag": "span",
        "owner": {
          "nodeName": "CheckSourceItem",
          "slot": "children"
        },
        "text": "通过",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "fc7khYlXjIBX",
        "tag": "span",
        "owner": {
          "nodeName": "CheckRoleItem",
          "slot": "label"
        },
        "text": "权限",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "8x3ceTSCp7Ss",
        "tag": "span",
        "owner": {
          "nodeName": "CheckRoleItem",
          "slot": "children"
        },
        "text": "通过",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "fLijcEQDhPtT",
        "tag": "span",
        "owner": {
          "nodeName": "CheckColumnItem",
          "slot": "label"
        },
        "text": "结果字段",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "133FigqPtxSE",
        "tag": "span",
        "owner": {
          "nodeName": "CheckColumnItem",
          "slot": "children"
        },
        "text": "通过",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "OglZ_ZXgRFpl",
        "tag": "span",
        "owner": {
          "nodeName": "CheckFilterItem",
          "slot": "label"
        },
        "text": "结尾过滤",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "gguw66feqYw9",
        "tag": "span",
        "owner": {
          "nodeName": "CheckFilterItem",
          "slot": "children"
        },
        "text": "通过",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": "HitCountStatistic",
        "elementUuid": "PBwbk30venId",
        "tag": "plasmic-component",
        "owner": {
          "nodeName": "SqlCard",
          "slot": "children"
        },
        "text": "",
        "component": "plasmicantd6statistic",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/libraries/antd_v6/components/statistic.md"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "f9nKztcxvomM",
        "tag": "span",
        "owner": {
          "nodeName": "HitCountStatistic",
          "slot": "title"
        },
        "text": "命中规模",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "3fCZPlFhpuVt",
        "tag": "span",
        "owner": {
          "nodeName": "HitCountStatistic",
          "slot": "suffix"
        },
        "text": "人",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "gH2SjYKmuth1",
        "tag": "span",
        "owner": {
          "nodeName": "SampleUidColumn",
          "slot": "title"
        },
        "text": "UID",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "k8QzetZmrccT",
        "tag": "span",
        "owner": {
          "nodeName": "SampleRegColumn",
          "slot": "title"
        },
        "text": "注册时间",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "UzRC0wgN4oyr",
        "tag": "span",
        "owner": {
          "nodeName": "SampleSourceColumn",
          "slot": "title"
        },
        "text": "App来源",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "vLrrj-HLgTIh",
        "tag": "span",
        "owner": {
          "nodeName": "SampleCreditColumn",
          "slot": "title"
        },
        "text": "授信状态",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "8brf2bnLDq4_",
        "tag": "span",
        "owner": {
          "nodeName": "SampleLoanColumn",
          "slot": "title"
        },
        "text": "借据状态",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": "SelectorFooter",
        "elementUuid": "Ma3PvaF0ocRh",
        "tag": "div",
        "owner": {
          "nodeName": "AppShell",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "6TAdzPfc4U8q",
        "tag": "div",
        "owner": {
          "nodeName": "AppShell",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "T6KJTnNaEvVP",
        "tag": "span",
        "owner": {
          "nodeName": "AppShell",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": "SubmitButton",
        "elementUuid": "B3G448iKAnU_",
        "tag": "plasmic-component",
        "owner": {
          "nodeName": "AppShell",
          "slot": "children"
        },
        "text": "",
        "component": "plasmicantd6button",
        "expectedOwner": null,
        "message": "Actual semantic owner/Slot differs from the naming plan",
        "rule": "references/libraries/antd_v6/components/button.md"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "b_VkvW8jbK1V",
        "tag": "span",
        "owner": {
          "nodeName": "SubmitButton",
          "slot": "children"
        },
        "text": "提交",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": "SaveSqlButton",
        "elementUuid": "VyP-fL2S8ax-",
        "tag": "plasmic-component",
        "owner": {
          "nodeName": "AppShell",
          "slot": "children"
        },
        "text": "",
        "component": "plasmicantd6button",
        "expectedOwner": null,
        "message": "Actual semantic owner/Slot differs from the naming plan",
        "rule": "references/libraries/antd_v6/components/button.md"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "_IFYls8ynP-B",
        "tag": "span",
        "owner": {
          "nodeName": "SaveSqlButton",
          "slot": "children"
        },
        "text": "保存 SQL",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": "OnlineButton",
        "elementUuid": "Qoa5-gIuph65",
        "tag": "plasmic-component",
        "owner": {
          "nodeName": "AppShell",
          "slot": "children"
        },
        "text": "",
        "component": "plasmicantd6button",
        "expectedOwner": null,
        "message": "Actual semantic owner/Slot differs from the naming plan",
        "rule": "references/libraries/antd_v6/components/button.md"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "1tbOyDiA8RbI",
        "tag": "span",
        "owner": {
          "nodeName": "OnlineButton",
          "slot": "children"
        },
        "text": "上线",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": "CancelButton",
        "elementUuid": "AwCL3YQe_LBZ",
        "tag": "plasmic-component",
        "owner": {
          "nodeName": "AppShell",
          "slot": "children"
        },
        "text": "",
        "component": "plasmicantd6button",
        "expectedOwner": null,
        "message": "Actual semantic owner/Slot differs from the naming plan",
        "rule": "references/libraries/antd_v6/components/button.md"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "n-wCl7AxURJy",
        "tag": "span",
        "owner": {
          "nodeName": "CancelButton",
          "slot": "children"
        },
        "text": "取消",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": "PreflightModal",
        "elementUuid": "8BaoliqK508U",
        "tag": "plasmic-component",
        "owner": {
          "nodeName": "AppShell",
          "slot": "children"
        },
        "text": "",
        "component": "plasmicantd6modal",
        "expectedOwner": null,
        "message": "Actual semantic owner/Slot differs from the naming plan",
        "rule": "references/libraries/antd_v6/components/modal.md"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "LqAyknQ2adQz",
        "tag": "div",
        "owner": {
          "nodeName": "PreflightModal",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "lSeZyjofG3Jy",
        "tag": "div",
        "owner": {
          "nodeName": "PreflightModal",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "TpSnlJoYS055",
        "tag": "span",
        "owner": {
          "nodeName": "PreflightModal",
          "slot": "children"
        },
        "text": "预跑进行中，请稍候",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "iMAx4c7OI3CL",
        "tag": "div",
        "owner": {
          "nodeName": "PreflightModal",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": "PreflightSuccessAlert",
        "elementUuid": "1ken_iRzRMwI",
        "tag": "plasmic-component",
        "owner": {
          "nodeName": "PreflightModal",
          "slot": "children"
        },
        "text": "",
        "component": "plasmicantd6alert",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/libraries/antd_v6/components/alert.md"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "JonBx-3vUrVB",
        "tag": "span",
        "owner": {
          "nodeName": "PreflightSuccessAlert",
          "slot": "title"
        },
        "text": "预跑成功 · 命中规模 12,340 人",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "7LeAbYasEssa",
        "tag": "div",
        "owner": {
          "nodeName": "PreflightModal",
          "slot": "children"
        },
        "text": "",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": "PreflightFailedAlert",
        "elementUuid": "Cuk2cO04aDxX",
        "tag": "plasmic-component",
        "owner": {
          "nodeName": "PreflightModal",
          "slot": "children"
        },
        "text": "",
        "component": "plasmicantd6alert",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/libraries/antd_v6/components/alert.md"
      },
      {
        "path": "/groups/selector",
        "check": "namingCoverage",
        "nodeName": null,
        "elementUuid": "Rq3FdqXfLxoL",
        "tag": "span",
        "owner": {
          "nodeName": "PreflightFailedAlert",
          "slot": "title"
        },
        "text": "预跑失败：底表分区缺失",
        "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
        "rule": "references/design/naming.md#editor-node-naming"
      },
      {
        "path": "/groups/selector",
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
        "path": "/groups/selector",
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
        "path": "/groups/selector",
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
        "path": "/groups/selector",
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
        "path": "/groups/selector",
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
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "NameItem",
        "at": "/props/rules/0/message",
        "text": "请输入客群名称",
        "owner": "NameItem",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": null,
        "at": "/text",
        "text": "客群名称数据保存天数产出截止时间刷新模式客群类型格式化校验校验通过 · 结果集含 uid + app_source语句合法性通过底表通过权限通过结果字段通过结尾过滤通过命中规模人UID注册时间App来源授信状态借据状态提交保存 SQL上线取消预跑进行中，请稍候预跑成功 · 命中规模 12,340 人预跑失败：底表分区缺失",
        "owner": "NameItem",
        "slot": "label",
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "RetentionItem",
        "at": "/props/rules/0/message",
        "text": "请选择数据保存天数",
        "owner": "RetentionItem",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "DeadlineItem",
        "at": "/props/rules/0/message",
        "text": "请选择产出截止时间",
        "owner": "DeadlineItem",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "DeadlineTime",
        "at": "/props/value",
        "text": "2026-08-19T18:00:00",
        "owner": "DeadlineTime",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "SqlEditor",
        "at": "/props/value",
        "text": "SELECT uid, app_source, register_date\nFROM cdm_mx_dim_customer_user_df\nWHERE register_date >= '2026-07-01'\n  AND app_source = 'TACO'\nLIMIT 1000",
        "owner": "SqlEditor",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "SqlEditor",
        "at": "/props/placeholder",
        "text": "请输入只读 SELECT 语句",
        "owner": "SqlEditor",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "HitCountStatistic",
        "at": "/props/value",
        "text": "{{ $state.hitCount }}",
        "owner": "HitCountStatistic",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "SampleCreditBadge",
        "at": "/props/text",
        "text": "{{ row.creditStatus }}",
        "owner": "SampleCreditBadge",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "SampleLoanBadge",
        "at": "/props/text",
        "text": "{{ row.loanStatus }}",
        "owner": "SampleLoanBadge",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "NameItem",
        "at": "/slots/label/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "RetentionItem",
        "at": "/slots/label/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "DeadlineItem",
        "at": "/slots/label/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "RefreshItem",
        "at": "/slots/label/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "TypeItem",
        "at": "/slots/label/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "FormatButton",
        "at": "/slots/children/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "ValidateButton",
        "at": "/slots/children/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "CheckAlert",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "CheckSyntaxItem",
        "at": "/slots/label/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "CheckSourceItem",
        "at": "/slots/label/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "CheckRoleItem",
        "at": "/slots/label/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "CheckColumnItem",
        "at": "/slots/label/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "CheckFilterItem",
        "at": "/slots/label/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "SampleUidColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "SampleRegColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "SampleSourceColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "SampleCreditColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "SampleLoanColumn",
        "at": "/slots/title/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "SubmitButton",
        "at": "/slots/children/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "SaveSqlButton",
        "at": "/slots/children/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "OnlineButton",
        "at": "/slots/children/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      },
      {
        "path": "/groups/selector",
        "check": "copyCoverage",
        "nodeName": "CancelButton",
        "at": "/slots/children/text",
        "message": "Reviewed UI copy is missing or moved to a different native location",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      }
    ],
    "templates": [
      {
        "path": "/groups/selector",
        "passed": true,
        "errors": [],
        "sources": [],
        "status": "not_applicable",
        "reason": "Splits the SQL workflow into a basic-information Card and an SQL/校验 Card on one page; the catalog sections cover list, tabbed list, catalog tabs, detail and form pages only, and this staged SQL composition is not one of them.",
        "notChecked": [
          "correctness of the no-template-fit decision"
        ]
      }
    ],
    "content": [
      {
        "path": "/groups/selector",
        "passed": false,
        "errors": [
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "FcnEDvDKoMDi",
            "tag": "div",
            "owner": null,
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": "BasicInfoCard",
            "elementUuid": "ntoH2Jxb6C2h",
            "tag": "plasmic-component",
            "owner": {
              "nodeName": "AppShell",
              "slot": "children"
            },
            "text": "",
            "component": "plasmicantd6card",
            "expectedOwner": null,
            "message": "Actual semantic owner/Slot differs from the naming plan",
            "rule": "references/libraries/antd_v6/components/card.md"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "VS5FRUYZKAut",
            "tag": "div",
            "owner": {
              "nodeName": "BasicForm",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "V2C0-SD3evpi",
            "tag": "div",
            "owner": {
              "nodeName": "BasicForm",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "jx-GufpmBIKn",
            "tag": "span",
            "owner": {
              "nodeName": "NameItem",
              "slot": "label"
            },
            "text": "客群名称",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "H3iFXhx7kRkZ",
            "tag": "div",
            "owner": {
              "nodeName": "BasicForm",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "MM6U2sO1n_Gl",
            "tag": "span",
            "owner": {
              "nodeName": "RetentionItem",
              "slot": "label"
            },
            "text": "数据保存天数",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "Ihynw3Ub3wyz",
            "tag": "div",
            "owner": {
              "nodeName": "BasicForm",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "JK_5NM5GOwck",
            "tag": "span",
            "owner": {
              "nodeName": "DeadlineItem",
              "slot": "label"
            },
            "text": "产出截止时间",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "c28JK3soEiYq",
            "tag": "div",
            "owner": {
              "nodeName": "BasicForm",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "ynCjWZ-9-yE5",
            "tag": "div",
            "owner": {
              "nodeName": "BasicForm",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "g-CrdyBNdyqZ",
            "tag": "span",
            "owner": {
              "nodeName": "RefreshItem",
              "slot": "label"
            },
            "text": "刷新模式",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "BEslg-CQRVgk",
            "tag": "div",
            "owner": {
              "nodeName": "BasicForm",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "IRXQb8n9dNb6",
            "tag": "span",
            "owner": {
              "nodeName": "TypeItem",
              "slot": "label"
            },
            "text": "客群类型",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": "SqlCard",
            "elementUuid": "2OUODHx0GzSq",
            "tag": "plasmic-component",
            "owner": {
              "nodeName": "AppShell",
              "slot": "children"
            },
            "text": "",
            "component": "plasmicantd6card",
            "expectedOwner": null,
            "message": "Actual semantic owner/Slot differs from the naming plan",
            "rule": "references/libraries/antd_v6/components/card.md"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "2hZP3QXkvxUt",
            "tag": "div",
            "owner": {
              "nodeName": "SqlCard",
              "slot": "extra"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "Sc6lsIWHVrA_",
            "tag": "span",
            "owner": {
              "nodeName": "FormatButton",
              "slot": "children"
            },
            "text": "格式化",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "7WMnEbsHrCQ_",
            "tag": "span",
            "owner": {
              "nodeName": "ValidateButton",
              "slot": "children"
            },
            "text": "校验",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "FAqsVzCvikJ2",
            "tag": "div",
            "owner": {
              "nodeName": "SqlCard",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "931ky6ocCQPX",
            "tag": "span",
            "owner": {
              "nodeName": "CheckAlert",
              "slot": "title"
            },
            "text": "校验通过 · 结果集含 uid + app_source",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "IUe4BHt0fXHZ",
            "tag": "span",
            "owner": {
              "nodeName": "CheckSyntaxItem",
              "slot": "label"
            },
            "text": "语句合法性",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "CVuEGGDAhJWw",
            "tag": "span",
            "owner": {
              "nodeName": "CheckSyntaxItem",
              "slot": "children"
            },
            "text": "通过",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "ebSjA3IxA57F",
            "tag": "span",
            "owner": {
              "nodeName": "CheckSourceItem",
              "slot": "label"
            },
            "text": "底表",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "d6z2uP4ONGR8",
            "tag": "span",
            "owner": {
              "nodeName": "CheckSourceItem",
              "slot": "children"
            },
            "text": "通过",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "fc7khYlXjIBX",
            "tag": "span",
            "owner": {
              "nodeName": "CheckRoleItem",
              "slot": "label"
            },
            "text": "权限",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "8x3ceTSCp7Ss",
            "tag": "span",
            "owner": {
              "nodeName": "CheckRoleItem",
              "slot": "children"
            },
            "text": "通过",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "fLijcEQDhPtT",
            "tag": "span",
            "owner": {
              "nodeName": "CheckColumnItem",
              "slot": "label"
            },
            "text": "结果字段",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "133FigqPtxSE",
            "tag": "span",
            "owner": {
              "nodeName": "CheckColumnItem",
              "slot": "children"
            },
            "text": "通过",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "OglZ_ZXgRFpl",
            "tag": "span",
            "owner": {
              "nodeName": "CheckFilterItem",
              "slot": "label"
            },
            "text": "结尾过滤",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "gguw66feqYw9",
            "tag": "span",
            "owner": {
              "nodeName": "CheckFilterItem",
              "slot": "children"
            },
            "text": "通过",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": "HitCountStatistic",
            "elementUuid": "PBwbk30venId",
            "tag": "plasmic-component",
            "owner": {
              "nodeName": "SqlCard",
              "slot": "children"
            },
            "text": "",
            "component": "plasmicantd6statistic",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/libraries/antd_v6/components/statistic.md"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "f9nKztcxvomM",
            "tag": "span",
            "owner": {
              "nodeName": "HitCountStatistic",
              "slot": "title"
            },
            "text": "命中规模",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "3fCZPlFhpuVt",
            "tag": "span",
            "owner": {
              "nodeName": "HitCountStatistic",
              "slot": "suffix"
            },
            "text": "人",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "gH2SjYKmuth1",
            "tag": "span",
            "owner": {
              "nodeName": "SampleUidColumn",
              "slot": "title"
            },
            "text": "UID",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "k8QzetZmrccT",
            "tag": "span",
            "owner": {
              "nodeName": "SampleRegColumn",
              "slot": "title"
            },
            "text": "注册时间",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "UzRC0wgN4oyr",
            "tag": "span",
            "owner": {
              "nodeName": "SampleSourceColumn",
              "slot": "title"
            },
            "text": "App来源",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "vLrrj-HLgTIh",
            "tag": "span",
            "owner": {
              "nodeName": "SampleCreditColumn",
              "slot": "title"
            },
            "text": "授信状态",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "8brf2bnLDq4_",
            "tag": "span",
            "owner": {
              "nodeName": "SampleLoanColumn",
              "slot": "title"
            },
            "text": "借据状态",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": "SelectorFooter",
            "elementUuid": "Ma3PvaF0ocRh",
            "tag": "div",
            "owner": {
              "nodeName": "AppShell",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "6TAdzPfc4U8q",
            "tag": "div",
            "owner": {
              "nodeName": "AppShell",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "T6KJTnNaEvVP",
            "tag": "span",
            "owner": {
              "nodeName": "AppShell",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": "SubmitButton",
            "elementUuid": "B3G448iKAnU_",
            "tag": "plasmic-component",
            "owner": {
              "nodeName": "AppShell",
              "slot": "children"
            },
            "text": "",
            "component": "plasmicantd6button",
            "expectedOwner": null,
            "message": "Actual semantic owner/Slot differs from the naming plan",
            "rule": "references/libraries/antd_v6/components/button.md"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "b_VkvW8jbK1V",
            "tag": "span",
            "owner": {
              "nodeName": "SubmitButton",
              "slot": "children"
            },
            "text": "提交",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": "SaveSqlButton",
            "elementUuid": "VyP-fL2S8ax-",
            "tag": "plasmic-component",
            "owner": {
              "nodeName": "AppShell",
              "slot": "children"
            },
            "text": "",
            "component": "plasmicantd6button",
            "expectedOwner": null,
            "message": "Actual semantic owner/Slot differs from the naming plan",
            "rule": "references/libraries/antd_v6/components/button.md"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "_IFYls8ynP-B",
            "tag": "span",
            "owner": {
              "nodeName": "SaveSqlButton",
              "slot": "children"
            },
            "text": "保存 SQL",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": "OnlineButton",
            "elementUuid": "Qoa5-gIuph65",
            "tag": "plasmic-component",
            "owner": {
              "nodeName": "AppShell",
              "slot": "children"
            },
            "text": "",
            "component": "plasmicantd6button",
            "expectedOwner": null,
            "message": "Actual semantic owner/Slot differs from the naming plan",
            "rule": "references/libraries/antd_v6/components/button.md"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "1tbOyDiA8RbI",
            "tag": "span",
            "owner": {
              "nodeName": "OnlineButton",
              "slot": "children"
            },
            "text": "上线",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": "CancelButton",
            "elementUuid": "AwCL3YQe_LBZ",
            "tag": "plasmic-component",
            "owner": {
              "nodeName": "AppShell",
              "slot": "children"
            },
            "text": "",
            "component": "plasmicantd6button",
            "expectedOwner": null,
            "message": "Actual semantic owner/Slot differs from the naming plan",
            "rule": "references/libraries/antd_v6/components/button.md"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "n-wCl7AxURJy",
            "tag": "span",
            "owner": {
              "nodeName": "CancelButton",
              "slot": "children"
            },
            "text": "取消",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": "PreflightModal",
            "elementUuid": "8BaoliqK508U",
            "tag": "plasmic-component",
            "owner": {
              "nodeName": "AppShell",
              "slot": "children"
            },
            "text": "",
            "component": "plasmicantd6modal",
            "expectedOwner": null,
            "message": "Actual semantic owner/Slot differs from the naming plan",
            "rule": "references/libraries/antd_v6/components/modal.md"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "LqAyknQ2adQz",
            "tag": "div",
            "owner": {
              "nodeName": "PreflightModal",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "lSeZyjofG3Jy",
            "tag": "div",
            "owner": {
              "nodeName": "PreflightModal",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "TpSnlJoYS055",
            "tag": "span",
            "owner": {
              "nodeName": "PreflightModal",
              "slot": "children"
            },
            "text": "预跑进行中，请稍候",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "iMAx4c7OI3CL",
            "tag": "div",
            "owner": {
              "nodeName": "PreflightModal",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": "PreflightSuccessAlert",
            "elementUuid": "1ken_iRzRMwI",
            "tag": "plasmic-component",
            "owner": {
              "nodeName": "PreflightModal",
              "slot": "children"
            },
            "text": "",
            "component": "plasmicantd6alert",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/libraries/antd_v6/components/alert.md"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "JonBx-3vUrVB",
            "tag": "span",
            "owner": {
              "nodeName": "PreflightSuccessAlert",
              "slot": "title"
            },
            "text": "预跑成功 · 命中规模 12,340 人",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "7LeAbYasEssa",
            "tag": "div",
            "owner": {
              "nodeName": "PreflightModal",
              "slot": "children"
            },
            "text": "",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/design/naming.md#editor-node-naming"
          },
          {
            "check": "namingCoverage",
            "nodeName": "PreflightFailedAlert",
            "elementUuid": "Cuk2cO04aDxX",
            "tag": "plasmic-component",
            "owner": {
              "nodeName": "PreflightModal",
              "slot": "children"
            },
            "text": "",
            "component": "plasmicantd6alert",
            "message": "Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics",
            "rule": "references/libraries/antd_v6/components/alert.md"
          },
          {
            "check": "namingCoverage",
            "nodeName": null,
            "elementUuid": "Rq3FdqXfLxoL",
            "tag": "span",
            "owner": {
              "nodeName": "PreflightFailedAlert",
              "slot": "title"
            },
            "text": "预跑失败：底表分区缺失",
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
            "nodeName": "NameItem",
            "at": "/props/rules/0/message",
            "text": "请输入客群名称",
            "owner": "NameItem",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": null,
            "at": "/text",
            "text": "客群名称数据保存天数产出截止时间刷新模式客群类型格式化校验校验通过 · 结果集含 uid + app_source语句合法性通过底表通过权限通过结果字段通过结尾过滤通过命中规模人UID注册时间App来源授信状态借据状态提交保存 SQL上线取消预跑进行中，请稍候预跑成功 · 命中规模 12,340 人预跑失败：底表分区缺失",
            "owner": "NameItem",
            "slot": "label",
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "RetentionItem",
            "at": "/props/rules/0/message",
            "text": "请选择数据保存天数",
            "owner": "RetentionItem",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "DeadlineItem",
            "at": "/props/rules/0/message",
            "text": "请选择产出截止时间",
            "owner": "DeadlineItem",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "DeadlineTime",
            "at": "/props/value",
            "text": "2026-08-19T18:00:00",
            "owner": "DeadlineTime",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "SqlEditor",
            "at": "/props/value",
            "text": "SELECT uid, app_source, register_date\nFROM cdm_mx_dim_customer_user_df\nWHERE register_date >= '2026-07-01'\n  AND app_source = 'TACO'\nLIMIT 1000",
            "owner": "SqlEditor",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "SqlEditor",
            "at": "/props/placeholder",
            "text": "请输入只读 SELECT 语句",
            "owner": "SqlEditor",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "HitCountStatistic",
            "at": "/props/value",
            "text": "{{ $state.hitCount }}",
            "owner": "HitCountStatistic",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "SampleCreditBadge",
            "at": "/props/text",
            "text": "{{ row.creditStatus }}",
            "owner": "SampleCreditBadge",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "SampleLoanBadge",
            "at": "/props/text",
            "text": "{{ row.loanStatus }}",
            "owner": "SampleLoanBadge",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "NameItem",
            "at": "/slots/label/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "RetentionItem",
            "at": "/slots/label/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "DeadlineItem",
            "at": "/slots/label/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "RefreshItem",
            "at": "/slots/label/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "TypeItem",
            "at": "/slots/label/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "FormatButton",
            "at": "/slots/children/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "ValidateButton",
            "at": "/slots/children/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "CheckAlert",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "CheckSyntaxItem",
            "at": "/slots/label/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "CheckSourceItem",
            "at": "/slots/label/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "CheckRoleItem",
            "at": "/slots/label/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "CheckColumnItem",
            "at": "/slots/label/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "CheckFilterItem",
            "at": "/slots/label/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "SampleUidColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "SampleRegColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "SampleSourceColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "SampleCreditColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "SampleLoanColumn",
            "at": "/slots/title/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "SubmitButton",
            "at": "/slots/children/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "SaveSqlButton",
            "at": "/slots/children/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "OnlineButton",
            "at": "/slots/children/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          },
          {
            "check": "copyCoverage",
            "nodeName": "CancelButton",
            "at": "/slots/children/text",
            "message": "Reviewed UI copy is missing or moved to a different native location",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          }
        ],
        "inventory": {
          "nodes": [
            {
              "nodeName": null,
              "elementUuid": "FcnEDvDKoMDi",
              "tag": "div",
              "owner": null,
              "text": ""
            },
            {
              "nodeName": "AppShell",
              "elementUuid": "wjRgpPPbCcVP",
              "tag": "plasmic-component",
              "owner": null,
              "text": "",
              "component": "plasmicoverseasappshell"
            },
            {
              "nodeName": "SelectorBody",
              "elementUuid": "gSaXkTQpdSyc",
              "tag": "div",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "BasicInfoCard",
              "elementUuid": "ntoH2Jxb6C2h",
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
              "elementUuid": "FBAW67BO1vap",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicInfoCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6form"
            },
            {
              "nodeName": null,
              "elementUuid": "VS5FRUYZKAut",
              "tag": "div",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": null,
              "elementUuid": "V2C0-SD3evpi",
              "tag": "div",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "NameItem",
              "elementUuid": "ZrPv7WUfvfO7",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6formitem"
            },
            {
              "nodeName": null,
              "elementUuid": "jx-GufpmBIKn",
              "tag": "span",
              "owner": {
                "nodeName": "NameItem",
                "slot": "label"
              },
              "text": "客群名称"
            },
            {
              "nodeName": "NameInput",
              "elementUuid": "eZUawtK1aC2k",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "NameItem",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6input"
            },
            {
              "nodeName": null,
              "elementUuid": "H3iFXhx7kRkZ",
              "tag": "div",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "RetentionItem",
              "elementUuid": "n0qDiBtDLC5t",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6formitem"
            },
            {
              "nodeName": null,
              "elementUuid": "MM6U2sO1n_Gl",
              "tag": "span",
              "owner": {
                "nodeName": "RetentionItem",
                "slot": "label"
              },
              "text": "数据保存天数"
            },
            {
              "nodeName": "RetentionSelect",
              "elementUuid": "qLRLIXXCy8Xy",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "RetentionItem",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6select"
            },
            {
              "nodeName": null,
              "elementUuid": "Ihynw3Ub3wyz",
              "tag": "div",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "DeadlineItem",
              "elementUuid": "ZXzYJQGiriD5",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6formitem"
            },
            {
              "nodeName": null,
              "elementUuid": "JK_5NM5GOwck",
              "tag": "span",
              "owner": {
                "nodeName": "DeadlineItem",
                "slot": "label"
              },
              "text": "产出截止时间"
            },
            {
              "nodeName": "DeadlineTime",
              "elementUuid": "hVCGRomDNxUh",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "DeadlineItem",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6timepicker"
            },
            {
              "nodeName": null,
              "elementUuid": "c28JK3soEiYq",
              "tag": "div",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": null,
              "elementUuid": "ynCjWZ-9-yE5",
              "tag": "div",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "RefreshItem",
              "elementUuid": "H7DXt3a1h_Tb",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6formitem"
            },
            {
              "nodeName": null,
              "elementUuid": "g-CrdyBNdyqZ",
              "tag": "span",
              "owner": {
                "nodeName": "RefreshItem",
                "slot": "label"
              },
              "text": "刷新模式"
            },
            {
              "nodeName": "RefreshSelect",
              "elementUuid": "_e9CGte0txYy",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "RefreshItem",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6select"
            },
            {
              "nodeName": null,
              "elementUuid": "BEslg-CQRVgk",
              "tag": "div",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "TypeItem",
              "elementUuid": "u0c1EsVE3MED",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "BasicForm",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6formitem"
            },
            {
              "nodeName": null,
              "elementUuid": "IRXQb8n9dNb6",
              "tag": "span",
              "owner": {
                "nodeName": "TypeItem",
                "slot": "label"
              },
              "text": "客群类型"
            },
            {
              "nodeName": "TypeInput",
              "elementUuid": "qfIy8_QM_cba",
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
              "elementUuid": "2OUODHx0GzSq",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6card"
            },
            {
              "nodeName": null,
              "elementUuid": "2hZP3QXkvxUt",
              "tag": "div",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "extra"
              },
              "text": ""
            },
            {
              "nodeName": "FormatButton",
              "elementUuid": "sosPJ5A1BoKW",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "extra"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": null,
              "elementUuid": "Sc6lsIWHVrA_",
              "tag": "span",
              "owner": {
                "nodeName": "FormatButton",
                "slot": "children"
              },
              "text": "格式化"
            },
            {
              "nodeName": "ValidateButton",
              "elementUuid": "hu064uVQTK13",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "extra"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": null,
              "elementUuid": "7WMnEbsHrCQ_",
              "tag": "span",
              "owner": {
                "nodeName": "ValidateButton",
                "slot": "children"
              },
              "text": "校验"
            },
            {
              "nodeName": null,
              "elementUuid": "FAqsVzCvikJ2",
              "tag": "div",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "SqlEditor",
              "elementUuid": "NmXsdFTDsK7B",
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
              "elementUuid": "s15xI_z-jJvH",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6alert"
            },
            {
              "nodeName": null,
              "elementUuid": "931ky6ocCQPX",
              "tag": "span",
              "owner": {
                "nodeName": "CheckAlert",
                "slot": "title"
              },
              "text": "校验通过 · 结果集含 uid + app_source"
            },
            {
              "nodeName": "CheckDescriptions",
              "elementUuid": "TPYtjZfNTS1I",
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
              "elementUuid": "8MzGI7xceL9a",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CheckDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": null,
              "elementUuid": "IUe4BHt0fXHZ",
              "tag": "span",
              "owner": {
                "nodeName": "CheckSyntaxItem",
                "slot": "label"
              },
              "text": "语句合法性"
            },
            {
              "nodeName": null,
              "elementUuid": "CVuEGGDAhJWw",
              "tag": "span",
              "owner": {
                "nodeName": "CheckSyntaxItem",
                "slot": "children"
              },
              "text": "通过"
            },
            {
              "nodeName": "CheckSourceItem",
              "elementUuid": "3ZeYFz-_mYrg",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CheckDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": null,
              "elementUuid": "ebSjA3IxA57F",
              "tag": "span",
              "owner": {
                "nodeName": "CheckSourceItem",
                "slot": "label"
              },
              "text": "底表"
            },
            {
              "nodeName": null,
              "elementUuid": "d6z2uP4ONGR8",
              "tag": "span",
              "owner": {
                "nodeName": "CheckSourceItem",
                "slot": "children"
              },
              "text": "通过"
            },
            {
              "nodeName": "CheckRoleItem",
              "elementUuid": "hp1Jpn49HquU",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CheckDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": null,
              "elementUuid": "fc7khYlXjIBX",
              "tag": "span",
              "owner": {
                "nodeName": "CheckRoleItem",
                "slot": "label"
              },
              "text": "权限"
            },
            {
              "nodeName": null,
              "elementUuid": "8x3ceTSCp7Ss",
              "tag": "span",
              "owner": {
                "nodeName": "CheckRoleItem",
                "slot": "children"
              },
              "text": "通过"
            },
            {
              "nodeName": "CheckColumnItem",
              "elementUuid": "Wc2Fjf_fiuRH",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CheckDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": null,
              "elementUuid": "fLijcEQDhPtT",
              "tag": "span",
              "owner": {
                "nodeName": "CheckColumnItem",
                "slot": "label"
              },
              "text": "结果字段"
            },
            {
              "nodeName": null,
              "elementUuid": "133FigqPtxSE",
              "tag": "span",
              "owner": {
                "nodeName": "CheckColumnItem",
                "slot": "children"
              },
              "text": "通过"
            },
            {
              "nodeName": "CheckFilterItem",
              "elementUuid": "V2LNrq1d1Fci",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "CheckDescriptions",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6descriptionsitem"
            },
            {
              "nodeName": null,
              "elementUuid": "OglZ_ZXgRFpl",
              "tag": "span",
              "owner": {
                "nodeName": "CheckFilterItem",
                "slot": "label"
              },
              "text": "结尾过滤"
            },
            {
              "nodeName": null,
              "elementUuid": "gguw66feqYw9",
              "tag": "span",
              "owner": {
                "nodeName": "CheckFilterItem",
                "slot": "children"
              },
              "text": "通过"
            },
            {
              "nodeName": "HitCountStatistic",
              "elementUuid": "PBwbk30venId",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "SqlCard",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6statistic"
            },
            {
              "nodeName": null,
              "elementUuid": "f9nKztcxvomM",
              "tag": "span",
              "owner": {
                "nodeName": "HitCountStatistic",
                "slot": "title"
              },
              "text": "命中规模"
            },
            {
              "nodeName": null,
              "elementUuid": "3fCZPlFhpuVt",
              "tag": "span",
              "owner": {
                "nodeName": "HitCountStatistic",
                "slot": "suffix"
              },
              "text": "人"
            },
            {
              "nodeName": "PreviewTable",
              "elementUuid": "kdTkQuLbdKfE",
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
              "elementUuid": "aQoR5oHG03GA",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreviewTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "gH2SjYKmuth1",
              "tag": "span",
              "owner": {
                "nodeName": "SampleUidColumn",
                "slot": "title"
              },
              "text": "UID"
            },
            {
              "nodeName": "SampleRegColumn",
              "elementUuid": "ZjG1ZK5Coagn",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreviewTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "k8QzetZmrccT",
              "tag": "span",
              "owner": {
                "nodeName": "SampleRegColumn",
                "slot": "title"
              },
              "text": "注册时间"
            },
            {
              "nodeName": "SampleSourceColumn",
              "elementUuid": "ax7XVOMB8nmc",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreviewTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "UzRC0wgN4oyr",
              "tag": "span",
              "owner": {
                "nodeName": "SampleSourceColumn",
                "slot": "title"
              },
              "text": "App来源"
            },
            {
              "nodeName": "SampleCreditColumn",
              "elementUuid": "i8hInrBO3noY",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreviewTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "vLrrj-HLgTIh",
              "tag": "span",
              "owner": {
                "nodeName": "SampleCreditColumn",
                "slot": "title"
              },
              "text": "授信状态"
            },
            {
              "nodeName": "SampleCreditBadge",
              "elementUuid": "hHxIyFTM5Y8l",
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
              "elementUuid": "PetH4ZHNW3lK",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreviewTable",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6tablecolumn"
            },
            {
              "nodeName": null,
              "elementUuid": "8brf2bnLDq4_",
              "tag": "span",
              "owner": {
                "nodeName": "SampleLoanColumn",
                "slot": "title"
              },
              "text": "借据状态"
            },
            {
              "nodeName": "SampleLoanBadge",
              "elementUuid": "GOjVTST9rhfp",
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
              "elementUuid": "Ma3PvaF0ocRh",
              "tag": "div",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": null,
              "elementUuid": "6TAdzPfc4U8q",
              "tag": "div",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": null,
              "elementUuid": "T6KJTnNaEvVP",
              "tag": "span",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "SubmitButton",
              "elementUuid": "B3G448iKAnU_",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": null,
              "elementUuid": "b_VkvW8jbK1V",
              "tag": "span",
              "owner": {
                "nodeName": "SubmitButton",
                "slot": "children"
              },
              "text": "提交"
            },
            {
              "nodeName": "SaveSqlButton",
              "elementUuid": "VyP-fL2S8ax-",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": null,
              "elementUuid": "_IFYls8ynP-B",
              "tag": "span",
              "owner": {
                "nodeName": "SaveSqlButton",
                "slot": "children"
              },
              "text": "保存 SQL"
            },
            {
              "nodeName": "OnlineButton",
              "elementUuid": "Qoa5-gIuph65",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": null,
              "elementUuid": "1tbOyDiA8RbI",
              "tag": "span",
              "owner": {
                "nodeName": "OnlineButton",
                "slot": "children"
              },
              "text": "上线"
            },
            {
              "nodeName": "CancelButton",
              "elementUuid": "AwCL3YQe_LBZ",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "AppShell",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6button"
            },
            {
              "nodeName": null,
              "elementUuid": "n-wCl7AxURJy",
              "tag": "span",
              "owner": {
                "nodeName": "CancelButton",
                "slot": "children"
              },
              "text": "取消"
            },
            {
              "nodeName": "PreflightModal",
              "elementUuid": "8BaoliqK508U",
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
              "elementUuid": "dEcQ2RHklQ0l",
              "tag": "span",
              "owner": {
                "nodeName": "PreflightModal",
                "slot": "title"
              },
              "text": "预跑结果"
            },
            {
              "nodeName": null,
              "elementUuid": "LqAyknQ2adQz",
              "tag": "div",
              "owner": {
                "nodeName": "PreflightModal",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": null,
              "elementUuid": "lSeZyjofG3Jy",
              "tag": "div",
              "owner": {
                "nodeName": "PreflightModal",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": null,
              "elementUuid": "TpSnlJoYS055",
              "tag": "span",
              "owner": {
                "nodeName": "PreflightModal",
                "slot": "children"
              },
              "text": "预跑进行中，请稍候"
            },
            {
              "nodeName": null,
              "elementUuid": "iMAx4c7OI3CL",
              "tag": "div",
              "owner": {
                "nodeName": "PreflightModal",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "PreflightSuccessAlert",
              "elementUuid": "1ken_iRzRMwI",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreflightModal",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6alert"
            },
            {
              "nodeName": null,
              "elementUuid": "JonBx-3vUrVB",
              "tag": "span",
              "owner": {
                "nodeName": "PreflightSuccessAlert",
                "slot": "title"
              },
              "text": "预跑成功 · 命中规模 12,340 人"
            },
            {
              "nodeName": null,
              "elementUuid": "7LeAbYasEssa",
              "tag": "div",
              "owner": {
                "nodeName": "PreflightModal",
                "slot": "children"
              },
              "text": ""
            },
            {
              "nodeName": "PreflightFailedAlert",
              "elementUuid": "Cuk2cO04aDxX",
              "tag": "plasmic-component",
              "owner": {
                "nodeName": "PreflightModal",
                "slot": "children"
              },
              "text": "",
              "component": "plasmicantd6alert"
            },
            {
              "nodeName": null,
              "elementUuid": "Rq3FdqXfLxoL",
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
              "nodeName": null,
              "at": "/text",
              "text": "客群名称数据保存天数产出截止时间刷新模式客群类型格式化校验校验通过 · 结果集含 uid + app_source语句合法性通过底表通过权限通过结果字段通过结尾过滤通过命中规模人UID注册时间App来源授信状态借据状态提交保存 SQL上线取消预跑进行中，请稍候预跑成功 · 命中规模 12,340 人预跑失败：底表分区缺失",
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
              "nodeName": "RetentionItem",
              "at": "/props/rules/0/message",
              "text": "请选择数据保存天数",
              "owner": "RetentionItem",
              "slot": null
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
              "nodeName": "DeadlineTime",
              "at": "/props/value",
              "text": "2026-08-19T18:00:00",
              "owner": "DeadlineTime",
              "slot": null
            },
            {
              "nodeName": "RefreshSelect",
              "at": "/props/options/0/label",
              "text": "T+1 动态",
              "owner": "RefreshSelect",
              "slot": null
            },
            {
              "nodeName": "SqlEditor",
              "at": "/props/value",
              "text": "SELECT uid, app_source, register_date\nFROM cdm_mx_dim_customer_user_df\nWHERE register_date >= '2026-07-01'\n  AND app_source = 'TACO'\nLIMIT 1000",
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
              "nodeName": "HitCountStatistic",
              "at": "/props/value",
              "text": "{{ $state.hitCount }}",
              "owner": "HitCountStatistic",
              "slot": null
            },
            {
              "nodeName": "SampleCreditBadge",
              "at": "/props/text",
              "text": "{{ row.creditStatus }}",
              "owner": "SampleCreditBadge",
              "slot": null
            },
            {
              "nodeName": "SampleLoanBadge",
              "at": "/props/text",
              "text": "{{ row.loanStatus }}",
              "owner": "SampleLoanBadge",
              "slot": null
            },
            {
              "nodeName": "PreflightTitle",
              "at": "/text",
              "text": "预跑结果",
              "owner": "PreflightModal",
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

## forms: failed

```json
{
  "passed": false,
  "checkedFields": 0,
  "errors": [
    {
      "error": "Nonempty unique source-derived Page inventory required",
      "rule": "references/libraries/antd_v6/components/form.md#project-inventory-and-acceptance"
    },
    {
      "error": "Page inventory mismatch",
      "input": "overview",
      "rule": "references/libraries/antd_v6/components/form.md#project-inventory-and-acceptance"
    },
    {
      "error": "Page inventory mismatch",
      "input": "readback",
      "rule": "references/libraries/antd_v6/components/form.md#project-inventory-and-acceptance"
    }
  ]
}
```

## descriptions: failed

```json
{
  "errorType": "ValueError",
  "error": "Full-project inventories must cover every Page, including explicit empty lists"
}
```

## overlays: failed

```json
{
  "errorType": "ValueError",
  "error": "Full-project inventories must cover every Page, including explicit empty lists"
}
```

## slots: failed

```json
{
  "errorType": "ValueError",
  "error": "Nonempty reviewed Page inventory required"
}
```

## shell_height: passed

```json
{
  "passed": true,
  "pages": [
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
