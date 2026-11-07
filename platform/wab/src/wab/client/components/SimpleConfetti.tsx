import * as React from "react";
import { createRoot } from "react-dom/client";
import ReactConfetti from "react-confetti";
import { useWindowSize } from "react-use";

export function SimpleConfetti({ onComplete }: { onComplete?: () => void }) {
  const { width, height } = useWindowSize();
  return (
    <ReactConfetti
      width={width}
      height={height}
      numberOfPieces={32}
      recycle={false}
      onConfettiComplete={onComplete}
    />
  );
}

/** Show the publish celebration and release its temporary React root afterward. */
export function showConfetti() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(<SimpleConfetti onComplete={() => {
    root.unmount();
    container.remove();
  }} />);
}
