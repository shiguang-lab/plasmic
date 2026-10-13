-- Run against the existing local PostgreSQL cluster; never against production.
CREATE USER temporal_ai WITH PASSWORD 'local-temporal-ai';
CREATE DATABASE temporal_ai OWNER temporal_ai;
CREATE DATABASE temporal_ai_visibility OWNER temporal_ai;
GRANT temporal_ai TO superwab;
\connect temporal_ai
ALTER SCHEMA public OWNER TO temporal_ai;
\connect temporal_ai_visibility
ALTER SCHEMA public OWNER TO temporal_ai;
-- btree_gin must be installed here by a database administrator before Temporal.
-- CREATE EXTENSION IF NOT EXISTS btree_gin;
