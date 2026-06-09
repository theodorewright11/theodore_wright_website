import { useMemo, useState } from 'react';
import { buildCodeTree, flattenTree, resolveColor, type CodeNode } from './compute';
import type { Code } from './types';

type Props = {
  codes: Code[];
  selectedIds: Set<string>;
  onToggle: (codeId: string) => void;
  searchPlaceholder?: string;
  // Optional layout knobs.
  maxHeight?: string;
  className?: string;
};

// Shared picker for the codebook tree. Used by:
//   - Explore filter "Codes" popover
//   - Theme detail "Auto-include codes" picker
// Renders the same hierarchical order as the codebook (sorted by `order` then
// `created_at`), with collapse arrows on parents and an Expand/Collapse-all
// toolbar. A search input flattens the result while typing.
export default function HierarchicalCodePicker({
  codes,
  selectedIds,
  onToggle,
  searchPlaceholder = 'Search codes…',
  maxHeight = '320px',
  className = '',
}: Props) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const tree = useMemo(() => buildCodeTree(codes), [codes]);
  const flatDfs = useMemo(() => flattenTree(tree), [tree]);
  const parentIds = useMemo(() => {
    // A code is a parent in the tree if anything has it in parentIds.
    const out = new Set<string>();
    for (const c of codes) {
      for (const pid of c.parentIds) out.add(pid);
    }
    return out;
  }, [codes]);

  const q = query.trim().toLowerCase();
  const isSearching = q.length > 0;

  const collapseAll = () => setCollapsed(new Set(parentIds));
  const expandAll = () => setCollapsed(new Set());
  const anyCollapsed = collapsed.size > 0;

  // Visible rows. When searching, dedupe by code id and filter by name match
  // — flat alphabetical order, no indentation, no collapse semantics.
  // Otherwise, walk the tree honoring `collapsed`.
  const rows = useMemo(() => {
    if (isSearching) {
      const seen = new Set<string>();
      return flatDfs
        .filter((n) => {
          if (seen.has(n.code.id)) return false;
          seen.add(n.code.id);
          return n.code.name.toLowerCase().includes(q);
        })
        .sort((a, b) =>
          a.code.name.localeCompare(b.code.name, undefined, { sensitivity: 'base' }),
        )
        .map((n) => ({ node: n, depth: 0, hasHiddenChildren: false }));
    }
    const out: { node: CodeNode; depth: number; hasHiddenChildren: boolean }[] = [];
    const walk = (nodes: CodeNode[], depth: number) => {
      for (const n of nodes) {
        const hidden = collapsed.has(n.code.id) && n.children.length > 0;
        out.push({ node: n, depth, hasHiddenChildren: hidden });
        if (!collapsed.has(n.code.id)) {
          walk(n.children, depth + 1);
        }
      }
    };
    walk(tree, 0);
    return out;
  }, [tree, collapsed, isSearching, flatDfs, q]);

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 bg-slate-50">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="flex-1 min-w-0 px-2 py-1 text-[12px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
        />
        {parentIds.size > 0 && !isSearching && (
          <button
            type="button"
            onClick={anyCollapsed ? expandAll : collapseAll}
            className="px-2 py-1 text-[11px] font-semibold rounded border border-slate-300 text-slate-600 hover:bg-white"
            title={anyCollapsed ? 'expand every parent' : 'collapse every parent'}
          >
            {anyCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        )}
      </div>
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-[12px] text-slate-400 italic text-center">
            No matching codes.
          </div>
        ) : (
          rows.map(({ node, depth, hasHiddenChildren }) => {
            const checked = selectedIds.has(node.code.id);
            const color = resolveColor(codes, node.code.id);
            const isParent = node.children.length > 0;
            return (
              <div
                key={node.pathKey}
                className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer ${
                  checked ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                }`}
                style={{ paddingLeft: `${8 + depth * 12}px` }}
                onClick={() => onToggle(node.code.id)}
              >
                {isParent && !isSearching ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsed((s) => {
                        const n = new Set(s);
                        if (n.has(node.code.id)) n.delete(node.code.id);
                        else n.add(node.code.id);
                        return n;
                      });
                    }}
                    className="w-3 text-[10px] text-slate-400 hover:text-slate-700"
                  >
                    {collapsed.has(node.code.id) ? '▸' : '▾'}
                  </button>
                ) : (
                  <span className="w-3" />
                )}
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(node.code.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-blue-600 flex-shrink-0"
                />
                <span
                  className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/5 flex-shrink-0"
                  style={{ background: color }}
                />
                <span className="text-[13px] text-slate-800 leading-snug break-words flex-1 min-w-0">
                  {node.code.name}
                </span>
                {hasHiddenChildren && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {node.children.length}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
