# Best Practices — Code Review

## Review Priorities (in order)
1. Correctness: Does it do what the spec says?
2. Security: Any injection, auth, or data exposure risk?
3. Maintainability: Will someone understand this in 6 months?
4. Performance: Only if measurably relevant to the use case
5. Style: Least important — automate with linters

## Reviewer Mindset
- Review the change, not the person
- Ask questions before making demands: "Why did you choose X?" not "Change X to Y"
- Approve with comments for minor nits — don't block on style
- Block only for correctness, security, or spec deviation

## What to Check
- Does every new function have a test?
- Are error paths handled (not just happy path)?
- Are there any TODO/FIXME that should be tracked?
- Is the commit message descriptive?
- Does the change match the linked spec/story?

## Anti-Patterns
- ✘ Never approve without reading every changed line
- ✘ Never block on personal style preferences — use linters
- ✘ Never merge with failing CI
- ✘ Never review more than 400 lines at once — request split
