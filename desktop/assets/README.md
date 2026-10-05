# Desktop application icon

`icon.png` is the 1024×1024 RGBA master. `icon.icns` contains macOS sizes from
16px through 1024px (including Retina representations). `icon.ico` contains
16, 24, 32, 48, 64, 128 and 256px Windows images. Preserve transparency when
exporting these formats from the master.

The master was generated with the built-in imagegen tool, then resized with
Pillow's Lanczos filter. The macOS icon was assembled with `iconutil`; the
Windows icon was exported with Pillow. The mark and palette follow the
desktop login page's three pink-to-violet arches.

Generation prompt:

> Use case: logo-brand. Asset type: production desktop application icon for Plasmic Desktop, a visual web builder. Create a single square 1024 by 1024 icon asset. Subject: three clean concentric upward semicircular arches, matching a minimal rainbow mark: the three arch endpoints share one horizontal baseline; open underneath, no circle, no central dot. Each arch has a thick equal-width stroke, rounded endpoints, and smooth continuous color from bright pink #f44ab4 at the left to violet #8956ff at the right. Set this large centered mark on a pearl white softly rounded square tile with a subtle lavender glow and very restrained bevel/shadow, crisp front-facing symmetrical composition, professional macOS app icon polish. Tile fills approximately 82 percent of canvas width, with generous transparent margins around it. The rainbow mark fills approximately 62 percent of tile width; centered optically vertically. True transparent alpha outside the tile. Excellent small-size readability, clean simple silhouette, high-quality antialiasing. No letters, no words, no cursor, no tools, no extra pictograms, no mockup scene, no watermark.
