import { useModelSelector } from "@/wab/client/stores/model-revisions-react";
import { modelKeys } from "@/wab/shared/model-revisions";
import { SiteDiffs } from "@/wab/client/components/modals/SiteDiffs";
import { getCustomFunctionDisplayName } from "@/wab/client/components/modals/customFunctionModals";
import { showTemporaryPrompt } from "@/wab/client/components/quick-modals";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { Textbox } from "@/wab/client/components/widgets/Textbox";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import CodeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Code";
import ComponentIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Component";
import ImageBlockIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__ImageBlock";
import MixinIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Mixin";
import TokenIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Token";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  componentToReferenced,
  customFunctionsUsedBySite,
} from "@/wab/shared/cached-selectors";
import {
  extractUsedIconAssetsForComponents,
  extractUsedPictureAssetsForComponents,
  extractUsedPictureAssetsFromMixins,
} from "@/wab/shared/codegen/image-assets";
import { extractUsedMixinsForComponents } from "@/wab/shared/codegen/mixins";
import {
  extractUsedTokensForComponents,
  extractUsedTokensForMixins,
  extractUsedTokensForTokenOverrides,
  extractUsedTokensForTokens,
} from "@/wab/shared/codegen/style-tokens";
import {
  ensure,
  intersectSets,
  mergeSets,
  spawn,
  withoutNils,
} from "@/wab/shared/common";
import { getComponentDisplayName } from "@/wab/shared/core/components";
import {
  buildObjToDepMap,
  extractTransitiveDepsFromComponents,
  extractTransitiveDepsFromMixins,
  extractTransitiveDepsFromTokens,
  getTransitiveDepsFromObjs,
} from "@/wab/shared/core/project-deps";
import { customFunctionId } from "@/wab/shared/core/query-ids";
import { createSite, isHostLessPackage } from "@/wab/shared/core/sites";
import {
  Component,
  ImageAsset,
  Mixin,
  ProjectDependency,
  Site,
  StyleToken,
} from "@/wab/shared/model/classes";
import {
  ChangeLogEntry,
  SemVerReleaseType,
  compareSites,
} from "@/wab/shared/site-diffs";
import { filterUsefulDiffs } from "@/wab/shared/site-diffs/filter-useful-diffs";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Alert, Form, Select } from "antd";
import React from "react";

const { Option } = Select;

type UpgradeDepResponse = boolean;
type DeleteDepResponse = boolean;
type PublishProjResponse = {
  confirm: boolean;
  tags: string[];
  title: string;
};

function DependencyVersionBanner(props: {
  name: string;
  curVersion?: string;
  targetVersion?: string;
  isHostless?: boolean;
}) {
  const { name, curVersion, targetVersion, isHostless } = props;
  const isUpgrade = !!targetVersion && !!curVersion;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--ui-elevated, rgba(255, 255, 255, 0.04))",
        border: "1px solid var(--ui-border-subtle, rgba(255, 255, 255, 0.08))",
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon
          icon={isHostless ? CodeIcon : ComponentIcon}
          className="component-fg"
        />
        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--ui-text, #fff)",
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--ui-muted, rgba(255, 255, 255, 0.45))",
            }}
          >
            {isHostless ? (
              <UiText message="Code library" />
            ) : (
              <UiText message="Shared project" />
            )}
          </div>
        </div>
      </div>
      {isUpgrade ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              background: "rgba(255, 255, 255, 0.08)",
              color: "var(--ui-muted, rgba(255, 255, 255, 0.65))",
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            v{curVersion}
          </span>
          <span style={{ opacity: 0.45, fontSize: 12 }}>➔</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              background: "rgba(114, 46, 209, 0.2)",
              color: "#b37feb",
              fontWeight: 600,
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            v{targetVersion}
          </span>
        </div>
      ) : curVersion ? (
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            background: "rgba(255, 255, 255, 0.08)",
            color: "var(--ui-muted, rgba(255, 255, 255, 0.65))",
            fontSize: 12,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          v{curVersion}
        </span>
      ) : null}
    </div>
  );
}

