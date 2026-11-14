# CrewSignal Credits and Disclosures

## Team & Challenge

- **Project:** CrewSignal (offline-first spaceflight crew health observation, trend comparison, and controlled reporting prototype)
- **Team:** **POP N' SEB** — Manila, Philippines
- **Event:** 2026 NASA International Space Apps Challenge ([2026 event](https://www.spaceappschallenge.org/2026/), [Manila local event](https://www.spaceappschallenge.org/2026/local-events/manila/))
- **Challenge:** [Health Monitoring Software](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/)
- **Project License:** Apache License, Version 2.0 (`LICENSE`)

CrewSignal is an independent manual-entry prototype using synthetic demonstration datasets (`SIM-01`, `SIM-SCHEDULE`, `SIM-EMPTY`). It is **not** endorsed by NASA, CDC, or NIST, does **not** perform autonomous clinical diagnosis or flight-readiness certification, and does **not** claim compliance with NASA-STD-3001 Volume 2.

---

## Challenge research trace

| Indicator or coverage | In-app screen | Research source | Limitation |
| --- | --- | --- | --- |
| Sleep and mood | Explorer and measurement Help | [Ongoing HRP Research](https://www.nasa.gov/hrp/ongoing-hrp-research/) and [Five Hazards](https://www.nasa.gov/hrp/hazards/) | ARCHeR uses dedicated study tools. CrewSignal records self-reports. |
| Heart rate and blood pressure | Explorer and measurement Help | [Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/) | Mission research gives context for recording method and rest. It cannot interpret a crew member's risk. |
| Blood glucose and body temperature | Explorer and measurement Help | [Five Hazards](https://www.nasa.gov/hrp/hazards/) | A check-in captures a reading and its context. Nutritional status remains unassessed. |
| Musculoskeletal and immune function | Explorer | [CSA space experiments](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp) and [NASA HRP Risks](https://www.nasa.gov/hrp/risks/) | Both areas are unassessed by the six check-in indicators. |
| Radiation | Explorer radiation research card | [CSA radiation monitoring](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp) | Neutron exposure requires a dedicated instrument. Radiation exposure remains unassessed in CrewSignal. |

The four new NASA and Canadian Space Agency entries were checked on 2026-11-14. CrewSignal uses original paraphrases and links for the CSA materials. [Canadian Space Agency terms](https://www.asc-csa.gc.ca/eng/terms.asp).

## Spaceflight, Clinical & Measurement Sources

Each summary in `shared/src/guidance.ts` and `shared/fixtures/evidence-and-help.json` carries its verification date. CrewSignal cites concise attributed summaries rather than republishing full external articles.

1. **Five Hazards of Human Spaceflight**
   - Publisher: NASA Human Research Program (HRP)
   - URL: https://www.nasa.gov/hrp/hazards/
   - Checked: 2026-11-13
   - Use in CrewSignal: High-level spaceflight health risk framing across radiation, isolation and confinement, distance from Earth, gravity fields, and hostile closed environments.

2. **NASA Human Research Roadmap — Risks**
   - Publisher: NASA Human Research Program (HRP)
   - URL: https://humanresearchroadmap.nasa.gov/risks/
   - Checked: 2026-11-13
   - Use in CrewSignal: Documents open spaceflight human-system risks and informs conservative separation between personal logging and unsupported clinical recommendations.

3. **NASA Standard Measures**
   - Publisher: NASA Human Research Program (HRP)
   - URL: https://www.nasa.gov/reference/standard-measures/
   - Checked: 2026-11-13
   - Use in CrewSignal: Core physiological, behavioral, and sleep-wake domain framing so distinct indicators remain contextualized rather than collapsed into an unvalidated composite score.

4. **Risk from Inadequate Sleep and Irregular Schedules**
   - Publisher: NASA Human Research Program (HRP)
   - URL: https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/
   - Source updated: 2025-05-16 · Checked: 2026-11-13
   - Use in CrewSignal: Educational context explaining how irregular schedules, shifting work demands, and disrupted rest environments relate to reduced total sleep and performance risk.

5. **Seven Ways Astronauts Improve Sleep**
   - Publisher: NASA Station Mission Feature
   - URL: https://www.nasa.gov/missions/station/seven-ways-astronauts-improve-sleep-may-help-you-snooze-better-on-earth/
   - Checked: 2026-11-13
   - Use in CrewSignal: Educational context for consistent rest schedules, light/dark cues, quiet rest environments, and noting sleep interruptions (non-prescriptive).

6. **Isolation Standard Measures Manuscript (IAC 2022)**
   - Publisher: NASA Technical Reports Server (NTRS)
   - URL: https://ntrs.nasa.gov/api/citations/20220013722/downloads/IAC_ISM-2022-manuscript-final.pdf
   - Checked: 2026-11-13
   - Use in CrewSignal: Context for analog sleep-diary period logging and honest labeling of CrewSignal's custom single-item mood scale (`crewsignal-mood-v1`) as distinct from validated clinical batteries.

7. **CDC NHANES 2021–2022 Laboratory Procedure Manual — GLU-L-MET-508**
   - Publisher: Centers for Disease Control and Prevention (CDC)
   - URL: https://wwwn.cdc.gov/nchs/data/nhanes/public/2021/labmethods/GLU-L-MET-508.pdf
   - Checked: 2026-11-13
   - Use in CrewSignal: Defines the exact blood glucose unit conversion factor (`mmol/L × 18.02 = mg/dL`, and reciprocal `mg/dL / 18.02`).

8. **NIST SI Units: Temperature**
   - Publisher: National Institute of Standards and Technology (NIST)
   - URL: https://www.nist.gov/pml/owm/si-units-temperature
   - Checked: 2026-11-13
   - Use in CrewSignal: Defines the exact Celsius/Fahrenheit equations (`F = C × 1.8 + 32` and `C = (F − 32) / 1.8`).

---

## Design & Typography Credits

- **Dark Theme System:** Adapted from Linear-style low-glare dark operational dashboard token structure (`shared/tokens/tokens.css`, `shared/tokens/tokens.json`, `shared/src/tokens.ts`).
- **Light Theme System:** Adapted from Vercel Geist light design token structure for high-legibility daylight and print usage.
- **Inter Typeface (v4.1):** Copyright (c) 2016 The Inter Project Authors (https://github.com/rsms/inter). Licensed under SIL Open Font License 1.1 (`shared/assets/fonts/Inter-OFL-LICENSE.txt`).
- **Geist Mono Typeface (v1.9.2):** Copyright (c) 2023 Vercel, in collaboration with basement.studio (https://www.npmjs.com/package/geist). Licensed under SIL Open Font License 1.1 (`shared/assets/fonts/GeistMono-OFL-LICENSE.txt`).
- **Health Explorer 3D navigation model:** Original procedural figure by POP N' SEB (2026), Apache License 2.0. Source and reproduction: `shared/scripts/build-body-model.mjs` and `shared/assets/models/MODEL-SOURCE.md`. It is an illustration for navigation, not anatomical or measurement data.
- **three.js (r187):** Copyright © 2010-2026 three.js authors, MIT License. It renders the 3D model on Windows (Tauri WebView) and Android (Expo GL, MIT, © 650 Industries).

---

## AI & Tool-Assistance Disclosure

AI coding, architecture, and verification tools were used to assist POP N' SEB during requirement consolidation, design-system tokenization, TypeScript contract/test authoring, cross-platform scaffolding, and documentation formatting. All requirements, clinical-safety boundaries, unit/math rules, synthetic fixtures, and final acceptance checks are reviewed by the team.

- **Submission owner action (`G01`):** Before final Space Apps portal submission, confirm and update this disclosure statement (including any specific AI model names/versions and generated-asset notes) to match the official 2026 NASA Space Apps Participant Terms and submission guide requirements.
