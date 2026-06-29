// Worker-local AI config token.
// AiConfig type lives in @ba-helper/shared; this file only defines the DI token.
export type { AiConfig } from '@ba-helper/shared';

export const AI_CONFIG_TOKEN = Symbol('AI_CONFIG');
