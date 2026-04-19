const BASE = process.env.BACKEND_URL!

export async function backendPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Backend ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}
