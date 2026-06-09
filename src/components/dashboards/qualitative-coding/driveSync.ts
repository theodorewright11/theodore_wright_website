// Per-project sync orchestration. Pushes a project into a Drive folder
// shaped as:
//
//   <root>/<project name>/
//     project.json
//     project.md
//     codebook.md
//     documents/
//       <doc.folder mirrored as nested subfolders>/
//         <doc title>.md

import {
  MIME,
  createFile,
  createFolder,
  deleteFile,
  findOrCreateFolder,
  getFileContent,
  listChildren,
  moveFile,
  renameFile,
  slugFile,
  updateFile,
  type DriveItem,
} from './drive';
import {
  codebookMarkdown,
  exportDocumentMarkdown,
  exportProjectJSON,
  exportProjectMarkdown,
  themesMarkdown,
} from './exporters';
import type { Document, DriveLink, Project } from './types';

// ---------------------------------------------------------------------------
// Sync — pushes a project to Drive. Idempotent: safe to call repeatedly.
// Returns the updated DriveLink (caller writes back into project state).
// ---------------------------------------------------------------------------

export async function syncProjectToDrive(
  token: string,
  project: Project,
  rootFolderId: string | undefined,
): Promise<DriveLink> {
  const folderCache = new Map<string, string>();

  // 1. Ensure project folder exists. Migration path: if drive.folderId is
  //    missing but a legacy drive.projectJsonId-or-fileId points to a flat
  //    file in rootFolderId, create the new folder and move the file in.
  let folderId = project.drive?.folderId;
  const legacyFileId =
    !folderId && (project.drive as any)?.fileId
      ? (project.drive as any).fileId
      : project.drive?.projectJsonId;

  if (!folderId) {
    folderId = await findOrCreateFolder(token, project.name, rootFolderId, folderCache);
    if (legacyFileId) {
      // Move legacy flat file into the new folder, rename to project.json.
      try {
        await renameFile(token, legacyFileId, 'project.json');
        await moveFile(token, legacyFileId, folderId);
      } catch {
        // If the move fails, just continue — we'll write a fresh project.json below.
      }
    }
  } else {
    // Folder exists. Best-effort: ensure folder name matches project name.
    await renameFile(token, folderId, project.name).catch(() => {});
  }

  // 2. Find existing project.json (if any) inside the folder.
  const folderListing = await listChildren(token, folderId);
  const existingJson = folderListing.find(
    (f) => f.mimeType !== MIME.folder && f.name === 'project.json',
  );
  const existingProjectMd = folderListing.find(
    (f) => f.mimeType !== MIME.folder && f.name === 'project.md',
  );
  const existingCodebookMd = folderListing.find(
    (f) => f.mimeType !== MIME.folder && f.name === 'codebook.md',
  );
  const existingThemesMd = folderListing.find(
    (f) => f.mimeType !== MIME.folder && f.name === 'themes.md',
  );
  const existingDocumentsFolder = folderListing.find(
    (f) => f.mimeType === MIME.folder && f.name === 'documents',
  );

  // 3. Write project.json (canonical).
  const projectJsonContent = exportProjectJSON({ ...project, drive: undefined });
  let projectJsonFile: DriveItem;
  if (existingJson) {
    projectJsonFile = await updateFile(token, {
      fileId: existingJson.id,
      content: projectJsonContent,
      mimeType: MIME.json,
      name: 'project.json',
    });
  } else {
    projectJsonFile = await createFile(token, {
      name: 'project.json',
      parentId: folderId,
      mimeType: MIME.json,
      content: projectJsonContent,
      appTagged: true,
    });
  }

  // 4. Write project.md
  const projectMdContent = exportProjectMarkdown(project);
  if (existingProjectMd) {
    await updateFile(token, {
      fileId: existingProjectMd.id,
      content: projectMdContent,
      mimeType: MIME.md,
    });
  } else {
    await createFile(token, {
      name: 'project.md',
      parentId: folderId,
      mimeType: MIME.md,
      content: projectMdContent,
    });
  }

  // 5. Write codebook.md
  const codebookContent = codebookMarkdown(project);
  if (existingCodebookMd) {
    await updateFile(token, {
      fileId: existingCodebookMd.id,
      content: codebookContent,
      mimeType: MIME.md,
    });
  } else {
    await createFile(token, {
      name: 'codebook.md',
      parentId: folderId,
      mimeType: MIME.md,
      content: codebookContent,
    });
  }

  // 5b. Write themes.md (always; harmless when empty).
  const themesContent = themesMarkdown(project);
  if (existingThemesMd) {
    await updateFile(token, {
      fileId: existingThemesMd.id,
      content: themesContent,
      mimeType: MIME.md,
    });
  } else {
    await createFile(token, {
      name: 'themes.md',
      parentId: folderId,
      mimeType: MIME.md,
      content: themesContent,
    });
  }

  // 6. Documents/ subfolder (mirroring doc.folder structure).
  const documentsFolderId =
    existingDocumentsFolder?.id ??
    (await createFolder(token, 'documents', folderId)).id;

  // 6a. Compute the desired files map: relative path → content
  const docFilesDesired = computeDocFileMap(project);

  // 6b. Walk the existing documents/ tree and build a path map
  const existingDocFiles = await collectFilesRecursive(
    token,
    documentsFolderId,
    'documents',
  );

  // 6c. Compute diff: upserts and orphans
  const orphans: DriveItem[] = [];
  const orphanFolders: DriveItem[] = [];
  for (const item of existingDocFiles.files) {
    if (!docFilesDesired.has(item.relPath)) {
      orphans.push(item.item);
    }
  }
  // Collect leaf folders that are empty after we'd write our desired tree
  const desiredFolderPaths = new Set<string>(['documents']);
  for (const relPath of docFilesDesired.keys()) {
    const parts = relPath.split('/');
    for (let i = 1; i < parts.length; i++) {
      desiredFolderPaths.add(parts.slice(0, i).join('/'));
    }
  }
  for (const f of existingDocFiles.folders) {
    if (!desiredFolderPaths.has(f.relPath)) {
      orphanFolders.push(f.item);
    }
  }

  // 6d. Write/update each desired doc file
  // First, build a path-to-folder-id map by ensuring subfolders exist.
  const folderIdByPath = new Map<string, string>();
  folderIdByPath.set('documents', documentsFolderId);
  for (const f of existingDocFiles.folders) {
    folderIdByPath.set(f.relPath, f.item.id);
  }
  // Ensure all needed subfolders exist (in order: deepest last)
  const sortedNeededFolderPaths = [...desiredFolderPaths].sort(
    (a, b) => a.split('/').length - b.split('/').length,
  );
  for (const path of sortedNeededFolderPaths) {
    if (folderIdByPath.has(path)) continue;
    const parts = path.split('/');
    const parentPath = parts.slice(0, -1).join('/');
    const parentId = folderIdByPath.get(parentPath);
    if (!parentId) continue; // shouldn't happen since we sorted by depth
    const made = await createFolder(token, parts[parts.length - 1], parentId);
    folderIdByPath.set(path, made.id);
  }

  // Map existing files by relative path for upsert
  const existingFileByPath = new Map(
    existingDocFiles.files.map((f) => [f.relPath, f.item]),
  );

  for (const [relPath, content] of docFilesDesired.entries()) {
    const parts = relPath.split('/');
    const fileName = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join('/');
    const parentId = folderIdByPath.get(parentPath) ?? documentsFolderId;
    const existing = existingFileByPath.get(relPath);
    if (existing) {
      await updateFile(token, {
        fileId: existing.id,
        content,
        mimeType: MIME.md,
        name: fileName,
      });
    } else {
      await createFile(token, {
        name: fileName,
        parentId,
        mimeType: MIME.md,
        content,
      });
    }
  }

  // 6e. Delete orphans (files first, then folders bottom-up)
  for (const o of orphans) {
    await deleteFile(token, o.id).catch(() => {});
  }
  orphanFolders.sort((a, b) => -a.name.length + b.name.length); // arbitrary; we deleted files already
  // We need to delete deepest folders first. Re-derive from relPath depth.
  const orphanFoldersByDepth = existingDocFiles.folders
    .filter((f) => !desiredFolderPaths.has(f.relPath))
    .sort((a, b) => b.relPath.split('/').length - a.relPath.split('/').length);
  for (const o of orphanFoldersByDepth) {
    await deleteFile(token, o.item.id).catch(() => {});
  }

  // 7. Return updated DriveLink
  return {
    folderId,
    projectJsonId: projectJsonFile.id,
    modifiedTime: projectJsonFile.modifiedTime,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeDocFileMap(project: Project): Map<string, string> {
  // Returns relative-path (within project folder, e.g. "documents/Round 1/A.md")
  // → markdown content
  const out = new Map<string, string>();
  const usedPaths = new Map<string, number>(); // base path → next suffix
  for (const doc of project.documents) {
    const segments: string[] = ['documents'];
    if (doc.folder) {
      for (const seg of doc.folder.split('/').map((s) => s.trim()).filter(Boolean)) {
        segments.push(slugFile(seg));
      }
    }
    const baseName = slugFile(doc.title || 'Untitled');
    const baseRelPath = [...segments, baseName].join('/') + '.md';
    let relPath = baseRelPath;
    const used = usedPaths.get(baseRelPath);
    if (used !== undefined) {
      const n = used + 1;
      usedPaths.set(baseRelPath, n);
      relPath = baseRelPath.replace(/\.md$/, ` (${n}).md`);
    } else {
      usedPaths.set(baseRelPath, 1);
    }
    out.set(relPath, exportDocumentMarkdown(project, doc));
  }
  return out;
}

async function collectFilesRecursive(
  token: string,
  rootId: string,
  rootRelPath: string,
): Promise<{
  files: { relPath: string; item: DriveItem }[];
  folders: { relPath: string; item: DriveItem }[];
}> {
  const files: { relPath: string; item: DriveItem }[] = [];
  const folders: { relPath: string; item: DriveItem }[] = [];
  const walk = async (folderId: string, relPath: string): Promise<void> => {
    const children = await listChildren(token, folderId);
    for (const c of children) {
      const childRel = `${relPath}/${c.name}`;
      if (c.mimeType === MIME.folder) {
        folders.push({ relPath: childRel, item: c });
        await walk(c.id, childRel);
      } else {
        files.push({ relPath: childRel, item: c });
      }
    }
  };
  await walk(rootId, rootRelPath);
  return { files, folders };
}

// ---------------------------------------------------------------------------
// Pull — fetch a project's canonical state from Drive
// ---------------------------------------------------------------------------

export async function pullProjectFromDrive(
  token: string,
  source: { folderId?: string; projectJsonId?: string; legacyFileId?: string },
): Promise<unknown> {
  if (source.projectJsonId) {
    return await getFileContent(token, source.projectJsonId);
  }
  if (source.legacyFileId) {
    return await getFileContent(token, source.legacyFileId);
  }
  if (source.folderId) {
    const children = await listChildren(token, source.folderId);
    const json = children.find(
      (c) => c.mimeType !== MIME.folder && c.name === 'project.json',
    );
    if (json) return await getFileContent(token, json.id);
  }
  throw new Error('Could not locate a project.json to pull.');
}

// ---------------------------------------------------------------------------
// Delete — remove a project's entire Drive folder
// ---------------------------------------------------------------------------

export async function deleteProjectFromDrive(
  token: string,
  drive: DriveLink | undefined,
): Promise<void> {
  if (!drive?.folderId) return;
  await deleteFile(token, drive.folderId).catch(() => {});
}
