# 全仓审核覆盖清单

[审核结论、修复建议与测试结果](repository-audit-2026-11-22.md)

本表按工作区路径统计实际进入两轮静态扫描的 JS/TS 文件（含测试和声明）。Vitest 文件数来自本次根配置及 WAB 的 studio、server、studio-theme 三个项目的收集结果。数字 0 表示这四个配置在该目录没有收集到测试文件；Node、Go、Python、Preview 独立测试和浏览器脚本的运行结果在主报告单列。下列为父子目录的不同视图，跨表的数字有重叠。

## 顶层工作区

| 目录 | JS/TS 扫描文件 | Vitest 收集文件 |
| --- | ---: | ---: |
| [.github](../.github/) | 0 | 0 |
| [.plasmic-task](../.plasmic-task/) | 0 | 0 |
| [ai](../ai/) | 10 | 0 |
| [deploy](../deploy/) | 28 | 0 |
| [desktop](../desktop/) | 313 | 0 |
| [docs](../docs/) | 42 | 0 |
| [msw](../msw/) | 1 | 0 |
| [output](../output/) | 0 | 0 |
| [packages](../packages/) | 501 | 51 |
| [plasmicpkgs](../plasmicpkgs/) | 818 | 78 |
| [plasmicpkgs-dev](../plasmicpkgs-dev/) | 7 | 0 |
| [platform](../platform/) | 5253 | 1024 |
| [scripts](../scripts/) | 37 | 0 |
| [vendor](../vendor/) | 77 | 0 |

## 平台应用与共享运行时

| 目录 | JS/TS 扫描文件 | Vitest 收集文件 |
| --- | ---: | ---: |
| [platform/canvas-packages](../platform/canvas-packages/) | 101 | 0 |
| [platform/host-test](../platform/host-test/) | 29 | 0 |
| [platform/integration-tests](../platform/integration-tests/) | 4 | 0 |
| [platform/live-frame](../platform/live-frame/) | 11 | 0 |
| [platform/loader-bundle-env](../platform/loader-bundle-env/) | 6 | 0 |
| [platform/loader-html-hydrate](../platform/loader-html-hydrate/) | 3 | 0 |
| [platform/loader-tests](../platform/loader-tests/) | 137 | 0 |
| [platform/patches](../platform/patches/) | 0 | 0 |
| [platform/preview](../platform/preview/) | 11 | 0 |
| [platform/react-renderer](../platform/react-renderer/) | 6 | 0 |
| [platform/react-web-bundle](../platform/react-web-bundle/) | 7 | 0 |
| [platform/shared](../platform/shared/) | 5 | 0 |
| [platform/shared/hosting](../platform/shared/hosting/) | 1 | 0 |
| [platform/shared/preview](../platform/shared/preview/) | 2 | 0 |
| [platform/shared/resource-cache](../platform/shared/resource-cache/) | 2 | 0 |
| [platform/sub](../platform/sub/) | 6 | 0 |
| [platform/wab](../platform/wab/) | 4927 | 1024 |

## Studio 客户端

