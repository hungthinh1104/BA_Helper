export interface ScanLimits {
  /** Maximum total size of all files combined in MB */
  MAX_REPO_SIZE_MB: number;
  
  /** Maximum number of total files to process */
  MAX_FILE_COUNT: number;
  
  /** Maximum number of TypeScript files for the AST parser */
  MAX_TS_FILE_COUNT: number;
  
  /** Maximum size for a single file in KB */
  MAX_FILE_SIZE_KB: number;
  
  /** Maximum timeout for git clone in MS */
  CLONE_TIMEOUT_MS: number;
  
  /** Maximum timeout for static analysis scan in MS */
  SCAN_TIMEOUT_MS: number;
}

export const DEFAULT_SCAN_LIMITS: ScanLimits = {
  MAX_REPO_SIZE_MB: 100, // 100 MB max source code
  MAX_FILE_COUNT: 10000,
  MAX_TS_FILE_COUNT: 2000,
  MAX_FILE_SIZE_KB: 1024, // 1 MB per file
  CLONE_TIMEOUT_MS: 60000, // 1 minute
  SCAN_TIMEOUT_MS: 120000, // 2 minutes
};

export class ScanLimitsPolicy {
  constructor(private readonly limits: ScanLimits = DEFAULT_SCAN_LIMITS) {}

  getLimits(): ScanLimits {
    return this.limits;
  }

  isRepoSizeExceeded(sizeMb: number): boolean {
    return sizeMb > this.limits.MAX_REPO_SIZE_MB;
  }

  isFileCountExceeded(count: number): boolean {
    return count > this.limits.MAX_FILE_COUNT;
  }

  isTsFileCountExceeded(count: number): boolean {
    return count > this.limits.MAX_TS_FILE_COUNT;
  }

  isFileSizeExceeded(sizeKb: number): boolean {
    return sizeKb > this.limits.MAX_FILE_SIZE_KB;
  }
}
