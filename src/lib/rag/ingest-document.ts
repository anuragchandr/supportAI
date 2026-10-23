
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

  // Generate all embeddings before writing any chunks.
  // A failed API request therefore won't leave partial chunks.
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

  // Store all chunks and vectors in one transaction.
  await db.$transaction(async (tx) => {
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

    // Discover where pgvector was installed.
    const extensions = await tx.$queryRaw<
      Array<{ schemaName: string }>
    >`
      SELECT n.nspname AS "schemaName"
      FROM pg_extension e
      JOIN pg_namespace n
        ON n.oid = e.extnamespace
      WHERE e.extname = 'vector'
    `;

    const vectorSchema = extensions[0]?.schemaName;

    if (!vectorSchema) {
      throw new Error(
        "The pgvector extension is not enabled."
      );
    }

    // Make the extension's vector type visible in this transaction.
    await tx.$queryRaw`
      SELECT set_config(
        'search_path',
        quote_ident(${vectorSchema}) || ', public',
        true
      )
    `;

    // Remove previous chunks if this document is being reprocessed.
    await tx.documentChunk.deleteMany({
      where: { documentId },
    });

    for (let index = 0; index < chunks.length; index += 1) {
      const embedding = embeddings[index];

      if (
        embedding.length !== EMBEDDING_DIMENSIONS ||
        !embedding.every(Number.isFinite)
      ) {
        throw new Error(
          `Invalid embedding at chunk ${index}.`
        );
      }

      const chunk = await tx.documentChunk.create({
        data: {
          documentId,
          content: chunks[index],
          chunkIndex: index,
        },
        select: {
          id: true,
        },
      });

      const vectorLiteral =
        `[${embedding.join(",")}]`;

      await tx.$executeRaw`
        UPDATE public.document_chunks
        SET embedding = ${vectorLiteral}::vector(384)
        WHERE id = ${chunk.id}
      `;
    }
  });

  // Update processing status only after the transaction commits.
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
