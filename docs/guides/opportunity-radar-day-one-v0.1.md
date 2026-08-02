# TradeProof Opportunity Radar — Day One v0.1

## Purpose

This slice proves the first operating day of the TradeProof market-entry strategy:

```text
official public opportunity source
→ bounded collection
→ canonical Opportunity
→ deterministic digest
→ duplicate rejection
→ daily machine-readable collection
→ human-readable operating report
```

It does not create a marketplace, buyer identity, supplier eligibility decision, buyer endorsement, transaction, payment or verified commercial relationship.

## Active source

Day One activates one green source: the anonymous TED Search API for published EU procurement notices.

```text
POST https://api.ted.europa.eu/v3/notices/search
```

The source registry also records two next connectors without pretending they are implemented:

- EEN public opportunity discovery, as a yellow minimal-discovery source;
- user-authorized mailbox/RFQ intake, as a private holder-controlled source.

## Run with a deterministic fixture

```bash
node tools/collect-ted-opportunities.mjs \
  --fixture examples/opportunity-day-one/ted-response.fixture.json \
  --since 20260801 \
  --observed-at 2026-08-02T11:30:00.000Z \
  --out /tmp/tradeproof-opportunities.json \
  --report /tmp/tradeproof-opportunity-report.md
```

## Run against the live TED API

```bash
node tools/collect-ted-opportunities.mjs \
  --since 20260726 \
  --limit 10 \
  --out /tmp/tradeproof-live-opportunities.json \
  --report /tmp/tradeproof-live-report.md
```

## Operating interpretation

Each result is an observed official procurement notice. The collector intentionally keeps both foreign-supplier and China-supplier eligibility as `unknown`. A later review must inspect the full notice, procurement documents, jurisdiction and participation rules before making an eligibility statement.

The digest proves deterministic identity of the normalized observation. It does not prove:

- the buyer endorses TradeProof;
- the opportunity is commercially suitable for a specific company;
- a foreign or Chinese supplier may participate;
- any supplier has capacity or authority;
- a transaction exists.

## Day-one operator checklist

1. Inspect the generated Markdown report.
2. Open the original TED notice for the most relevant records.
3. Mark records that merit eligibility review; do not infer eligibility from the summary.
4. Record missing fields and parser failures as source-specific exceptions.
5. Add a Connector only after its access, rights, frequency and public-projection rules are registered.