| 目录 | JS/TS 扫描文件 | Vitest 收集文件 |
| --- | ---: | ---: |
| [platform/wab/src/wab/client/__testonly__](../platform/wab/src/wab/client/__testonly__/) | 11 | 0 |
| [platform/wab/src/wab/client/app-auth](../platform/wab/src/wab/client/app-auth/) | 1 | 0 |
| [platform/wab/src/wab/client/canvas-snapshot](../platform/wab/src/wab/client/canvas-snapshot/) | 5 | 2 |
| [platform/wab/src/wab/client/clipboard](../platform/wab/src/wab/client/clipboard/) | 12 | 3 |
| [platform/wab/src/wab/client/code-components](../platform/wab/src/wab/client/code-components/) | 6 | 2 |
| [platform/wab/src/wab/client/commands](../platform/wab/src/wab/client/commands/) | 18 | 0 |
| [platform/wab/src/wab/client/components](../platform/wab/src/wab/client/components/) | 1541 | 497 |
| [platform/wab/src/wab/client/contexts](../platform/wab/src/wab/client/contexts/) | 3 | 0 |
| [platform/wab/src/wab/client/copilot](../platform/wab/src/wab/client/copilot/) | 33 | 18 |
| [platform/wab/src/wab/client/data](../platform/wab/src/wab/client/data/) | 3 | 1 |
| [platform/wab/src/wab/client/definitions](../platform/wab/src/wab/client/definitions/) | 2 | 0 |
| [platform/wab/src/wab/client/figma-importer](../platform/wab/src/wab/client/figma-importer/) | 19 | 7 |
| [platform/wab/src/wab/client/file-drag](../platform/wab/src/wab/client/file-drag/) | 3 | 1 |
| [platform/wab/src/wab/client/frame-ctx](../platform/wab/src/wab/client/frame-ctx/) | 18 | 7 |
| [platform/wab/src/wab/client/hooks](../platform/wab/src/wab/client/hooks/) | 25 | 5 |
| [platform/wab/src/wab/client/i18n](../platform/wab/src/wab/client/i18n/) | 12 | 7 |
| [platform/wab/src/wab/client/image](../platform/wab/src/wab/client/image/) | 4 | 1 |
| [platform/wab/src/wab/client/linting](../platform/wab/src/wab/client/linting/) | 4 | 1 |
| [platform/wab/src/wab/client/messages](../platform/wab/src/wab/client/messages/) | 1 | 0 |
| [platform/wab/src/wab/client/observability](../platform/wab/src/wab/client/observability/) | 4 | 0 |
| [platform/wab/src/wab/client/operations](../platform/wab/src/wab/client/operations/) | 68 | 32 |
| [platform/wab/src/wab/client/pen-importer](../platform/wab/src/wab/client/pen-importer/) | 13 | 4 |
| [platform/wab/src/wab/client/plasmic](../platform/wab/src/wab/client/plasmic/) | 1382 | 1 |
| [platform/wab/src/wab/client/react-global-hook](../platform/wab/src/wab/client/react-global-hook/) | 15 | 6 |
| [platform/wab/src/wab/client/route](../platform/wab/src/wab/client/route/) | 10 | 3 |
| [platform/wab/src/wab/client/shortcuts](../platform/wab/src/wab/client/shortcuts/) | 9 | 3 |
| [platform/wab/src/wab/client/state-management](../platform/wab/src/wab/client/state-management/) | 3 | 0 |
| [platform/wab/src/wab/client/stores](../platform/wab/src/wab/client/stores/) | 10 | 5 |
| [platform/wab/src/wab/client/studio-ctx](../platform/wab/src/wab/client/studio-ctx/) | 189 | 103 |
| [platform/wab/src/wab/client/tours](../platform/wab/src/wab/client/tours/) | 16 | 3 |
| [platform/wab/src/wab/client/utils](../platform/wab/src/wab/client/utils/) | 8 | 2 |
| [platform/wab/src/wab/client/web-importer](../platform/wab/src/wab/client/web-importer/) | 10 | 2 |

该目录直属 JS/TS 文件另有 103 个。

## WAB 服务端

