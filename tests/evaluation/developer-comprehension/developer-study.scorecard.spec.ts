import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildDeveloperStudyScorecard,
} from './developer-study.scorecard';
import {
  developerStudyDatasetSchema,
  type DeveloperStudyDataset,
  type DeveloperStudyObservation,
  type StudyCondition,
  type StudyTaskFamily,
} from './developer-study.schema';

const template = JSON.parse(readFileSync(
  resolve(__dirname, 'dataset.template.json'),
  'utf8',
)) as DeveloperStudyDataset;
const toolCommitSha = 'b'.repeat(40);

function makeObservation(
  session: string,
  condition: StudyCondition,
  taskFamily: StudyTaskFamily,
  suffix: number,
): DeveloperStudyObservation {
  const task = template.tasks.find((item) => item.taskFamily === taskFamily)!;
  return {
    observationId: session + '-' + condition + '-' + taskFamily + '-' + suffix,
    participantSessionCode: session,
    condition,
    taskId: task.taskId,
    caseId: task.caseId,
    repositoryId: task.repositoryId,
    repositoryCommitSha: task.repositoryCommitSha,
    toolCommitSha,
    selectedMethod: task.target.symbol,
    startedAt: '2026-10-27T10:00:00.000Z',
    endedAt: '2026-10-27T10:01:30.000Z',
    elapsedSeconds: 90,
    completionStatus: 'COMPLETED',
    submittedAnswer: 'Test-only answer fixture with source references.',
    taskCorrect: true,
    correctnessRubric: {
      behaviorAccuracy: 2,
      sourceEvidence: 2,
      testSemantics: 2,
      uncertaintyRecognition: 2,
      changeSafety: 2,
    },
    confidenceRating: 5,
    evidenceIdentifications: [{
      sourceRole: 'PRODUCTION',
      filePath: task.target.filePath,
      startLine: 24,
      endLine: 46,
    }],
    unsupportedClaims: [],
    claimsReviewed: 2,
    incorrectConfidentConclusions: 0,
    navigationActions: 3,
    usefulnessRating: 4,
    voluntaryReuse: true,
  };
}

function completeDataset(): DeveloperStudyDataset {
  const sessions: Array<Array<[StudyCondition, StudyTaskFamily]>> = [
    [['EXISTING_WORKFLOW', 'EXPLAIN_BEHAVIOR'], ['TEXTUAL_EVIDENCE', 'VERIFY_TEST_EVIDENCE'], ['VISUAL_TEST_TRACE', 'PREDICT_UNSEEN_CASE']],
    [['EXISTING_WORKFLOW', 'VERIFY_TEST_EVIDENCE'], ['TEXTUAL_EVIDENCE', 'PREDICT_UNSEEN_CASE'], ['VISUAL_TEST_TRACE', 'PREPARE_SAFE_CHANGE']],
    [['EXISTING_WORKFLOW', 'PREDICT_UNSEEN_CASE'], ['TEXTUAL_EVIDENCE', 'PREPARE_SAFE_CHANGE'], ['VISUAL_TEST_TRACE', 'VERIFY_CLAIM']],
    [['EXISTING_WORKFLOW', 'PREPARE_SAFE_CHANGE'], ['TEXTUAL_EVIDENCE', 'VERIFY_CLAIM'], ['VISUAL_TEST_TRACE', 'EXPLAIN_BEHAVIOR']],
    [['EXISTING_WORKFLOW', 'VERIFY_CLAIM'], ['TEXTUAL_EVIDENCE', 'EXPLAIN_BEHAVIOR'], ['VISUAL_TEST_TRACE', 'VERIFY_TEST_EVIDENCE']],
    [['EXISTING_WORKFLOW', 'EXPLAIN_BEHAVIOR'], ['TEXTUAL_EVIDENCE', 'VERIFY_TEST_EVIDENCE'], ['VISUAL_TEST_TRACE', 'PREDICT_UNSEEN_CASE']],
  ];
  const observations = sessions.flatMap((cells, sessionIndex) => cells.map(([condition, family], cellIndex) =>
    makeObservation('session-' + (sessionIndex + 1), condition, family, cellIndex)));
  return {
    ...template,
    studyStatus: 'COMPLETED',
    groundTruthReviewStatus: 'APPROVED',
    tool: { commitSha: toolCommitSha, appVersion: 'test-only' },
    observations,
  };
}

