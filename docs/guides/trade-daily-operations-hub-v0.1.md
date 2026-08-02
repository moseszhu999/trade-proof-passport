# Trade Daily Operations Hub v0.1

## Purpose

Turn the Opportunity Radar from a data collector into the first bounded daily workspace.

```text
public opportunity observation
→ select one opportunity
→ create a local follow-up draft
→ review qualification and deadline tasks
→ inspect Agent execution state
→ receive case-linked learning guidance
→ close the day with unresolved work visible
```

This slice adapts the TrainingOS Teacher Operations Hub pattern rather than copying education-domain objects.

## Five fixed regions

1. **Today Market** — current source-linked Opportunity observations.
2. **Current Case** — one holder-controlled local draft created from an Opportunity.
3. **Action Queue** — qualification review and current-case next actions.
4. **Agent Status** — collector completion and human-review waiting state.
5. **Risk and Close** — urgent deadlines, unresolved work and formal Daily Log connection state.

A sixth supporting region, **Learning and Intelligence**, provides clearly labelled Agent guidance and fails closed when formal market-intelligence connectors are absent.

## TrainingOS mechanisms retained

- one daily landing surface;
- canonical-source owner labels;
- explicit ready / empty / stale / unavailable states;
- no missing-data-to-zero inference;
- Agent output remains non-formal;
- external official source remains the evidence link;
- local tools may be used without uploading private data;
- formal actions remain owned by later bounded modules.

## Current real connection

`docs/data/opportunity-radar-latest.json` is a five-notice live TED snapshot produced by the merged Opportunity Radar collector. The browser may also import another compatible collection locally.

## Boundaries

- no account or server persistence;
- no buyer or supplier identity verification;
- no China or foreign supplier eligibility decision;
- no message sending, outreach, RFQ, quotation, contract or transaction execution;
- no payment, settlement, financing, insurance or customs action;
- no synthetic market trend, tariff or regulatory conclusion;
- local Case is a browser-held draft with `formalWritePerformed=false`;
- learning cards are `agent_guidance`, not official notice requirements.

## Next owners

The next independent slices should add, without merging authority:

1. persistent holder-controlled Trade Case;
2. source-linked requirement extraction;
3. email and document intake;
4. supplier discovery and comparison;
5. Market Intelligence connectors;
6. daily log and relationship history;
7. TradeProof claim, evidence and confirmation handoff.
