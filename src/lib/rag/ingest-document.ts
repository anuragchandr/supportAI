
import { db } from "@/lib/db";
import { createEmbeddings } from "@/lib/ai/embeddings";
import { chunkText } from "@/lib/rag/chunking";

const EMBEDDING_BATCH_SIZE = 16;
const EMBEDDING_DIMENSIONS = 384;

export async function ingestDocument(
  documentId: string,
  businessId: string,
  content: string
) {
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    throw new Error("The document has no text to process.");
  }

  // Generate embeddings before opening the database transaction.
  const embeddings: number[][] = [];

  for (
    let start = 0;
    start < chunks.length;
    start += EMBEDDING_BATCH_SIZE
  ) {
    const batch = chunks.slice(
      start,
      start + EMBEDDING_BATCH_SIZE
    );

    const batchEmbeddings = await createEmbeddings(batch);
    embeddings.push(...batchEmbeddings);
  }

  if (embeddings.length !== chunks.length) {
    throw new Error("Not all document chunks were embedded.");
  }

  // Validate all embeddings before starting the transaction.
  for (let index = 0; index < embeddings.length; index++) {
    const embedding = embeddings[index];

    if (
      embedding.length !== EMBEDDING_DIMENSIONS ||
      !embedding.every(Number.isFinite)
    ) {
      throw new Error(`Invalid embedding at chunk ${index}.`);
    }
  }

  // Prepare all vectors for a single bulk SQL update.
  const embeddingRows = embeddings.map((embedding, chunkIndex) => ({
    chunkIndex,
    embedding: `[${embedding.join(",")}]`,
  }));

  await db.$transaction(
    async (tx) => {
      const document = await tx.document.findFirst({
        where: {
          id: documentId,
          businessId,
        },
        select: {
          id: true,
        },
      });

      if (!document) {
        throw new Error("Document not found for this business.");
      }

      // Find the schema where pgvector is installed.
      const extensions = await tx.$queryRaw<
        Array<{ schemaName: string }>
      >`
        SELECT n.nspname AS "schemaName"
        FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'vector'
      `;

      const vectorSchema = extensions[0]?.schemaName;

      if (!vectorSchema) {
        throw new Error("The pgvector extension is not enabled.");
      }

      // Make the vector type available in this transaction.
      await tx.$queryRaw`
        SELECT set_config(
          'search_path',
          quote_ident(${vectorSchema}) || ', public',
          true
        )
      `;

      // Remove previous chunks when reprocessing a document.
      await tx.documentChunk.deleteMany({
        where: {
          documentId,
        },
      });

      // Insert all chunks in one database operation.
      await tx.documentChunk.createMany({
        data: chunks.map((chunk, index) => ({
          documentId,
          content: chunk,
          chunkIndex: index,
        })),
      });

      // Update all vector embeddings in one SQL operation.
      await tx.$executeRaw`
        UPDATE public.document_chunks AS dc
        SET embedding = input.embedding::vector(384)
        FROM jsonb_to_recordset(
          ${JSON.stringify(embeddingRows)}::jsonb
        ) AS input("chunkIndex" integer, embedding text)
        WHERE dc."documentId" = ${documentId}
          AND dc."chunkIndex" = input."chunkIndex"
      `;
    },
    {
      maxWait: 10_000,
      timeout: 30_000,
    }
  );

  // Mark the document as processed after the transaction commits.
  await db.document.updateMany({
    where: {
      id: documentId,
      businessId,
    },
    data: {
      status: "PROCESSED",
    },
  });

  return {
    chunksCreated: chunks.length,
  };
}
