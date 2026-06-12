import { FileDiagnostic } from './safe-file-enumerator';

export interface DiagnosticItem {
  code: string;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'BLOCKER';
  message: string;
  category?: 'SECURITY' | 'LIMIT' | 'FRAMEWORK' | 'FILE_SYSTEM' | 'GIT' | 'SCANNER';
  count?: number;
  samplePaths?: string[];
  payload?: {
    candidateTerms?: string[];
    language?: string;
    framework?: string;
    relativePath?: string;
    unsupportedPattern?: string;
    candidateText?: string;
    evidenceKind?: string;
    [key: string]: unknown;
  };
}

export class DiagnosticCollector {
  private diagnostics = new Map<string, DiagnosticItem>();

  private buildKey(diagnostic: DiagnosticItem): string {
    const payload = diagnostic.payload;
    const candidateTerms = [...(payload?.candidateTerms ?? [])].sort().join(',');
    return [
      diagnostic.code,
      payload?.relativePath ?? '',
      payload?.unsupportedPattern ?? '',
      candidateTerms,
    ].join('::');
  }

  add(diagnostic: DiagnosticItem) {
    const key = this.buildKey(diagnostic);
    const existing = this.diagnostics.get(key);

    if (existing) {
      existing.count = (existing.count || 1) + (diagnostic.count || 1);
      
      if (diagnostic.samplePaths) {
        existing.samplePaths = existing.samplePaths || [];
        for (const p of diagnostic.samplePaths) {
          if (existing.samplePaths.length < 5 && !existing.samplePaths.includes(p)) {
            existing.samplePaths.push(p);
          }
        }
      }
    } else {
      this.diagnostics.set(key, { ...diagnostic, count: diagnostic.count || 1 });
    }
  }

  addFromFileDiagnostic(d: FileDiagnostic, relativePath?: string) {
    let category: DiagnosticItem['category'] = 'FILE_SYSTEM';
    if (
      d.code === 'FILE_LIMIT_EXCEEDED' ||
      d.code === 'TS_FILE_LIMIT_EXCEEDED' ||
      d.code === 'FILE_TOO_LARGE' ||
      d.code === 'REPO_LIMIT_EXCEEDED'
    ) {
      category = 'LIMIT';
    } else if (d.code === 'SYMLINK_SKIPPED') {
      category = 'SECURITY';
    }

    this.add({
      code: d.code,
      severity: d.severity,
      message: d.message,
      category,
      samplePaths: relativePath ? [relativePath] : undefined,
    });
  }

  addSecretRedacted(relativePath: string) {
    this.add({
      code: 'SECRET_REDACTED',
      severity: 'WARN',
      message: 'Secrets were redacted before persistence.',
      category: 'SECURITY',
      samplePaths: [relativePath]
    });
  }

  getItems(): DiagnosticItem[] {
    return Array.from(this.diagnostics.values());
  }
}
