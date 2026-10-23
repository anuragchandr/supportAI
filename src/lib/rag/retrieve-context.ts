
import { db } from "@/lib/db";
import { createEmbeddings } from "@/lib/ai/embeddings";

const EMBEDDING_DIMENSIONS = 384;
const DEFAULT_MATCH_COUNT = 5;
const MAX_MATCH_COUNT = 8;

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  chunkIndex: number;
  similarity: number;
};

export async function retrieveRelevantChunks(
  question: string,
  businessId: string,
  requestedCount = DEFAULT_MATCH_COUNT
): Promise<RetrievedChunk[]> {
  const cleanQuestion = question.trim();

  if (!cleanQuestion) {
    throw new Error("Search question cannot be empty.");
  }

  if (cleanQuestion.length > 1000) {
    throw new Error("Search question cannot exceed 1000 characters.");
  }

  if (!businessId) {
    throw new Error("Business ID is required.");
  }

  // Keep the requested result count within safe limits.
  const matchCount = Math.min(
    MAX_MATCH_COUNT,
    Math.max(1, Math.trunc(requestedCount) || DEFAULT_MATCH_COUNT)
  );

  // Generate the query vector using the same model as ingestion.
  const embeddings = await createEmbeddings([cleanQuestion]);
  const queryEmbedding = embeddings[0];

  if (
    !queryEmbedding ||
    queryEmbedding.length !== EMBEDDING_DIMENSIONS ||
    !queryEmbedding.every(Number.isFinite)
  ) {
    throw new Error("The query embedding is invalid.");
  }

  // PostgreSQL expects a vector literal for the pgvector cast.
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  return db.$transaction(async (tx) => {
    // Detect the schema where the vector extension was installed.
    const extensions = await tx.$queryRaw<
      Array<{ schemaName: string }>
    >`
      SELECT n.nspname AS "schemaName"
      FROM pg_extension e
      JOIN pg_namespace n
        ON n.oid = e.extnamespace
      WHERE e.extname = 'vector'
      LIMIT 1
    `;

    const vectorSchema = extensions[0]?.schemaName;

    if (!vectorSchema) {
      throw new Error("The pgvector extension is not enabled.");
    }

    // Keep the type and similarity operator visible in this transaction.
    await tx.$queryRaw`
      SELECT set_config(
        'search_path',
        quote_ident(${vectorSchema}) || ', public',
        true
      )
    `;

    // Retrieve nearest chunks, restricted to the current business.
    const matches = await tx.$queryRaw<RetrievedChunk[]>`
      SELECT
        c.id AS "chunkId",
        d.id AS "documentId",
        d.title AS "documentTitle",
        c.content,
        c."chunkIndex",
        (
          1 - (c.embedding <=> ${vectorLiteral}::vector(384))
        )::float8 AS similarity
      FROM public.document_chunks AS c
      INNER JOIN public.documents AS d
        ON d.id = c."documentId"
      WHERE d."businessId" = ${businessId}
        AND d.status = 'PROCESSED'
        AND c.embedding IS NOT NULL
      ORDER BY
        c.embedding <=> ${vectorLiteral}::vector(384) ASC
      LIMIT ${matchCount}
    `;

    return matches;
  });
}
