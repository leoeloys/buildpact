# Medical Marketing Squad — CFM-Compliant

> **Private — Internal Use Only**
> A BuildPact Squad for Brazilian medical marketing professionals enforcing CFM nº 1.974/2011 and ANVISA RDC nº 96/2008.

## Agents

| Agent | Tier | Role |
|-------|------|------|
| Strategist | T1 | Campaign planning + compliance oversight |
| Copywriter | T2 | CFM-compliant copy + violation detection |
| Designer | T2 | Visual assets + Schema JSON-LD |
| Analytics | T3 | LGPD-compliant tracking + ROI reporting |

## Built-in Templates

- `templates/cfm-checklist.md` — CFM nº 1.974/2011 pre-publication checklist
- `templates/whatsapp-cta.md` — Approved WhatsApp CTA templates
- `templates/schema-jsonld.json` — MedicalOrganization + Physician Schema JSON-LD

## Compliance Gate

The CFM/ANVISA compliance gate runs automatically on all Copywriter output.
Violations are reported with specific rule references (e.g., "CFM 1.974/2011 Art. 7 §1").

## Key Regulations

- **CFM nº 1.974/2011** — Medical advertising standards
- **ANVISA RDC nº 96/2008** — Health product advertising
- **LGPD Lei 13.709/2018** — Brazilian data privacy law

## Usage

```bash
npx buildpact squad validate medical-marketing
```
