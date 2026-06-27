import type {
  DomainPack,
  DomainPackSelectedBy,
  ResolvedDomainPackSelection,
} from '@ba-helper/contracts';

export type DomainPackSelectionInput = {
  manualPackId?: string | null;
  repositoryProfileDomain?: string | null;
};

export type DomainPackSelectionResult = {
  pack: DomainPack;
  normalizedPackId: string;
  selectedBy: DomainPackSelectedBy;
  resolved: ResolvedDomainPackSelection;
};

export interface DomainPackSelectionPort {
  selectPack(input: DomainPackSelectionInput): DomainPackSelectionResult;
  selectResolvedPack(selection: ResolvedDomainPackSelection): DomainPackSelectionResult;
}
