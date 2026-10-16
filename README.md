# Embrace

**AI agents for social services desks, in any language.** Embrace reads every report a social services office receives (social aid, disability and elderly care, homelessness, disaster relief, violence and child protection) from the web, WhatsApp, email, social media, voice notes or photos. It masks personal data, judges urgency, applies the agency's own escalation rules, assigns a person in charge, finds the right procedure in the agency's SOPs and drafts a cited reply in the citizen's language. An officer approves every reply. Leaders get a live dashboard, an AI weekly brief and early warnings when reports cluster around one village, school or payment batch.

Built for the **AI Builder Cup 2026, Social Good track** ("Build in JAPAC. Build for the world.") by team **Nalaria**.

- Live prototype: https://embrace.nalaria.ai.id (also https://embrace--embrace-23a9c.asia-southeast1.hosted.app)
- Demo video: _coming soon_
- Pitch deck: [`docs/submission/`](docs/submission/) (PPTX and PDF), brief description in [`docs/submission/description.md`](docs/submission/description.md)

> Prototype with synthetic data only. Agencies, SOPs and complaints in the two sample packs are fictional; the Indonesia pack uses real public regulations.

## The problem

Social services desks get every kind of message in one inbox: a family without shelter tonight next to a question about office hours. Officers sort by hand, escalation depends on who reads the message first, replies quote procedures from memory, and no one sees that five families from the same village reported the same missing payment this week. In Indonesia alone, the national complaint channel SP4N-LAPOR! received 176,853 reports in 2023, up 30% on 2022, and KemenPPPA recorded 28,831 cases of violence against children in 2024.

Systems that work today start after a human has read, sorted and typed the case in: UNICEF's Primero (CPIMS+, GBVIMS+) manages child protection and GBV cases in 75 countries, and SP4N-LAPOR! routes complaints to agencies. Embrace is the AI front door before that step.

## What it does

| Step | Agent | What happens |
|---|---|---|
| 0 | Media agent (Gemini) | Transcribes voice notes word for word in any language and describes photos (ID cards, letters, injuries); masks personal data. Runs only when files are attached. |
| 1 | Intake agent (Gemini) | Detects the language, extracts place / institution / programme / age, masks names, phone and ID numbers, restates the complaint in English. |
| 2 | Triage agent (Gemini) | Category from the agency's taxonomy, urgency with the decisive quote, sentiment, safety flags, confidence. |
| 3 | Policy rules (code) | Deterministic escalation and routing. Safety flags, always-escalate categories and keywords force escalation even if the model under-rates the case; model failure falls back to keyword rules and manual review, never silence. |
| 4 | SOP lookup (code) | BM25 search over the agency's SOP documents; no AI tokens. |
| 5 | Reply drafter (Gemini) | Reply in the citizen's language with ticket number, team, response time in hours, and only procedures from the SOP passages, cited [1], [2]. Waits for officer approval. |
| – | Analyst agent (Gemini + tools) | Answers leaders' questions and writes the weekly brief by calling tools over live Firestore data (`get_overview`, `find_clusters`, `search_tickets`). |

![Case page in the staff workspace](docs/screenshots/case.png)

Every case gets a **person in charge** (PIC): the policy step assigns the officer who owns the queue, and officers can delegate a case to a colleague with a handover note. Escalations and assignments are published to **Pub/Sub** (topic `case-events`); a **Cloud Function for Firebase** (`functions/src/index.ts`) writes a notification for the supervisor and the PIC and marks the alert delivered.

