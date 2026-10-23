# ClinIQ

*Intelligence that keeps care human.*

ClinIQ helps a patient in BC work out where to go for care, and lets them tell their story once. A patient describes the problem on their phone, gets screened for emergencies, answers a few questions, and is routed to the fastest right place: often a pharmacy, since BC pharmacists can assess and prescribe for 21 common conditions.

This repo is the MVP. **Stage 1 (the patient flow) is built.** Stages 2–4 (clinic view, pharmacy view, prescription check) are not.

## Status

| Stage | What | State |
| --- | --- | --- |
| 1 | Patient flow: 8 screens, 3 conditions (UTI, shingles, headache), 10 locations | Built. Needs real location data and clinician sign-off before a demo |
| 2 | Clinic side: daily confirmation, incoming list, patient summary | Not started. Needs a database and a legal answer on data retention |
| 3 | Pharmacy side: patient list, assessment helper | Not started |
| 4 | Prescription allergy check | Not started |

**Blocking the Stage 1 demo**

- `data/locations.yaml` is empty. It needs ten real Vancouver-area locations, each with a published wait and the time it was read.
- Clinician sign-off on `data/emergency-checklist.yaml` and every rule in `conditions/`.
- Pharmacist-scope text for each condition (currently `PENDING`).
- Open clinical questions marked `REVIEW` in the condition files.

## Run it

Needs Node 20 or later.

```bash
npm install
npm run dev:fixtures   # http://localhost:3100, with invented test locations
```

`dev:fixtures` loads `tests/fixtures/locations.yaml` and shows a yellow "Test location data" banner. Plain `npm run dev` uses the real `data/locations.yaml`, which is empty for now, so every run ends at "nothing open".

The patient view is built for phones. In a desktop browser, use the device toolbar, or open `http://<your-computer's-IP>:3100` on a phone on the same Wi-Fi.

## Test it

```bash
npm test            # unit tests (Vitest): engine, content, flow rules
npm run test:e2e    # end-to-end (Playwright), phone viewport, test locations
npm run typecheck
npm run lint
```

The e2e tests use your installed Google Chrome. To use Playwright's bundled browser instead, run `npx playwright install chromium` and set `PW_BUNDLED=1`.

## Where things live

```
conditions/         one YAML file per condition: questions, routing rules, pharmacist scope
data/               emergency checklist, list of 21 conditions + contraception, location directory
src/content/        schemas and loaders for the YAML (a bad file stops the app)
src/engine/         pure routing logic: emergency, eligibility, rules, routing, ranking,
                    matching, summary, reference codes
src/store/          intake state on the phone and the rules for which screen you may be on
src/app/(patient)/  the 8 patient screens, Call 911, wait times
tests/              engine/ and store/ (Vitest), e2e/ (Playwright), fixtures/
```

To add or change a condition, edit its YAML file; no code changes are needed. The schema checks that every rule points at a real question and option. Every rule needs a test case in `tests/engine/routing.test.ts`, and a coverage test fails if one is missing.

## Rules for contributors

These come from the blueprint and aren't negotiable.

1. **A model may suggest, never decide.** Emergency screening, routing, eligibility and allergy matching are tables and if-statements a clinician can read.
2. **One emergency tick stops everything.** The checklist never gets shorter without written approval from the business team.
3. **Clinical changes need clinician sign-off.** A change to `conditions/` or `data/emergency-checklist.yaml` is a reviewed commit.
4. **No patient information in logs, error reports or analytics.** Log the reference code, never the answers.
5. **No invented numbers.** Waits, locations and regulatory text come from real sources or stay marked pending. Test data lives only in `tests/fixtures/`.
6. **Fail closed.** An answer that doesn't fit the condition file throws instead of routing someone to a pharmacy.
7. **Nothing in patient care depends on ClinIQ being up.** Every clinician screen will show a phone number.

## Docs

- Stage 1 design doc: [ClinIQ Stage 1 Design Doc](https://claude.ai/code/artifact/02160753-71b8-4f69-a22a-1614999ed654). Private; ask the project owner for access.
- The MVP Blueprint and Appendix (PDFs) are the source of truth for clinical rules and scope.
