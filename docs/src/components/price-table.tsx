"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtUsd } from "@/lib/pricing"
import type { LeaderboardResponse } from "@/lib/api"

const PAGE_SIZE = 100
const SLIDER_MIN_B = 0
const SLIDER_MAX_B = 1000

const SORT_LABELS: Record<string, string> = {
  input: "Input $/1M",
  output: "Output $/1M",
  cacheRead: "Cache read $/1M",
  cacheWrite: "Cache write $/1M",
  modelName: "Model",
  provider: "Provider",
  tier: "Tier",
  modality: "Modality",
  sizeB: "Size",
}

function fmtSizeB(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}T`
  return n >= 1 ? `${n.toFixed(1).replace(/\.0$/, "")}B` : `${n.toFixed(2)}B`
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
  const sizeBounds = useMemo(() => initial.filters.sizeRange, [initial])
  const [sizeRange, setSizeRange] = useState<[number, number]>([SLIDER_MIN_B, SLIDER_MAX_B])

  const sizeActive = sizeRange[0] > SLIDER_MIN_B || sizeRange[1] < SLIDER_MAX_B

  const params = useMemo(() => {
    const p: Record<string, string> = { sortBy, sortOrder }
    if (models) p.models = models
    if (provider !== "all") p.provider = provider
    if (tier !== "all") p.tier = tier
    if (modality !== "all") p.modality = modality
    if (sizeActive && sizeRange) {
      if (sizeRange[0] > SLIDER_MIN_B) p.minSize = String(sizeRange[0])
      if (sizeRange[1] < SLIDER_MAX_B) p.maxSize = String(sizeRange[1])
    }
    return p
  }, [models, provider, tier, modality, sortBy, sortOrder, sizeActive, sizeRange])

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

  const topOpen = sizeRange[1] >= SLIDER_MAX_B
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

      {sizeBounds && sizeRange && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
          <span className="w-24 text-sm font-medium">Size</span>
          <Slider
            className="max-w-72 flex-1"
            min={SLIDER_MIN_B}
            max={SLIDER_MAX_B}
            step={1}
            value={sizeRange}
            onValueChange={(v) => {
              if (v.length === 2) setSizeRange([v[0], v[1]])
            }}
          />
          <span className="min-w-28 text-sm tabular-nums text-muted-foreground">
            {fmtSizeB(sizeRange[0])} – {topOpen ? ">1T" : fmtSizeB(sizeRange[1])}
          </span>
          {sizeActive && (
            <button
              className="text-sm text-muted-foreground underline underline-offset-2"
              onClick={() => setSizeRange([SLIDER_MIN_B, SLIDER_MAX_B])}
            >
              Reset
            </button>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {sizeActive
          ? "Models without a published size (e.g. GPT-4.1) are always included; the slider filters only models whose size is known. Pull the top thumb to the end for the \u201C>1T\u201D category."
          : "Size is inferred from the model ID, so it is only available for open-weight models. Largest known size: " +
            (sizeBounds ? `${fmtSizeB(sizeBounds.max)} (${fmtSizeB(sizeBounds.min)} smallest)` : "—") +
            "."}
      </p>

      <p className="text-sm text-muted-foreground">
        {loading && rows.length === 0 ? "Loading…" : `Showing ${rows.length.toLocaleString()} of ${total.toLocaleString()} prices`}
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {["modelName", "provider", "tier", "modality", "sizeB", "input", "output", "cacheRead", "cacheWrite"].map((key) => (
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
                    {Array.from({ length: 9 }).map((_, j) => (
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
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {row.sizeB === null ? "—" : fmtSizeB(row.sizeB)}
                    </TableCell>
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