The app has two sides, in a Material 3 light theme. **Citizens** use `/report` (write, record a voice note or add a photo, in any language; the confirmation shows plain-language progress, with a "staff view" of the agent trace for the demo) and `/track/<id>` (status and the approved reply, no internal data). **Staff** use the workspace under `/staff` with a navigation rail: **Inbox** (My cases, escalated, queues, search), **Case** pages with tabs for the case, the agent trace and the history (delegate to a colleague, approve the reply, reassign, resolve), **Insights** (KPIs, AI weekly brief, early-warning clusters, and an Ask-the-analyst tab), **Knowledge** (the agency's SOP documents and search) and **Team** (who handles what, open cases per person). A demo sign-in picker switches between team members; a bell shows Pub/Sub notifications.

## Built for the world: agency packs

Each agency is a folder under [`agencies/`](agencies/): `agency.json` (categories, queues, escalation rules, SLA hours, emergency line, signature), `sop/` (its own SOP documents with a `sources.json`) and `seed.json` (synthetic demo history). Adding a country or agency means adding a folder, not changing code.

| Pack | What it shows |
|---|---|
| `social_services` | Generic social services office: social aid, disability and elderly care, homelessness, disaster relief, domestic violence. Sample SOP. |
| `child_protection` | Generic child protection service. Sample SOP + the UN Convention on the Rights of the Child. Complaints in English, Spanish, French, Tagalog, Portuguese, Vietnamese, Swahili. |
| `id_demak` | Indonesia country pack: a district social affairs office with six real Indonesian regulations as SOPs; complaints in Indonesian and Javanese. |

Prospective users are social affairs offices and child protection commissions; Embrace is an open-source blueprint each agency deploys in its own Firebase project, so complaint data stays with the agency.

## How it uses Google Cloud

- **Gemini** (Gemini API, `gemini-3.1-flash-lite` for media, intake, drafting and analysis; `gemini-2.5-flash` for triage) for multilingual understanding, audio transcription, image reading, structured outputs and tool calling.
- **Google Agent Development Kit (ADK) for TypeScript**: the pipeline is an ADK `SequentialAgent` of four `LlmAgent`s with Zod output schemas plus two custom `BaseAgent`s (rules and SOP search); the analyst is an `LlmAgent` with `FunctionTool`s.
- **Firebase App Hosting**: builds and serves the Next.js app (UI + API route handlers) from this repo; secrets come from Secret Manager.
- **Cloud Run**: App Hosting runs the Next.js server on Cloud Run (`asia-southeast1`, one warm instance during judging); agent progress streams to the browser over Server-Sent Events.
- **Pub/Sub + Cloud Functions for Firebase**: escalations and assignments are published to the `case-events` topic; the `onCaseEvent` function notifies the supervisor and the person in charge and marks alerts delivered.
- **Cloud Firestore**: cases with the full agent trace, person in charge, history and officer actions, plus `notifications`; the analyst agent's tools read it live. Security rules deny all client access; only the server and the function write.
- **Firebase Analytics**: page and screen usage of the prototype.

## Quality

Triage eval on 60 labelled synthetic complaints (Indonesian, Javanese, English; child protection and social assistance), `npm run eval`, results in [`data/eval/results.json`](data/eval/results.json):

| Metric | Result |
|---|---|
| Category accuracy | 93% |
| Urgency exact / within one level | 80% / 100% |
| Critical cases escalated (9 cases), model alone and with rules | 100% / 100% |
| Escalations that were truly high or critical (20) | 95% |
| Sent to manual review | 0% |

Remaining misses are borderline: a shared bullying video read as education rather than online harm, a schoolyard beating with bruises escalated as abuse, street children busking escalated.
In local test runs a text complaint went through all five steps in about 6 seconds.

## Run it

Requirements: Node 22+, a Gemini API key.

```bash
npm install
cp .env.example .env.local     # set GOOGLE_GENAI_API_KEY
npm run dev                    # http://localhost:3000, in-memory store
npm test                       # policy rules and SOP search, no model calls
npm run eval                   # triage eval, uses the Gemini key
npm run sop:index              # rebuild agencies/*/sop-index.json after changing SOP documents
```

Deploy to your own Firebase project (Blaze plan; stays within free tiers at prototype volume):

```bash
firebase use <project-id>
gcloud firestore databases create --location=asia-southeast1 --project <project-id>
firebase apphosting:backends:create --backend embrace --primary-region asia-southeast1
firebase apphosting:secrets:set gemini-api-key        # paste the Gemini API key
firebase apphosting:secrets:grantaccess gemini-api-key --backend embrace
firebase deploy --only apphosting,firestore,functions
```

## Layout

```
app/              Next.js App Router: page + API route handlers (app/api/*)
functions/        Cloud Function for Firebase: Pub/Sub case events -> notifications
components/       React UI (Report, Officer console, Insights)
lib/agents/       ADK agents: pipeline.ts, analyst.ts, models.ts
lib/              policy rules, SOP search, Firestore store, analytics, seeding
agencies/<id>/    agency packs: agency.json, sop/, sop-index.json, seed.json
scripts/          SOP index builder, triage eval
tests/            vitest: policy and SOP search
```

## Safety and privacy

- Synthetic data only. Personal data is masked by the intake agent before officers see it; the original stays behind a "Show original" toggle.
- Escalation never depends on the model alone; replies are never sent without officer approval.
- Attachments are sent to Gemini and not stored; the ticket keeps only their type and size and what the media agent read.
- Per-IP rate limits protect the demo's Gemini budget.

## License

Apache-2.0. Indonesian regulations and the UN CRC are public documents redistributed with their source URLs in each `sources.json`.
