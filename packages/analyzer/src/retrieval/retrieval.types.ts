import type { ScanArtifact, ScanResult } from '../scanner/scanner.types';
import type { GraphResult } from '../graph/graph.types';

export type RetrievalInput = {
  changeRequest: string;
  scan: ScanResult;
  graph: GraphResult;
  expandGraph?: boolean;
};

export type RetrievalResult = {
  artifacts: ScanArtifact[];
};
