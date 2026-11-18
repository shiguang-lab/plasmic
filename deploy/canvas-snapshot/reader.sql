\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE plasmic_cover_reader LOGIN PASSWORD :'password';
ALTER ROLE plasmic_cover_reader SET default_transaction_read_only = on;
GRANT SELECT (id, name, "createdAt", "updatedAt", "deletedAt", "hostUrl") ON project TO plasmic_cover_reader;
GRANT SELECT ("projectId", revision, data, "deletedAt", "branchId") ON project_revision TO plasmic_cover_reader;
GRANT SELECT (id,"pkgId",version,model) ON pkg_version TO plasmic_cover_reader;
GRANT SELECT ("pkgVersionId",artifact) ON hostless_library_version TO plasmic_cover_reader;
COMMIT;
