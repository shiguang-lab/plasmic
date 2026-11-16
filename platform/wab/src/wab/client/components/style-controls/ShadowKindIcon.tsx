import React from "react";

export function ShadowKindIcon({ inset }: { inset: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {inset ? (
        <>
          <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" />
          <path d="M4 4h8v3H7v5H4V4Z" fill="currentColor" opacity="0.45" />
        </>
      ) : (
        <>
          <rect x="6" y="6" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.45" />
          <rect x="2.5" y="2.5" width="8" height="8" rx="1.5" stroke="currentColor" />
        </>
      )}
    </svg>
  );
}
