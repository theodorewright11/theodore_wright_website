import { annotationsForDoc, codePathString } from './compute';
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
