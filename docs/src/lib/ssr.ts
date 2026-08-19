import { headers } from "next/headers"

async function apiBaseUrl(): Promise<string> {
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "http"
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  return `${proto}://${host}`
}

export function searchParamsToURLSearchParams(
  sp: Record<string, string | string[] | undefined>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    params.set(key, Array.isArray(value) ? value[0] : value);
  }
  return params;
}

export async function ssrGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const base = await apiBaseUrl()
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const qs = search.toString()
  const res = await fetch(`${base}${path}${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`SSR fetch of ${path} failed with HTTP ${res.status}`)
  return res.json() as Promise<T>
}