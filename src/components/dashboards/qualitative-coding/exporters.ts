import {
  annText,
  annotationsForDoc,
  buildCodeTree,
  codePathString,
  descendantIds,
  flattenTree,
  meanAccuracyForCode,
} from './compute';
import type { Document, Project, Theme } from './types';

export function exportProjectJSON(project: Project): unknown {
  return {
    ...project,
    exported_at: new Date().toISOString(),
  };
}

export function exportDocumentMarkdown(project: Project, doc: Document): string {
  const anns = annotationsForDoc(project.annotations, doc.id);
  const lines: string[] = [];
  lines.push(`# ${doc.title || 'Untitled document'}`);
  lines.push('');
  if (project.metadataSchema.length > 0) {
    lines.push('## Metadata');
    lines.push('');
    for (const field of project.metadataSchema) {
      const v = doc.metadata[field.key];
      if (v !== undefined && v !== null && v !== '') {
        lines.push(`- **${field.label}**: ${v}`);
      }
    }
    lines.push('');
  }
  lines.push('## Text');
  lines.push('');
  lines.push(doc.text);
  lines.push('');
  if (anns.length > 0) {
    lines.push('## Annotations');
    lines.push('');
    lines.push('| # | Chars | Span | Code | Note |');
    lines.push('| - | ----- | ---- | ---- | ---- |');
    anns.forEach((a, i) => {
      const span = annText(a, doc.text).replace(/\s+/g, ' ').slice(0, 80);
      const path = codePathString(project.codes, a.codeId);
      const note = (a.note ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const chars = a.ranges.map((r) => `${r.start}–${r.end}`).join(', ');
      lines.push(`| ${i + 1} | ${chars} | ${escapePipes(span)} | ${escapePipes(path)} | ${note} |`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

function escapePipes(s: string): string {
  return s.replace(/\|/g, '\\|');
}

export function codebookMarkdown(project: Project): string {
  const lines: string[] = [];
  lines.push(`# Codebook · ${project.name}`);
  lines.push('');
  if (project.description) {
    lines.push(`> ${project.description}`);
    lines.push('');
  }
  lines.push(
    `*Generated ${new Date().toISOString().slice(0, 10)} · ${project.codes.length} code${project.codes.length === 1 ? '' : 's'} · ${project.annotations.length} annotation${project.annotations.length === 1 ? '' : 's'}*`,
  );
  lines.push('');

  if (project.codes.length === 0) {
    lines.push('_No codes defined yet._');
    lines.push('');
    return lines.join('\n');
  }

  const counts = new Map<string, number>();
  for (const a of project.annotations) {
    for (const id of descendantIds(project.codes, a.codeId)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const flat = flattenTree(buildCodeTree(project.codes));

  // Summary table — at-a-glance overview
  lines.push('## At a glance');
  lines.push('');
  lines.push('| Code | Definition | Annotations | Specificity | Mean accuracy |');
  lines.push('| --- | --- | ---: | ---: | ---: |');
  for (const node of flat) {
    const indent = '&nbsp;'.repeat(node.depth * 4);
    const count = counts.get(node.code.id) ?? 0;
    const desc = (node.code.description ?? '')
      .replace(/\n+/g, ' ')
      .replace(/\|/g, '\\|')
      .slice(0, 140);
    const name = `${indent}${node.depth > 0 ? '↳ ' : ''}**${escapePipes(node.code.name)}**`;
    const spec = node.code.specificity ? `${node.code.specificity}/5` : '—';
    const acc = meanAccuracyForCode(project.annotations, node.code.id);
    const accCell = acc ? `${acc.mean.toFixed(1)}/5 (${acc.count})` : '—';
    lines.push(`| ${name} | ${desc || '_—_'} | ${count} | ${spec} | ${accCell} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Full body — one section per code, headers nested by depth
  lines.push('## Definitions');
  lines.push('');
  for (const node of flat) {
    const level = Math.min(node.depth + 3, 6); // H3 for top-level so toc-friendly
    const heading = '#'.repeat(level);
    lines.push(`${heading} ${node.code.name}`);
    lines.push('');
    const path = codePathString(project.codes, node.code.id);
    const metaParts: string[] = [];
    if (node.depth > 0) metaParts.push(`Path: \`${path}\``);
    const cnt = counts.get(node.code.id) ?? 0;
    if (cnt > 0) metaParts.push(`${cnt} annotation${cnt === 1 ? '' : 's'}`);
    if (metaParts.length > 0) {
      lines.push(`*${metaParts.join(' · ')}*`);
      lines.push('');
    }
    if (node.code.description && node.code.description.trim()) {
      lines.push(node.code.description.trim());
      lines.push('');
    }
    // Rubric scores
    const acc = meanAccuracyForCode(project.annotations, node.code.id);
    if (node.code.specificity || acc) {
      const bits: string[] = [];
      if (node.code.specificity) {
        bits.push(`Specificity: **${node.code.specificity}/5**`);
        if (node.code.specificityNotes) bits.push(`(${node.code.specificityNotes})`);
      }
      if (acc) {
        bits.push(`Mean accuracy: **${acc.mean.toFixed(2)}/5** across ${acc.count} rated annotation${acc.count === 1 ? '' : 's'}`);
      }
      lines.push(bits.join(' · '));
      lines.push('');
    }
  }

  return lines.join('\n');
}

// Markdown export of every theme in the project, with full evidence underneath.
// Mirrors the in-app Themes view: name → narrative → 5-axis ratings → evidence
// grouped by code with core/supporting weights.
export function themesMarkdown(project: Project): string {
  const themes = project.themes ?? [];
  const lines: string[] = [];
  lines.push(`# Themes · ${project.name}`);
  lines.push('');
  if (project.description) {
    lines.push(`> ${project.description}`);
    lines.push('');
  }
  lines.push(
    `*Generated ${new Date().toISOString().slice(0, 10)} · ${themes.length} theme${themes.length === 1 ? '' : 's'}*`,
  );
  lines.push('');

  if (themes.length === 0) {
    lines.push('_No themes defined yet._');
    lines.push('');
    return lines.join('\n');
  }

  // Summary table
  lines.push('## At a glance');
  lines.push('');
  lines.push('| Theme | Grounding | Usefulness | Independence | Interp. | Novelty | Evidence |');
  lines.push('| --- | :-: | :-: | :-: | :-: | :-: | ---: |');
  const themeMap = new Map(themes.map((t) => [t.id, t]));
  const depthOf = (t: Theme): number => {
    let d = 0;
    let cur: Theme | undefined = t;
    while (cur?.parentIds[0]) {
      const parent = themeMap.get(cur.parentIds[0]);
      if (!parent) break;
      cur = parent;
      d += 1;
      if (d > 20) break; // cycle guard
    }
    return d;
  };
  for (const t of themes) {
    const indent = '&nbsp;'.repeat(depthOf(t) * 4);
    const r = t.rating ?? {};
    const cell = (n?: number) => (n ? `${n}` : '—');
    const ev = evidenceForTheme(t, project);
    lines.push(
      `| ${indent}${depthOf(t) > 0 ? '↳ ' : ''}**${escapePipes(t.name)}** | ${cell(r.grounding)} | ${cell(r.usefulness)} | ${cell(r.independence)} | ${cell(r.interpretationLevel)} | ${cell(r.novelty)} | ${ev.length} |`,
    );
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // One section per theme
  for (const t of themes) {
    const heading = '#'.repeat(Math.min(depthOf(t) + 2, 6));
    lines.push(`${heading} ${t.name}`);
    lines.push('');

    if (t.parentIds[0]) {
      const parent = themeMap.get(t.parentIds[0]);
      if (parent) lines.push(`*Subtheme of: ${parent.name}*`);
      lines.push('');
    }

    if (t.definition && t.definition.trim()) {
      lines.push('### Definition');
      lines.push('');
      lines.push(t.definition.trim());
      lines.push('');
    }
    if (t.reasoning && t.reasoning.trim()) {
      lines.push('### Reasoning');
      lines.push('');
      lines.push(t.reasoning.trim());
      lines.push('');
    }
    if (t.description && t.description.trim()) {
      lines.push('### Notes');
      lines.push('');
      lines.push(t.description.trim());
      lines.push('');
    }

    if (t.rating) {
      lines.push('### Ratings');
      lines.push('');
      const r = t.rating;
      const rows: [string, number | undefined][] = [
        ['Grounding', r.grounding],
        ['Usefulness', r.usefulness],
        ['Independence', r.independence],
        ['Interpretation level', r.interpretationLevel],
        ['Novelty', r.novelty],
      ];
      for (const [k, v] of rows) {
        if (v) lines.push(`- **${k}**: ${v}/5`);
      }
      if (r.notes && r.notes.trim()) {
        lines.push('');
        lines.push(`> ${r.notes.trim().replace(/\n/g, '\n> ')}`);
      }
      lines.push('');
    }

    if (t.includeCodeIds.length > 0) {
      lines.push('### Auto-included codes');
      lines.push('');
      for (const cid of t.includeCodeIds) {
        lines.push(`- ${codePathString(project.codes, cid)}`);
      }
      lines.push('');
    }

    const ev = evidenceForTheme(t, project);
    if (ev.length > 0) {
      lines.push(`### Evidence (${ev.length})`);
      lines.push('');
      // Group by code path
      const byCode = new Map<string, typeof ev>();
      for (const e of ev) {
        const arr = byCode.get(e.annotation.codeId) ?? [];
        arr.push(e);
        byCode.set(e.annotation.codeId, arr);
      }
      const sortedCodes = [...byCode.keys()].sort((a, b) =>
        codePathString(project.codes, a).localeCompare(codePathString(project.codes, b)),
      );
      for (const cid of sortedCodes) {
        const items = byCode.get(cid)!;
        lines.push(`#### ${codePathString(project.codes, cid)} (${items.length})`);
        lines.push('');
        for (const { annotation: a, weight, source } of items) {
          const doc = project.documents.find((d) => d.id === a.docId);
          const text = annText(a, doc?.text ?? '').replace(/\n+/g, ' ');
          const weightTag = weight === 'core' ? '**Core**' : '_Supporting_';
          const sourceTag = source === 'auto' ? ' · auto-included' : '';
          const docTitle = doc?.title ?? 'unknown doc';
          lines.push(`- ${weightTag}${sourceTag} · ${docTitle}`);
          lines.push(`  > ${text.slice(0, 400)}${text.length > 400 ? '…' : ''}`);
          if (a.note) lines.push(`  > _note: ${a.note.replace(/\n/g, ' ')}_`);
        }
        lines.push('');
      }
    }
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

type ThemeEvidence = {
  annotation: Project['annotations'][number];
  weight: 'core' | 'supporting';
  source: 'direct' | 'auto';
};

function evidenceForTheme(theme: Theme, project: Project): ThemeEvidence[] {
  const out: ThemeEvidence[] = [];
  const seen = new Set<string>();
  const annById = new Map(project.annotations.map((a) => [a.id, a]));
  for (const link of theme.annotationLinks) {
    const a = annById.get(link.annotationId);
    if (!a) continue;
    out.push({ annotation: a, weight: link.weight, source: 'direct' });
    seen.add(a.id);
  }
  if (theme.includeCodeIds.length > 0) {
    const codeIdSet = new Set<string>();
    for (const cid of theme.includeCodeIds) {
      for (const d of descendantIds(project.codes, cid)) codeIdSet.add(d);
    }
    for (const a of project.annotations) {
      if (seen.has(a.id)) continue;
      if (!codeIdSet.has(a.codeId)) continue;
      out.push({ annotation: a, weight: 'supporting', source: 'auto' });
    }
  }
  return out;
}

// Compact JSON of just the themes + their hand ratings + supporting segments —
// the SPUR-ready artifact for embedding / quantitative comparison. Each theme:
// name, definition, reasoning, the three rated axes (+ notes), and every
// supporting span as { text, source, role }, where `source` is the document's
// [D{n}] tag (project.documents order, matching corpus.md). Parent name is
// included so sub-theme structure survives the flattening.
export function exportThemesRatingsJSON(project: Project): unknown {
  const themes = project.themes ?? [];
  const themeName = new Map(themes.map((t) => [t.id, t.name]));
  const docIndex = new Map(project.documents.map((d, i) => [d.id, i]));
  const tag = (docId: string): string => {
    const i = docIndex.get(docId);
    return i === undefined ? '?' : `D${i + 1}`;
  };
  return {
    project: project.name,
    exported_at: new Date().toISOString(),
    themes: themes.map((t) => {
      const supporting: { text: string; source: string; role: 'core' | 'supporting' }[] = [];
      for (const h of t.uncodedHighlights ?? []) {
        const doc = project.documents.find((d) => d.id === h.docId);
        const text = (h.ranges ?? [])
          .map((r) => (doc?.text ?? '').slice(r.start, r.end))
          .join(' … ');
        supporting.push({ text, source: tag(h.docId), role: h.weight });
      }
      for (const e of evidenceForTheme(t, project)) {
        const doc = project.documents.find((d) => d.id === e.annotation.docId);
        supporting.push({
          text: annText(e.annotation, doc?.text ?? ''),
          source: tag(e.annotation.docId),
          role: e.weight,
        });
      }
      // Non-anchored quotes (low-effort imports): no doc span.
      for (const eq of t.extraQuotes ?? []) {
        supporting.push({
          text: eq.text,
          source: eq.source || '?',
          role: eq.role ?? 'supporting',
        });
      }
      const r = t.rating ?? {};
      return {
        name: t.name,
        parent: t.parentIds[0] ? themeName.get(t.parentIds[0]) ?? null : null,
        definition: t.definition ?? null,
        reasoning: t.reasoning ?? null,
        ratings: {
          grounding: r.grounding ?? null,
          usefulness: r.usefulness ?? null,
          independence: r.independence ?? null,
          interpretationLevel: r.interpretationLevel ?? null,
          novelty: r.novelty ?? null,
          notes: r.notes ?? null,
        },
        similar: (t.similarThemeIds ?? [])
          .map((id) => themeName.get(id))
          .filter((n): n is string => !!n),
        supporting,
      };
    }),
  };
}

// Dead-simple corpus export for pasting into an AI prompt's {data} block: each
// document as a short generated identifier ([D1], [D2], …) followed by its
// verbatim text. The identifier — not the title — is the stable key the model
// echoes back as a quote's `source`, so quotes map to a document on reconcile.
// `D` = document (the generic data-model unit, project-type-agnostic). Order
// matches project.documents, so [D{n}] resolves to documents[n-1].
export function exportCorpusForAI(project: Project): string {
  const parts: string[] = [];
  project.documents.forEach((doc, i) => {
    if (i > 0) parts.push('');
    parts.push(`[D${i + 1}]`);
    parts.push(doc.text);
  });
  return parts.join('\n');
}

export function exportProjectMarkdown(project: Project): string {
  const parts: string[] = [];
  parts.push(`# ${project.name}`);
  parts.push('');
  if (project.description) {
    parts.push(project.description);
    parts.push('');
  }
  parts.push(`Exported: ${new Date().toISOString()}`);
  parts.push('');
  parts.push('## Code tree');
  parts.push('');
  for (const c of project.codes) {
    parts.push(`- \`${c.id}\` ${codePathString(project.codes, c.id)}`);
  }
  parts.push('');
  if (project.themes && project.themes.length > 0) {
    parts.push('## Themes');
    parts.push('');
    for (const t of project.themes) {
      const ev = evidenceForTheme(t, project);
      const r = t.rating ?? {};
      const ratingBits: string[] = [];
      if (r.grounding) ratingBits.push(`G:${r.grounding}`);
      if (r.usefulness) ratingBits.push(`U:${r.usefulness}`);
      if (r.independence) ratingBits.push(`I:${r.independence}`);
      if (r.interpretationLevel) ratingBits.push(`Int:${r.interpretationLevel}`);
      if (r.prevalence) ratingBits.push(`P:${r.prevalence}`);
      const ratingStr = ratingBits.length > 0 ? ` · ${ratingBits.join(' ')}` : '';
      parts.push(`- **${t.name}** · ${ev.length} quote${ev.length === 1 ? '' : 's'}${ratingStr}`);
    }
    parts.push('');
  }
  parts.push('---');
  parts.push('');
  for (const doc of project.documents) {
    parts.push(exportDocumentMarkdown(project, doc));
    parts.push('');
    parts.push('---');
    parts.push('');
  }
  return parts.join('\n');
}
