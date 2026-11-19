variable "RELEASE_TAG" {
  default = "local"
}

variable "PLASMIC_COMMIT" {
  default = ""
}

group "default" {
  targets = ["server", "web", "preview", "cover-worker"]
}

# One BuildKit solve shares the Studio builder stage and builds the release images
# concurrently. Separate registry cache tags retain intermediate layers across
# release tags without competing for a single cache manifest.
target "images" {
  matrix = {
    image = ["server", "web", "preview", "cover-worker"]
  }
  name       = image
  context    = image == "cover-worker" ? "deploy/canvas-snapshot/worker" : "."
  dockerfile = image == "cover-worker" ? "Dockerfile" : "deploy/Dockerfile"
  target     = image == "cover-worker" ? null : image
  platforms  = ["linux/amd64"]
  tags       = ["ghcr.io/shiguang-lab/plasmic-${image}:${RELEASE_TAG}"]
  args = {
    PLASMIC_COMMIT = PLASMIC_COMMIT
  }
  labels = {
    "org.opencontainers.image.source"   = "https://github.com/shiguang-lab/plasmic"
    "org.opencontainers.image.revision" = PLASMIC_COMMIT
  }
  attest = ["type=provenance,disabled=true"]
  cache-from = ["type=registry,ref=ghcr.io/shiguang-lab/plasmic-${image}:buildcache"]
  cache-to   = ["type=registry,ref=ghcr.io/shiguang-lab/plasmic-${image}:buildcache,mode=max"]
}
