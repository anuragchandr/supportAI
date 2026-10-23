const CHAT_MODEL = "@cf/google/gemma-4-26b-a4b-it";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CloudflareChatResponse = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: {
    response?: string;
  };
};

export async function generateSupportAnswer(
  messages: ChatMessage[]
): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error(
      "Cloudflare Workers AI credentials are not configured."
    );
  }

  const url =
    `https://api.cloudflare.com/client/v4/accounts/` +
    `${accountId}/ai/run/${CHAT_MODEL}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      max_tokens: 450,
      temperature: 0.2,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });

  const result =
    (await response.json().catch(() => null)) as
      | CloudflareChatResponse
      | null;

  if (!response.ok || !result?.success) {
    const details = result?.errors
      ?.map((item) => item.message)
      .filter(Boolean)
      .join("; ");

    throw new Error(
      `Cloudflare chat request failed (HTTP ${response.status})` +
        (details ? `: ${details}` : "")
    );
  }

  const answer = result.result?.response?.trim();

  if (!answer) {
    throw new Error(
      "Cloudflare returned an empty assistant response."
    );
  }

  return answer;
}