| 目录 | JS/TS 扫描文件 | Vitest 收集文件 |
| --- | ---: | ---: |
| [platform/wab/src/wab/server/__testonly__](../platform/wab/src/wab/server/__testonly__/) | 7 | 1 |
| [platform/wab/src/wab/server/analytics](../platform/wab/src/wab/server/analytics/) | 4 | 2 |
| [platform/wab/src/wab/server/auth](../platform/wab/src/wab/server/auth/) | 7 | 1 |
| [platform/wab/src/wab/server/bundle-migrations](../platform/wab/src/wab/server/bundle-migrations/) | 259 | 0 |
| [platform/wab/src/wab/server/cdn](../platform/wab/src/wab/server/cdn/) | 2 | 1 |
| [platform/wab/src/wab/server/code-components](../platform/wab/src/wab/server/code-components/) | 4 | 3 |
| [platform/wab/src/wab/server/component-reuse](../platform/wab/src/wab/server/component-reuse/) | 4 | 0 |
| [platform/wab/src/wab/server/copilot](../platform/wab/src/wab/server/copilot/) | 20 | 9 |
| [platform/wab/src/wab/server/data-sources](../platform/wab/src/wab/server/data-sources/) | 16 | 6 |
| [platform/wab/src/wab/server/db](../platform/wab/src/wab/server/db/) | 49 | 11 |
| [platform/wab/src/wab/server/discourse](../platform/wab/src/wab/server/discourse/) | 5 | 0 |
| [platform/wab/src/wab/server/emails](../platform/wab/src/wab/server/emails/) | 56 | 5 |
| [platform/wab/src/wab/server/entities](../platform/wab/src/wab/server/entities/) | 2 | 0 |
| [platform/wab/src/wab/server/github](../platform/wab/src/wab/server/github/) | 9 | 0 |
| [platform/wab/src/wab/server/image](../platform/wab/src/wab/server/image/) | 1 | 0 |
| [platform/wab/src/wab/server/loader](../platform/wab/src/wab/server/loader/) | 21 | 11 |
| [platform/wab/src/wab/server/migrations](../platform/wab/src/wab/server/migrations/) | 36 | 0 |
| [platform/wab/src/wab/server/observability](../platform/wab/src/wab/server/observability/) | 3 | 0 |
| [platform/wab/src/wab/server/pkg-mgr](../platform/wab/src/wab/server/pkg-mgr/) | 2 | 0 |
| [platform/wab/src/wab/server/routes](../platform/wab/src/wab/server/routes/) | 79 | 33 |
| [platform/wab/src/wab/server/scripts](../platform/wab/src/wab/server/scripts/) | 5 | 2 |
| [platform/wab/src/wab/server/site-operation](../platform/wab/src/wab/server/site-operation/) | 1 | 0 |
| [platform/wab/src/wab/server/usage](../platform/wab/src/wab/server/usage/) | 1 | 1 |
| [platform/wab/src/wab/server/util](../platform/wab/src/wab/server/util/) | 18 | 4 |
| [platform/wab/src/wab/server/workers](../platform/wab/src/wab/server/workers/) | 8 | 1 |

该目录直属 JS/TS 文件另有 29 个。

## WAB 共享模型

