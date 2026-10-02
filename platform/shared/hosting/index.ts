/** Settings sent by Studio to the Plasmic hosting API. */
export interface PlasmicHostingSettings {
  favicon?: {
    url: string;
    mimeType?: string;
  };
  textFiles?: Record<string, string>;
}
