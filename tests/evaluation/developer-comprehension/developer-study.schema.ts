import { z } from 'zod';

const shaSchema = z.string().regex(/^[a-f0-9]{40}$/i);
const taskFamilySchema = z.enum([
  'EXPLAIN_BEHAVIOR',
  'VERIFY_TEST_EVIDENCE',
  'PREDICT_UNSEEN_CASE',
  'PREPARE_SAFE_CHANGE',
  'VERIFY_CLAIM',
]);
const studyConditionSchema = z.enum([
  'EXISTING_WORKFLOW',
  'TEXTUAL_EVIDENCE',
  'VISUAL_TEST_TRACE',
]);
const studyStatusSchema = z.enum([
  'NOT_STARTED',
  'READY',
  'IN_PROGRESS',
  'INSUFFICIENT_DATA',
  'COMPLETED',
  'BLOCKED',
]);
const sourcePathSchema = z.string().trim().min(1).max(500).refine(
  (path) => !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..'),
  'source paths must be repository-relative',
);
const scoreSchema = z.number().int().min(0).max(2).nullable();

export const studyTaskDefinitionSchema = z.object({
  taskId: z.string().trim().min(1).max(80),
  taskFamily: taskFamilySchema,
  caseId: z.string().trim().min(1).max(80),
  evaluatedModule: z.string().trim().min(1).max(120).optional(),
  repositoryId: z.string().trim().min(1).max(80),
  repositoryCommitSha: shaSchema,
  target: z.object({
    filePath: sourcePathSchema,
    symbol: z.string().trim().min(1).max(200),
  }).strict(),
  participantPrompt: z.string().trim().min(1).max(2_000),
}).strict();

const repositorySchema = z.object({
  repositoryId: z.string().trim().min(1).max(80),
  url: z.string().url().regex(/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/),
  commitSha: shaSchema,
  licenseId: z.string().trim().min(1).max(80),
}).strict();

const evidenceIdentificationSchema = z.object({
  sourceRole: z.enum(['PRODUCTION', 'TEST']),
  filePath: sourcePathSchema,
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
}).strict().superRefine((value, context) => {
  if (value.endLine < value.startLine) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endLine'],
      message: 'endLine must be greater than or equal to startLine',
    });
  }
});

const unsupportedClaimSchema = z.object({
  claim: z.string().trim().min(1).max(1_000),
  reason: z.string().trim().min(1).max(1_000),
  confidenceRating: z.number().int().min(1).max(5).nullable(),
}).strict();

const correctnessRubricSchema = z.object({
  behaviorAccuracy: scoreSchema,
  sourceEvidence: scoreSchema,
  testSemantics: scoreSchema,
  uncertaintyRecognition: scoreSchema,
  changeSafety: scoreSchema,
}).strict();

