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
  "collectedAt": "2026-10-25T03:54:13.768288+00:00",
  "before": {
    "projectId": "uSwwgCkC1ujK3EVVPvmHdW",
    "branchId": null,
    "sessionId": "5zXK8lDocMXa",
    "revision": 57,
    "changeCounter": 115
  },
  "after": {
    "projectId": "uSwwgCkC1ujK3EVVPvmHdW",
    "branchId": null,
    "sessionId": "5zXK8lDocMXa",
    "revision": 57,
    "changeCounter": 115
  },
  "files": {
    "overview.json": "c32da1aa060933d1824532153aa768a15d59d3c937dff5120a8ac9018a7a3e23",
    "pages.json": "c6e64dead7845198507adb2b7d70f67e56ed8454a82b6930cb26f0d69d1444eb",
    "layouts.json": "5ea9927c35ec9f2bd376641a224269e09948d4e0543f85fef166b1585ee35395"
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
  "expectedPageCount": 4,
  "actualPageCount": 4,
  "errors": [
    {
      "check": "uiCopy",
      "text": "仅 SELECT",
      "node": "CheckSyntaxItemText",
      "message": "button copy exceeds the 6-character budget; shorten it to the source's own UI wording",
      "path": "/groups/selector",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "check": "uiCopy",
      "text": "dwt/cdm",
      "node": "CheckSourceItemText",
      "message": "button copy exceeds the 6-character budget; shorten it to the source's own UI wording",
      "path": "/groups/selector",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "check": "uiCopy",
      "text": "uid+app_source",
      "node": "CheckColumnItemText",
      "message": "button copy exceeds the 6-character budget; shorten it to the source's own UI wording",
      "path": "/groups/selector",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "check": "uiCopy",
      "text": "app_source",
      "node": "CheckFilterItemText",
      "message": "button copy exceeds the 6-character budget; shorten it to the source's own UI wording",
      "path": "/groups/selector",
      "rule": "references/design/content-review.md#saved-model-acceptance"
    },
    {
      "check": "binding",
      "path": "/groups/selector",
      "node": "SqlEditor",
      "missingEvent": "onChange",
      "rule": "references/libraries/antd_v6/components/input.md"
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
      "path": "/groups/selector",
      "check": "feedback",
      "node": "SubmitButton",
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
      "text": "{{ $state.sqlText }}",
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
        "path": "/groups/selector",
        "check": "feedback",
        "node": "SubmitButton",
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
        "text": "{{ $state.sqlText }}",
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
      }
    ],
    "templates": [
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
            "text": "{{ $state.sqlText }}",
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
              "nodeName": "DeadlineTime",
              "at": "/props/value",
              "text": "2026-08-19T18:00:00",
              "owner": "DeadlineTime",
              "slot": null
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

## forms: failed

```json
{
  "errorType": "AttributeError",
  "error": "'str' object has no attribute 'items'"
}
```

## descriptions: passed

```json
{
  "passed": true,
  "errors": []
}
```

## overlays: failed

```json
{
  "errorType": "TypeError",
  "error": "string indices must be integers"
}
```

## slots: failed

```json
{
  "passed": false,
  "pages": [
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
      "unprovidedSlotChildren": [
        {
          "component": "SqlCard",
          "slot": "extra",
          "elementUuid": "X8dwfIWE9Qxo"
        }
      ],
      "passed": false
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
