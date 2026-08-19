"use client"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

const TABS = [
  { path: "/", label: "Overview" },
  { path: "/pricing", label: "Price per 1M tokens" },
  { path: "/availability", label: "Availability" },
  { path: "/tier-comparison", label: "Tier comparison" },
]

export function NavTabs() {
  const pathname = usePathname()
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const active = TABS.some((t) => t.path === pathname) ? pathname : "/"

  const copyShareUrl = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="border-b">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4">
        <Tabs value={active} onValueChange={(v) => router.push(v)}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.path} value={t.path}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="link" size="sm" onClick={() => void copyShareUrl()}>
          {copied ? "Copied!" : "Share this data"}
        </Button>
      </div>
    </div>
  )
}