import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_REPORT_LOCALE, ReportLabels, ReportLocale } from './report-localization.types';

export { DEFAULT_REPORT_LOCALE, ReportLabels, ReportLocale };

export function normalizeReportLocale(value?: string | null): ReportLocale {
  return value === 'vi' ? 'vi' : DEFAULT_REPORT_LOCALE;
}

const REPORT_LABELS: Record<ReportLocale, ReportLabels> = {
  en: {
    titlePrefix: 'Impact Analysis Report',
    status: 'Status',
    approved: 'Approved',
    requirement: 'Requirement',
    snapshotCommit: 'Snapshot Commit',
    repository: 'Repository',
    targetRef: 'Target Ref',
    generatedAt: 'Generated At',
    provenance: 'Provenance',
    analysisId: 'Analysis ID',
    generatedDocumentId: 'Generated Document ID',
    projectId: 'Project ID',
    repositoryId: 'Repository ID',
    snapshotId: 'Snapshot ID',
    commitSha: 'Commit SHA',
    analyzerVersion: 'Analyzer Version',
    finalizedAt: 'Finalized At',
    scannerCapabilityProfile: 'Scanner Capability Profile',
    scannerDiagnosticsAndRisks: 'Scanner Diagnostics & Risks',
    language: 'Language',
    framework: 'Framework',
    maturityStatus: 'Maturity Status',
    confidenceLevel: 'Confidence Level',
    terminology: 'Domain Terminology',
    impactFlowDiagram: 'Impact Flow Diagram',
    executiveSummary: 'Executive Summary',
    impactedAreas: 'Impacted Areas',
    reviewerNotesOnImpactedAreas: 'Reviewer Notes on Impacted Areas',
    evidenceBackedImpacts: 'Evidence-backed Impacts',
    certainty: 'Certainty',
    reviewerNote: 'Reviewer Note',
    reasoning: 'Reasoning',
    evidence: 'Evidence',
    noEvidenceAttached: '_No evidence attached._',
    acceptanceCriteria: 'Acceptance Criteria',
    notDirectlyEvidenced: '_Not directly evidenced; derived from requirement and should be confirmed._',
    qaScenarios: 'QA Scenarios',
    scenario: 'Scenario',
    precondition: 'Precondition',
    action: 'Action',
    expectedResult: 'Expected Result',
    openQuestions: 'Open Questions / Unknowns',
    question: 'Question',
    whyThisMatters: 'Why this matters',
    derivedFromScannerDiagnostic: '_Derived from scanner diagnostic_',
    clarifications: 'Clarifications',
    answered: 'Answered',
    answer: 'Answer',
    disposition: 'Disposition',
    convertedToRequirementRevision: 'Converted to Requirement Revision',
    stillOpen: 'Still Open',
    dismissed: 'Dismissed',
    dismissedDuringReview: 'Dismissed during review.',
    evidenceAppendix: 'Evidence Appendix',
    secretsRedacted: 'Secrets were redacted before storage, embedding, or LLM processing.',
    file: 'File',
    lines: 'Lines',
    reviewDecisionHistory: 'Review Decision History',
    time: 'Time',
    reviewer: 'Reviewer',
    decision: 'Decision',
    note: 'Note',
    evidenceQuality: 'Evidence Quality & Dataset Readiness',
    evidenceBackedLinks: 'Evidence-backed links',
    inferredLinks: 'Inferred links',
    reviewRequired: 'Review required',
    artifact: 'Artifact',
    quality: 'Quality',
    reason: 'Reason',
    evaluationContext: 'Evaluation Context',
    datasetVersion: 'Dataset Version',
    subsetId: 'Subset ID',
    subsetSize: 'Subset Size',
    illustrativeOnly: 'Illustrative Only',
    interpretation: 'Interpretation',
    researchArtifact: 'Research Artifact',
    comparisonArtifact: 'Comparison Artifact',
    knownLimits: 'Known Limits',
    evidenceQualityNotes: 'Evidence Quality Notes',
    datasetExpansionRecommendations: 'Dataset Expansion Recommendations',
    impactDiffSnapshot: 'Impact Diff Snapshot',
    derivedFromBaseline: 'This analysis was derived from baseline analysis',
    summary: 'Summary',
    addedCodeImpacts: 'Added code impacts',
    removedCodeImpacts: 'Removed code impacts',
    resolvedUnknowns: 'Resolved unknowns',
    newUnknowns: 'New unknowns',
    addedQaScenarios: 'Added QA scenarios',
    area: 'Area',
    reviewStatus: 'Review Status',
    confirmed: 'Confirmed',
    needsReview: 'Needs Review',
    unknown: 'Unknown',
    methodUnknown: 'Method: UNKNOWN',
    rejectedExcluded: 'Rejected insights are excluded from this approved report.',
    unreviewedAcknowledged: 'This report was finalized with unreviewed items acknowledged.',
    diagramTruncated: 'Diagram truncated to the most relevant impacted artifacts. See the Impacted Areas and Evidence Appendix for full details.',
    executiveSummaryLine: (claims, qaScenarios, openQuestions) =>
      `This analysis identified **${claims}** evidence-backed impacts, **${qaScenarios}** QA scenarios, and **${openQuestions}** open questions.`,
    primaryImpactedAreas: (areas) => `The primary impacted areas are **${areas.toLowerCase()}** layers.`,
  },
  vi: {
    titlePrefix: 'Báo cáo phân tích tác động',
    status: 'Trạng thái',
    approved: 'Đã phê duyệt',
    requirement: 'Yêu cầu',
    snapshotCommit: 'Commit snapshot',
    repository: 'Repository',
    targetRef: 'Nhánh đích',
    generatedAt: 'Tạo lúc',
    provenance: 'Truy vết',
    analysisId: 'Analysis ID',
    generatedDocumentId: 'Generated Document ID',
    projectId: 'Project ID',
    repositoryId: 'Repository ID',
    snapshotId: 'Snapshot ID',
    commitSha: 'Commit SHA',
    analyzerVersion: 'Analyzer Version',
    finalizedAt: 'Finalize lúc',
    scannerCapabilityProfile: 'Hồ sơ năng lực scanner',
    scannerDiagnosticsAndRisks: 'Chẩn đoán scanner và rủi ro',
    language: 'Ngôn ngữ',
    framework: 'Framework',
    maturityStatus: 'Mức độ hỗ trợ',
    confidenceLevel: 'Độ tin cậy',
    terminology: 'Thuật ngữ domain',
    impactFlowDiagram: 'Sơ đồ luồng tác động',
    executiveSummary: 'Tóm tắt điều hành',
    impactedAreas: 'Khu vực bị tác động',
    reviewerNotesOnImpactedAreas: 'Ghi chú review về khu vực tác động',
    evidenceBackedImpacts: 'Tác động có bằng chứng',
    certainty: 'Độ chắc chắn',
    reviewerNote: 'Ghi chú reviewer',
    reasoning: 'Lập luận',
    evidence: 'Bằng chứng',
    noEvidenceAttached: '_Chưa gắn bằng chứng._',
    acceptanceCriteria: 'Tiêu chí chấp nhận',
    notDirectlyEvidenced: '_Không có bằng chứng trực tiếp; được suy ra từ yêu cầu và cần xác nhận._',
    qaScenarios: 'Kịch bản QA',
    scenario: 'Kịch bản',
    precondition: 'Điều kiện trước',
    action: 'Hành động',
    expectedResult: 'Kết quả mong đợi',
    openQuestions: 'Câu hỏi mở / điều chưa rõ',
    question: 'Câu hỏi',
    whyThisMatters: 'Vì sao quan trọng',
    derivedFromScannerDiagnostic: '_Được suy ra từ chẩn đoán scanner_',
    clarifications: 'Làm rõ',
    answered: 'Đã trả lời',
    answer: 'Trả lời',
    disposition: 'Xử lý',
    convertedToRequirementRevision: 'Đã chuyển thành Requirement Revision',
    stillOpen: 'Còn mở',
    dismissed: 'Đã bỏ qua',
    dismissedDuringReview: 'Đã bỏ qua trong quá trình review.',
    evidenceAppendix: 'Phụ lục bằng chứng',
    secretsRedacted: 'Secret đã được redact trước khi lưu trữ, embedding, hoặc xử lý LLM.',
    file: 'File',
    lines: 'Dòng',
    reviewDecisionHistory: 'Lịch sử quyết định review',
    time: 'Thời gian',
    reviewer: 'Reviewer',
    decision: 'Quyết định',
    note: 'Ghi chú',
    evidenceQuality: 'Chất lượng bằng chứng và mức sẵn sàng dataset',
    evidenceBackedLinks: 'Link có bằng chứng',
    inferredLinks: 'Link suy luận',
    reviewRequired: 'Cần review',
    artifact: 'Artifact',
    quality: 'Chất lượng',
    reason: 'Lý do',
    evaluationContext: 'Ngữ cảnh đánh giá',
    datasetVersion: 'Phiên bản dataset',
    subsetId: 'Subset ID',
    subsetSize: 'Kích thước subset',
    illustrativeOnly: 'Chỉ để minh họa',
    interpretation: 'Cách diễn giải',
    researchArtifact: 'Artifact nghiên cứu',
    comparisonArtifact: 'Artifact so sánh',
    knownLimits: 'Giới hạn đã biết',
    evidenceQualityNotes: 'Ghi chú chất lượng bằng chứng',
    datasetExpansionRecommendations: 'Khuyến nghị mở rộng dataset',
    impactDiffSnapshot: 'Snapshot diff tác động',
    derivedFromBaseline: 'Analysis này được tạo từ baseline analysis',
    summary: 'Tóm tắt',
    addedCodeImpacts: 'Tác động code mới',
    removedCodeImpacts: 'Tác động code đã gỡ',
    resolvedUnknowns: 'Điều chưa rõ đã được giải quyết',
    newUnknowns: 'Điều chưa rõ mới',
    addedQaScenarios: 'Kịch bản QA mới',
    area: 'Khu vực',
    reviewStatus: 'Trạng thái review',
    confirmed: 'Đã xác nhận',
    needsReview: 'Cần review',
    unknown: 'Không rõ',
    methodUnknown: 'Method: UNKNOWN',
    rejectedExcluded: 'Insight bị reject đã được loại khỏi report đã phê duyệt.',
    unreviewedAcknowledged: 'Report này được finalize với các item chưa review đã được acknowledge.',
    diagramTruncated: 'Sơ đồ đã được rút gọn vào các artifact tác động quan trọng nhất. Xem Khu vực bị tác động và Phụ lục bằng chứng để biết đầy đủ.',
    executiveSummaryLine: (claims, qaScenarios, openQuestions) =>
      `Analysis này xác định **${claims}** tác động có bằng chứng, **${qaScenarios}** kịch bản QA, và **${openQuestions}** câu hỏi mở.`,
    primaryImpactedAreas: (areas) => `Khu vực tác động chính là các layer **${areas.toLowerCase()}**.`,
  },
};

