const EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5";
const EMBEDDING_DIMENSIONS = 384;

type CloudflareEmbeddingResponse = {
  success?: boolean;
  errors?: Array<{
    message?: string;
  }>;
  result?: {
    shape?: number[];
    data?: number[][];
  };
};

export async function createEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error(
      "Cloudflare Workers AI is not configured. Check your server environment variables."
    );
  }

  if (texts.some((text) => !text.trim())) {
    throw new Error(
      "Embedding input cannot contain empty text."
    );
  }

  const endpoint =
    `https://api.cloudflare.com/client/v4/accounts/` +
    `${accountId}/ai/run/${EMBEDDING_MODEL}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: texts,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  const payload =
    (await response.json().catch(() => null)) as
      | CloudflareEmbeddingResponse
      | null;

  if (
    !response.ok ||
    !payload?.success ||
    !payload.result?.data
  ) {
    const details = payload?.errors
      ?.map((item) => item.message)
      .filter(Boolean)
      .join("; ");

    throw new Error(
      `Cloudflare embedding request failed (HTTP ${response.status})` +
        (details ? `: ${details}` : "")
    );
  }

  const embeddings = payload.result.data;

  if (embeddings.length !== texts.length) {
    throw new Error(
      "Embedding response count does not match the input count."
    );
  }

  for (const embedding of embeddings) {
    if (
      embedding.length !== EMBEDDING_DIMENSIONS ||
      !embedding.every(Number.isFinite)
    ) {
      throw new Error(
        "Cloudflare returned an invalid embedding vector."
      );
    }
  }

  return embeddings;
}