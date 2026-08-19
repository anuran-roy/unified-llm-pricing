"use client"

import { usePathname, useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TABS = [
  { path: "/", label: "Overview" },
  { path: "/pricing", label: "Price per 1M tokens" },
  { path: "/availability", label: "Availability" },
  { path: "/tier-comparison", label: "Tier comparison" },
]

export function NavTabs() {
  const pathname = usePathname()
  const router = useRouter()
  const active = TABS.some((t) => t.path === pathname) ? pathname : "/"

  return (
    <div className="border-b">
      <div className="mx-auto w-full max-w-6xl px-4">
        <Tabs value={active} onValueChange={(v) => router.push(v)}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.path} value={t.path}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  )
}