export class SecretRedactor {
  // Common patterns for secrets
  private static readonly PATTERNS = [
    // AWS Access Key ID
    { type: 'AWS_ACCESS_KEY', regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g },
    
    // Generic JWT (very basic heuristic: eyJ...)
    { type: 'JWT', regex: /eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g },

    // Generic Bearer/Token strings
    { type: 'BEARER_TOKEN', regex: /(?:bearer|token)\s+([a-zA-Z0-9_.-]{20,})/gi },

    // GitHub PAT
    { type: 'GITHUB_TOKEN', regex: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}/g },
    
    // Slack Token
    { type: 'SLACK_TOKEN', regex: /xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/g },

    // RSA/EC Private Keys
    { type: 'PRIVATE_KEY', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----\s*(?:[A-Za-z0-9+/=]+\s*)+\s*-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
    
    // Generic URL with embedded credentials
    { type: 'URL_CREDENTIALS', regex: /(?:https?|ftp|postgres|mongodb|mysql):\/\/[^\s:@]+:[^\s:@]+@[^\s/]+/g },

    // .env assignments looking like secrets (heuristic: high entropy looking value assigned to KEY/SECRET/TOKEN/PASSWORD)
    { type: 'ENV_SECRET', regex: /(?:KEY|SECRET|TOKEN|PASSWORD|PASS|CREDENTIALS|API_KEY)[_A-Z0-9]*\s*(?::|=)\s*["']?([A-Za-z0-9_.-]{20,})["']?/gi }
  ];

  static redact(content: string): { redactedContent: string; foundSecrets: boolean } {
    if (!content) return { redactedContent: content, foundSecrets: false };

    let redactedContent = content;
    let foundSecrets = false;

    for (const pattern of this.PATTERNS) {
      const initialContent = redactedContent;
      
      // For patterns with capture groups (like Bearer or Env), we only redact the group
      if (pattern.type === 'BEARER_TOKEN' || pattern.type === 'ENV_SECRET') {
        redactedContent = redactedContent.replace(pattern.regex, (match, p1) => {
          return match.replace(p1, `[REDACTED_SECRET:${pattern.type}]`);
        });
      } else if (pattern.type === 'URL_CREDENTIALS') {
        // Redact just the credentials part: protocol://user:pass@host -> protocol://[REDACTED_SECRET:CREDENTIALS]@host
        redactedContent = redactedContent.replace(/(https?|ftp|postgres|mongodb|mysql):\/\/([^\s:@]+:[^\s:@]+)@/g, `$1://[REDACTED_SECRET:CREDENTIALS]@`);
      } else {
        redactedContent = redactedContent.replace(pattern.regex, `[REDACTED_SECRET:${pattern.type}]`);
      }
      
      if (initialContent !== redactedContent) {
        foundSecrets = true;
      }
    }

    return { redactedContent, foundSecrets };
  }
}