export async function promptUpgradeDeps(props: {
  studioCtx: StudioCtx;
  targetDeps: ProjectDependency[];
}) {
  const { studioCtx, targetDeps } = props;
  return showTemporaryPrompt<UpgradeDepResponse>((onSubmit, onCancel) => (
    <Modal
      title={<UiText message="Upgrade imported projects" />}
      open={true}
      onOk={() => onSubmit(true)}
      okText={<UiText message="Confirm" />}
      cancelText={<UiText message="Cancel" />}
      onCancel={onCancel}
      styles={{
        body: {
          marginInline: -24,
        },
      }}
    >
      <Scrollbar style={{ maxHeight: "calc(80vh - 150px)" }}>
        <div style={{ paddingInline: 24 }}>
          {targetDeps.map((targetDep) => {
            const curDep = ensure(
              studioCtx.site.projectDependencies.find(
                (dep) => dep.pkgId === targetDep.pkgId,
              ),
              "Target dependency must be one of the existing project dependencies",
            );
            return (
              <WarnChangeDep
                studioCtx={studioCtx}
                curDep={curDep}
                targetDep={targetDep}
                heading={
                  <DependencyVersionBanner
                    name={targetDep.name}
                    curVersion={curDep.version}
                    targetVersion={targetDep.version}
                    isHostless={isHostLessPackage(curDep.site)}
                  />
                }
              />
            );
          })}
        </div>
      </Scrollbar>
    </Modal>
  ));
}

export async function promptUpgradeDep(props: {
  studioCtx: StudioCtx;
  targetDep: ProjectDependency;
}) {
  const { studioCtx, targetDep } = props;
  const curDep = ensure(
    studioCtx.site.projectDependencies.find(
      (dep) => dep.pkgId === targetDep.pkgId,
    ),
    "Target dependency must be one of the existing project dependencies",
  );
  return showTemporaryPrompt<UpgradeDepResponse>((onSubmit, onCancel) => (
    <Modal
      title={
        <UiText
          message={'Upgrade imported project "{part1}"'}
          values={{ part1: targetDep.name }}
        />
      }
      open={true}
      onOk={() => onSubmit(true)}
      okText={<UiText message="Confirm" />}
      cancelText={<UiText message="Cancel" />}
      onCancel={onCancel}
      styles={{
        body: {
          marginInline: -24,
        },
      }}
    >
      <Scrollbar style={{ maxHeight: "calc(80vh - 150px)" }}>
        <div style={{ paddingInline: 24 }}>
          <WarnChangeDep
            studioCtx={studioCtx}
            curDep={curDep}
            targetDep={targetDep}
            heading={
              <DependencyVersionBanner
                name={targetDep.name}
                curVersion={curDep.version}
                targetVersion={targetDep.version}
                isHostless={isHostLessPackage(curDep.site)}
              />
            }
          />
        </div>
      </Scrollbar>
    </Modal>
  ));
}

export async function promptDeleteDep(props: {
  studioCtx: StudioCtx;
  curDep: ProjectDependency;
}) {
  const { studioCtx, curDep } = props;
  return showTemporaryPrompt<DeleteDepResponse>((onSubmit, onCancel) => (
    <Modal
      title={
        <UiText
          message={'Remove imported project "{part1}"?'}
          values={{ part1: curDep.name }}
        />
      }
      open={true}
      onOk={() => onSubmit(true)}
      okText={<UiText message="Confirm" />}
      cancelText={<UiText message="Cancel" />}
      onCancel={onCancel}
      styles={{
        body: {
          marginInline: -24,
        },
      }}
    >
      <Scrollbar style={{ maxHeight: "calc(80vh - 150px)" }}>
        <div style={{ paddingInline: 24 }}>
          <WarnChangeDep
            studioCtx={studioCtx}
            curDep={curDep}
            targetDep={undefined}
            heading={
              <DependencyVersionBanner
                name={curDep.name}
                curVersion={curDep.version}
                isHostless={isHostLessPackage(curDep.site)}
              />
            }
          />
        </div>
      </Scrollbar>
    </Modal>
  ));
}

