import type { ProjectId } from "@/wab/shared/ApiSchema";

export interface TemplateMetadata {
  name: string;
  description: string;
  kind: "page" | "section";
  device: "mobile" | "desktop" | "responsive";
  category: string;
  thumbnailUrl: string;
}

export interface TemplatePublication {
  version: string;
  publishedAt: string;
  previewUrl: string;
  libraries: string[];
}

export interface ApiDesignTemplate {
  id: ProjectId;
  metadata: TemplateMetadata;
  published: TemplatePublication | null;
  updatedAt?: string;
}

export interface TemplateCenterResponse {
  templates: ApiDesignTemplate[];
  canManage: boolean;
}
