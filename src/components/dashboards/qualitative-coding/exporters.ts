import {
  annotationsForDoc,
  buildCodeTree,
  codePathString,
  descendantIds,
  flattenTree,
} from './compute';
import type { Document, Project } from './types';

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
      const span = doc.text.slice(a.start, a.end).replace(/\s+/g, ' ').slice(0, 80);
      const path = codePathString(project.codes, a.codeId);
      const note = (a.note ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      lines.push(`| ${i + 1} | ${a.start}–${a.end} | ${escapePipes(span)} | ${escapePipes(path)} | ${note} |`);
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
  lines.push('| Code | Definition | Annotations |');
  lines.push('| --- | --- | ---: |');
  for (const node of flat) {
    const indent = '&nbsp;'.repeat(node.depth * 4);
    const count = counts.get(node.code.id) ?? 0;
    const desc = (node.code.description ?? '')
      .replace(/\n+/g, ' ')
      .replace(/\|/g, '\\|')
      .slice(0, 140);
    const name = `${indent}${node.depth > 0 ? '↳ ' : ''}**${escapePipes(node.code.name)}**`;
    lines.push(`| ${name} | ${desc || '_—_'} | ${count} |`);
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
  }

  return lines.join('\n');
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
