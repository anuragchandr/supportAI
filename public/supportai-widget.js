
(function () {
  "use strict";

  const script = document.currentScript;

  if (!script) {
    console.error("SupportAI widget: unable to identify embed script.");
    return;
  }

  const widgetKey = script.getAttribute("data-widget-key");

  if (!widgetKey) {
    console.error("SupportAI widget: missing data-widget-key.");
    return;
  }

  if (document.getElementById("supportai-widget-root")) {
    return;
  }

  const appOrigin = new URL(script.src, window.location.href).origin;
  const apiUrl = new URL("/api/widget/chat", appOrigin);
  apiUrl.searchParams.set("key", widgetKey);

  const leadApiUrl = new URL("/api/widget/leads", appOrigin);
  leadApiUrl.searchParams.set("key", widgetKey);

  const visitorStorageKey = `supportai_visitor_${widgetKey}`;

  function createVisitorId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function getVisitorId() {
    try {
      let visitorId = localStorage.getItem(visitorStorageKey);

      if (!visitorId) {
        visitorId = createVisitorId();
        localStorage.setItem(visitorStorageKey, visitorId);
      }

      return visitorId;
    } catch {
      // Continue without persistent storage if browser storage is blocked.
      return createVisitorId();
    }
  }

  const visitorId = getVisitorId();
  let conversationId = null;
  let sending = false;

  const style = document.createElement("style");

  style.textContent = `
    #supportai-widget-root,
    #supportai-widget-root * {
      box-sizing: border-box;
    }

    #supportai-widget-root {
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #supportai-widget-root .sai-launcher {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 2147483000;
      padding: 14px 20px;
      border: 0;
      border-radius: 999px;
      background: #18181b;
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 8px 28px rgba(0,0,0,.2);
    }

    #supportai-widget-root .sai-panel {
      position: fixed;
      right: 22px;
      bottom: 88px;
      z-index: 2147483000;
      display: flex;
      flex-direction: column;
      width: min(380px, calc(100vw - 32px));
      height: min(570px, calc(100vh - 120px));
      overflow: hidden;
      border: 1px solid #e4e4e7;
      border-radius: 18px;
      background: #ffffff;
      color: #18181b;
      box-shadow: 0 18px 60px rgba(0,0,0,.18);
    }

    #supportai-widget-root .sai-panel[hidden] {
      display: none !important;
    }

    #supportai-widget-root .sai-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 17px;
      background: #18181b;
      color: #ffffff;
    }

    #supportai-widget-root .sai-title {
      font-size: 15px;
      font-weight: 700;
    }

    #supportai-widget-root .sai-subtitle {
      margin-top: 3px;
      color: #d4d4d8;
      font-size: 12px;
    }

    #supportai-widget-root .sai-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    #supportai-widget-root .sai-header button {
      border: 1px solid #52525b;
      border-radius: 8px;
      padding: 6px 8px;
      background: transparent;
      color: #ffffff;
      font-size: 12px;
      cursor: pointer;
    }

    #supportai-widget-root .sai-messages {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
      padding: 16px;
      background: #fafafa;
    }

    #supportai-widget-root .sai-bubble {
      max-width: 90%;
      padding: 11px 13px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    #supportai-widget-root .sai-user {
      align-self: flex-end;
      border-bottom-right-radius: 4px;
      background: #18181b;
      color: #ffffff;
    }

    #supportai-widget-root .sai-assistant {
      align-self: flex-start;
      border: 1px solid #e4e4e7;
      border-bottom-left-radius: 4px;
      background: #ffffff;
      color: #27272a;
    }

    #supportai-widget-root .sai-sources {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 8px;
    }

    #supportai-widget-root .sai-source {
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      padding: 7px 9px;
      background: #ffffff;
      color: #52525b;
      font-size: 11px;
    }

    #supportai-widget-root .sai-status {
      min-height: 17px;
      padding: 0 16px 8px;
      background: #fafafa;
      color: #71717a;
      font-size: 11px;
    }

    #supportai-widget-root .sai-form {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid #e4e4e7;
      background: #ffffff;
    }

    #supportai-widget-root .sai-input {
      min-width: 0;
      min-height: 42px;
      max-height: 110px;
      flex: 1;
      resize: vertical;
      border: 1px solid #d4d4d8;
      border-radius: 10px;
      padding: 10px;
      background: #ffffff;
      color: #18181b;
      font: inherit;
      font-size: 13px;
      outline: none;
    }

    #supportai-widget-root .sai-input:focus {
      border-color: #71717a;
    }

    #supportai-widget-root .sai-send {
      min-height: 42px;
      border: 0;
      border-radius: 10px;
      padding: 0 13px;
      background: #18181b;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    #supportai-widget-root button:disabled,
    #supportai-widget-root textarea:disabled {
      cursor: not-allowed;
      opacity: .55;
    }

    @media (max-width: 480px) {
      #supportai-widget-root .sai-panel {
        right: 16px;
        bottom: 82px;
        width: calc(100vw - 32px);
        height: min(620px, calc(100vh - 105px));
      }

      #supportai-widget-root .sai-launcher {
        right: 16px;
        bottom: 16px;
      }
    }

        #supportai-widget-root .sai-contact-form {
      display: grid;
      gap: 9px;
      max-height: 260px;
      overflow-y: auto;
      border-top: 1px solid #e4e4e7;
      padding: 12px;
      background: #ffffff;
    }

    #supportai-widget-root .sai-contact-form[hidden] {
      display: none !important;
    }

    #supportai-widget-root .sai-contact-heading {
      font-size: 13px;
      font-weight: 700;
    }

    #supportai-widget-root .sai-contact-description {
      color: #71717a;
      font-size: 11px;
      line-height: 1.5;
    }

    #supportai-widget-root .sai-field {
      display: grid;
      gap: 4px;
      color: #52525b;
      font-size: 11px;
    }

    #supportai-widget-root .sai-field input,
    #supportai-widget-root .sai-field textarea {
      width: 100%;
      min-width: 0;
      border: 1px solid #d4d4d8;
      border-radius: 7px;
      padding: 8px;
      color: #18181b;
      background: #ffffff;
      font: inherit;
      font-size: 12px;
    }

    #supportai-widget-root .sai-contact-submit {
      justify-self: start;
      border: 0;
      border-radius: 8px;
      padding: 9px 12px;
      background: #18181b;
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    #supportai-widget-root .sai-contact-status {
      color: #52525b;
      font-size: 11px;
    }
  `;

  const root = document.createElement("div");
  root.id = "supportai-widget-root";

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "sai-launcher";
  launcher.textContent = "Chat with us";
  launcher.setAttribute("aria-expanded", "false");

  const panel = document.createElement("section");
  panel.className = "sai-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "SupportAI chat");

  const header = document.createElement("header");
  header.className = "sai-header";

  const heading = document.createElement("div");

  const title = document.createElement("div");
  title.className = "sai-title";
  title.textContent = "Customer support";

  const subtitle = document.createElement("div");
  subtitle.className = "sai-subtitle";
  subtitle.textContent = "Powered by SupportAI";

  heading.append(title, subtitle);

  const headerActions = document.createElement("div");
  headerActions.className = "sai-header-actions";

  const newChatButton = document.createElement("button");
  newChatButton.type = "button";
  newChatButton.textContent = "New chat";

  const contactButton = document.createElement("button");
    contactButton.type = "button";
    contactButton.textContent = "Contact";
    contactButton.setAttribute("aria-expanded", "false");


  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.setAttribute("aria-label", "Close chat");

  headerActions.append(
  newChatButton,
  contactButton,
  closeButton
);
  header.append(heading, headerActions);

  contactButton.addEventListener("click", () => {
  leadForm.hidden = !leadForm.hidden;

  contactButton.setAttribute(
    "aria-expanded",
    String(!leadForm.hidden)
  );

  if (!leadForm.hidden) {
    leadName.input.focus();
  }
});

  const messages = document.createElement("div");
  messages.className = "sai-messages";
  messages.setAttribute("aria-live", "polite");
  messages.setAttribute("aria-relevant", "additions");

  const status = document.createElement("div");
  status.className = "sai-status";
  status.setAttribute("role", "status");

  let submittingLead = false;

const leadForm = document.createElement("form");
leadForm.className = "sai-contact-form";
leadForm.hidden = true;

const leadHeading = document.createElement("p");
leadHeading.className = "sai-contact-heading";
leadHeading.textContent = "Leave your contact details";

const leadDescription = document.createElement("p");
leadDescription.className = "sai-contact-description";
leadDescription.textContent =
  "Share an email address or phone number and the business can follow up.";

function makeLeadField(labelText, fieldName, inputType, required) {
  const label = document.createElement("label");
  label.className = "sai-field";

  const caption = document.createElement("span");
  caption.textContent = labelText;

  const input =
    inputType === "textarea"
      ? document.createElement("textarea")
      : document.createElement("input");

  input.name = fieldName;
  input.required = required;

  if (inputType === "textarea") {
    input.rows = 2;
    input.maxLength = 2000;
  } else {
    input.type = inputType;
  }

  label.append(caption, input);

  return { label, input };
}

const leadName = makeLeadField("Name", "name", "text", true);
leadName.input.maxLength = 100;
leadName.input.autocomplete = "name";

const leadEmail = makeLeadField("Email", "email", "email", false);
leadEmail.input.maxLength = 254;
leadEmail.input.autocomplete = "email";

const leadPhone = makeLeadField("Phone", "phone", "tel", false);
leadPhone.input.maxLength = 30;
leadPhone.input.autocomplete = "tel";

const leadMessage = makeLeadField(
  "How can we help? (optional)",
  "message",
  "textarea",
  false
);

const leadStatus = document.createElement("p");
leadStatus.className = "sai-contact-status";
leadStatus.setAttribute("role", "status");

const leadSubmit = document.createElement("button");
leadSubmit.type = "submit";
leadSubmit.className = "sai-contact-submit";
leadSubmit.textContent = "Submit details";

leadForm.append(
  leadHeading,
  leadDescription,
  leadName.label,
  leadEmail.label,
  leadPhone.label,
  leadMessage.label,
  leadStatus,
  leadSubmit
);

  const form = document.createElement("form");
  form.className = "sai-form";

  const input = document.createElement("textarea");
  input.className = "sai-input";
  input.rows = 2;
  input.maxLength = 1000;
  input.placeholder = "Ask a question...";
  input.setAttribute("aria-label", "Your question");

  const sendButton = document.createElement("button");
  sendButton.className = "sai-send";
  sendButton.type = "submit";
  sendButton.textContent = "Send";

  form.append(input, sendButton);
  panel.append(
  header,
  messages,
  leadForm,
  status,
  form
);
  root.append(launcher, panel);
  document.head.appendChild(style);

  function addMessage(role, content, sources) {
    const bubble = document.createElement("div");
    bubble.className = `sai-bubble ${
      role === "user" ? "sai-user" : "sai-assistant"
    }`;

    // Use textContent: responses and document titles are never HTML.
    bubble.textContent = content;

    if (role === "assistant" && Array.isArray(sources) && sources.length) {
      const sourceList = document.createElement("div");
      sourceList.className = "sai-sources";

      sources.forEach((source) => {
        const item = document.createElement("div");
        item.className = "sai-source";

        const similarity = Number(source.similarity);
        const score = Number.isFinite(similarity)
          ? ` · ${Math.round(similarity * 100)}% similarity`
          : "";

        item.textContent =
          `[${source.reference}] ${source.documentTitle}` +
          ` · Chunk ${Number(source.chunkIndex) + 1}${score}`;

        sourceList.appendChild(item);
      });

      bubble.appendChild(sourceList);
    }

    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function setBusy(value) {
    sending = value;
    input.disabled = value;
    sendButton.disabled = value;
    newChatButton.disabled = value;
    sendButton.textContent = value ? "..." : "Send";
    status.textContent = value ? "Searching documents..." : "";
  }

  function showPanel() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    launcher.textContent = "Close chat";
    input.focus();
  }

  function hidePanel() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.textContent = "Chat with us";
  }

  launcher.addEventListener("click", () => {
    if (panel.hidden) {
      showPanel();
    } else {
      hidePanel();
    }
  });

  closeButton.addEventListener("click", hidePanel);

  newChatButton.addEventListener("click", () => {
    if (sending) return;

    conversationId = null;
    messages.replaceChildren();

    addMessage(
      "assistant",
      "Welcome! Ask a question about this business, and I'll search its knowledge base.",
      []
    );

    status.textContent = "";
    input.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = input.value.trim();

    if (!question || sending) return;

    addMessage("user", question, []);
    input.value = "";
    setBusy(true);

    try {
      const response = await fetch(apiUrl.toString(), {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          visitorId,
          ...(conversationId ? { conversationId } : {}),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data && typeof data.error === "string"
            ? data.error
            : `Request failed with status ${response.status}`
        );
      }

      if (
        !data ||
        typeof data.answer !== "string" ||
        typeof data.conversationId !== "string"
      ) {
        throw new Error("The server returned an incomplete answer.");
      }

      conversationId = data.conversationId;

      addMessage(
        "assistant",
        data.answer,
        Array.isArray(data.sources) ? data.sources : []
      );
    } catch (error) {
      console.error("SupportAI widget request failed.");

      addMessage(
        "assistant",
        "Sorry, I couldn't process your question right now. Please try again shortly.",
        []
      );

      status.textContent = "The request could not be completed.";
    } finally {
      setBusy(false);
      input.focus();
    }
  });

  leadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (submittingLead) return;

  const name = leadName.input.value.trim();
  const email = leadEmail.input.value.trim();
  const phone = leadPhone.input.value.trim();
  const message = leadMessage.input.value.trim();

  if (!email && !phone) {
    leadStatus.textContent =
      "Enter an email address or phone number.";
    return;
  }

  submittingLead = true;
  leadSubmit.disabled = true;
  leadStatus.textContent = "Submitting your details...";

  try {
    const response = await fetch(leadApiUrl.toString(), {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        phone,
        message,
        visitorId,
        ...(conversationId ? { conversationId } : {}),
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data && typeof data.error === "string"
          ? data.error
          : `Request failed with status ${response.status}`
      );
    }

    leadForm.reset();
    leadStatus.textContent =
      data.message || "Your details were submitted successfully.";
  } catch {
    leadStatus.textContent =
      "Unable to submit your details right now. Please try again.";
  } finally {
    submittingLead = false;
    leadSubmit.disabled = false;
  }
});

  input.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  addMessage(
    "assistant",
    "Welcome! Ask a question about this business, and I'll search its knowledge base.",
    []
  );

  function mount() {
    if (document.body && !root.isConnected) {
      document.body.appendChild(root);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
