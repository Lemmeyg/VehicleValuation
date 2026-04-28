import Link from 'next/link'
import { Search } from 'lucide-react'

interface KBFilterBarProps {
  categories: string[]
  activeCategory?: string
  activeQuery?: string
}

export function KBFilterBar({ categories, activeCategory, activeQuery }: KBFilterBarProps) {
  function pillHref(category: string | null): string {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (activeQuery) params.set('q', activeQuery)
    const qs = params.toString()
    return qs ? `/knowledge-base?${qs}` : '/knowledge-base'
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-8">
      <form method="get" action="/knowledge-base" className="flex gap-2 mb-4">
        {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            name="q"
            defaultValue={activeQuery ?? ''}
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
        <Link
          href={pillHref(null)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            !activeCategory
              ? 'bg-primary-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
          }`}
        >
          All
        </Link>
        {categories.map(category => (
          <Link
            key={category}
            href={pillHref(category)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              activeCategory === category
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            {category}
          </Link>
        ))}
      </div>
    </div>
  )
}
