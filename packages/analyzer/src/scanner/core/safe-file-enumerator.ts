import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ScanLimitsPolicy } from './limits';
import type { ScanSkipReason } from '../scanner.types';

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
  goFiles: string[];
  pyFiles: string[];
  csFiles: string[];
  phpFiles: string[];
  rbFiles: string[];
  allFiles: string[];
  diagnostics: FileDiagnostic[];
  isPartial: boolean;
  skippedFiles: Array<{ path: string; reason: ScanSkipReason }>;
  skippedSummary: Record<ScanSkipReason, number>;
  limits: {
    maxFiles: number;
    maxFileBytes: number;
    maxTotalBytes?: number;
  };
  limitHits: {
    fileLimitHit: boolean;
    repoSizeLimitHit: boolean;
  };
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
  'out',
  'target',
  '.idea',
  '.vscode',
  '.mvn',
  '.gradle'
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
  '.csv',
]);

const INITIAL_SKIPPED_SUMMARY: Record<ScanSkipReason, number> = {
  IGNORED_DIRECTORY: 0,
  UNSUPPORTED_EXTENSION: 0,
  GENERATED_FILE: 0,
  VENDOR_FILE: 0,
  BUILD_OUTPUT: 0,
  FILE_TOO_LARGE: 0,
  REPO_FILE_LIMIT_EXCEEDED: 0,
  REPO_SIZE_LIMIT_EXCEEDED: 0,
  SYMLINK_OUTSIDE_ROOT: 0,
  BINARY_FILE: 0,
  READ_ERROR: 0,
  UNSUPPORTED_FRAMEWORK: 0,
  UNSUPPORTED_LANGUAGE: 0,
};

const BINARY_SNIFF_BYTES = 8192;
const BINARY_CONTROL_BYTE_RATIO = 0.3;

export class SafeFileEnumerator {
  private skippedFiles: Array<{ path: string; reason: ScanSkipReason }> = [];
  private skippedSummary: Record<ScanSkipReason, number> = { ...INITIAL_SKIPPED_SUMMARY };

  constructor(
    private readonly rootDir: string,
    private readonly limitsPolicy: ScanLimitsPolicy = new ScanLimitsPolicy()
  ) {}

  private recordSkip(filePath: string, reason: ScanSkipReason) {
    this.skippedSummary[reason]++;
    if (this.skippedFiles.length < 100) {
      // Normalize path separator to '/' to ensure determinism across OSes
      const normalizedPath = filePath.split(path.sep).join('/');
      this.skippedFiles.push({ path: normalizedPath, reason });
    }
  }

