/**
 * Notify the frontend to revalidate cached pages after CMS mutations.
 * Fire-and-forget — failures are logged but don't block the response.
 */
export async function revalidateFrontend(path?: string): Promise<void> {
  const url = process.env.FRONTEND_REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!url || !secret) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, path }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`[revalidate] Frontend returned HTTP ${response.status}`);
    }
  } catch (err) {
    console.error('[revalidate] Failed to notify frontend:', err);
  } finally {
    clearTimeout(timeout);
  }
}
