/**
 * Notify the frontend to revalidate cached pages after CMS mutations.
 * Fire-and-forget — failures are logged but don't block the response.
 */
export async function revalidateFrontend(path?: string): Promise<void> {
  const url = process.env.FRONTEND_REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!url || !secret) return;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, path }),
    });
  } catch (err) {
    console.error('[revalidate] Failed to notify frontend:', err);
  }
}
