import type { ScanArtifact } from '@ba-helper/analyzer';
import { normalizeArtifactKind } from '../../artifact/domain/universal-artifact-kind';
import type { IncrementalScanSummaryPayload, ArtifactReuseSample } from '@ba-helper/contracts';
import type { CodeArtifact } from '@prisma/client';

export class IncrementalScanClassifier {
  static classify(params: {
    currentArtifacts: ScanArtifact[];
    currentAnalyzerVersion: string;
    previousSnapshot: { id: string; analyzerVersion: string } | null;
    previousArtifacts: CodeArtifact[];
  }): IncrementalScanSummaryPayload {
    const { currentArtifacts, currentAnalyzerVersion, previousSnapshot, previousArtifacts } = params;

    let addedArtifactCount = 0;
    let changedArtifactCount = 0;
    let unchangedArtifactCount = 0;
    let removedArtifactCount = 0;
    let hashUnavailableArtifactCount = 0;

    const added: ArtifactReuseSample[] = [];
    const changed: ArtifactReuseSample[] = [];
    const unchanged: ArtifactReuseSample[] = [];
    const removed: ArtifactReuseSample[] = [];
    const hashUnavailable: ArtifactReuseSample[] = [];

    const addSample = (list: ArtifactReuseSample[], artifact: ArtifactReuseSample) => {
      list.push(artifact);
    };

    const mapToSample = (a: ScanArtifact | CodeArtifact, isCurrent: boolean): ArtifactReuseSample => {
      if (isCurrent) {
        const cur = a as ScanArtifact;
        return {
          artifactKey: cur.stableId,
          universalKind: normalizeArtifactKind(cur.type),
          artifactType: cur.type,
          filePath: cur.filePath,
          symbolName: cur.symbolName ?? null,
          name: cur.symbolName ?? null,
          displayName: cur.symbolName ?? null,
        };
      } else {
        const prev = a as CodeArtifact;
        return {
          artifactKey: prev.artifactKey,
          universalKind: prev.universalKind,
          artifactType: prev.artifactType,
          filePath: prev.filePath,
          symbolName: prev.name ?? null,
          name: prev.name ?? null,
          displayName: prev.name ?? null,
        };
      }
    };

    const prevMap = new Map<string, CodeArtifact>();
    for (const p of previousArtifacts) {
      prevMap.set(p.artifactKey, p);
    }

    if (!previousSnapshot) {
      addedArtifactCount = currentArtifacts.length;
      for (const cur of currentArtifacts) {
        addSample(added, mapToSample(cur, true));
      }
      return {
        baseSnapshotId: null,
        addedArtifactCount,
        changedArtifactCount: 0,
        unchangedArtifactCount: 0,
        removedArtifactCount: 0,
        hashUnavailableArtifactCount: 0,
        reuseEligibleArtifactCount: 0,
        reuseEligibleRatio: 0,
        reuseSafety: 'NO_BASELINE',
        warnings: [],
        sampleLimit: 20,
        samples: {
          added: this.sortSamples(added).slice(0, 20),
          changed: [],
          removed: [],
          hashUnavailable: [],
        },
      };
    }

    for (const cur of currentArtifacts) {
      const prev = prevMap.get(cur.stableId);
      
      if (!prev) {
        addedArtifactCount++;
        addSample(added, mapToSample(cur, true));
      } else {
        // Exists in both
        if (prev.contentHash == null || cur.contentHash == null) {
          hashUnavailableArtifactCount++;
          addSample(hashUnavailable, mapToSample(cur, true));
        } else if (prev.contentHash === cur.contentHash) {
          unchangedArtifactCount++;
          addSample(unchanged, mapToSample(cur, true));
        } else {
          changedArtifactCount++;
          addSample(changed, mapToSample(cur, true));
        }
        prevMap.delete(cur.stableId); // mark as seen
      }
    }

    // Any remaining in prevMap are removed
    for (const prev of prevMap.values()) {
      removedArtifactCount++;
      addSample(removed, mapToSample(prev, false));
    }

    const reuseEligibleArtifactCount = unchangedArtifactCount;
    const reuseEligibleRatio = currentArtifacts.length > 0 ? unchangedArtifactCount / currentArtifacts.length : 0;
    
    let reuseSafety: IncrementalScanSummaryPayload['reuseSafety'] = 'SAFE_FOR_FUTURE_REUSE';
    const warnings: string[] = [];

    if (currentAnalyzerVersion !== previousSnapshot.analyzerVersion) {
      reuseSafety = 'VERSION_CHANGED_REVIEW_REQUIRED';
      warnings.push('SCANNER_OR_ANALYZER_VERSION_CHANGED');
    }

    return {
      baseSnapshotId: previousSnapshot.id,
      addedArtifactCount,
      changedArtifactCount,
      unchangedArtifactCount,
      removedArtifactCount,
      hashUnavailableArtifactCount,
      reuseEligibleArtifactCount,
      reuseEligibleRatio,
      reuseSafety,
      warnings,
      sampleLimit: 20,
      samples: {
        added: this.sortSamples(added).slice(0, 20),
        changed: this.sortSamples(changed).slice(0, 20),
        removed: this.sortSamples(removed).slice(0, 20),
        hashUnavailable: this.sortSamples(hashUnavailable).slice(0, 20),
      },
    };
  }

  private static sortSamples(samples: ArtifactReuseSample[]): ArtifactReuseSample[] {
    return samples.sort((a, b) => {
      if (a.universalKind !== b.universalKind) return a.universalKind.localeCompare(b.universalKind);
      if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
      const aName = a.symbolName || a.name || '';
      const bName = b.symbolName || b.name || '';
      if (aName !== bName) return aName.localeCompare(bName);
      return a.artifactKey.localeCompare(b.artifactKey);
    });
  }
}
