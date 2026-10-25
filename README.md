# ClinIQ

*Intelligence that keeps care human.*

ClinIQ helps a patient in BC work out where to go for care, and lets them tell their story once. A patient describes the problem on their phone, gets screened for emergencies, answers a few questions, and is routed to the fastest right place: often a pharmacy, since BC pharmacists can assess and prescribe for 21 common conditions. If the patient agrees, their answers reach that clinic or pharmacy before they walk in.

**Live demo:** https://cliniq-gules.vercel.app

| View | Link | Who it's for |
| --- | --- | --- |
| Patient | [/](https://cliniq-gules.vercel.app) | A patient on their phone |
| Clinic | [/clinic](https://cliniq-gules.vercel.app/clinic) | Front desk and physicians at a walk-in clinic |
| Pharmacy | [/pharmacy](https://cliniq-gules.vercel.app/pharmacy) | A pharmacist running a minor ailment assessment |

## Status

This repo is the MVP. It's a working demo, not yet for real patients.

| Stage | What | State |
| --- | --- | --- |
| 1 | Patient flow: 8 screens, 3 conditions (UTI, shingles, headache), 10 real Vancouver locations | Built and deployed |
| 2 | Clinic view: daily confirmation, incoming patients, code lookup, patient summary | Demo built (same-device handoff, see below) |
| 3 | Pharmacy view: today's patients, $20 assessment counter, assessment helper | Demo built (same-device handoff) |
| 4 | Prescription allergy check | Not started |

**Before real patients use it**

- Clinician sign-off on `data/emergency-checklist.yaml` and every rule in `conditions/`.
- Pharmacist-scope text for each condition (currently `PENDING`, from Schedule A).
- Open clinical questions marked `REVIEW` in the condition files.
- A real handoff between patient and provider, which needs a backend and a legal answer on what we may store and for how long.

## How the demo works

- **Handoff on one device.** When a patient taps **Share** on their last screen, their answers are saved in the browser, and the clinic or pharmacy screen in another tab of the same browser picks them up straight away. Nothing is sent to a server, so a phone and a laptop can't talk to each other yet.
- **Demo providers.** None of the real places are ClinIQ customers, so the app has two fictional ones, **ClinIQ Demo Clinic** and **ClinIQ Demo Pharmacy** (`data/demo-providers.yaml`). They're labelled as fictional wherever they appear. Routine cases go to them because they can receive the patient's answers; urgent cases still go to the fastest place.
- **Real locations.** `data/locations.yaml` holds 2 emergency departments, 2 urgent and primary care centres, 2 walk-ins and 4 pharmacies, captured by hand on 25 Oct 2026. ED and urgent care waits come from [edwaittimes.ca](https://edwaittimes.ca) and go stale within the hour, so refresh them before a demo. Walk-in waits come from [medimap.ca](https://medimap.ca) only when a clinic has posted one recently. Never enter a number you didn't read from the source.
- **To try it:** open the patient view and `/clinic` (or `/pharmacy`) as two tabs in the same browser. Go through to **Share**, and the patient appears on the provider's screen. "Clear demo data" on the provider screen resets it.

## Run it

Needs Node 20 or later.

```bash
npm install
npm run dev            # http://localhost:3000, real Vancouver locations
npm run dev:fixtures   # http://localhost:3100, invented test locations
```

`dev:fixtures` loads `tests/fixtures/locations.yaml` and shows a yellow "Test location data" banner. Every screen shows a "Demo only, not medical advice" banner, and the site asks search engines not to index it.

The patient view is built for phones; in a desktop browser, use the device toolbar. Travel times only appear when the patient shares their location.

## Test it

```bash
npm test            # unit tests (Vitest): engine, content, flow, handoff
npm run test:e2e    # end-to-end (Playwright): patient, clinic and pharmacy flows
npm run typecheck
npm run lint
```

The e2e tests use your installed Google Chrome. To use Playwright's bundled browser instead, run `npx playwright install chromium` and set `PW_BUNDLED=1`.

## Deploy

The demo is hosted on Vercel. To redeploy after a change (for example, refreshed waits):

```bash
npx vercel@65.2.0 deploy --prod
```
