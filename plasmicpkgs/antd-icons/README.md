# Ant Design Icons for Plasmic

The independent hostless library registers the official `@ant-design/icons`
6.3.4 exports. Every icon has its own component identity and official import;
there is no generic Icon/name wrapper. Registration provides Outlined, Filled
and Two Tone sections, thumbnails, spin, rotate and twoToneColor props.

The registrations are loaded by the `antd-icons` canvas package only for projects
that install the library. They are not part of the default host or Ant Design 6
registrations. The standard Component Store install card, dependency import,
Installed library section, component cards and slot editing handle the UI.
The top-level Icons section keeps displaying project SVG assets.

After changing the icon dependency, regenerate thumbnails from the repo root:

```sh
node scripts/antd-icons/generate.cjs
```

Deploy the server and web bundles, then register the library/catalog with
`docker compose run --rm server src/wab/server/nas-icons.ts`. The Component Store
Icons section contains one `@ant-design/icons` card. Installed contains
**Ant Design Icons** after installation. Other icon libraries use their own
Installed entries. Codegen applications import directly from `@ant-design/icons`.

Validate the registration and the built canvas/server bundles:

```sh
pnpm --filter @shiguang-lab/plasmic-antd-icons test
cd platform/canvas-packages && node --test antd-icons.test.cjs
cd ../wab && pnpm exec vitest run src/wab/server/code-components/antd-icons.test.ts --project server
```