const studyObservationSchema = z.object({
  observationId: z.string().trim().min(1).max(120),
  participantSessionCode: z.string().regex(/^[A-Za-z0-9._:-]{1,80}$/),
  condition: studyConditionSchema,
  taskId: z.string().trim().min(1).max(80),
  caseId: z.string().trim().min(1).max(80),
  repositoryId: z.string().trim().min(1).max(80),
  repositoryCommitSha: shaSchema,
  toolCommitSha: shaSchema,
  selectedMethod: z.string().trim().min(1).max(300).nullable(),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }),
  elapsedSeconds: z.number().finite().nonnegative(),
  phaseTimes: z.object({
    setupSeconds: z.number().finite().nonnegative(),
    scanSeconds: z.number().finite().nonnegative(),
    investigationSeconds: z.number().finite().nonnegative(),
    verificationSeconds: z.number().finite().nonnegative(),
    reworkSeconds: z.number().finite().nonnegative(),
  }).strict().optional(),
  criticalImpactRecall: z.number().finite().min(0).max(1).nullable().optional(),
  completionStatus: z.enum(['COMPLETED', 'ABANDONED']),
  submittedAnswer: z.string().max(12_000).nullable(),
  taskCorrect: z.boolean().nullable(),
  correctnessRubric: correctnessRubricSchema,
  confidenceRating: z.number().int().min(1).max(5).nullable(),
  evidenceIdentifications: z.array(evidenceIdentificationSchema).max(100),
  unsupportedClaims: z.array(unsupportedClaimSchema).max(50),
  claimsReviewed: z.number().int().nonnegative(),
  incorrectConfidentConclusions: z.number().int().nonnegative(),
  navigationActions: z.number().int().nonnegative(),
  usefulnessRating: z.number().int().min(1).max(5).nullable(),
  voluntaryReuse: z.boolean().nullable(),
}).strict().superRefine((value, context) => {
  if (value.endedAt < value.startedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endedAt'], message: 'endedAt cannot precede startedAt' });
  }
  if (value.incorrectConfidentConclusions > value.claimsReviewed) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['incorrectConfidentConclusions'],
      message: 'incorrectConfidentConclusions cannot exceed claimsReviewed' });
  }
  if (value.unsupportedClaims.length > value.claimsReviewed) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['unsupportedClaims'],
      message: 'unsupportedClaims cannot exceed claimsReviewed' });
  }
  if (value.phaseTimes) {
    const phaseTotal = Object.values(value.phaseTimes).reduce((sum, seconds) => sum + seconds, 0);
    if (phaseTotal > value.elapsedSeconds + 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['phaseTimes'],
        message: 'phase durations cannot exceed total elapsed time by more than one second' });
    }
  }
  const scores = Object.values(value.correctnessRubric);
  if (value.completionStatus === 'COMPLETED') {
    if (!value.submittedAnswer?.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['submittedAnswer'],
        message: 'completed tasks require a submitted answer' });
    }
    if (value.taskCorrect === null || value.confidenceRating === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['taskCorrect'],
        message: 'completed tasks require correctness and confidence ratings' });
    }
    if (scores.every((score) => score === null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['correctnessRubric'],
        message: 'completed tasks require at least one rubric score' });
    }
  } else if (value.taskCorrect !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['taskCorrect'],
      message: 'abandoned tasks must leave taskCorrect null' });
  }
});

const REQUIRED_CONDITIONS: z.infer<typeof studyConditionSchema>[] = [
  'EXISTING_WORKFLOW',
  'TEXTUAL_EVIDENCE',
  'VISUAL_TEST_TRACE',
];
const REQUIRED_TASK_FAMILIES: z.infer<typeof taskFamilySchema>[] = [
  'EXPLAIN_BEHAVIOR',
  'VERIFY_TEST_EVIDENCE',
  'PREDICT_UNSEEN_CASE',
  'PREPARE_SAFE_CHANGE',
  'VERIFY_CLAIM',
];
export const MIN_COMPLETION_SESSIONS = 6;

