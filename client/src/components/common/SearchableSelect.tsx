import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';

interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export const SearchableSelect = ({ label, value, onChange, options, className }: SearchableSelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = options.find(o => o.value === value)?.label || value;

  return (
    <div className={className} ref={ref}>
      {label && <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-1">{label}</span>}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setOpen(!open); setSearch(''); }}
          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-52 flex flex-col overflow-hidden">
            <div className="p-1.5 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 py-1">
              {filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                  className={`w-full px-3 py-1.5 text-sm text-left hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors ${
                    o.value === value
                      ? 'text-violet-600 font-medium bg-violet-50/50 dark:bg-violet-900/10'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {o.label}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-gray-400">No results</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
