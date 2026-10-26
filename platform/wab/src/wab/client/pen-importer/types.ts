export interface PenNode {
  type: string;
  id?: string;
  name?: string;
  children?: PenNode[];
  // The source schema shares graphics/layout fields across several node types.
  [property: string]: any;
}

export interface PenDocument {
  version: string;
  children: PenNode[];
  imports?: Record<string, string>;
  themes?: Record<string, string[]>;
  variables?: Record<string, { type: string; value: any }>;
}

export interface PenAsset {
  id: string;
  name: string;
  data: string;
  svg?: string;
  width?: number;
  height?: number;
}

export interface PenLayer {
  name: string;
  styles: Record<string, string>;
  children: PenLayer[];
  text?: string;
  asset?: string;
}

export interface PenDesign {
  root: PenLayer;
  width: number;
  height: number;
  assets: PenAsset[];
  warnings: string[];
}

export interface PenChoice {
  id: string;
  name: string;
}
export interface PenFileEntry {
  path: string;
  bytes?: Uint8Array;
  file?: File;
}
export interface PenReader {
  read(files: PenFileEntry[]): PenChoice[];
  frames(file: string): Promise<PenChoice[]>;
  convert(file: string, frame: string): Promise<PenDesign>;
}
