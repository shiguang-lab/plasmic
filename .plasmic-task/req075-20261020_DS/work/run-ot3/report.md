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
  "collectedAt": "2026-10-25T03:57:01.991391+00:00",
  "before": {
    "projectId": "uSwwgCkC1ujK3EVVPvmHdW",
    "branchId": null,
    "sessionId": "5zXK8lDocMXa",
    "revision": 66,
    "changeCounter": 177
  },
  "after": {
    "projectId": "uSwwgCkC1ujK3EVVPvmHdW",
    "branchId": null,
    "sessionId": "5zXK8lDocMXa",
    "revision": 66,
    "changeCounter": 177
  },
  "files": {
    "overview.json": "c32da1aa060933d1824532153aa768a15d59d3c937dff5120a8ac9018a7a3e23",
    "pages.json": "a1c09e7b0590cb6122001b1bfa2a6994d1792168cc4429374fa128e21ae15266",
    "layouts.json": "754ec60c9057e0cf4a7e99f195df674d046409341417dbe91a42d525e7af6474"
  },
  "validation": {
    "componentUuids": [
      "cVcKW-ucQxXU"
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
  "pagePath": "/groups/onetime-create"
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
      "path": "/groups/onetime-create",
      "check": "copyCoverage",
      "nodeName": "OnetimeHitCount",
      "at": "/props/value",
      "text": "{{ $state.hitCount }}",
      "owner": "OnetimeHitCount",
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
        "path": "/groups/onetime-create",
        "check": "copyCoverage",
        "nodeName": "OnetimeHitCount",
        "at": "/props/value",
        "text": "{{ $state.hitCount }}",
        "owner": "OnetimeHitCount",
        "slot": null,
        "expected": null,
        "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
        "rule": "references/design/content-review.md#saved-model-acceptance"
      }
    ],
    "templates": [
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
      }
    ],
    "content": [
      {
        "path": "/groups/onetime-create",
        "passed": false,
        "errors": [
          {
            "check": "copyCoverage",
            "nodeName": "OnetimeHitCount",
            "at": "/props/value",
            "text": "{{ $state.hitCount }}",
            "owner": "OnetimeHitCount",
            "slot": null,
            "expected": null,
            "message": "Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source",
            "rule": "references/design/content-review.md#saved-model-acceptance"
          }
        ],
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
  "checkedFields": 2,
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