describe('developer comprehension study scorecard', () => {
  it('keeps an empty template unstarted and reports absent metrics as null', () => {
    const scorecard = buildDeveloperStudyScorecard(template);
    expect(scorecard.studyStatus).toBe('NOT_STARTED');
    expect(scorecard.collectionStatus).toBe('NOT_COLLECTED');
    expect(scorecard.conditions.TEXTUAL_EVIDENCE.taskCorrectRate).toBeNull();
    expect(scorecard.conditions.TEXTUAL_EVIDENCE.unsupportedClaimRate).toBeNull();
    expect(scorecard.conditions.TEXTUAL_EVIDENCE.timeToCorrectAnswerSeconds).toBeNull();
  });

  it('summarizes completed condition/task cells without claiming product value', () => {
    const scorecard = buildDeveloperStudyScorecard(completeDataset());
    expect(scorecard).toMatchObject({
      studyStatus: 'COMPLETED',
      groundTruthReviewStatus: 'APPROVED',
      collectionStatus: 'COLLECTED',
      observationCount: 18,
      caseCount: 3,
      sessionCount: 6,
      conditionTaskCellCount: 15,
      missingConditionTaskCells: [],
    });
    expect(scorecard.conditions.VISUAL_TEST_TRACE).toMatchObject({
      observationCount: 6,
      taskCorrectRate: 1,
      unsupportedClaimRate: 0,
      timeToCorrectAnswerSeconds: 90,
      voluntaryReuseRate: 1,
    });
    expect(scorecard.limitations[0]).toMatch(/do not establish causal product value/);
  });

  it('records abandonment without converting it into an incorrect answer', () => {
    const observation = makeObservation('session-abandoned', 'EXISTING_WORKFLOW', 'EXPLAIN_BEHAVIOR', 1);
    const abandoned: DeveloperStudyObservation = {
      ...observation,
      completionStatus: 'ABANDONED',
      submittedAnswer: null,
      taskCorrect: null,
      correctnessRubric: {
        behaviorAccuracy: null,
        sourceEvidence: null,
        testSemantics: null,
        uncertaintyRecognition: null,
        changeSafety: null,
      },
      confidenceRating: null,
      usefulnessRating: null,
      voluntaryReuse: null,
    };
    const scorecard = buildDeveloperStudyScorecard({
      ...template,
      studyStatus: 'IN_PROGRESS',
      tool: { commitSha: toolCommitSha, appVersion: 'test-only' },
      observations: [abandoned],
    });

    expect(scorecard.collectionStatus).toBe('INCOMPLETE');
    expect(scorecard.conditions.EXISTING_WORKFLOW.abandonedCount).toBe(1);
    expect(scorecard.conditions.EXISTING_WORKFLOW.completionRate).toBe(0);
    expect(scorecard.conditions.EXISTING_WORKFLOW.taskCorrectRate).toBeNull();
  });

  it('rejects unpinned observations, repeated participant tasks, and identity fields', () => {
    const valid = completeDataset();
    const first = valid.observations[0];
    expect(() => developerStudyDatasetSchema.parse({
      ...valid,
      observations: [first, { ...first, observationId: 'same-task', condition: 'VISUAL_TEST_TRACE' }],
    })).toThrow(/same task under multiple conditions/);
    expect(() => developerStudyDatasetSchema.parse({
      ...valid,
      observations: [{ ...first, repositoryCommitSha: 'c'.repeat(40) }],
    })).toThrow(/not pinned to its task repository commit/);
    expect(() => developerStudyDatasetSchema.parse({
      ...valid,
      participantName: 'must-not-be-collected',
    })).toThrow();
  });

  it('does not accept a completed state before human review and minimum coverage', () => {
    expect(() => developerStudyDatasetSchema.parse({
      ...template,
      studyStatus: 'COMPLETED',
      observations: [],
    })).toThrow(/COMPLETED requires approved ground truth/);
  });
});
