import React from "react";

/** Inherited by inspector sections and by the portals they open. */
export const InspectorReadOnly = React.createContext(false);

export function InspectorInput(props: React.ComponentPropsWithRef<"input">) {
  const readOnly = React.useContext(InspectorReadOnly);
  if (readOnly) {
    return (
      <span aria-label={props["aria-label"]}>
        {props.value ?? props.defaultValue ?? props.placeholder ?? "—"}
      </span>
    );
  }
  return <input {...props} />;
}

export function InspectorEdit({ children }: { children: React.ReactNode }) {
  return React.useContext(InspectorReadOnly) ? null : <>{children}</>;
}

/** Choice buttons expose the selected value in the same field in inspection mode. */
export function InspectorChoice(props: React.ComponentPropsWithRef<"button">) {
  if (React.useContext(InspectorReadOnly)) {
    return props["aria-pressed"] === true ||
      props["aria-pressed"] === "true" ? (
      <span title={props["aria-label"]}>
        {props["aria-label"] || props.children}
      </span>
    ) : null;
  }
  return <button {...props} />;
}