| 目录 | JS/TS 扫描文件 | Vitest 收集文件 |
| --- | ---: | ---: |
| [platform/wab/src/wab/shared/ApiErrors](../platform/wab/src/wab/shared/ApiErrors/) | 4 | 1 |
| [platform/wab/src/wab/shared/__testonly__](../platform/wab/src/wab/shared/__testonly__/) | 1 | 0 |
| [platform/wab/src/wab/shared/api](../platform/wab/src/wab/shared/api/) | 3 | 0 |
| [platform/wab/src/wab/shared/billing](../platform/wab/src/wab/shared/billing/) | 4 | 2 |
| [platform/wab/src/wab/shared/code-components](../platform/wab/src/wab/shared/code-components/) | 9 | 4 |
| [platform/wab/src/wab/shared/codegen](../platform/wab/src/wab/shared/codegen/) | 79 | 30 |
| [platform/wab/src/wab/shared/copilot](../platform/wab/src/wab/shared/copilot/) | 20 | 5 |
| [platform/wab/src/wab/shared/core](../platform/wab/src/wab/shared/core/) | 68 | 26 |
| [platform/wab/src/wab/shared/css](../platform/wab/src/wab/shared/css/) | 18 | 7 |
| [platform/wab/src/wab/shared/data](../platform/wab/src/wab/shared/data/) | 2 | 0 |
| [platform/wab/src/wab/shared/data-picker](../platform/wab/src/wab/shared/data-picker/) | 1 | 0 |
| [platform/wab/src/wab/shared/data-sources](../platform/wab/src/wab/shared/data-sources/) | 1 | 0 |
| [platform/wab/src/wab/shared/data-sources-meta](../platform/wab/src/wab/shared/data-sources-meta/) | 11 | 1 |
| [platform/wab/src/wab/shared/discourse](../platform/wab/src/wab/shared/discourse/) | 2 | 0 |
| [platform/wab/src/wab/shared/element-repr](../platform/wab/src/wab/shared/element-repr/) | 3 | 1 |
| [platform/wab/src/wab/shared/eval](../platform/wab/src/wab/shared/eval/) | 9 | 4 |
| [platform/wab/src/wab/shared/folders](../platform/wab/src/wab/shared/folders/) | 4 | 2 |
| [platform/wab/src/wab/shared/insertable-templates](../platform/wab/src/wab/shared/insertable-templates/) | 6 | 2 |
| [platform/wab/src/wab/shared/linting](../platform/wab/src/wab/shared/linting/) | 11 | 2 |
| [platform/wab/src/wab/shared/model](../platform/wab/src/wab/shared/model/) | 12 | 3 |
| [platform/wab/src/wab/shared/observability](../platform/wab/src/wab/shared/observability/) | 7 | 1 |
| [platform/wab/src/wab/shared/plume](../platform/wab/src/wab/shared/plume/) | 15 | 1 |
| [platform/wab/src/wab/shared/pricing](../platform/wab/src/wab/shared/pricing/) | 1 | 0 |
| [platform/wab/src/wab/shared/register-library](../platform/wab/src/wab/shared/register-library/) | 1 | 0 |
| [platform/wab/src/wab/shared/route](../platform/wab/src/wab/shared/route/) | 3 | 1 |
| [platform/wab/src/wab/shared/site-diffs](../platform/wab/src/wab/shared/site-diffs/) | 15 | 6 |
| [platform/wab/src/wab/shared/site-operation](../platform/wab/src/wab/shared/site-operation/) | 5 | 0 |
| [platform/wab/src/wab/shared/utils](../platform/wab/src/wab/shared/utils/) | 12 | 4 |
| [platform/wab/src/wab/shared/web-exporter](../platform/wab/src/wab/shared/web-exporter/) | 11 | 4 |

该目录直属 JS/TS 文件另有 145 个。

## SDK、CLI、脚手架及组件包

