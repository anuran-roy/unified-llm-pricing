"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { fmtUsd } from "@/lib/pricing"
import type { StatsResponse } from "@/lib/api"

export function Overview({ stats }: { stats: StatsResponse }) {
  const s = stats.stats
  const maxAvg = Math.max(...s.perProvider.map((p) => p.avgStandardInput ?? 0), 1)
  const sortedProviders = [...s.perProvider].sort(
    (a, b) => (a.avgStandardInput ?? Infinity) - (b.avgStandardInput ?? Infinity)
  )
  const modalities = Object.entries(s.modalityCounts).sort((a, b) => b[1] - a[1])
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    })

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{s.providerCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Models</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{s.modelCount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Models on 2+ providers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{s.multiProviderModelCount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cheapest input /1M</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {s.cheapestOverall ? fmtUsd(s.cheapestOverall.price) : "—"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {s.cheapestOverall?.model} · {s.cheapestOverall?.provider}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Average standard input price per provider</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedProviders.map((p) => (
              <div key={p.provider} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm">{p.provider}</span>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.max(((p.avgStandardInput ?? 0) / maxAvg) * 100, 1)}%`,
                    }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-sm tabular-nums">
                  {p.avgStandardInput !== null ? fmtUsd(p.avgStandardInput) : "—"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cheapest model per provider</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Input $/1M</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.perProvider.map((p) => (
                  <TableRow key={p.provider}>
                    <TableCell>{p.provider}</TableCell>
                    <TableCell className="max-w-60 truncate">{p.cheapestModel ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.cheapestInput !== null ? fmtUsd(p.cheapestInput) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Modality coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {modalities.map(([m, count]) => (
                  <Badge key={m} variant="secondary">
                    {m} · {count.toLocaleString()}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Data source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                Source: <Badge variant="outline">Live — GitHub raw</Badge>
              </p>
              <p className="text-muted-foreground">
                Snapshot generated {formatDateTime(stats.meta.generatedAt)} UTC
              </p>
              <p className="text-muted-foreground">
                Fetched {formatDateTime(stats.meta.fetchedAt)} UTC
              </p>
              {stats.meta.error && (
                <Tooltip>
                  <TooltipTrigger>
                    <p className="text-destructive">Remote fetch failed — showing bundled snapshot</p>
                  </TooltipTrigger>
                  <TooltipContent>{stats.meta.error}</TooltipContent>
                </Tooltip>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}