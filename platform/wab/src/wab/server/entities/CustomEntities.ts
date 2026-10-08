import type { LoaderBundleOutput } from "@/wab/server/loader/module-bundler";
import type { LibraryArtifact } from "@/wab/server/loader/library-artifacts";
import type { PreviewPage } from "@plasmic-shared/preview";
import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity("preview_publication")
export class PreviewPublication {
  @PrimaryColumn("text") projectId: string;
  @Index({ unique: true })
  @Column("text")
  code: string;
  @Column("text") version: string;
  @Column("boolean") enabled: boolean;
  @Column("text") entryPath: string;
  @Column("jsonb") pages: PreviewPage[];
  @Column("jsonb", { nullable: true }) bundle: LoaderBundleOutput | null;
  @Column("timestamptz") publishedAt: Date;
}

@Entity("hostless_library_version")
export class HostlessLibraryVersion {
  @PrimaryColumn("text") pkgVersionId: string;
  @Column("jsonb") artifact: LibraryArtifact;
}
