"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtUsd } from "@/lib/pricing"
import type { AvailabilityResponse } from "@/lib/api"

const PAGE_SIZE = 100

export function AvailabilityTable({ initial }: { initial: AvailabilityResponse }) {
  const [models, setModels] = useState("")
  const [minProviders, setMinProviders] = useState(String(initial.minProviders))
  const [sortBy, setSortBy] = useState<string>("count")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [clusters, setClusters] = useState(initial.clusters)
  const [providers, setProviders] = useState(initial.providers)
  const [total, setTotal] = useState(initial.total)
  const [loading, setLoading] = useState(false)
  const [loadedAll, setLoadedAll] = useState(initial.clusters.length >= initial.total)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const params = useMemo(() => {
    const p: Record<string, string> = { sortBy, sortOrder, minProviders }
    if (models) p.models = models
    return p
  }, [models, minProviders, sortBy, sortOrder])

  const load = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true)
      try {
        const search = new URLSearchParams({ ...params, offset: String(offset), limit: String(PAGE_SIZE) })
        const res = await fetch(`/api/availability?${search.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as AvailabilityResponse
        setClusters(append ? (prev) => [...prev, ...data.clusters] : data.clusters)
        setProviders(data.providers)
        setTotal(data.total)
        setLoadedAll(offset + data.clusters.length >= data.total)
      } catch (err) {
        console.error("availability fetch failed", err)
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
        <Select value={minProviders} onValueChange={setMinProviders}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Min providers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1+ providers</SelectItem>
            <SelectItem value="2">2+ providers</SelectItem>
            <SelectItem value="3">3+ providers</SelectItem>
            <SelectItem value="4">4+ providers</SelectItem>
            <SelectItem value="5">5+ providers</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count">Provider count</SelectItem>
            <SelectItem value="name">Model name</SelectItem>
            <SelectItem value="input">Cheapest input</SelectItem>
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
        {loading && clusters.length === 0
          ? "Loading…"
          : `Showing ${clusters.length.toLocaleString()} of ${total.toLocaleString()} models on ${minProviders}+ providers`}
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background">Model</TableHead>
              <TableHead>Providers</TableHead>
              {providers.map((p) => (
                <TableHead key={p} className="whitespace-nowrap text-right">
                  {p}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && clusters.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: providers.length + 2 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : clusters.map((cluster) => {
                  const min = Math.min(
                    ...cluster.entries.map((e) => e.input ?? Number.POSITIVE_INFINITY)
                  )
                  return (
                    <TableRow key={cluster.key}>
                      <TableCell className="sticky left-0 max-w-56 bg-background">
                        <p className="truncate font-medium">{cluster.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{cluster.key}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {cluster.count}×
                      </TableCell>
                      {providers.map((p) => {
                        const entry = cluster.entries.find((e) => e.provider === p)
                        return (
                          <TableCell key={p} className="whitespace-nowrap text-right tabular-nums">
                            {entry ? (
                              <span className={entry.input === min ? "font-medium" : undefined}>
                                {fmtUsd(entry.input)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
          </TableBody>
        </Table>
      </div>

      {!loadedAll && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void load(clusters.length, true)} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  )
}