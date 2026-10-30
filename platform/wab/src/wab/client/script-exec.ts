/**
 * Executing a block of code by injecting a <script/> tag to the
 * argument window.
 */
export function scriptExec(window: Window, code: string) {
  const doc = window.document;
  const script = doc.createElement("script");
  script.text = code;
  let err: Error | undefined = undefined;
  const errorHandler = (error: ErrorEvent) => {
    err = error.error;
  };
  window.addEventListener("error", errorHandler);
  doc.head.appendChild(script);
  doc.head.removeChild(script);
  window.removeEventListener("error", errorHandler);
  if (err) {
    throw err;
  }
}
