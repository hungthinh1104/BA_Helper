import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ScanLimitsPolicy } from './limits';

export interface FileDiagnostic {
  code:
    | 'SYMLINK_SKIPPED'
    | 'FILE_TOO_LARGE'
    | 'BINARY_SKIPPED'
    | 'FILE_LIMIT_EXCEEDED'
    | 'TS_FILE_LIMIT_EXCEEDED'
    | 'REPO_LIMIT_EXCEEDED';
  severity: 'INFO' | 'WARN' | 'ERROR' | 'BLOCKER';
  message: string;
  filePath?: string;
}

export interface EnumeratorResult {
  tsFiles: string[];
  javaFiles: string[];
  allFiles: string[];
  diagnostics: FileDiagnostic[];
  isPartial: boolean;
}

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  'vendor',
  'tmp',
]);

const IGNORED_EXTENSIONS = new Set([
  '.min.js',
  '.map',
  '.lock',
  '.zip',
  '.tar',
  '.gz',
  '.7z',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.pdf',
  '.csv', // Often huge
]);

export class SafeFileEnumerator {
  constructor(
    private readonly rootDir: string,
    private readonly limitsPolicy: ScanLimitsPolicy = new ScanLimitsPolicy()
  ) {}

  async enumerate(): Promise<EnumeratorResult> {
    const tsFiles: string[] = [];
    const javaFiles: string[] = [];
    const allFiles: string[] = [];
    const diagnostics: FileDiagnostic[] = [];
    
    let isPartial = false;
    let fileCount = 0;
    let tsFileCount = 0;
    let totalSizeBytes = 0;

    // Resolve real root to prevent symlink traversal escaping root
    const resolvedRoot = await fs.realpath(this.rootDir);

    const queue: string[] = [resolvedRoot];

    while (queue.length > 0) {


      const currentDir = queue.shift()!;
      let entries: Dirent[];
      
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch (err) {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isSymbolicLink()) {
          try {
            const realPath = await fs.realpath(fullPath);
            if (!realPath.startsWith(resolvedRoot)) {
              diagnostics.push({
                code: 'SYMLINK_SKIPPED',
                severity: 'INFO',
                message: 'Skipped symlink pointing outside workspace',
                filePath: fullPath,
              });
              continue;
            }
            // If it's a safe symlink, we can treat it as a normal file/dir
            // But to avoid circular loops and complexity in MVP, we just skip ALL symlinks as requested by the rule:
            // "do not follow symlink outside repo root, skip symlink by default"
          } catch {
            // Broken symlink
          }
          diagnostics.push({
            code: 'SYMLINK_SKIPPED',
            severity: 'INFO',
            message: 'Skipped symlink by default',
            filePath: fullPath,
          });
          continue;
        }

        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name)) {
            queue.push(fullPath);
          }
          continue;
        }

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          
          if (IGNORED_EXTENSIONS.has(ext)) {
             diagnostics.push({
                code: 'BINARY_SKIPPED',
                severity: 'INFO',
                message: 'Skipped binary/archive file',
                filePath: fullPath,
              });
             continue;
          }

          if (entry.name === 'package-lock.json' || entry.name === 'yarn.lock' || entry.name === 'pnpm-lock.yaml') {
            continue;
          }

          try {
            const stat = await fs.stat(fullPath);
            const sizeKb = stat.size / 1024;
            
            if (this.limitsPolicy.isFileSizeExceeded(sizeKb)) {
               diagnostics.push({
                code: 'FILE_TOO_LARGE',
                severity: 'INFO',
                message: `File exceeded max size (${this.limitsPolicy.getLimits().MAX_FILE_SIZE_KB} KB)`,
                filePath: fullPath,
              });
              continue;
            }

            totalSizeBytes += stat.size;
            const totalSizeMb = totalSizeBytes / (1024 * 1024);
            if (this.limitsPolicy.isRepoSizeExceeded(totalSizeMb)) {
              diagnostics.push({
                code: 'REPO_LIMIT_EXCEEDED',
                severity: 'WARN',
                message: `Maximum repository size (${this.limitsPolicy.getLimits().MAX_REPO_SIZE_MB} MB) exceeded.`,
              });
              isPartial = true;
              break;
            }
          } catch {
            continue;
          }

          fileCount++;
          if (this.limitsPolicy.isFileCountExceeded(fileCount)) {
            diagnostics.push({
              code: 'FILE_LIMIT_EXCEEDED',
              severity: 'WARN',
              message: `Maximum file count (${this.limitsPolicy.getLimits().MAX_FILE_COUNT}) exceeded.`,
            });
            isPartial = true;
            break;
          }
          
          allFiles.push(fullPath);

          if (ext === '.ts' || ext === '.tsx') {
            tsFileCount++;
            if (this.limitsPolicy.isTsFileCountExceeded(tsFileCount)) {
              diagnostics.push({
                code: 'TS_FILE_LIMIT_EXCEEDED',
                severity: 'WARN',
                message: `Maximum TS file count (${this.limitsPolicy.getLimits().MAX_TS_FILE_COUNT}) exceeded.`,
              });
              isPartial = true;
              break;
            }
            tsFiles.push(fullPath);
          } else if (ext === '.java') {
            javaFiles.push(fullPath);
          }
        }
      }
      
      if (isPartial) break;
    }

    return {
      tsFiles,
      javaFiles,
      allFiles,
      diagnostics,
      isPartial
    };
  }
}
