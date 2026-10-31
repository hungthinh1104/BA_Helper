import { AiPolicy } from '@ba-helper/shared';
import type { LlmRequest } from '../domain/llm-provider.interface';

export function redactLlmPrompts(
  request: Pick<LlmRequest, 'systemPrompt' | 'userPrompt'>,
): Pick<LlmRequest, 'systemPrompt' | 'userPrompt'> {
  return {
    systemPrompt: AiPolicy.redactPayload(request.systemPrompt).redactedPayload,
    userPrompt: AiPolicy.redactPayload(request.userPrompt).redactedPayload,
  };
}
