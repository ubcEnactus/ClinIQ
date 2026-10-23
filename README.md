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
