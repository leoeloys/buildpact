# Scientific Research Squad

**Version:** 0.1.0 — Private Beta
**Domain:** research
**Status:** Private, Beta

A pre-built Squad for systematic reviews, empirical research, and scientific manuscript production. Follows PRISMA, CONSORT, STROBE, and EQUATOR Network reporting guidelines.

## Agents

| Agent | Role | Pipeline Phase |
|-------|------|---------------|
| Research Lead | Principal investigator — study design, PICO formulation, protocol | specify, plan |
| Literature Reviewer | Systematic search, PRISMA compliance, evidence synthesis | literature search |
| Data Analyst | Statistical analysis per pre-registered SAP, reproducible outputs | execute |
| Peer Reviewer | Critical appraisal, EQUATOR guideline compliance | verify |
| LaTeX Writer | Publication-ready manuscript formatting | document |

## Built-in Templates

- `templates/prisma-checklist.md` — PRISMA 2020 27-item systematic review checklist
- `templates/statistical-analysis-plan.md` — Pre-registration SAP template (lock before data access)

## Domain-Aware Questions

This squad asks four domain-specific questions during the specify phase:
1. **Research question** — formalized as PICO/PECO
2. **Study design** — RCT, cohort, case-control, systematic review, meta-analysis, etc.
3. **Inclusion/exclusion criteria** — population or literature search criteria
4. **Statistical approach** — pre-registered analysis methods

## Usage

```yaml
# In your .buildpact/config.yaml
active_squad: scientific-research
```
