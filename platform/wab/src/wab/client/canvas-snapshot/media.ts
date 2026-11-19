import { withTimeout } from "@/wab/shared/common";

/** Keep every image's layout box in the snapshot, even if its pixels are unavailable. */
export async function waitForCoverMedia(documents: Document[]) {
  const images = documents.flatMap((doc) =>
    Array.from(doc.images).filter(
      (img) =>
        img.currentSrc || img.getAttribute("src") || img.getAttribute("srcset"),
    ),
  );
  const unavailable = new Set(images);
  await withTimeout(
    Promise.allSettled([
      ...documents.map((doc) => doc.fonts.ready),
      ...images.map(async (img) => {
        if (img.loading === "lazy") {
          img.loading = "eager";
        }
        await img.decode();
        unavailable.delete(img);
      }),
    ]),
    "Cover media deadline",
    5_000,
  ).catch(() => undefined);

  for (const img of unavailable) {
    img.style.visibility = "hidden";
  }
  return unavailable.size;
}
