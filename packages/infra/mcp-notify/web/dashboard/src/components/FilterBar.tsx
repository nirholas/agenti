import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, X, Filter } from "lucide-react"
import { useState } from "react"

interface FilterOption {
  value: string
  label: string
}

interface FilterBarProps {
  searchPlaceholder?: string
  onSearchChange?: (value: string) => void
  filters?: {
    name: string
    options: FilterOption[]
    value?: string
    onChange?: (value: string) => void
  }[]
  onReset?: () => void
  className?: string
}

export function FilterBar({
  searchPlaceholder = "Search...",
  onSearchChange,
  filters = [],
  onReset,
  className,
}: FilterBarProps) {
  const [search, setSearch] = useState("")

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onSearchChange?.(value)
  }

  const handleReset = () => {
    setSearch("")
    onReset?.()
  }

  const hasActiveFilters = search || filters.some((f) => f.value)

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
        {search && (
          <button
            onClick={() => handleSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      {filters.map((filter) => (
        <Select
          key={filter.name}
          value={filter.value}
          onValueChange={filter.onChange}
        >
          <SelectTrigger className="w-[150px]">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder={filter.name} />
            </div>
          </SelectTrigger>
          <SelectContent>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* Reset */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <X className="h-4 w-4 mr-1" />
          Clear filters
        </Button>
      )}
    </div>
  )
}
