'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'

interface KBFilterBarProps {
  categories: string[]
  activeCategory?: string
  activeQuery?: string
  onSearch: (query: string) => void
  onCategoryChange: (category: string | null) => void
}

export function KBFilterBar({
  categories,
  activeCategory,
  activeQuery,
  onSearch,
  onCategoryChange,
}: KBFilterBarProps) {
  const [inputValue, setInputValue] = useState(activeQuery ?? '')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(activeQuery ?? '')
  }, [activeQuery])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSearch(inputValue)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-8">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Search articles…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Topics:
        </span>
        <button
          type="button"
          onClick={() => onCategoryChange(null)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            !activeCategory
              ? 'bg-primary-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
          }`}
        >
          All
        </button>
        {categories.map(category => (
          <button
            key={category}
            type="button"
            onClick={() => onCategoryChange(activeCategory === category ? null : category)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              activeCategory === category
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  )
}