  async enumerate(): Promise<EnumeratorResult> {
    const tsFiles: string[] = [];
    const javaFiles: string[] = [];
    const goFiles: string[] = [];
    const pyFiles: string[] = [];
    const csFiles: string[] = [];
    const phpFiles: string[] = [];
    const rbFiles: string[] = [];
    const allFiles: string[] = [];
    const diagnostics: FileDiagnostic[] = [];
    
    let isPartial = false;
    let fileCount = 0;
    let tsFileCount = 0;
    let totalSizeBytes = 0;

    let limitHits = {
      fileLimitHit: false,
      repoSizeLimitHit: false,
    };

    // Resolve real root to prevent symlink traversal escaping root
    const resolvedRoot = await fs.realpath(this.rootDir);

    const queue: string[] = [resolvedRoot];

    while (queue.length > 0) {
      // Sort the queue to ensure deterministic traversal order
      queue.sort();
      const currentDir = queue.shift()!;
      let entries: Dirent[];
      
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
        // Sort entries by name for determinism within directory
        entries.sort((a, b) => a.name.localeCompare(b.name));
      } catch (err) {
        const relativePath = path.relative(resolvedRoot, currentDir) || '.';
        this.recordSkip(relativePath, 'READ_ERROR');
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(resolvedRoot, fullPath);

          if (entry.isSymbolicLink()) {
          try {
            const realPath = await fs.realpath(fullPath);
            if (!realPath.startsWith(resolvedRoot)) {
              diagnostics.push({ code: 'SYMLINK_SKIPPED', severity: 'INFO', message: 'Symlink outside root', filePath: relativePath });
              this.recordSkip(relativePath, 'SYMLINK_OUTSIDE_ROOT');
              continue;
            }
          } catch {
             // Broken symlink
          }
          diagnostics.push({ code: 'SYMLINK_SKIPPED', severity: 'INFO', message: 'Symlink skipped', filePath: relativePath });
          this.recordSkip(relativePath, 'SYMLINK_OUTSIDE_ROOT');
          continue;
        }

        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name)) {
            let reason: ScanSkipReason = 'IGNORED_DIRECTORY';
            if (['node_modules', 'vendor'].includes(entry.name)) reason = 'VENDOR_FILE';
            if (['dist', 'build', 'out', 'target', '.next'].includes(entry.name)) reason = 'BUILD_OUTPUT';
            
            this.recordSkip(relativePath, reason);
            // DO NOT descend into ignored directories
          } else {
            queue.push(fullPath);
          }
          continue;
        }

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          
          if (IGNORED_EXTENSIONS.has(ext)) {
             diagnostics.push({ code: 'BINARY_SKIPPED', severity: 'INFO', message: 'Binary file skipped', filePath: relativePath });
             this.recordSkip(relativePath, 'BINARY_FILE');
             continue;
          }

          if (entry.name === 'package-lock.json' || entry.name === 'yarn.lock' || entry.name === 'pnpm-lock.yaml') {
            this.recordSkip(relativePath, 'VENDOR_FILE');
            continue;
          }

          if (entry.name.includes('.generated.') || entry.name.includes('.gen.')) {
            this.recordSkip(relativePath, 'GENERATED_FILE');
            continue;
          }

          try {
            const stat = await fs.stat(fullPath);
            const sizeKb = stat.size / 1024;
            
            if (this.limitsPolicy.isFileSizeExceeded(sizeKb)) {
              diagnostics.push({ code: 'FILE_TOO_LARGE', severity: 'WARN', message: 'File too large', filePath: relativePath });
              this.recordSkip(relativePath, 'FILE_TOO_LARGE');
              continue;
            }

            if (await this.isBinaryFile(fullPath, stat.size)) {
              diagnostics.push({ code: 'BINARY_SKIPPED', severity: 'INFO', message: 'Binary file skipped', filePath: relativePath });
              this.recordSkip(relativePath, 'BINARY_FILE');
              continue;
            }

            totalSizeBytes += stat.size;
            const totalSizeMb = totalSizeBytes / (1024 * 1024);
            if (this.limitsPolicy.isRepoSizeExceeded(totalSizeMb)) {
              limitHits.repoSizeLimitHit = true;
              isPartial = true;
              diagnostics.push({ code: 'REPO_LIMIT_EXCEEDED', severity: 'ERROR', message: 'Repo size limit exceeded', filePath: relativePath });
              this.recordSkip(relativePath, 'REPO_SIZE_LIMIT_EXCEEDED');
              break;
            }
          } catch {
            this.recordSkip(relativePath, 'READ_ERROR');
            continue;
          }

          fileCount++;
          if (this.limitsPolicy.isFileCountExceeded(fileCount)) {
            limitHits.fileLimitHit = true;
            isPartial = true;
            diagnostics.push({ code: 'FILE_LIMIT_EXCEEDED', severity: 'ERROR', message: 'File count limit exceeded', filePath: relativePath });
            this.recordSkip(relativePath, 'REPO_FILE_LIMIT_EXCEEDED');
            break;
          }
          
          // Normalize paths for files as well
          allFiles.push(fullPath.split(path.sep).join('/'));

          if (ext === '.ts' || ext === '.tsx') {
            tsFileCount++;
            if (this.limitsPolicy.isTsFileCountExceeded(tsFileCount)) {
              limitHits.fileLimitHit = true;
              isPartial = true;
              diagnostics.push({ code: 'TS_FILE_LIMIT_EXCEEDED', severity: 'ERROR', message: 'TS file limit exceeded', filePath: relativePath });
              this.recordSkip(relativePath, 'REPO_FILE_LIMIT_EXCEEDED');
              break;
            }
            tsFiles.push(fullPath.split(path.sep).join('/'));
          } else if (ext === '.java') {
            javaFiles.push(fullPath.split(path.sep).join('/'));
          } else if (ext === '.go') {
            goFiles.push(fullPath.split(path.sep).join('/'));
          } else if (ext === '.py') {
            pyFiles.push(fullPath.split(path.sep).join('/'));
          } else if (ext === '.cs') {
            csFiles.push(fullPath.split(path.sep).join('/'));
          } else if (ext === '.php') {
            phpFiles.push(fullPath.split(path.sep).join('/'));
          } else if (ext === '.rb') {
            rbFiles.push(fullPath.split(path.sep).join('/'));
          }
        }
      }
      
      if (isPartial) break;
    }

    const limits = this.limitsPolicy.getLimits();

    return {
      tsFiles,
      javaFiles,
      goFiles,
      pyFiles,
      csFiles,
      phpFiles,
      rbFiles,
      allFiles,
      diagnostics,
      isPartial,
      skippedFiles: this.skippedFiles,
      skippedSummary: this.skippedSummary,
      limits: {
        maxFiles: limits.MAX_FILE_COUNT,
        maxFileBytes: limits.MAX_FILE_SIZE_KB * 1024,
        maxTotalBytes: limits.MAX_REPO_SIZE_MB * 1024 * 1024,
      },
      limitHits,
    };
  }

  private async isBinaryFile(filePath: string, fileSize: number): Promise<boolean> {
    if (fileSize === 0) return false;

    const handle = await fs.open(filePath, 'r');
    try {
      const length = Math.min(fileSize, BINARY_SNIFF_BYTES);
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, 0);
      return isBinaryBuffer(buffer.subarray(0, bytesRead));
    } finally {
      await handle.close();
    }
  }
}

function isBinaryBuffer(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  if (buffer.includes(0)) return true;

  let controlBytes = 0;
  for (const byte of buffer) {
    const isAllowedWhitespace = byte === 9 || byte === 10 || byte === 12 || byte === 13;
    if (byte < 32 && !isAllowedWhitespace) {
      controlBytes++;
    }
  }

  return controlBytes / buffer.length > BINARY_CONTROL_BYTE_RATIO;
}
