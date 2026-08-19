"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface MultiSelectComboboxProps {
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  /** Label shown when all options are selected, e.g. "All providers". */
  allLabel: string
  /** Singular noun used for the count label, e.g. "provider" -> "2 providers". */
  countLabel: string
  searchPlaceholder?: string
}

export function MultiSelectCombobox({
  options,
  selected,
  onChange,
  allLabel,
  countLabel,
  searchPlaceholder,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false)
  const allSelected = options.length > 0 && selected.length === options.length

  const toggleAll = () => onChange(allSelected ? [] : [...options])
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])

  const triggerLabel =
    allSelected || options.length === 0
      ? allLabel
      : selected.length === 0
        ? "None selected"
        : `${selected.length} ${countLabel}${selected.length === 1 ? "" : "s"}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-between gap-2">
          {triggerLabel}
          <span className="text-muted-foreground">▾</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? "Search…"} />
          <CommandList>
            <CommandEmpty>No options found</CommandEmpty>
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
              {options.map((opt) => {
                const checked = selected.includes(opt)
                return (
                  <CommandItem key={opt} onSelect={() => toggle(opt)}>
                    <span
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border",
                        checked ? "border-primary bg-primary text-primary-foreground" : "opacity-50"
                      )}
                    >
                      {checked && <Check className="size-3" />}
                    </span>
                    {opt}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}