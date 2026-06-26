import type { DomainPack } from '@ba-helper/contracts';

export type DomainPackSelectionInput = {
  manualPackId?: string | null;
  repositoryProfileDomain?: string | null;
};

export type DomainPackSelectionResult = {
  pack: DomainPack;
  normalizedPackId: string;
  selectedBy: 'manual_config' | 'repository_profile' | 'safe_default';
};

export interface DomainPackSelectionPort {
  selectPack(input: DomainPackSelectionInput): DomainPackSelectionResult;
}
