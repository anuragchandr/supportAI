
const CHAT_MODEL = "@cf/google/gemma-4-26b-a4b-it";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CloudflareChatResponse = {
  success?: boolean;
  errors?: Array<{
    message?: string;
  }>;
  result?: {
    response?: string;
    choices?: Array<{
      message?: {
        content?: string | Array<{ text?: string }>;
      };
    }>;
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

  const endpoint =
    `https://api.cloudflare.com/client/v4/accounts/` +
    `${accountId}/ai/run/${CHAT_MODEL}`;

  const response = await fetch(endpoint, {
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

  const payload =
    (await response.json().catch(() => null)) as
      | CloudflareChatResponse
      | null;

  if (!response.ok || !payload || payload.success === false) {
    const details = payload?.errors
      ?.map((item) => item.message)
      .filter(Boolean)
      .join("; ");

    throw new Error(
      `Cloudflare chat request failed (HTTP ${response.status})` +
        (details ? `: ${details}` : "")
    );
  }

  // Support the traditional Workers AI result format.
  const directAnswer = payload.result?.response;

  // Also support the Chat Completions response format.
  const messageContent =
    payload.result?.choices?.[0]?.message?.content;

  const choiceAnswer =
    typeof messageContent === "string"
      ? messageContent
      : Array.isArray(messageContent)
        ? messageContent
            .map((part) => part.text ?? "")
            .join("\n")
        : "";

  const answer = (directAnswer || choiceAnswer).trim();

  if (!answer) {
    // Do not log the complete payload, which may contain business data.
    throw new Error(
      "Cloudflare returned no usable assistant text."
    );
  }

  return answer;
}