export const developerStudyDatasetSchema = z.object({
  schemaVersion: z.literal(1),
  studyStatus: studyStatusSchema,
  studyStatusNote: z.string().trim().max(1_000).nullable(),
  groundTruthReviewStatus: z.enum(['PENDING_INDEPENDENT_REVIEW', 'APPROVED']),
  tool: z.object({
    commitSha: shaSchema.nullable(),
    appVersion: z.string().trim().min(1).max(80).nullable(),
  }).strict(),
  repositories: z.array(repositorySchema).min(1).max(20),
  tasks: z.array(studyTaskDefinitionSchema).min(1).max(100),
  observations: z.array(studyObservationSchema).max(2_000).default([]),
}).strict().superRefine((value, context) => {
  const repositoriesById = new Map(value.repositories.map((item) => [item.repositoryId, item]));
  const tasksById = new Map(value.tasks.map((item) => [item.taskId, item]));
  if (repositoriesById.size !== value.repositories.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['repositories'], message: 'repositoryId values must be unique' });
  }
  if (tasksById.size !== value.tasks.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['tasks'], message: 'taskId values must be unique' });
  }

  for (const task of value.tasks) {
    const repository = repositoriesById.get(task.repositoryId);
    if (!repository || repository.commitSha.toLowerCase() !== task.repositoryCommitSha.toLowerCase()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['tasks'],
        message: 'Task ' + task.taskId + ' is not pinned to its declared repository commit.' });
    }
  }

  const observationIds = new Set<string>();
  const participantTasks = new Set<string>();
  const participantModules = new Set<string>();
  for (const observation of value.observations) {
    const task = tasksById.get(observation.taskId);
    const repository = repositoriesById.get(observation.repositoryId);
    if (!task || task.caseId !== observation.caseId || task.repositoryId !== observation.repositoryId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['observations'],
        message: 'Observation ' + observation.observationId + ' does not match its task and case.' });
      continue;
    }
    if (!repository || repository.commitSha.toLowerCase() !== observation.repositoryCommitSha.toLowerCase() ||
        task.repositoryCommitSha.toLowerCase() !== observation.repositoryCommitSha.toLowerCase()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['observations'],
        message: 'Observation ' + observation.observationId + ' is not pinned to its task repository commit.' });
    }
    if (!value.tool.commitSha || value.tool.commitSha.toLowerCase() !== observation.toolCommitSha.toLowerCase()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['observations'],
        message: 'Observation ' + observation.observationId + ' is not pinned to the declared tool commit.' });
    }
    if (observationIds.has(observation.observationId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['observations'], message: 'observationId values must be unique' });
    }
    observationIds.add(observation.observationId);
    const participantTask = observation.participantSessionCode + ':' + observation.taskId;
    if (participantTasks.has(participantTask)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['observations'],
        message: 'A participant cannot receive the same task under multiple conditions.' });
    }
    participantTasks.add(participantTask);
    if (task.evaluatedModule) {
      const participantModule = observation.participantSessionCode + ':' + task.evaluatedModule;
      if (participantModules.has(participantModule)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['observations'],
          message: 'A participant cannot receive the same evaluated module more than once.' });
      }
      participantModules.add(participantModule);
    }
    if (value.groundTruthReviewStatus !== 'APPROVED' && observation.criticalImpactRecall != null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['observations'],
        message: 'critical impact recall requires independently approved ground truth.' });
    }
  }

  const observationsExist = value.observations.length > 0;
  if (value.studyStatus === 'NOT_STARTED' && observationsExist) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['studyStatus'], message: 'NOT_STARTED cannot contain observations' });
  }
  if (value.studyStatus === 'READY' && (observationsExist || value.groundTruthReviewStatus !== 'APPROVED' ||
      !value.tool.commitSha || !value.tool.appVersion)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['studyStatus'],
      message: 'READY requires approved ground truth, a pinned tool build, and no observations yet' });
  }
  if (['IN_PROGRESS', 'INSUFFICIENT_DATA'].includes(value.studyStatus) && !observationsExist) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['studyStatus'],
      message: value.studyStatus + ' requires at least one observation' });
  }
  if (['INSUFFICIENT_DATA', 'BLOCKED'].includes(value.studyStatus) && !value.studyStatusNote?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['studyStatusNote'],
      message: value.studyStatus + ' requires a reason' });
  }
  if (value.studyStatus === 'COMPLETED' && !isCompletionReady(value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['studyStatus'],
      message: 'COMPLETED requires approved ground truth, all condition/task cells, at least three cases, and six sessions' });
  }
});

export type DeveloperStudyDataset = z.infer<typeof developerStudyDatasetSchema>;
export type DeveloperStudyObservation = z.infer<typeof studyObservationSchema>;
export type StudyCondition = z.infer<typeof studyConditionSchema>;
export type StudyTaskFamily = z.infer<typeof taskFamilySchema>;
export type StudyStatus = z.infer<typeof studyStatusSchema>;

export function isCompletionReady(dataset: Pick<DeveloperStudyDataset,
  'observations' | 'tasks' | 'groundTruthReviewStatus'>): boolean {
  if (dataset.groundTruthReviewStatus !== 'APPROVED') return false;
  const taskFamilies = new Set(dataset.tasks.map((task) => task.taskFamily));
  const cells = new Set(dataset.observations.map((item) => {
    const task = dataset.tasks.find((candidate) => candidate.taskId === item.taskId);
    return task ? item.condition + ':' + task.taskFamily : '';
  }));
  const hasEveryCell = REQUIRED_CONDITIONS.every((condition) =>
    REQUIRED_TASK_FAMILIES.every((family) => taskFamilies.has(family) && cells.has(condition + ':' + family)));
  const cases = new Set(dataset.observations.map((item) => item.caseId));
  const sessions = new Set(dataset.observations.map((item) => item.participantSessionCode));
  return hasEveryCell && cases.size >= 3 && sessions.size >= MIN_COMPLETION_SESSIONS;
}

export const studyConditions = REQUIRED_CONDITIONS;
export const studyTaskFamilies = REQUIRED_TASK_FAMILIES;