| 目录 | JS/TS 扫描文件 | Vitest 收集文件 |
| --- | ---: | ---: |
| [packages/auth-api](../packages/auth-api/) | 2 | 0 |
| [packages/auth-react](../packages/auth-react/) | 2 | 0 |
| [packages/cli](../packages/cli/) | 66 | 11 |
| [packages/create-plasmic-app](../packages/create-plasmic-app/) | 208 | 2 |
| [packages/data-sources](../packages/data-sources/) | 24 | 8 |
| [packages/data-sources-context](../packages/data-sources-context/) | 1 | 0 |
| [packages/host](../packages/host/) | 34 | 3 |
| [packages/loader-angular](../packages/loader-angular/) | 0 | 0 |
| [packages/loader-core](../packages/loader-core/) | 5 | 1 |
| [packages/loader-edge](../packages/loader-edge/) | 3 | 1 |
| [packages/loader-fetcher](../packages/loader-fetcher/) | 6 | 2 |
| [packages/loader-nextjs](../packages/loader-nextjs/) | 14 | 1 |
| [packages/loader-react](../packages/loader-react/) | 26 | 6 |
| [packages/loader-splits](../packages/loader-splits/) | 7 | 3 |
| [packages/loader-svelte](../packages/loader-svelte/) | 0 | 0 |
| [packages/loader-vue](../packages/loader-vue/) | 0 | 0 |
| [packages/plasmic](../packages/plasmic/) | 1 | 0 |
| [packages/plasmic-cli](../packages/plasmic-cli/) | 13 | 0 |
| [packages/prepass](../packages/prepass/) | 4 | 3 |
| [packages/query](../packages/query/) | 3 | 1 |
| [packages/react-web](../packages/react-web/) | 75 | 8 |
| [packages/react-web-runtime](../packages/react-web-runtime/) | 5 | 1 |
| [packages/watcher](../packages/watcher/) | 2 | 0 |
| [plasmicpkgs/airtable](../plasmicpkgs/airtable/) | 2 | 0 |
| [plasmicpkgs/antd](../plasmicpkgs/antd/) | 21 | 1 |
| [plasmicpkgs/antd-icons](../plasmicpkgs/antd-icons/) | 3 | 0 |
| [plasmicpkgs/antd5](../plasmicpkgs/antd5/) | 57 | 5 |
| [plasmicpkgs/antd6](../plasmicpkgs/antd6/) | 184 | 33 |
| [plasmicpkgs/cms](../plasmicpkgs/cms/) | 7 | 1 |
| [plasmicpkgs/commerce-providers/commerce](../plasmicpkgs/commerce-providers/commerce/) | 66 | 3 |
| [plasmicpkgs/commerce-providers/commercetools](../plasmicpkgs/commerce-providers/commercetools/) | 30 | 0 |
| [plasmicpkgs/commerce-providers/local](../plasmicpkgs/commerce-providers/local/) | 20 | 0 |
| [plasmicpkgs/commerce-providers/saleor](../plasmicpkgs/commerce-providers/saleor/) | 58 | 0 |
| [plasmicpkgs/commerce-providers/shopify](../plasmicpkgs/commerce-providers/shopify/) | 42 | 1 |
| [plasmicpkgs/commerce-providers/swell](../plasmicpkgs/commerce-providers/swell/) | 50 | 0 |
| [plasmicpkgs/contentful](../plasmicpkgs/contentful/) | 7 | 1 |
| [plasmicpkgs/fetch](../plasmicpkgs/fetch/) | 1 | 0 |
| [plasmicpkgs/framer-motion](../plasmicpkgs/framer-motion/) | 2 | 0 |
| [plasmicpkgs/google-maps](../plasmicpkgs/google-maps/) | 2 | 0 |
| [plasmicpkgs/graphql](../plasmicpkgs/graphql/) | 1 | 0 |
| [plasmicpkgs/keen-slider](../plasmicpkgs/keen-slider/) | 1 | 0 |
| [plasmicpkgs/lottie-react](../plasmicpkgs/lottie-react/) | 2 | 0 |
| [plasmicpkgs/mailchimp](../plasmicpkgs/mailchimp/) | 2 | 0 |
| [plasmicpkgs/material-ui](../plasmicpkgs/material-ui/) | 15 | 5 |
| [plasmicpkgs/overseas](../plasmicpkgs/overseas/) | 27 | 7 |
| [plasmicpkgs/plasmic-basic-components](../plasmicpkgs/plasmic-basic-components/) | 16 | 1 |
| [plasmicpkgs/plasmic-calendly](../plasmicpkgs/plasmic-calendly/) | 2 | 0 |
| [plasmicpkgs/plasmic-cms](../plasmicpkgs/plasmic-cms/) | 5 | 0 |
| [plasmicpkgs/plasmic-content-stack](../plasmicpkgs/plasmic-content-stack/) | 3 | 0 |
| [plasmicpkgs/plasmic-contentful](../plasmicpkgs/plasmic-contentful/) | 3 | 0 |
| [plasmicpkgs/plasmic-embed-css](../plasmicpkgs/plasmic-embed-css/) | 1 | 0 |
| [plasmicpkgs/plasmic-eventbrite](../plasmicpkgs/plasmic-eventbrite/) | 4 | 1 |
| [plasmicpkgs/plasmic-giphy](../plasmicpkgs/plasmic-giphy/) | 5 | 2 |
| [plasmicpkgs/plasmic-graphcms](../plasmicpkgs/plasmic-graphcms/) | 2 | 0 |
| [plasmicpkgs/plasmic-hubspot](../plasmicpkgs/plasmic-hubspot/) | 2 | 0 |
| [plasmicpkgs/plasmic-intercom](../plasmicpkgs/plasmic-intercom/) | 2 | 0 |
| [plasmicpkgs/plasmic-link-preview](../plasmicpkgs/plasmic-link-preview/) | 3 | 0 |
| [plasmicpkgs/plasmic-nav](../plasmicpkgs/plasmic-nav/) | 2 | 0 |
| [plasmicpkgs/plasmic-pigeon-maps](../plasmicpkgs/plasmic-pigeon-maps/) | 2 | 0 |
| [plasmicpkgs/plasmic-query](../plasmicpkgs/plasmic-query/) | 2 | 0 |
| [plasmicpkgs/plasmic-sanity-io](../plasmicpkgs/plasmic-sanity-io/) | 4 | 1 |
| [plasmicpkgs/plasmic-soundcloud](../plasmicpkgs/plasmic-soundcloud/) | 2 | 0 |
| [plasmicpkgs/plasmic-strapi](../plasmicpkgs/plasmic-strapi/) | 6 | 1 |
| [plasmicpkgs/plasmic-tabs](../plasmicpkgs/plasmic-tabs/) | 2 | 0 |
| [plasmicpkgs/plasmic-typeform](../plasmicpkgs/plasmic-typeform/) | 2 | 0 |
| [plasmicpkgs/plasmic-wordpress](../plasmicpkgs/plasmic-wordpress/) | 3 | 0 |
| [plasmicpkgs/plasmic-wordpress-graphql](../plasmicpkgs/plasmic-wordpress-graphql/) | 2 | 0 |
| [plasmicpkgs/plasmic-yotpo](../plasmicpkgs/plasmic-yotpo/) | 3 | 0 |
| [plasmicpkgs/radix-ui](../plasmicpkgs/radix-ui/) | 6 | 0 |
| [plasmicpkgs/react-aria](../plasmicpkgs/react-aria/) | 57 | 3 |
| [plasmicpkgs/react-audio-player](../plasmicpkgs/react-audio-player/) | 2 | 0 |
| [plasmicpkgs/react-awesome-reveal](../plasmicpkgs/react-awesome-reveal/) | 1 | 0 |
| [plasmicpkgs/react-chartjs-2](../plasmicpkgs/react-chartjs-2/) | 8 | 0 |
| [plasmicpkgs/react-parallax-tilt](../plasmicpkgs/react-parallax-tilt/) | 1 | 0 |
| [plasmicpkgs/react-scroll-parallax](../plasmicpkgs/react-scroll-parallax/) | 3 | 0 |
| [plasmicpkgs/react-slick](../plasmicpkgs/react-slick/) | 1 | 0 |
| [plasmicpkgs/react-twitter-widgets](../plasmicpkgs/react-twitter-widgets/) | 4 | 1 |
| [plasmicpkgs/react-ui](../plasmicpkgs/react-ui/) | 15 | 5 |
| [plasmicpkgs/spotify](../plasmicpkgs/spotify/) | 2 | 0 |
| [plasmicpkgs/strapi](../plasmicpkgs/strapi/) | 7 | 2 |
| [plasmicpkgs/tiptap](../plasmicpkgs/tiptap/) | 23 | 2 |
| [plasmicpkgs/vanilla-cookieconsent](../plasmicpkgs/vanilla-cookieconsent/) | 4 | 0 |
| [plasmicpkgs/wordpress](../plasmicpkgs/wordpress/) | 6 | 2 |

