const PRIVATE_KEY_PATTERN =
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g;
const CREDENTIAL_URL_PATTERN =
  /((?:https?|ftp|postgres(?:ql)?|mongodb(?:\+srv)?|mysql|mariadb|redis|rediss|amqps?):\/\/)[^\s/@:]*:[^\s/@]+@/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const PROVIDER_TOKEN_PATTERN =
  /\b(?:sk[-_][A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b/g;
const SECRET_ASSIGNMENT_PATTERN =
  /(?<keyQuote>["']?)(?<key>[A-Za-z0-9.-]*(?:API[_-]?KEY|ACCESS[_-]?KEY|AUTHORIZATION|AUTH|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS|PRIVATE[_-]?KEY))\k<keyQuote>(?<separator>\s*[:=]\s*)(?<value>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;]+)/gi;

export const AiPolicy = {
  redactPayload(payload: string): { redactedPayload: string; hasSecrets: boolean } {
    if (!payload) return { redactedPayload: payload, hasSecrets: false };

    let redactedPayload = payload;
    redactedPayload = redactedPayload.replace(PRIVATE_KEY_PATTERN, '[REDACTED]');
    redactedPayload = redactedPayload.replace(CREDENTIAL_URL_PATTERN, '$1[REDACTED]@');
    redactedPayload = redactedPayload.replace(JWT_PATTERN, '[REDACTED]');
    redactedPayload = redactedPayload.replace(BEARER_PATTERN, 'Bearer [REDACTED]');
    redactedPayload = redactedPayload.replace(PROVIDER_TOKEN_PATTERN, '[REDACTED]');
    redactedPayload = redactedPayload.replace(
      SECRET_ASSIGNMENT_PATTERN,
      (_match, keyQuote: string, key: string, separator: string, value: string) => {
        const quote = value.startsWith('"') || value.startsWith("'") ? value[0] : '';
        return `${keyQuote}${key}${keyQuote}${separator}${quote}[REDACTED]${quote}`;
      },
    );

    return { redactedPayload, hasSecrets: redactedPayload !== payload };
  },
};
