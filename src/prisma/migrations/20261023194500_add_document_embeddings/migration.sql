-- Ensure pgvector is available.
CREATE EXTENSION IF NOT EXISTS vector;

-- Find the schema where pgvector is installed.
DO $$
DECLARE
    vector_schema TEXT;
BEGIN
    SELECT n.nspname
    INTO vector_schema
    FROM pg_extension e
    JOIN pg_namespace n
        ON n.oid = e.extnamespace
    WHERE e.extname = 'vector';

    IF vector_schema IS NULL THEN
        RAISE EXCEPTION
            'pgvector is not enabled in this database';
    END IF;

    -- Add a 384-dimensional embedding column.
    EXECUTE format(
        'ALTER TABLE public.document_chunks
         ADD COLUMN IF NOT EXISTS embedding %I.vector(384)',
        vector_schema
    );

    -- Index vectors for cosine similarity search.
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
         ON public.document_chunks
         USING hnsw (embedding %I.vector_cosine_ops)',
        vector_schema
    );
END $$;