function PublishContent(props: {
  studioCtx: StudioCtx;
  onSubmit: (response: PublishProjResponse) => void;
  onCancel: () => void;
}) {
  const { t: uiT } = useI18n();
  const { studioCtx, onSubmit, onCancel } = props;
  const [nextVersion, setNextVersion] = React.useState<{
    version: string;
    changeLog: ChangeLogEntry[];
    releaseType?: SemVerReleaseType;
  }>();
  const [previousTags, setPreviousTags] = React.useState([] as string[]);
  const [tags, setTags] = React.useState([] as string[]);
  const [title, setTitle] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    spawn(
      (async () => {
        if (loading) {
          const next = await studioCtx.calculateNextPublishVersion();
          setNextVersion(next);

          const projectReleases = await studioCtx.getProjectReleases();
          setPreviousTags([
            ...new Set(projectReleases.map((release) => release.tags).flat()),
          ] as string[]);

          setLoading(false);
        }
      })(),
    );
  }, [studioCtx, loading]);

  if (loading) {
    return (
      <Modal
        title={<UiText message="Publish a new version" />}
        open
        onCancel={onCancel}
        footer={null}
      >
        <UiText message="Loading..." />
      </Modal>
    );
  }

  if (!nextVersion) {
    return (
      <Modal
        title={<UiText message="Publish a new version" />}
        open
        onCancel={onCancel}
        footer={null}
      >
        <UiText message="There have been no new changes since your last published version" />
      </Modal>
    );
  }

  const { changeLog, version, releaseType } = nextVersion;
  const diffs = filterUsefulDiffs(changeLog);
  const previousTagsOptions = previousTags.map((tag) => {
    return <Option key={tag}>{tag}</Option>;
  });

  return (
    <Modal
      title={<UiText message="Publish a new version" />}
      open
      onCancel={onCancel}
      onOk={() => onSubmit({ confirm: true, tags, title })}
      okText={<UiText message="Confirm" />}
      cancelText={<UiText message="Cancel" />}
    >
      <Form>
        <p>
          <UiText
            message={
              "When you publish a new version, you let other developers and designers know that your updates are ready for use."
            }
          />
        </p>
        {releaseType === "major" && (
          <p>
            <Alert
              type="warning"
              showIcon
              message={uiT(
                "The new version you're publishing contains potentially breaking changes, as some things have been removed or renamed.",
              )}
            />
          </p>
        )}
        <p>
          <strong>
            <UiText message={"Version:"} />{" "}
          </strong>{" "}
          {version}
        </p>
        <p>
          <Textbox
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={uiT("Description (optional)...")}
            aria-label={uiT("Description")}
            autoFocus
            styleType={"bordered"}
          />
        </p>
        <p>
          <Select
            mode="tags"
            style={{ width: "100%" }}
            placeholder={uiT("Tags (optional) ...")}
            aria-label={uiT("Tags selector")}
            onChange={(newTags) => setTags(newTags)}
            tokenSeparators={[","]}
          >
            {previousTagsOptions}
          </Select>
        </p>
        {diffs && (
          <p>
            <SiteDiffs diffs={diffs} />
          </p>
        )}
      </Form>
    </Modal>
  );
}

export async function promptPublishProj(props: { studioCtx: StudioCtx }) {
  return showTemporaryPrompt<PublishProjResponse>((onSubmit, onCancel) => (
    <PublishContent
      studioCtx={props.studioCtx}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  ));
}

