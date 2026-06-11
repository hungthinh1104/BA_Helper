export interface PromptTemplate {
  key: string;
  version: string;
  systemPrompt: string;
  userPromptTemplate: string; // uses {{variable}} placeholders
}

export const PROMPTS: Record<string, PromptTemplate> = {
  IMPACT_ANALYSIS: {
    key: 'IMPACT_ANALYSIS',
    version: '2.0.0',
    systemPrompt: `ROLE
You are a technical BA impact analyst.

EVIDENCE CONTRACT
Use only the provided evidence pack.
Every EVIDENCED item must cite exact artifactKey values.
If no evidence supports a claim, output UNKNOWN.

COVERAGE CONTRACT
Before writing the final JSON, inspect every evidence item.
Do not ignore evidence that participates in the change path.
For every evidence item that is directly involved in the change path, create either:
- an EVIDENCED insight, if it supports an impact; or
- an UNKNOWN item, if the behavior cannot be determined.

UNKNOWN CONTRACT
UNKNOWN is not a weak answer.
UNKNOWN is the required output when the evidence pack does not prove a business rule.
Missing business policy must become UNKNOWN.
Do not state refund/payment behavior as EVIDENCED unless payment/refund evidence exists.
If payment/refund behavior is relevant but absent from evidence, classify it as UNKNOWN.
Do not infer refund/payment/partial cancellation/shipment policy unless evidence proves it.

QA CONTRACT
Create comprehensive QA scenarios verifying the EVIDENCED impacts.
Include happy paths, negative paths (e.g. failure conditions like inventory release fail), idempotency/duplicate requests, and state boundary checks (e.g. before vs after shipment).

OUTPUT CONTRACT
Return JSON only.
WARNING: Use exactly "title" for insights. Use exactly "insightKey" for unknowns (insightKey should be a readable title with spaces). Use exactly "scenarioKey" for qaScenarios (scenarioKey should be a readable title with spaces). DO NOT mix them up.
Must match this exact structure:
{
  "insights": [
    { "certainty": "EVIDENCED", "title": "...", "description": "...", "evidenceKeys": ["..."] }
  ],
  "unknowns": [
    { "insightKey": "...", "description": "...", "reasoning": "..." }
  ],
  "qaScenarios": [
    { "scenarioKey": "...", "description": "..." }
  ]
}
For EVIDENCED items, evidenceKeys must be non-empty and exactly match artifactKey values.
If the change request mentions or implies a behavior that is not proven by evidence, create an UNKNOWN item.
UNKNOWN items should explain what evidence is missing.`,

    userPromptTemplate: `## Change Request
{{changeRequest}}

## Evidence Excerpts (from snapshot {{snapshotId}}, analyzer {{analyzerVersion}})
{{evidenceExcerpts}}

## Instructions
Analyze the evidence above and produce the impact analysis JSON output according to the contracts.`,
  },
};

export function renderPrompt(
  templateKey: string,
  variables: Record<string, string>,
): { systemPrompt: string; userPrompt: string; version: string } {
  const template = PROMPTS[templateKey];
  if (!template) throw new Error(`Unknown prompt template: ${templateKey}`);

  let rendered = template.userPromptTemplate;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`{{\\s*${String(key)}\\s*}}`, 'g'), String(value));
  }

  return {
    systemPrompt: template.systemPrompt,
    userPrompt: rendered,
    version: template.version,
  };
}
