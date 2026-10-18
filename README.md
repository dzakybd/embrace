# Embrace

**The AI service desk for social services and child protection.** Embrace reads every report a social services office receives (social aid, disability and elderly care, homelessness, disaster relief, violence and child protection) from its web chat or Telegram bot, as text, voice notes or photos, in any language. It masks personal data, judges urgency, applies the agency's own escalation rules in code, assigns a person in charge, finds the right passages in the agency's SOPs and Indonesian law, and drafts a cited reply in the citizen's language that says what happens next. A caseworker approves every reply. Staff also get a knowledge base with a document agent that finds documents and answers from them (for example what a regulation requires, or the legal basis of a case for the police or a court), and leaders get interactive dashboards, a map of cases, an AI weekly brief and early warnings when reports cluster.

Built for the **AI Builder Cup 2026, Social Good track** ("Build in JAPAC. Build for the world.") by team **Nalaria**.

- Live prototype: https://embrace.nalaria.ai.id
- Demo video: [Google Drive](https://drive.google.com/drive/folders/1vu12gJthTznQft9KAmY7A5rueKGBmqYE?usp=sharing)
- Telegram bots: [@embrace_dinsos_demak_bot](https://t.me/embrace_dinsos_demak_bot) (Demak Social Affairs) and [@embrace_kpai_bot](https://t.me/embrace_kpai_bot) (KPAI)

> Prototype with synthetic data only. The two demo agencies, the Demak Regency Social Affairs Office (Dinsos P2PA Kabupaten Demak) and the Indonesian Child Protection Commission (KPAI), use their real unit structure, published service flows and public regulations; staff names and complaints are fictional, and neither agency endorses this prototype. Demo complaints and documents are in English so anyone can follow them; the agents read Indonesian and Javanese too, and the Indonesian originals of the service flows are kept next to the translations.

## The problem

Social services desks still read and sort every report by hand, in office hours, so a child beaten at home tonight waits in the same queue as a late food-aid card. Handling is slow by design: an online complaint to KPAI gets its first call back within 14 working days (3 x 24 hours if data is missing) ([KPAI complaint SOP](agencies/kpai/sop/sop-pengaduan-kpai.md)); SP4N-LAPOR! allows 5, 14 or 60 working days by type (PermenPANRB 5/2025), and about 1 in 9 of its complaints gets no response (88.5% response rate, [KemenPANRB via IDN Times, 2026](https://www.idntimes.com/news/indonesia/kemenpan-rb-aduan-sp4nlapor-02-5kbmp-d70p98)). Escalation depends on who reads the message first, replies quote procedures from memory, and no one sees that five families from the same village reported the same missing payment this week. Indonesia's national public complaints portal, SP4N-LAPOR!, receives about 454 reports a day ([KemenPANRB via IDN Times, 2026](https://www.idntimes.com/news/indonesia/kemenpan-rb-aduan-sp4nlapor-02-5kbmp-d70p98)), and the child protection commission KPAI recorded 2,031 child-rights violations in 2025 ([KPAI year-end report](https://www.kpai.go.id/files/2026/01/siaran-pers-laporan-akhir-tahun-KPAI-2025.pdf)).

Systems that work today each cover one part, and start after a person has read, sorted and typed the case in: UNICEF's Primero (CPIMS+, GBVIMS+) manages child protection cases in 75 countries, and SP4N-LAPOR! routes complaints to agencies. Embrace is an AI service desk for the whole job: it takes the report from chat, triages and escalates it, manages the case to closing, and keeps the agency's policies, procedures and knowledge in one place.

## What it does

Every report runs one Google ADK `Workflow` (`lib/agents/pipeline.ts`): each step reads the session state the previous ones wrote.

| Step | Agent | What happens |
|---|---|---|
| 0 | Input guardrail (code) | Rate limits, spam filter and a prompt-injection screen before any model call; public text is fenced as data. |
| 1 | Media agent (Gemini) | Transcribes voice notes word for word and describes photos; masks personal data. Runs only when files are attached. |
| 2 | Intake agent (Gemini) | Language, place / institution / programme / age, personal-data masking, an English restatement. |
| 3 | Triage agent (Gemini) | Case type, urgency with the decisive quote, safety signals (built-in and the agency's own), confidence. |
| 4 | Policy rules (code) | Escalation and routing, never by the model alone: safety signals, always-escalate case types, minimum urgency, escalation words and a confidence threshold. A model failure falls back to keyword rules and manual review. |
| 5 | Document search (code) | BM25 over the documents replies may cite; no tokens. |
| 6 | Reply drafter (Gemini) | Reply in the citizen's language: ticket number, team, response time, the next stage of the agency's procedure, citations [1], [2], hotlines only from the agency's Resources. |
| 7 | Draft check (code) | The output guardrail checks for personal data, links, wrong citations, promises and leaked instructions; a flagged draft goes back to the drafter once with the findings. |
| – | Follow-up questions (code) | When place, age or time is missing, the chat asks at most two fixed, translated questions; the answers join the report and the agents run again (urgency can only go up). |
| – | Analyst agent (Gemini + tools) | Answers the head of office and writes the weekly brief with `get_overview`, `find_clusters`, `search_tickets` over live Firestore data. |
| – | Document agent (Gemini + tool) | Finds documents and answers any staff question from the knowledge base, and drafts a case's legal basis, calling `search_documents` several times; citations it was not given are flagged. |

![Case page in the staff workspace](.github/assets/case.png)

**Citizens** report through the web chat (`/report`) or the agency's Telegram bot, follow their case at `/track/<id>` (status, the approved reply, the procedure as a diagram) and read the public guide at `/a/<id>/guide`. The bot handles everything it can in plain code first (commands, greetings, danger words, follow-ups to an open case, per-chat and daily limits), and real reports are queued on Pub/Sub so the webhook answers at once.

**Staff** sign in by role (demo picker): caseworkers, a supervisor who receives escalations and delegates them, and a head of office (Kepala at Dinsos, Ketua at KPAI). The workspace:

- **Inbox** and **case pages**: the report, the draft to approve, the procedure checklist, the legal basis, delegation with a note, the agent trace as a conversation (model, time, tokens, Cloud Trace link) and the audit trail.
- **Insights** (head of office): KPIs, interactive Apache ECharts charts, a map of cases by province (KPAI) or by kecamatan in Demak regency (Dinsos), the AI weekly brief, early-warning clusters and Ask-the-analyst. Clicking a region, case type or urgency opens those cases.
- **Knowledge base**: laws, regulations, SOPs, court decisions, guidelines and web pages by category, each with a short summary. Staff add PDFs, Markdown, text or web pages (Gemini writes the summary if left empty) and choose whether replies may cite each one; search needs no tokens, and the document agent answers questions with citations.
- **Policies**: per case type its team, escalation level, legal basis (picked from the knowledge base) and procedure as a React Flow swimlane diagram; and the escalation rules for every case (response times, safety signals including the agency's own, escalation words, manual-review threshold).
- **Resources**: official channels, social media, hotlines and partner agencies; hotlines marked urgent are the emergency line given in urgent replies, in the bot and on tracking.
- **Channels**: the web chat link and the Telegram bot (status checks, set-up, show or change the token).
- **AI control tower** (supervisor): an interactive agent map with a two-turn simulation, the staff assistants and the Google Cloud architecture, every tool and check, models per agent, cost, latency, guardrail findings and red-team results.
- **Settings**: the agency's profile (English and Indonesian side by side) and its people and teams.

Every change to an agency's setup needs a settings password (checked on the server); built-in agencies keep edits as an override and **Reset demo data** restores them. The interface switches between English and Indonesian.

## Built for the world: agency packs

Each built-in agency is a folder under [`agencies/`](agencies/): `agency.json` (case types, teams, staff, escalation rules, response times, procedures, resources, map), `sop/` (its documents with `sources.json`, including summaries) and `seed.json` (synthetic demo history, with each case's replies, the citizen's answers and procedure progress). Any other agency is created in the app at `/agencies/new` from a copy of a built-in one, and is live on the web chat, Telegram and the staff workspace at once. No code changes per agency.

| Pack | What it shows |
|---|---|
| `dinsos_demak` | **Demak Regency Social Affairs Office (Dinsos P2PA Demak)**, a district office: UPTD PPA, social protection (PKH, BPNT/Sembako), SLRT / Puskesos (DTSEN, PBI/UHC), social rehabilitation, disaster victim protection (tidal floods in Sayung), child marriage and adoption. Knowledge: its 13 published service flows and Indonesian law (UU 11/2009, Permensos 1/2018 and 4/2023, UU 8/2016, UU 13/1998, UU 24/2007, UU 23/2004, UU 12/2022, UU 35/2014, UU 16/2019, Permen PPPA 4/2018, PermenPANRB 5/2025). |
| `kpai` | **Indonesian Child Protection Commission (KPAI)**, a national commission: complaints unit and clusters (special protection, family and alternative care, education, health and welfare). Knowledge: KPAI's complaint SOP and Indonesian law (UU 35/2014, Perpres 61/2016, PP 78/2021, UU 12/2022, UU 11/2012, UU 21/2007, UU 44/2008, UU 23/2004, UU 16/2019, PermenPANRB 5/2025). |

Why these two: the team is in contact with people at both agencies, and they cover the two ends of social complaints, a district office that delivers services and a national commission that refers and oversees. Embrace is a blueprint each agency deploys in its own Firebase project, so complaint data stays with the agency.

## How it uses Google Cloud

- **Gemini API** (`gemini-flash-lite-latest`, the latest Flash-Lite, for every agent; switchable per agent in the AI control tower): multilingual understanding, audio transcription, image reading, structured output, tool calling, safety filters; about US$0.002 per report.
- **Agent Development Kit (ADK) for TypeScript 2.3**: the pipeline is a `Workflow` of Gemini `LlmAgent`s with Zod schemas and custom `BaseAgent`s for rules, search and the draft check; the analyst and document agents are `LlmAgent`s with `FunctionTool`s; a governance plugin applies each agency's models and records latency and tokens; ADK OpenTelemetry goes to Cloud Trace.
- **Firebase App Hosting on Cloud Run** (`asia-southeast1`): builds and serves the Next.js app and its API; agent progress streams over Server-Sent Events. No Firebase SDK or key in the browser.
- **Cloud Firestore**: cases with the agent trace and audit trail, agencies, the knowledge base, integrations and notifications; rules deny all client access.
- **Cloud Storage for Firebase**: the laws the agents cite (opened at the cited page), map boundaries, portraits and emblems (public); report photos, voice notes and uploaded documents (private).
- **Pub/Sub + Cloud Functions for Firebase**: case events (`case-events` → `onCaseEvent`) notify the supervisor and the person in charge in seconds; Telegram reports are queued on `telegram-reports`.
- **Cloud Trace, Cloud Monitoring, Cloud Logging**: a trace of every agent run, token and latency metrics, guardrail events, an uptime check with an alert, and metadata-only logs.
- **Secret Manager and a billing budget**: the Gemini key, bot tokens, webhook secret and settings password stay out of code; spend alerts at 50%, 90% and 100%.

## Quality

Triage eval on 60 labelled synthetic complaints (Indonesian, Javanese, English; 30 per agency), `npm run eval`, results in [`data/eval/results.json`](data/eval/results.json). Model comparison on the same set in [`triage-models.json`](data/eval/triage-models.json): `gemini-flash-lite-latest` (3.5 Flash-Lite, in use) and `gemini-3.1-flash-lite` are on par and both beat `gemini-2.5-flash`.

| Metric | Result |
|---|---|
| Category accuracy | 93% |
| Urgency exact / within one level | 80% / 100% |
| Critical cases escalated (9 cases), model alone and with rules | 100% / 100% |
| Escalations that were truly high or critical (18) | 94% |
| Sent to manual review | 0% |

The four category misses are borderline: two beatings at school read as violence rather than education (both still sent to the right team for violence), a missing food-aid payment read as a registration problem, and a Javanese question on how to register for aid read as registration rather than general information.

**Attack tests on the public chat**: 14 synthetic attacks in English and Indonesian ([`data/eval/attacks.json`](data/eval/attacks.json)) through the full pipeline (`npm run eval:attacks`): prompt injection, fake system tags, prompt leaks, role play, urgency tricks, planted links and promises, data exfiltration. 14 of 14 held ([`attacks-results.json`](data/eval/attacks-results.json)).

**Load test on production**: ~290 page views/s with 50 concurrent users (p99 287 ms, 0 errors) on one warm instance; 10 AI reports at once completed in about 4.7 s each (`scripts/load-burst.mjs`).

**Tests**: 79 vitest tests without model calls (rules, durations, setup sections, guardrails, the drafting loop, citations, maps, the settings password, procedures, the bot gate, translations).

## Run it

Requirements: Node 22+, a Gemini API key.

```bash
npm install
cp .env.example .env.local     # set GOOGLE_GENAI_API_KEY (and EMBRACE_ADMIN_PASSWORD to protect setup changes)
npm run dev                    # http://localhost:3000, in-memory store
npm test                       # 79 tests, no model calls
npm run lint && npm run format # ESLint and Biome
npm run eval                   # triage eval (60 cases), uses the Gemini key
npm run eval:attacks           # attack tests through the full pipeline, uses the Gemini key
npm run sop:index              # rebuild agencies/*/sop-index.json after changing shipped documents
```

Deploy to your own Firebase project (Blaze plan; stays within free tiers at prototype volume except the warm instance):

```bash
firebase use <project-id>
gcloud firestore databases create --location=asia-southeast1 --project <project-id>
firebase apphosting:backends:create --backend embrace --primary-region asia-southeast1
firebase apphosting:secrets:set gemini-api-key           # and embrace-admin-password, bot tokens
firebase apphosting:secrets:grantaccess gemini-api-key --backend embrace
firebase deploy --only apphosting,firestore,functions,storage
```

## Layout

```
app/              Next.js App Router: pages and API route handlers (app/api/*)
components/       React UI: citizen chat and tracking, staff workspace, charts (ECharts), diagrams (React Flow)
lib/agents/       ADK agents: pipeline.ts (Workflow), analyst.ts, documents.ts, governance.ts, models.ts
lib/              policy rules, guardrails, search and knowledge base, agency setup, maps, Firestore store, analytics
functions/        Cloud Function for Firebase: Pub/Sub case events -> notifications
agencies/<id>/    agency packs: agency.json, sop/, sop-index.json, seed.json
scripts/          index builder, triage eval, attack tests, load test, Telegram set-up
tests/            vitest
```

## Safety and privacy

How to report a vulnerability, where secrets live and the known limits of the prototype: [SECURITY.md](SECURITY.md).

- Synthetic data only. Personal data is masked before staff see a case; the original stays behind a "Show original" toggle.
- Escalation never depends on the model alone; no reply is sent without a caseworker's approval; every action is in the case's audit trail.
- Public text is fenced as data in every prompt. Reports with instructions aimed at the AI go to a person, and the drafter gets only a neutral restatement; drafts are checked and rewritten once when flagged.
- Photos, voice notes and uploaded documents are kept in private Cloud Storage. Keys and tokens live in Secret Manager, never in the browser.
- The settings password is checked with scrypt; the browser never stores it but gets a signed, HttpOnly session cookie for eight hours. The demo sign-in picker is not real authentication (Firebase Authentication is the next step).
- Per-IP rate limits and a daily AI budget protect the Gemini key; Gemini errors back off and retry before the keyword rules decide.
- The chat and the bot link to a privacy notice ([`/privacy`](app/privacy/page.tsx)) under Indonesia's Personal Data Protection Law (UU 27/2022).

## License

All rights reserved: the code is public for review, not open source (see [LICENSE](LICENSE)). Third-party documents, emblems, map boundaries, icons and dependencies keep their own terms, listed in [NOTICE.md](NOTICE.md).
