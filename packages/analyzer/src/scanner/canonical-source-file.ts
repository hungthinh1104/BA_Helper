import { readFileSync } from 'node:fs';
import type { Project, SourceFile } from 'ts-morph';

/** Parse scanned files from a shared LF representation so persisted and transient offsets agree. */
export function addCanonicalSourceFile(project: Project, filePath: string): SourceFile {
  const sourceText = readFileSync(filePath, 'utf8').replace(/\r\n?/g, '\n');
  return project.createSourceFile(filePath, sourceText, { overwrite: true });
}
