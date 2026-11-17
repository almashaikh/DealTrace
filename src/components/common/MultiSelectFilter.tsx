import { ChevronDown } from 'lucide-react'
import { useId, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface FilterOption<T extends string> {
  value: T
  label: ReactNode
}

interface MultiSelectFilterProps<T extends string> {
  label: string
  options: readonly FilterOption<T>[]
  selected: readonly T[]
  onChange: (selected: T[]) => void
}

/** Button that opens a checklist. Shows how many options are chosen. */
export function MultiSelectFilter<T extends string>({ label, options, selected, onChange }: MultiSelectFilterProps<T>) {
  const id = useId()
  const count = selected.length

  function toggle(value: T, on: boolean) {
    onChange(on ? [...selected, value] : selected.filter((v) => v !== value))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" aria-label={count > 0 ? `${label}, ${count} selected` : label}>
          {label}
          {count > 0 && <span className="rounded-md bg-brand-subtle px-1.5 text-xs leading-4 font-medium text-brand tabular-nums">{count}</span>}
          <ChevronDown className="text-text-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <ul role="group" aria-label={label}>
          {options.map((o) => {
            const checkboxId = `${id}-${o.value}`
            const checked = selected.includes(o.value)
            return (
              <li key={o.value}>
                <label htmlFor={checkboxId} className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] leading-[18px] text-text hover:bg-app">
                  <Checkbox id={checkboxId} checked={checked} onCheckedChange={(v) => toggle(o.value, v === true)} />
                  {o.label}
                </label>
              </li>
            )
          })}
        </ul>
        {count > 0 && (
          <div className="mt-1 border-t pt-1">
            <Button variant="ghost" size="xs" className="w-full justify-start" onClick={() => onChange([])}>
              Clear {label.toLowerCase()}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
