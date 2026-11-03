# Desktop application icon

The design source is `platform/wab/src/wab/shared/branding.json`. Run
`node scripts/generate-brand-assets.mjs` from the repository root to regenerate
the Studio/favicon, Desktop and starter template assets. The script uses Sharp
from the Desktop dependencies. `icon.svg` places the gradient mark on the app
tile and `icon.png` is its 1024×1024 RGBA render.
`icon.icns` contains macOS sizes from 16px through 1024px (including Retina
representations). `icon.ico` contains
16, 24, 32, 48, 64, 128 and 256px Windows images. Preserve transparency when
exporting these formats from the master.

The cyan, blue and violet Plasmic mark is centered on a dark rounded tile.
macOS and Windows sizes are PNG images in the ICNS and ICO containers,
respectively.
