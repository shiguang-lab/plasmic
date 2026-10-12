# Desktop application icon

`icon.svg` is the design source; `icon.png` is its 1024×1024 RGBA render.
`icon.icns` contains macOS sizes from 16px through 1024px (including Retina
representations). `icon.ico` contains
16, 24, 32, 48, 64, 128 and 256px Windows images. Preserve transparency when
exporting these formats from the master.

The violet Plasmic mark is centered on a dark rounded tile. Render the SVG and
resize its PNG with Sharp. Pack the macOS and Windows sizes as PNG images in
the ICNS and ICO containers, respectively.
