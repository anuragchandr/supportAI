
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
      finish_reason?: string;
      message?: {
        content?: string | null | Array<{
          type?: string;
          text?: string;
        }>;
        refusal?: string | null;
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
    throw new Error("Cloudflare Workers AI credentials are not configured.");
  }

  const endpoint =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}` +
    `/ai/run/${CHAT_MODEL}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      max_completion_tokens: 450,
      temperature: 0.2,

      // Disable reasoning for normal customer support responses.
      chat_template_kwargs: {
        enable_thinking: false,
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });

  const responseText = await response.text();

  let payload: CloudflareChatResponse;

  try {
    payload = JSON.parse(responseText) as CloudflareChatResponse;
  } catch {
    throw new Error(
      `Cloudflare returned invalid JSON (HTTP ${response.status}): ` +
      responseText.slice(0, 500)
    );
  }

  if (!response.ok || payload.success === false) {
    const details = payload.errors
      ?.map((item) => item.message)
      .filter(Boolean)
      .join("; ");

    throw new Error(
      `Cloudflare chat failed (HTTP ${response.status})` +
      (details ? `: ${details}` : "")
    );
  }

  const choice = payload.result?.choices?.[0];
  const content = choice?.message?.content;

  const choiceAnswer =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .filter((part) => part.type === "text" || !part.type)
            .map((part) => part.text ?? "")
            .join("\n")
        : "";

  const answer = (
    payload.result?.response || choiceAnswer
  ).trim();

  if (!answer) {
    throw new Error(
      "Cloudflare returned no usable assistant text. " +
      `Finish reason: ${choice?.finish_reason ?? "unknown"}. ` +
      `Result keys: ${Object.keys(payload.result ?? {}).join(", ") || "none"}.`
    );
  }

  return answer;
}