function captureDependencyWarning(site: Site, curDep: ProjectDependency, targetDep?: ProjectDependency) {
  const diffs = targetDep
    ? filterUsefulDiffs(compareSites(curDep.site, targetDep.site))
    : filterUsefulDiffs(compareSites(curDep.site, createSite()));

  const removedComponentUuids = new Set(
    withoutNils(
      diffs.map((diff) =>
        diff.description === "removed" && diff.oldValue?.type === "Component"
          ? diff.oldValue.uuid
          : undefined,
      ),
    ),
  );
  const removedComponents = curDep.site.components.filter((component) =>
    removedComponentUuids.has(component.uuid),
  );

  // Build a set of components that are directly used by local components
  const referencedComponents = mergeSets(
    ...site.components.map((comp) => new Set(componentToReferenced(comp))),
  );
  const removedReferencedComponents = intersectSets(
    referencedComponents,
    new Set<Component>(removedComponents),
  );

  const removedTokenUuids = new Set(
    withoutNils(
      diffs.map((diff) =>
        diff.description === "removed" && diff.oldValue?.type === "Style token"
          ? diff.oldValue.uuid
          : undefined,
      ),
    ),
  );
  const removedTokens = curDep.site.styleTokens.filter((token) =>
    removedTokenUuids.has(token.uuid),
  );

  // Build a set of tokens that are directly used by local tokens, overrides,
  // mixins, and components
  const referencedTokens = new Set(
    // token references can come from this site's tokens, mixins, or
    // components
    [
      ...extractUsedTokensForTokens(site.styleTokens, site, {
        derefTokens: false,
      }),
      ...extractUsedTokensForTokenOverrides(site.styleTokenOverrides, site, {
        derefTokens: false,
      }),
      ...extractUsedTokensForMixins(site.mixins, site, {
        derefTokens: false,
      }),
      ...extractUsedTokensForMixins(
        site.themes.flatMap((t) => [
          t.defaultStyle,
          ...t.styles.map((s) => s.style),
        ]),
        site,
        {
          derefTokens: false,
        },
      ),
      ...extractUsedTokensForComponents(site, site.components, {
        // We don't need to expand mixins, as we're checking local
        // mixins referencing tokens separately, and we don't care about
        // imported mixins referencing tokens
        expandMixins: false,

        // We also don't need to deref, as we only care about the tokens
        // that are directly used
        derefTokens: false,
      }),
    ],
  );
  const removedReferencedTokens = intersectSets(
    referencedTokens,
    new Set<StyleToken>(removedTokens),
  );

  const removedMixinUuids = new Set(
    withoutNils(
      diffs.map((diff) =>
        diff.description === "removed" && diff.oldValue?.type === "Mixin"
          ? diff.oldValue.uuid
          : undefined,
      ),
    ),
  );
  const removedMixins = curDep.site.mixins.filter((mixin) =>
    removedMixinUuids.has(mixin.uuid),
  );

  // Build a set of Mixins that are directly used by local components
  const referencedMixins = new Set(
    extractUsedMixinsForComponents(site.components).keys(),
  );
  const removedReferencedMixins = intersectSets(
    referencedMixins,
    new Set<Mixin>(removedMixins),
  );

  const removedImageAssetUuids = new Set(
    withoutNils(
      diffs.map((diff) =>
        diff.description === "removed" &&
        (diff.oldValue?.type === "Image" || diff.oldValue?.type === "Icon")
          ? diff.oldValue.uuid
          : undefined,
      ),
    ),
  );
  const removedImageAssets = curDep.site.imageAssets.filter((asset) =>
    removedImageAssetUuids.has(asset.uuid),
  );

  // Build a set of ImageAssets that are directly used by local components
  // and local mixins
  const referencedImageAssets = new Set([
    ...extractUsedIconAssetsForComponents(site, site.components),
    ...extractUsedPictureAssetsForComponents(site, site.components, {
      includeRuleSets: true,
      expandMixins: false,
    }),
    ...extractUsedPictureAssetsFromMixins(site, site.mixins),
  ]);
  const removedReferencedImageAssets = intersectSets(
    referencedImageAssets,
    new Set<ImageAsset>(removedImageAssets),
  );

  const removedFunctionDiffIds = new Set(
    withoutNils(
      diffs.map((diff) =>
        diff.description === "removed" && diff.oldValue?.type === "Function"
          ? diff.oldValue.functionId
          : undefined,
      ),
    ),
  );
  const removedFunctions = curDep.site.customFunctions.filter((fn) =>
    removedFunctionDiffIds.has(customFunctionId(fn)),
  );
  const removedFunctionsById = new Set(removedFunctions.map(customFunctionId));
  const removedReferencedFunctions = new Set(
    [...customFunctionsUsedBySite(site)].filter((fn) =>
      removedFunctionsById.has(customFunctionId(fn)),
    ),
  );

  // out of those directly referenced objects that will now be removed,
  // let's see what transitive dependencies we'll need to pull in to
  // clone them
  const objDepMap = buildObjToDepMap(site);
  const transitiveDeps = new Set([
    ...extractTransitiveDepsFromComponents(
      site,
      [...removedReferencedComponents],
      objDepMap,
    ),
    ...extractTransitiveDepsFromTokens(
      site,
      [...removedReferencedTokens],
      objDepMap,
    ),
    ...extractTransitiveDepsFromMixins(
      site,
      [...removedReferencedMixins],
      objDepMap,
    ),
    ...getTransitiveDepsFromObjs(
      site,
      [...removedReferencedImageAssets],
      objDepMap,
    ),
  ]);
  return Object.freeze({
    diffs,
    componentNames: Object.freeze([...removedReferencedComponents].map(getComponentDisplayName)),
    tokenNames: Object.freeze([...removedReferencedTokens].map((token) => token.name)),
    mixinNames: Object.freeze([...removedReferencedMixins].map((mixin) => mixin.name)),
    imageNames: Object.freeze([...removedReferencedImageAssets].map((asset) => asset.name)),
    functionNames: Object.freeze([...removedReferencedFunctions].map(getCustomFunctionDisplayName)),
    dependencyNames: Object.freeze([...transitiveDeps].map((dependency) => dependency.name)),
    hostless: isHostLessPackage(curDep.site),
  });
}

