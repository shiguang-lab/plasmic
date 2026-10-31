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


/** Immutable model bytes, including the result of schema/hostless migrations. */
@Entity("dependency_model_resource")
@Index(["pkgVersionId", "digest"], { unique: true })
export class DependencyModelResource {
  @PrimaryColumn("text") id: string;
  @Column("text") pkgVersionId: string;
  @Column("text") pkgId: string;
  @Column("text") digest: string;
  @Column("text") model: string;
}
