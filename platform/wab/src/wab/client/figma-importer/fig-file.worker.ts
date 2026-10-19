import { FigFile } from "@/wab/client/figma-importer/fig-file";
import { expose } from "comlink";

const file = new FigFile();
expose({
  read: (bytes: Uint8Array) => file.read(bytes),
  convert: (pageId: string) => file.convert(pageId),
});
