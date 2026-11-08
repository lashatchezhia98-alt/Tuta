// Chat only. Community posts/comments and appointment records are not ephemeral.
export const CHAT_RETENTION_MS = 48 * 60 * 60 * 1000;
export function chatCutoff(now = Date.now()) {
  return new Date(now - CHAT_RETENTION_MS).toISOString();
}
export function liveMessages(messages, now = Date.now()) {
  return (messages || []).filter((message) => {
    const sent = Date.parse(message.created_at);
    return (
      Number.isFinite(sent) && sent <= now && now < sent + CHAT_RETENTION_MS
    );
  });
}
export function pruneChatPage(page, localNow = Date.now()) {
  if (!page) return null;
  // Anchor expiry to the server clock, including when a device's clock is wrong.
  const now =
    Date.parse(page.serverNow) + Math.max(0, localNow - page.receivedAt);
  return { ...page, messages: liveMessages(page.messages, now) };
}
