# Voice DNA

Voice DNA is Layer 3 of the [6-layer agent anatomy](/en/guide/creating-squads#the-6-layer-agent-anatomy). It defines **how an agent thinks and communicates** -- its personality, values, and behavioral guardrails. Without Voice DNA, agents produce generic, inconsistent output. With it, every response feels authored by a distinct, reliable collaborator.

Voice DNA is **not optional**. Squad validation (`buildpact doctor --smoke`) will reject any agent missing one of the five required sections.

## Why Voice DNA Matters

To see the difference Voice DNA makes, compare two responses to the same prompt.

**Prompt:** "Implement the login endpoint."

**Without Voice DNA (generic agent):**
> Sure! Here's a login endpoint implementation:
>
> ```typescript
> app.post('/login', async (req, res) => {
>   const user = await db.findUser(req.body.email);
>   if (user && bcrypt.compare(req.body.password, user.hash)) {
>     const token = jwt.sign({ id: user.id }, SECRET);
>     res.json({ token });
>   } else {
>     res.status(401).json({ error: 'Invalid credentials' });
>   }
> });
> ```

The generic response jumps straight to implementation. No tests, no error handling pattern, no adherence to project conventions.

**With Voice DNA (Coda, the Software Squad Developer):**
> RED phase first. Writing the failing test:
>
> ```typescript
> test('login returns token for valid credentials', () => {
>   const result = loginHandler({ email: 'a@b.com', password: 'valid' });
>   expect(result.ok).toBe(true);
>   expect(result.value).toHaveProperty('token');
> });
>
> test('login returns CliError for invalid credentials', () => {
>   const result = loginHandler({ email: 'a@b.com', password: 'wrong' });
>   expect(result.ok).toBe(false);
>   expect(result.error.code).toBe('AUTH_INVALID_CREDENTIALS');
> });
> ```
>
> Tests fail. GREEN phase -- minimal implementation using `Result<T, CliError>`:

Coda's Voice DNA enforces test-first development, the `Result<T, CliError>` pattern, and minimal code. The personality anchors (test-first, minimal, explicit) directly shape the output.

## The 5 Required Sections

Every Voice DNA block must contain all five sections in this order:

```markdown
## Voice DNA

### Personality Anchors
### Opinion Stance
### Anti-Patterns
### Never-Do Rules
### Inspirational Anchors
```

### 1. Personality Anchors

Define the agent's core character traits. Each anchor is a single trait with a brief behavioral note explaining how it manifests.

**Software example (Renzo, Architect):**
```markdown
### Personality Anchors
- Simplicity over cleverness -- the best architecture is the one developers
  don't have to think about
- Decision-driven -- every significant choice gets a DECISIONS.md entry
  with rationale
- Dependency-aware -- you map dependencies before writing a single line
```

**Non-software example (Copywriter, Medical Marketing):**
```markdown
### Personality Anchors
- Regulation-fluent -- you cite specific CFM/ANVISA article numbers when
  flagging violations
- Clarity-obsessed -- medical copy must be understood by patients with
  no medical background
- Trust-building -- every headline earns trust through accuracy, not hyperbole
```

**Tips:**
- Write at least 3 anchors
- Avoid vague adjectives ("smart", "helpful") -- describe *how* the trait manifests
- Think: what does this agent do differently from a default LLM?

### 2. Opinion Stance

State what the agent believes **strongly**. These are positions the agent will defend, not just preferences.

**Software example (Sofia, PM):**
```markdown
### Opinion Stance
- You have strong opinions on scope: ruthlessly cut features that don't
  serve the core use case
- You advocate for the user even when it's inconvenient for the team
```

**Non-software example (Copywriter):**
```markdown
### Opinion Stance
- You believe the best medical copy is educational copy -- it attracts the
  right patients organically
- You reject "miracle cure" language as both illegal and counterproductive
```

**Tips:**
- Frame as beliefs, not rules (rules go in Never-Do)
- Make these real opinions that shape decisions
- Useful for breaking ties: "when in doubt, what does this agent prioritize?"

### 3. Anti-Patterns

Define **minimum 5 prohibited/required behavior pairs**. Each pair is one line with a prohibited behavior (marked with `X`) followed by a line with the required behavior (marked with a checkmark).

**Software example (Coda, Developer):**
```markdown
### Anti-Patterns
- X Never mark a task complete without passing tests
- X Never add features not in the story
- X Never use default exports -- named exports only
- checkmark Always use Result<T, CliError> for fallible business logic
- checkmark Always add `.js` extension to ESM imports
- X Never silence TypeScript errors with `any` or `@ts-ignore`
  without a comment explaining why
- checkmark Always write the failing test before writing the implementation
- X Never commit code that fails typecheck or lint
- checkmark Always keep commits atomic -- one logical change per commit
```

**Non-software example (Copywriter):**
```markdown
### Anti-Patterns
- X Never write copy that guarantees a medical result
  (e.g., "cura garantida", "100% eficaz") -- violates CFM 1.974/2011 Art. 7 S1
- X Never use superlatives about physician skill
  (e.g., "melhor medico", "mais experiente") -- violates Art. 6
- X Never include patient testimonials or case study quotes -- violates Art. 7 S3
- checkmark Always flag prohibited phrases with specific CFM/ANVISA rule
  references before delivering copy
- checkmark Always offer a compliant rewrite for every flagged phrase
- X Never write pricing or discount copy -- violates Art. 9
- checkmark Always use "pode ajudar" / "pode contribuir" instead of
  absolute claims
- X Never reference before-and-after transformations for invasive procedures
- checkmark Always include the physician's CFM registration number in ads
  requiring it
```

**Tips:**
- Each prohibited line describes a common failure mode for this role
- Each required line is the concrete behavior that replaces it
- Think of real mistakes in this domain, then invert them
- Minimum 5 pairs is enforced by Squad validation

### 4. Never-Do Rules

List **hard prohibitions** -- behaviors this agent will never perform under any circumstances. These are non-negotiable bright lines, unlike Anti-Patterns which describe tendencies.

**Software example (Coda):**
```markdown
### Never-Do Rules
- Never throw in business logic -- return Result<T, CliError>
- Never import from a module's internal files -- only from index.ts
```

**Non-software example (Copywriter):**
```markdown
### Never-Do Rules
- Never deliver copy without running it through the CFM compliance gate
- Never use ANVISA-prohibited drug claims in any marketing material
```

**Tips:**
- Keep the list short (2-5 rules) -- if everything is a hard rule, nothing is
- Focus on the highest-stakes failure modes for this role
- These are bright lines with no exceptions

### 5. Inspirational Anchors

Name the books, frameworks, principles, or thinkers that shape how this agent approaches its work.

**Software example (Renzo):**
```markdown
### Inspirational Anchors
- Inspired by: Clean Architecture (Martin), A Philosophy of Software Design
  (Ousterhout)
```

**Non-software example (Copywriter):**
```markdown
### Inspirational Anchors
- Inspired by: CFM n. 1.974/2011, ANVISA RDC n. 96/2008, Cleveland Clinic
  health education writing
```

**Tips:**
- Choose sources relevant to the agent's domain
- A brief parenthetical note clarifies which aspect is influential
- These help the agent reason in a consistent "voice" across diverse tasks

## Lexicon and Tone

Personality Anchors and Opinion Stance together define the agent's vocabulary and communication style.

**Renzo (Architect)** speaks in terms of:
- "dependencies", "layer boundaries", "ADRs"
- "proven libraries over new hotness"
- "boring technology that works"

His lexicon comes directly from his anchors (dependency-aware, decision-driven) and stances (proven > novel, hard layer boundaries).

**The Copywriter** speaks in terms of:
- "CFM article numbers", "compliant rewrites", "prohibited phrases"
- "educational copy", "trust through accuracy"

Her lexicon comes from her anchors (regulation-fluent, clarity-obsessed) and stances (educational > promotional, accuracy > hyperbole).

When writing Voice DNA, ask: "What words should this agent use naturally? What jargon is native to their domain?" The Personality Anchors answer this.

## Cadence and Signature Phrases

The Heuristics layer (Layer 4) creates signature behavioral cadence through the **VETO pattern**. A VETO is a hard stop that fires automatically when a condition is met.

**Coda's VETO:**
```markdown
4. If typecheck or lint fails before commit VETO: fix the issue --
   do not use --no-verify
```

**Copywriter's VETO:**
```markdown
4. If the copy contains an absolute medical outcome claim VETO: block delivery
   and flag with rule reference (CFM 1.974/2011 Art. 7 S1)
```

**Sofia's VETO:**
```markdown
4. If the acceptance criteria cannot be verified by a test, VETO: rewrite it
   until it can
```

VETOs create a recognizable cadence: the agent operates fluidly until a hard boundary is hit, then stops decisively. This is a signature behavior that distinguishes well-defined agents from generic ones.

## Anti-Patterns: Before and After

Anti-patterns are the most actionable part of Voice DNA. Here are three real examples showing the bad behavior, the rule that catches it, and the corrected output.

### Example 1: Developer Skipping Tests

**Bad behavior:** Coda receives "implement the user profile endpoint" and immediately writes implementation code.

**Anti-pattern that catches it:**
> X Never mark a task complete without passing tests

**Corrected output:** Coda writes the failing test first (`expect(result.ok).toBe(true)`), then writes the minimal implementation to make it pass, then refactors.

### Example 2: Medical Copywriter Using Superlatives

**Bad behavior:** The Copywriter drafts a headline: "Dr. Silva -- o melhor cardiologista de Sao Paulo."

**Anti-pattern that catches it:**
> X Never use superlatives about physician skill (e.g., "melhor medico", "mais experiente") -- violates Art. 6

**Corrected output:** "Dr. Silva -- cardiologista com foco em arritmias cardiacas, CRM-SP 12345." The Copywriter replaces the prohibited superlative with a factual specialization and mandatory CFM registration number.

### Example 3: PM Accepting Vague Requirements

**Bad behavior:** Sofia accepts a story: "As a user, I want the app to be fast."

**Anti-pattern that catches it:**
> X Never write acceptance criteria that can't be tested

**Corrected output:** Sofia rewrites: "As Lucas (solo dev), I want page load under 2 seconds on 3G so that mobile users don't abandon the flow." The vague "fast" becomes a measurable threshold tied to a user persona.

## Common Mistakes

### Vague Personality Anchors

Bad: "Smart", "Helpful", "Professional"

These are generic traits that any agent could claim. They don't shape behavior.

Good: "Test-first -- failing test before any implementation, always"

This is specific, actionable, and creates a visible difference in output.

### Too Many Never-Do Rules

Bad: 10+ never-do rules covering every possible scenario.

When everything is a hard rule, the agent has no room for judgment. The rules lose their weight.

Good: 2-5 rules covering the highest-stakes failure modes only.

### Missing Anti-Pattern Pairs

Squad validation requires minimum 5 pairs. Each pair needs a prohibited behavior and the required replacement. If you write prohibitions without alternatives, validation will reject the agent.

### Anti-Patterns That Repeat Never-Do Rules

Anti-Patterns and Never-Do Rules serve different purposes:
- **Anti-Patterns** describe behavioral tendencies with concrete alternatives
- **Never-Do Rules** are absolute prohibitions with no exceptions

If an anti-pattern says "Never do X" and a never-do rule also says "Never do X", one of them is redundant. Anti-patterns should be more specific and include the positive replacement behavior.

## Next Steps

- **Creating Squads:** Return to the [Squad Creation Guide](/en/guide/creating-squads) for the full reference
- **Validation:** Run `buildpact doctor --smoke` to verify your agent definitions -- see [`doctor` CLI reference](/en/cli/doctor)
