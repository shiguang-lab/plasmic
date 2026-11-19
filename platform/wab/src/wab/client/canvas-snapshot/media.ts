import { withTimeout } from "@/wab/shared/common";

/** Count images that failed to decode or missed the shared media deadline. */
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

  return unavailable.size;
}

export async function waitForCoverTransitions(documents: Document[]) {
  for (;;) {
    // Let styles paint and transitionend/transitioncancel handlers take effect.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const transitions = documents.flatMap((doc) =>
      doc
        .getAnimations()
        .filter(
          (animation) =>
            "transitionProperty" in animation &&
            animation.playState === "running",
        ),
    );
    if (transitions.length === 0) {
      return;
    }
    await Promise.allSettled(
      transitions.map((transition) => transition.finished),
    );
  }
}