const WarnChangeDep = React.memo(function WarnChangeDep(props: {
  studioCtx: StudioCtx;
  curDep: ProjectDependency;
  targetDep?: ProjectDependency;
  heading: React.ReactElement;
}) {
  const { t: uiT } = useI18n();

  const { studioCtx, curDep, targetDep, heading } = props;
  // An open warning owns this whole-document reference scan and renders its result.
  const capture = React.useCallback(() => captureDependencyWarning(studioCtx.site, curDep, targetDep), [studioCtx, curDep, targetDep]);
  const {diffs, componentNames, tokenNames, mixinNames, imageNames, functionNames, dependencyNames, hostless} = useModelSelector(studioCtx.modelRevisions, [modelKeys.site], capture);
  const functionsList =
    functionNames.length > 0 ? (
      <div>
        <Icon className="function-fg mr-sm" icon={CodeIcon} />{" "}
        <UiText message={"Functions"} />{" "}
        {functionNames.join(", ")}
      </div>
    ) : null;
  const functionsNote = functionNames.length > 0 && (
    <div className="mt-m">
      <UiText
        message={"These functions will no longer be available: {part1}"}
        values={{
          part1: functionNames.join(", "),
        }}
      />
    </div>
  );
  const removedHostlessArtifactTypes = withoutNils([
    componentNames.length > 0 ? uiT("components") : undefined,
    functionNames.length > 0 ? uiT("functions") : undefined,
  ]);
  const removedHostlessArtifactLabel =
    removedHostlessArtifactTypes.length === 0
      ? uiT("items")
      : removedHostlessArtifactTypes.length === 1
        ? removedHostlessArtifactTypes[0]
        : uiT("{first} and {second}", {
            first: removedHostlessArtifactTypes[0],
            second: removedHostlessArtifactTypes[1],
          });

  return (
    <>
      {heading}
      {diffs.length > 0 && (
        <div className="mb-m">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: "var(--ui-text, #fff)",
              }}
            >
              <UiText message={"Change details"} />
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--ui-muted, rgba(255, 255, 255, 0.45))",
              }}
            >
              <UiText
                message={"{count} changes"}
                values={{ count: diffs.length }}
              />
            </span>
          </div>
          <SiteDiffs diffs={diffs} />
        </div>
      )}
      {(tokenNames.length > 0 ||
        mixinNames.length > 0 ||
        componentNames.length > 0 ||
        imageNames.length > 0 ||
        functionNames.length > 0) && (
        <Alert
          type="warning"
          showIcon
          message={uiT("Some things you are using have been removed!")}
          className="mv-m"
          description={
            hostless ? (
              <div>
                <div>
                  <UiText
                    message={
                      "These external {part1} will be removed from this project:"
                    }
                    values={{ part1: removedHostlessArtifactLabel }}
                  />
                </div>
                {componentNames.length > 0 && (
                  <div>
                    <Icon className="component-fg mr-sm" icon={ComponentIcon} />{" "}
                    <UiText message={"Components"} />{" "}
                    {componentNames.join(", ")}
                  </div>
                )}
                {functionsList}
              </div>
            ) : (
              <div>
                <div>
                  <UiText
                    message={
                      "We will make a copy of them for you in this project:"
                    }
                  />
                </div>
                {componentNames.length > 0 && (
                  <div>
                    <Icon className="component-fg mr-sm" icon={ComponentIcon} />{" "}
                    <UiText message={"Components"} />{" "}
                    {componentNames.join(", ")}
                  </div>
                )}
                {tokenNames.length > 0 && (
                  <div>
                    <Icon className="token-fg mr-sm" icon={TokenIcon} />{" "}
                    <UiText message={"Style tokens"} />{" "}
                    {tokenNames.join(", ")}
                  </div>
                )}
                {mixinNames.length > 0 && (
                  <div>
                    <Icon className="mixin-fg mr-sm" icon={MixinIcon} />{" "}
                    <UiText message={"Mixins"} />{" "}
                    {mixinNames.join(", ")}
                  </div>
                )}
                {imageNames.length > 0 && (
                  <div>
                    <Icon className="mixin-fg mr-sm" icon={ImageBlockIcon} />{" "}
                    <UiText message={"Images and icons"} />{" "}
                    {imageNames.join(", ")}
                  </div>
                )}
                {dependencyNames.length > 0 && (
                  <div className="mt-m">
                    <UiText
                      message={
                        "To copy these objects, we will also need to import these projects: {part1}"
                      }
                      values={{
                        part1: dependencyNames.join(", "),
                      }}
                    />
                  </div>
                )}
                {functionsNote}
              </div>
            )
          }
        />
      )}
    </>
  );
});
