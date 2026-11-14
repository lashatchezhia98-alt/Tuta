const endpoint = "https://exp.host/--/api/v2/push";

export function pushMessage(row) {
  return {
    to: row.device,
    title: row.lang === "ka" ? "თუთა" : "Tuta",
    body: row.lang === "ka" ? "ახალი შეტყობინება გაქვს." : "You have a new notification.",
    channelId: "tuta-activity",
    ttl: 3600,
    data: { screen: "activity" },
  };
}

export async function dispatch({ rpc, accessToken, send = fetch }) {
  async function request(path, payload) {
    const response = await send(`${endpoint}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw Error("Push provider unavailable");
    return (await response.json()).data;
  }

  const rows = await rpc("activity_push_claim");
  const pending = rows.filter((row) => row.eligible && !row.receipt);
  const receipted = rows.filter((row) => row.eligible && row.receipt);
  const [tickets, receipts] = await Promise.all([
    pending.length ? request("send", pending.map(pushMessage)).catch(() => null) : null,
    receipted.length ? request("getReceipts", { ids: receipted.map((row) => row.receipt) }).catch(() => null) : null,
  ]);
  const positions = new Map(pending.map((row, index) => [row.job, index]));
  for (let index = 0; index < rows.length; index += 10) {
    await Promise.all(rows.slice(index, index + 10).map(async (row) => {
      const value = row.receipt ? receipts?.[row.receipt] : tickets?.[positions.get(row.job)];
      const error = value?.details?.error;
      let result = "retry";
      if (!row.eligible || (row.receipt && value?.status === "ok") || error === "MessageTooBig") result = "done";
      else if (error === "DeviceNotRegistered") result = "unregistered";
      else if (!row.receipt && value?.status === "ok" && typeof value.id === "string") result = "ticket";
      await rpc("activity_push_finish", {
        p_job: row.job, p_claim: row.claim, p_result: result,
        p_ticket: result === "ticket" ? value.id : null,
      });
    }));
  }
  return rows.length;
}
