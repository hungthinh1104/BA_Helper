import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { developerStudyDatasetSchema } from './developer-comprehension/developer-study.schema';

const sourceSha = '78547792178275bb76ba1550c41265f55f79350a';
const materialsDirectory = resolve(__dirname, '../../artifacts/evaluation/edukids-pilot');
const tasksMaterial = JSON.parse(readFileSync(resolve(materialsDirectory, 'change-tasks.json'), 'utf8')) as {
  repository: { repositoryId: string; url: string; commitSha: string; licenseId: string };
  tasks: Array<{
    taskId: string;
    taskFamily: string;
    evaluatedModule: string;
    caseId: string;
    target: { filePath: string; symbol: string };
    participantPrompt: string;
  }>;
  scheduleSlots: Array<{ slot: string; conditionOrder: string[]; tasks: Record<string, string> }>;
};
const labelsMaterial = JSON.parse(readFileSync(resolve(materialsDirectory, 'ground-truth.json'), 'utf8')) as {
  status: string;
  labels: Array<{ labelClass: string; sourceLocations: Array<{ filePath: string; startLine: number; endLine: number }> }>;
  authoring: { predictionsExposedBeforeLabelFreeze: boolean; authoritativeMetrics: Record<string, unknown> };
};

describe('EduKids pilot preparation materials', () => {
  it('keeps source labels pinned, pending review, and separate from analyzer metrics', () => {
    expect(labelsMaterial.status).toBe('PENDING_INDEPENDENT_REVIEW');
    expect(labelsMaterial.labels).toHaveLength(22);
    expect(new Set(labelsMaterial.labels.map((label) => label.labelClass))).toEqual(new Set([
      'POSITIVE', 'NEGATIVE', 'MOCK_BOUND', 'UNRESOLVED', 'UNSUPPORTED',
    ]));
    expect(labelsMaterial.authoring.predictionsExposedBeforeLabelFreeze).toBe(false);
    expect(Object.values(labelsMaterial.authoring.authoritativeMetrics).every((value) => value === null)).toBe(true);
    for (const label of labelsMaterial.labels) {
      expect(label.sourceLocations.length).toBeGreaterThan(0);
      for (const source of label.sourceLocations) {
        expect(source.filePath).not.toContain('..');
        expect(source.startLine).toBeGreaterThan(0);
        expect(source.endLine).toBeGreaterThanOrEqual(source.startLine);
      }
    }
  });

  it('pins all tasks to EduKids and keeps A/B/C schedules balanced and module-distinct', () => {
    expect(tasksMaterial.repository.commitSha).toBe(sourceSha);
    expect(tasksMaterial.tasks).toHaveLength(15);
    expect(tasksMaterial.scheduleSlots).toHaveLength(6);
    const taskById = new Map(tasksMaterial.tasks.map((task) => [task.taskId, task]));
    const conditions = ['A', 'B', 'C'];
    const familiesByCondition = new Map(conditions.map((condition) => [condition, new Set<string>()]));
    const modulesByCondition = new Map(conditions.map((condition) => [condition, new Map<string, number>()]));
    const allOrders = new Set<string>();
    const moduleFamilyPairs = new Set<string>();

    for (const slot of tasksMaterial.scheduleSlots) {
      expect(slot.conditionOrder).toHaveLength(3);
      allOrders.add(slot.conditionOrder.join(''));
      const selected = conditions.map((condition) => {
        const task = taskById.get(slot.tasks[condition]);
        expect(task).toBeDefined();
        return task!;
      });
      expect(new Set(selected.map((task) => task.taskId)).size).toBe(3);
      expect(new Set(selected.map((task) => task.evaluatedModule)).size).toBe(3);
      for (const condition of conditions) {
        const task = taskById.get(slot.tasks[condition])!;
        familiesByCondition.get(condition)!.add(task.taskFamily);
        const modules = modulesByCondition.get(condition)!;
        modules.set(task.evaluatedModule, (modules.get(task.evaluatedModule) ?? 0) + 1);
        moduleFamilyPairs.add(`${task.evaluatedModule}:${task.taskFamily}`);
      }
    }

    expect(allOrders).toEqual(new Set(['ABC', 'BCA', 'CAB', 'CBA', 'BAC', 'ACB']));
    for (const condition of conditions) {
      expect(familiesByCondition.get(condition)).toEqual(new Set([
        'EXPLAIN_BEHAVIOR', 'VERIFY_TEST_EVIDENCE', 'PREDICT_UNSEEN_CASE', 'PREPARE_SAFE_CHANGE', 'VERIFY_CLAIM',
      ]));
      expect([...modulesByCondition.get(condition)!.values()].sort()).toEqual([2, 2, 2]);
    }
    expect(moduleFamilyPairs.size).toBe(15);

    const dataset = developerStudyDatasetSchema.parse({
      schemaVersion: 1,
      studyStatus: 'NOT_STARTED',
      studyStatusNote: null,
      groundTruthReviewStatus: 'PENDING_INDEPENDENT_REVIEW',
      tool: { commitSha: null, appVersion: null },
      repositories: [tasksMaterial.repository],
      tasks: tasksMaterial.tasks.map((task) => ({
        taskId: task.taskId,
        taskFamily: task.taskFamily,
        evaluatedModule: task.evaluatedModule,
        caseId: task.caseId,
        repositoryId: tasksMaterial.repository.repositoryId,
        repositoryCommitSha: sourceSha,
        target: task.target,
        participantPrompt: task.participantPrompt,
      })),
      observations: [],
    });
    expect(dataset.observations).toEqual([]);
  });
});