export function getReportLabels(locale: ReportLocale = DEFAULT_REPORT_LOCALE): ReportLabels {
  return REPORT_LABELS[locale] ?? REPORT_LABELS[DEFAULT_REPORT_LOCALE];
}

export function getDomainTerminology(
  domain: string | null | undefined,
  locale: ReportLocale,
): Array<{ key: string; value: string }> {
  const normalizedDomain = domain?.toLowerCase().trim();
  if (!normalizedDomain || !/^[a-z0-9-]+$/.test(normalizedDomain)) {
    return [];
  }

  const glossary = readGlossary(normalizedDomain, locale) ??
    readGlossary(normalizedDomain, DEFAULT_REPORT_LOCALE);

  if (!glossary) {
    return [];
  }

  return Object.entries(glossary.terms).map(([key, value]) => ({ key, value }));
}

function readGlossary(
  domain: string,
  locale: ReportLocale,
): { terms: Record<string, string> } | null {
  const file = resolve(
    process.cwd(),
    'packages/domain-packs',
    domain,
    `${locale}.glossary.json`,
  );

  if (!existsSync(file)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(file, 'utf-8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const terms = (parsed as { terms?: unknown }).terms;
  if (!terms || typeof terms !== 'object' || Array.isArray(terms)) {
    return null;
  }

  return { terms: terms as Record<string, string> };
}
