import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';

export const RESEARCH_FINDINGS_PATH = 'evaluation/results/v0/analysis/e13-research-findings.v0.json';
export const SAME_SUBSET_COMPARISON_PATH = 'evaluation/results/v0/analysis/same-subset-comparison.v0.json';

export type EvaluationContext = {
  datasetVersion: string;
  subsetId: string;
  subsetSize: string;
  interpretation: 'ILLUSTRATIVE_ONLY';
  knownLimits: string[];
  evidenceQualityNotes: string[];
  datasetExpansionRecommendations: string[];
  researchFindingsArtifact: string;
  sameSubsetComparisonArtifact: string;
};

@Injectable()
export class EvaluationContextAdapter {
  private readonly logger = new Logger(EvaluationContextAdapter.name);

  getEvaluationContext(): EvaluationContext | null {
    try {
      const e13Path = path.resolve(process.cwd(), RESEARCH_FINDINGS_PATH);
      const compPath = path.resolve(process.cwd(), SAME_SUBSET_COMPARISON_PATH);

      if (!existsSync(e13Path) || !existsSync(compPath)) {
        return null; // Graceful degradation
      }

      const e13Raw = readFileSync(e13Path, 'utf8');
      const e13 = JSON.parse(e13Raw);

      const compRaw = readFileSync(compPath, 'utf8');
      const comp = JSON.parse(compRaw);

      // Deep scan for unauthorized claims
      if (this.hasUnauthorizedClaim(e13) || this.hasUnauthorizedClaim(comp)) {
        this.logger.warn('Evaluation artifacts contain unauthorized claims. Failing evaluation context load.');
        return null;
      }

      if (comp.comparisonPolicy?.winnerAllowed === true) {
        this.logger.warn('comparisonPolicy.winnerAllowed is true. Failing evaluation context load.');
        return null;
      }

      return {
        datasetVersion: e13.datasetVersion || 'v0',
        subsetId: e13.subsetId || 'clean-vector-ready-v0',
        subsetSize: `${comp.caseCount}/6`,
        interpretation: 'ILLUSTRATIVE_ONLY',
        knownLimits: e13.knownLimits || [],
        evidenceQualityNotes: e13.evidenceQuality?.methodObservations?.map((m: any) => 
          `Method \`${m.method}\`: rank1HasGroundTruth=${m.rank1HasGroundTruth}, signals=[${(m.traceableSignals || []).join(', ')}]`
        ) || [],
        datasetExpansionRecommendations: e13.datasetExpansionRecommendation || [],
        researchFindingsArtifact: RESEARCH_FINDINGS_PATH,
        sameSubsetComparisonArtifact: SAME_SUBSET_COMPARISON_PATH
      };
    } catch (e) {
      this.logger.error(`Failed to load evaluation context: ${e}`);
      return null;
    }
  }

  private hasUnauthorizedClaim(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    
    const forbiddenKeys = ['winner', 'bestMethod', 'leaderboard', 'superiorityClaim', 'ranking'];
    for (const key of Object.keys(obj)) {
      if (forbiddenKeys.includes(key)) return true;
      if (typeof obj[key] === 'object') {
        if (this.hasUnauthorizedClaim(obj[key])) return true;
      }
    }
    return false;
  }
}
