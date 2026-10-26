import { PenFileReader } from "@/wab/client/pen-importer/reader";
import { expose } from "comlink";

expose(new PenFileReader());
