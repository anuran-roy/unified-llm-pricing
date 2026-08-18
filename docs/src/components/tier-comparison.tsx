"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtUsd } from "@/lib/pricing"
import type { TiersResponse } from "@/lib/api"

const PAGE_SIZE = 100

export function TierComparison({ initial }: { initial: TiersResponse }) {
  const [models, setModels] = useState("")
  const [provider, setProvider] = useState("all")
  const [sortBy, setSortBy] = useState<string>("savings")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [rows, setRows] = useState(initial.rows)
  const [total, setTotal] = useState(initial.total)
  const [loading, setLoading] = useState(false)
  const [loadedAll, setLoadedAll] = useState(initial.rows.length >= initial.total)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const providers = useMemo(() => initial.filters.providers, [initial])

  const params = useMemo(() => {
    const p: Record<string, string> = { sortBy, sortOrder }
    if (models) p.models = models
    if (provider !== "all") p.provider = provider
    return p
  }, [models, provider, sortBy, sortOrder])

  const load = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true)
      try {
        const search = new URLSearchParams({ ...params, offset: String(offset), limit: String(PAGE_SIZE) })
        const res = await fetch(`/api/tiers?${search.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as TiersResponse
        setRows(append ? (prev) => [...prev, ...data.rows] : data.rows)
        setTotal(data.total)
        setLoadedAll(offset + data.rows.length >= data.total)
      } catch (err) {
        console.error("tiers fetch failed", err)
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
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="savings">Savings %</SelectItem>
            <SelectItem value="input">Input price</SelectItem>
            <SelectItem value="output">Output price</SelectItem>
            <SelectItem value="modelName">Model name</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
        >
          {sortOrder === "asc" ? "Ascending ↑" : "Descending ↓"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {loading && rows.length === 0
          ? "Loading…"
          : `Showing ${rows.length.toLocaleString()} of ${total.toLocaleString()} discount-tier prices`}
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">Input $/1M</TableHead>
              <TableHead className="text-right">Output $/1M</TableHead>
              <TableHead className="text-right">Standard input</TableHead>
              <TableHead className="text-right">Savings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
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
                    <TableCell>
                      <Badge variant="outline">{row.tier}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(row.input)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(row.output)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsd(row.standardInput)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.savingsPct !== null ? (
                        <Badge variant={row.savingsPct > 0 ? "default" : "secondary"}>
                          {row.savingsPct > 0 ? "-" : "+"}
                          {Math.abs(row.savingsPct).toFixed(1)}%
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
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