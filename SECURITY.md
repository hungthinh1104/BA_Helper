# Security Policy

## Supported Status
This project is currently in **Public Beta / Experimental**. 
While we take security seriously, please note that we do not have a formal security certification yet. 

## Current Limitations
- Production SaaS concerns such as GitHub App auth, billing, and hosted multi-tenant deployment are not complete.
- We rely on deterministic limits (bounded diagnostics, explicitly skipped large files) rather than formalized sandboxing for repo ingestion.

## Reporting a Vulnerability

If you discover a security vulnerability, please open an Issue or a GitHub Discussion.

**CRITICAL RULE:** Do NOT post any secrets, real API keys, private database URLs, or proprietary source code in your reports.

We ask that you wait until our multi-tenant SaaS features are complete before using this tool to analyze highly sensitive, un-sanitized repositories without self-hosting in an isolated environment.
