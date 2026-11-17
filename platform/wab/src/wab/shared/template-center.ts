import type { ProjectId } from "@/wab/shared/ApiSchema";

export interface TemplateMetadata {
  name: string;
  description: string;
  kind: "page" | "section";
  device: "mobile" | "desktop" | "responsive";
  category: string;
  thumbnailUrl: string;
}

export interface TemplatePublication extends TemplateMetadata {
  version: string;
  publishedAt: string;
  previewUrl: string;
  libraries: string[];
}

export interface ApiDesignTemplate {
  id: ProjectId;
  published: TemplatePublication | null;
  /** Drafts are only returned to system administrators. */
  draft?: TemplateMetadata;
  updatedAt?: string;
}

export interface TemplateCenterResponse {
  templates: ApiDesignTemplate[];
  canManage: boolean;
}
