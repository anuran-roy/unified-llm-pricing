"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { fmtUsd } from "@/lib/pricing"
import type { AvailabilityEntry, AvailabilityResponse } from "@/lib/api"
import type { AvailabilityQuery } from "@/lib/leaderboard"

const PAGE_SIZE = 100

function priceLabel(e: AvailabilityEntry): string {
  if (!Number.isFinite(e.input) && !Number.isFinite(e.output)) return "—"
  const segs: string[] = []
  if (Number.isFinite(e.input)) segs.push(`${fmtUsd(e.input)}(input)`)
  else segs.push("—(input)")
  if (Number.isFinite(e.cacheRead)) segs.push(`${fmtUsd(e.cacheRead)}(cached input)`)
  if (Number.isFinite(e.output)) segs.push(`${fmtUsd(e.output)}(output)`)
  else segs.push("—(output)")
  if (Number.isFinite(e.cacheWrite)) segs.push(`${fmtUsd(e.cacheWrite)}(cached output)`)
  return segs.join("\n")
}

export function AvailabilityTable({ initial, initialQuery }: { initial: AvailabilityResponse; initialQuery: AvailabilityQuery }) {
  const router = useRouter()
  const pathname = usePathname()
  const [models, setModels] = useState(initialQuery.models ?? "")
  const [minProviders, setMinProviders] = useState(String(initialQuery.minProviders ?? 2))
  const [sortBy, setSortBy] = useState<string>(initialQuery.sortBy ?? "count")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialQuery.sortOrder ?? "desc")
  const [clusters, setClusters] = useState(initial.clusters)
  const [providers, setProviders] = useState(initial.providers)
  const [total, setTotal] = useState(initial.total)
  const [loading, setLoading] = useState(false)
  const [loadedAll, setLoadedAll] = useState(initial.clusters.length >= initial.total)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [allProviders] = useState(initial.providers)
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
    initialQuery.providers
      ? new Set(initialQuery.providers.split(",").filter(Boolean))
      : new Set(initial.providers)
  )

  const allSelected = selectedProviders.size === allProviders.length

  const toggleAll = () => {
    if (allSelected) setSelectedProviders(new Set())
    else setSelectedProviders(new Set(allProviders))
  }

  const toggleProvider = (p: string) => {
    const next = new Set(selectedProviders)
    if (next.has(p)) next.delete(p)
    else next.add(p)
    setSelectedProviders(next)
  }

  const params = useMemo(() => {
    const p: Record<string, string> = { sortBy, sortOrder, minProviders }
    if (models) p.models = models
    if (!allSelected) p.providers = [...selectedProviders].sort().join(",")
    return p
  }, [models, minProviders, sortBy, sortOrder, allSelected, selectedProviders])

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
      const search = new URLSearchParams(params).toString()
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [load, params, pathname, router])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search models…"
          value={models}
          onChange={(e) => setModels(e.target.value)}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="justify-between gap-2">
              {allSelected ? "All providers" : `${selectedProviders.size} provider${selectedProviders.size === 1 ? "" : "s"}`}
              <span className="text-muted-foreground">▾</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search providers…" />
              <CommandList>
                <CommandEmpty>No providers found</CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={toggleAll}>
                    <span
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border",
                        allSelected ? "border-primary bg-primary text-primary-foreground" : "opacity-50"
                      )}
                    >
                      {allSelected && <Check className="size-3" />}
                    </span>
                    Select All
                  </CommandItem>
                  {allProviders.map((p) => {
                    const checked = selectedProviders.has(p)
                    return (
                      <CommandItem key={p} onSelect={() => toggleProvider(p)}>
                        <span
                          className={cn(
                            "mr-2 flex size-4 items-center justify-center rounded-sm border",
                            checked ? "border-primary bg-primary text-primary-foreground" : "opacity-50"
                          )}
                        >
                          {checked && <Check className="size-3" />}
                        </span>
                        {p}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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

      <p className="text-xs text-muted-foreground">
        Per-provider prices per 1M tokens: $A(input)/$B(cached input)/$C(output)/$D(cached output). Cached prices are omitted when unavailable.
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
                          <TableCell key={p} className="whitespace-nowrap text-right">
                            {entry ? (
                              <span
                                className={
                                  entry.input === min
                                    ? "font-medium whitespace-pre-line tabular-nums"
                                    : "whitespace-pre-line text-xs tabular-nums text-muted-foreground"
                                }
                              >
                                {priceLabel(entry)}
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
      {!loading && clusters.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No models match the selected providers.</p>
      )}
    </div>
  )
}