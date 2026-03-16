# Clinic Management Squad — Private Beta

> A BuildPact Squad for Brazilian clinic operations management — Private, Beta release.
> **Internal use only.** For authorized clinic management teams.

## Agents

| Agent | Tier | Role |
|-------|------|------|
| **Operations Manager** | T1 | Orchestrates clinic workflows, staffing, and quality management |
| **Finance Analyst** | T2 | Revenue cycle, TISS billing, glosa contestation, cash flow |
| **Compliance Checker** | T3 | Validates all outputs against Brazilian healthcare regulations |
| **Patient Flow Optimizer** | T4 | Analyzes and improves patient journey and throughput |

## Regulatory Coverage

This squad enforces compliance with:

| Regulation | Scope |
|------------|-------|
| **Lei 8.080/90** | Organic Health Law — patient rights, SUS obligations |
| **CFM CEM 2019** | Code of Medical Ethics — physician conduct and patient consent |
| **ANS RN 566/2022** | Health plan authorization timelines, glosa contestation |
| **LGPD — Lei 13.709/18** | Patient data protection and processing rights |
| **Estatuto do Idoso — Lei 10.741/03** | Priority scheduling and care for patients 60+ |
| **ANVISA RDC 222/2018** | Healthcare waste management |
| **CFM Res. 1.821/2007** | Medical record retention (20 years minimum) |

## Pipeline Phase Routing

```
specify  →  Operations Manager   (define operational scope and requirements)
plan     →  Operations Manager   (workflow design and resource planning)
execute  →  Patient Flow Optimizer (implement flow changes)
verify   →  Compliance Checker   (regulatory validation gate)
```

## Templates

| Template | Purpose |
|----------|---------|
| `brazil-healthcare-compliance-checklist.md` | Full compliance review checklist |
| `patient-flow-dashboard.md` | Metrics dashboard for flow analysis |

## Getting Started

1. Run `buildpact init` and select **Clinic Management** squad
2. Answer the 4 domain questions in `squad.yaml`
3. Use `buildpact specify` — Operations Manager will guide requirements gathering
4. All outputs pass through the Compliance Checker gate before deployment

## Disclaimer

This squad's outputs are AI-generated and must be reviewed by qualified healthcare professionals before implementation. All regulatory compliance decisions must be verified by legal counsel familiar with Brazilian healthcare law.
