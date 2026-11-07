import { getStaticUrl } from "@/wab/shared/urls";
import memoizeOne from "memoize-one";

/** Install the native Monaco worker factory before opening an editor. */
export const configureMonacoWorkers = memoizeOne(() => {
  (window as any).MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      const name = label === "typescript" || label === "javascript" ? "ts"
        : ["json", "html", "css", "graphql"].includes(label) ? label : "editor";
      // Studio can serve assets from another origin. A classic worker bootstrap
      // keeps the same cross-origin importScripts behavior as the hosted editor.
      const source = `importScripts(${JSON.stringify(`${getStaticUrl()}/${name}.worker.js`)});`;
      return new Worker(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`, { name: label });
    },
  };
});
