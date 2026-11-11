export async function request<T>(url: string, data?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: data === undefined ? "GET" : "POST",
    headers:
      data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store",
  });
  const result = await r.json();
  if (!r.ok)
    throw new Error(result.error || "This action could not be completed.");
  return result as T;
}
