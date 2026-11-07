import React, { ReactNode, useState } from "react";

export interface StatedProps<T> {
  defaultValue: T;
  children: (value: T, setValue: (x: T) => void) => ReactNode;
}

export function Stated<T>({ defaultValue, children }: StatedProps<T>) {
  const [value, setValue] = useState(defaultValue);
  return <>{children(value, setValue)}</>;
}
