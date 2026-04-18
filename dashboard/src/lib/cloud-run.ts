const BASE = process.env.CLOUD_RUN_URL!

export async function cloudRunPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Cloud Run ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}
