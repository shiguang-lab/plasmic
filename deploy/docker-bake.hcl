variable "RELEASE_TAG" {
  default = "local"
}

variable "PLASMIC_COMMIT" {
  default = ""
}

group "default" {
  targets = ["server", "web", "preview"]
}

# One BuildKit solve shares the builder stage, then builds the three images
# concurrently. Separate registry cache tags retain intermediate layers across
# release tags without competing for a single cache manifest.
target "images" {
  matrix = {
    image = ["server", "web", "preview"]
  }
  name       = image
  context    = "."
  dockerfile = "deploy/Dockerfile"
  target     = image
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