根目录另有 6 个 JS/TS 文件，包括构建脚本、Lint 和 Vitest 配置。

## 类型检查诊断

检查对象取自各 SDK、组件包、开发宿主与平台应用自己的 tsconfig。下表是复核后仍有诊断的全部 6 个项目，其余 83 个通过。测试、stories 与生产源码按配置原样纳入。这里统计编译器诊断，功能缺陷按主报告中的独立触发路径统计。

| 项目 | 诊断数 | 原因及修正方向 |
| --- | ---: | --- |
| Antd 5 | 12 | 一条 TS6059 来自跨包导入 Antd 6 的测试 setup，另外 11 条为未使用的导入或形参。使测试与构建的源码范围一致，删除多余导入；保留有实际意义的回调签名。[跨包测试引用](../plasmicpkgs/antd5/src/react19-contracts.test.tsx#L2) · [菜单回调](../plasmicpkgs/antd5/src/registerMenu.tsx#L41) |
| Commercetools | 1 | Set 展开与项目编译目标不匹配。此处可使用保留插入顺序的 Array.from。[去重实现](../plasmicpkgs/commerce-providers/commercetools/src/utils/common.ts#L4) |
| Swell | 1 | 读取供应商列表时展开 Set，同样触发 TS2802。[供应商去重](../plasmicpkgs/commerce-providers/swell/src/utils/get-vendors.ts#L22) |
| React Aria | 2 | Popover story 缺少必需的 children；TextField story 克隆元素时没有收窄可用 props。应同步示例与真实控件签名。[Popover](../plasmicpkgs/react-aria/src/registerPopover.stories.tsx#L55) · [TextField](../plasmicpkgs/react-aria/src/registerTextField-common-stories.tsx#L213) |
| 组件包开发宿主 | 2 | Loader 的注册函数签名与本地 Registerable 不匹配。沿 registerFunction 的类型来源对齐宿主和组件元数据，在开发宿主的服务端与客户端入口共同检查。[客户端初始化](../plasmicpkgs-dev/plasmic-init-client.tsx#L22) |
| Live Frame | 1 | 从相邻包直接导入 transitions 源文件，超出本包 rootDir。应通过共享包的正式导出使用，或明确该项目的实际源码范围，再验证 bundle 输出位置。[跨包引用](../platform/live-frame/src/preview.tsx#L2) |

## Studio 全套回归的失败明细

共 21 个测试文件、42 条失败用例。下列现象均来自本次全量输出；其中已有单跑、测试替身或数据库对照的条目已注明。其余按观察到的断言保留，尚未全部建立生产复现。

| 文件 | 失败用例 | 观察及归因 |
| --- | ---: | --- |
| [canvas-lifecycle.test.ts](../platform/wab/src/wab/client/components/canvas/canvas-lifecycle.test.ts#L42) | 2 | 两个生命周期用例清理时对 undefined 调用 clear，尚未定位真实视图与替身的差异。 |
| [CmsEntryDetails.integration.test.tsx](../platform/wab/src/wab/client/components/cms/CmsEntryDetails.integration.test.tsx) | 1 | 默认地址没有 PostgreSQL。改用隔离数据库后，原用例通过。 |
| [CopilotChatDialog.test.tsx](../platform/wab/src/wab/client/components/copilot/CopilotChatDialog.test.tsx#L162) | 2 | 模拟同步中断时，空闲和运行中均找不到 role=status，单独复跑一致。需沿会话快照发布与提示挂载区分状态更新和可见性。 |
| [GridControls.native.test.tsx](../platform/wab/src/wab/client/components/sidebar-tabs/GridControls.native.test.tsx#L57) | 1 | 按可访问名称查找 Filled 按钮失败。需核对当前控件类型、文案及对应网格行为。 |
| [MixinsSection.test.tsx](../platform/wab/src/wab/client/components/sidebar-tabs/MixinsSection.test.tsx#L156) | 1 | 面板分组可见性期望 false，实际 true。与 P2 清单及排序三元式简化分开跟踪。 |
| [MultiSelectionPanel.native.test.tsx](../platform/wab/src/wab/client/components/sidebar-tabs/MultiSelectionPanel.native.test.tsx) | 1 | 多选用例进入选择器解析时，收到单独一个点号，报无效选择器。 |
| [NavigationDropdown.test.tsx](../platform/wab/src/wab/client/components/sidebar-tabs/ProjectPanel/NavigationDropdown.test.tsx#L195) | 1 | 模拟指针后目录提示未达到可见断言，尚未执行后续多语言切换断言。 |
| [PropValueEditor.test.tsx](../platform/wab/src/wab/client/components/sidebar-tabs/PropValueEditor.test.tsx#L385) | 1 | 语义对象绑定菜单里未找到 Number only，单独复跑一致。测试随后才检查移除最后一个回退字段；本次无法由此判断绑定是否丢失。 |
| [newly-added-query.test.tsx](../platform/wab/src/wab/client/components/sidebar-tabs/newly-added-query.test.tsx) | 4 | 四条新增查询场景均缺少 BottomModalsProvider，先补齐渲染环境再判断查询命令行为。 |
| [LeftSplitsPanel.test.tsx](../platform/wab/src/wab/client/components/sidebar/LeftSplitsPanel.test.tsx#L64) | 1 | 原生权限变化后仍找得到测试期望消失的 section。建议从运行时面板的可见性与权限订阅核对。 |
| [SidebarModal.test.tsx](../platform/wab/src/wab/client/components/sidebar/SidebarModal.test.tsx#L84) | 1 | 进入子编辑器时，期望父面板位移 -100%，实际取得动画中间值。宜在过渡完成后再核对最终位置与 inert。 |
| [ThemePanels.native.test.tsx](../platform/wab/src/wab/client/components/sidebar/ThemePanels.native.test.tsx#L45) | 1 | 切换主题或模型世界的场景中找不到期望的 123px 控件，尚未确认是否仅定位器过时。 |
| [DraggableInsertable.test.tsx](../platform/wab/src/wab/client/components/studio/add-drawer/DraggableInsertable.test.tsx#L136) | 13 | 13 条共用缺少 isPublishedTemplate 的 mock。临时副本仅将其设为 false，13/13 通过。 |
| [PosControls.native.test.tsx](../platform/wab/src/wab/client/components/style-controls/PosControls.native.test.tsx#L95) | 1 | 测试使用已被替换的 left 弹窗触发器，还没有执行到背景模型写回。已单独复跑。 |
| [IFrameAwareDropdownMenu.test.tsx](../platform/wab/src/wab/client/components/widgets/IFrameAwareDropdownMenu.test.tsx#L161) | 1 | 子菜单背景期望 rgb(32, 33, 40)，jsdom 返回全透明；应在真实浏览器按同一主题检查菜单与子菜单。 |
| [cseval-first-content.test.ts](../platform/wab/src/wab/client/cseval-first-content.test.ts#L136) | 4 | 观察器读取组件栈时遇到 undefined，覆盖正常提交、挂起和错误边界。仅补齐测试替身后 4/4 通过。 |
| [audit-business-errors.test.ts](../platform/wab/src/wab/client/i18n/audit-business-errors.test.ts#L48) | 1 | 仓库的通知文案规则找到两个直接显示底层错误的生产入口，见 P3-02。 |
| [editor-captions.test.tsx](../platform/wab/src/wab/client/i18n/editor-captions.test.tsx) | 1 | 已删除评论位置的用例在读取 store 时遇到 undefined，尚未确认真实项目中的表现。 |
| [locales.test.ts](../platform/wab/src/wab/client/i18n/locales.test.ts#L42) | 1 | 5 份译文的占位符一致，断言比较了语义键的字面值。详见主报告。 |
| [selection-change.test.ts](../platform/wab/src/wab/client/studio-ctx/selection-change.test.ts#L178) | 2 | 重复选择同一节点和画板背景时各多一次 scheduleSync，参数包含 eval 和 styles。单独复跑相同，应先厘清新选择与重复选择的失效条件，再测重算成本。 |
| [model-util.test.ts](../platform/wab/src/wab/shared/model/model-util.test.ts#L22) | 1 | 模型快照实际多出值为 undefined 的 metadata 等字段。需对照模型导出约定核对快照；本次保留原始快照。 |

全套运行另记录了 2 个未捕获的异步错误，均由 Vitest 关联到 CmsEntriesList.test.tsx。React 调度回调运行时 window 已不存在。单独复跑同一文件时 3/3 通过，未再出现该错误。该记录独立于上表 42 条断言失败。[相关测试](../platform/wab/src/wab/client/components/cms/CmsEntriesList.test.tsx)
