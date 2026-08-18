"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtUsd } from "@/lib/pricing"
import type { LeaderboardResponse } from "@/lib/api"

const PAGE_SIZE = 100

const SORT_LABELS: Record<string, string> = {
  input: "Input $/1M",
  output: "Output $/1M",
  cacheRead: "Cache read $/1M",
  cacheWrite: "Cache write $/1M",
  modelName: "Model",
  provider: "Provider",
  tier: "Tier",
  modality: "Modality",
}

export function PriceTable({ initial }: { initial: LeaderboardResponse }) {
  const [models, setModels] = useState("")
  const [provider, setProvider] = useState("all")
  const [tier, setTier] = useState("all")
  const [modality, setModality] = useState("all")
  const [sortBy, setSortBy] = useState<string>(initial.rows.length > 0 ? "input" : "modelName")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [rows, setRows] = useState(initial.rows)
  const [total, setTotal] = useState(initial.total)
  const [loading, setLoading] = useState(false)
  const [loadedAll, setLoadedAll] = useState(initial.rows.length >= initial.total)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tiers = useMemo(() => initial.filters.tiers, [initial])
  const modalities = useMemo(() => initial.filters.modalities, [initial])
  const providers = useMemo(() => initial.filters.providers, [initial])

  const params = useMemo(() => {
    const p: Record<string, string> = { sortBy, sortOrder }
    if (models) p.models = models
    if (provider !== "all") p.provider = provider
    if (tier !== "all") p.tier = tier
    if (modality !== "all") p.modality = modality
    return p
  }, [models, provider, tier, modality, sortBy, sortOrder])

  const load = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true)
      try {
        const search = new URLSearchParams({ ...params, offset: String(offset), limit: String(PAGE_SIZE) })
        const res = await fetch(`/api/leaderboard?${search.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as LeaderboardResponse
        setRows(append ? (prev) => [...prev, ...data.rows] : data.rows)
        setTotal(data.total)
        setLoadedAll(offset + data.rows.length >= data.total)
      } catch (err) {
        console.error("leaderboard fetch failed", err)
      } finally {
        setLoading(false)
      }
    },
    [params]
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void load(0, false)
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [load])

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
    else {
      setSortBy(key)
      setSortOrder(key === "modelName" || key === "provider" || key === "tier" || key === "modality" ? "asc" : "asc")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search models…"
          value={models}
          onChange={(e) => setModels(e.target.value)}
        />
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            {providers.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tiers</SelectItem>
            {tiers.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={modality} onValueChange={setModality}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Modality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modalities</SelectItem>
            {modalities.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {loading && rows.length === 0 ? "Loading…" : `Showing ${rows.length.toLocaleString()} of ${total.toLocaleString()} prices`}
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {["modelName", "provider", "tier", "modality", "input", "output", "cacheRead", "cacheWrite"].map((key) => (
                <TableHead key={key} className="whitespace-nowrap">
                  <button onClick={() => toggleSort(key)} className="font-medium">
                    {SORT_LABELS[key]}
                    {sortBy === key && (sortOrder === "asc" ? " ↑" : " ↓")}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row, i) => (
                  <TableRow key={`${row.provider}-${row.modelId}-${row.tier}-${i}`}>
                    <TableCell className="max-w-64 truncate">{row.modelName}</TableCell>
                    <TableCell>{row.provider}</TableCell>
                    <TableCell>{row.tier}</TableCell>
                    <TableCell>{row.modality}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(row.input)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(row.output)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(row.cacheRead)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(row.cacheWrite)}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {!loadedAll && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void load(rows.length, true)} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  )
}