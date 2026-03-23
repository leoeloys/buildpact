# Best Practices — Security Review

## OWASP Top 10 Checklist
- Injection: parameterize all queries, never concatenate user input
- Broken Auth: enforce MFA, session timeout, password complexity
- Sensitive Data: encrypt at rest and in transit, minimize data collection
- XXE: disable external entity processing in XML parsers
- Broken Access Control: check permissions server-side, never client-only
- Security Misconfiguration: remove default credentials, disable debug mode
- XSS: sanitize all output, use Content-Security-Policy headers
- Insecure Deserialization: validate and whitelist deserialized types
- Vulnerable Components: audit dependencies monthly, pin versions
- Insufficient Logging: log auth failures, access denials, input validation failures

## Code Review Security Checklist
- All user input validated and sanitized at the boundary
- No secrets in code, environment variables, or git history
- Authentication and authorization on every protected endpoint
- Error messages don't leak internal details
- Dependencies audited for known vulnerabilities

## Anti-Patterns
- ✘ Never log sensitive data (passwords, tokens, PII)
- ✘ Never use `eval()` or dynamic code execution with user input
- ✘ Never trust client-side validation alone
- ✘ Never store secrets in git — use environment variables or vaults
- ✘ Never disable HTTPS for "convenience"
