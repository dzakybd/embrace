# Embrace

**AI agents for public complaint desks, in any language.** Embrace reads every complaint a child protection or social assistance office receives (web, WhatsApp, email, social media, voice notes, photos), masks personal data, judges urgency, applies the agency's own escalation rules, finds the right procedure in the agency's SOPs and drafts a cited reply in the citizen's language. An officer approves every reply. Leaders get a live dashboard, an AI weekly brief and early warnings when complaints cluster around one school, village or payment batch.

Built for the **AI Builder Cup 2026, Social Good track** ("Build in JAPAC. Build for the world.") by team **Nalaria**.

- Live prototype: https://embrace--embrace-23a9c.asia-southeast1.hosted.app
- Demo video: _coming soon_
- Pitch deck: [`docs/submission/Embrace - AI Builder Cup.pptx`](docs/submission/)

> Prototype with synthetic data only. Agencies, SOPs and complaints in the two sample packs are fictional; the Indonesia pack uses real public regulations.

## The problem

Public complaint desks for children and vulnerable families get every kind of message in one inbox: a child being beaten tonight next to a question about office hours. Officers sort by hand, escalation depends on who reads the message first, replies quote procedures from memory, and no one sees that five families from the same village reported the same missing payment this week. The same pattern shows up in child protection hotlines and social assistance grievance desks across Asia-Pacific and the world.

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

Three screens: **Report** (citizen form with sample complaints, voice recording and photo upload, live agent trace), **Officer console** (escalation inbox, masked complaint, editable draft with sources, "Approve & send", agent trace explaining every decision, Ask-the-SOP search) and **Insights** (KPIs, AI weekly brief, ask-the-analyst, early-warning clusters, category trends).

## Built for the world: agency packs

Each agency is a folder under [`agencies/`](agencies/): `agency.json` (categories, queues, escalation rules, SLA hours, emergency line, signature), `sop/` (its own SOP documents with a `sources.json`) and `seed.json` (synthetic demo history). Adding a country or agency means adding a folder, not changing code.

| Pack | What it shows |
|---|---|
| `child_protection` | Generic child protection service. Sample SOP + the UN Convention on the Rights of the Child. Complaints in English, Spanish, French, Tagalog, Portuguese, Vietnamese, Swahili. |
| `social_assistance` | Generic social assistance grievance desk (cash transfers, food vouchers, disability and elderly services). Sample SOP. |
| `id_demak` | Indonesia country pack: a district social affairs office with six real Indonesian regulations as SOPs; complaints in Indonesian and Javanese. |

Prospective users are child protection commissions and social affairs offices; Embrace is an open-source blueprint each agency deploys in its own Firebase project, so complaint data stays with the agency.

## How it uses Google Cloud

- **Gemini** (Gemini API, `gemini-3.1-flash-lite` for media, intake, drafting and analysis; `gemini-2.5-flash` for triage) for multilingual understanding, audio transcription, image reading, structured outputs and tool calling.
- **Google Agent Development Kit (ADK) for TypeScript**: the pipeline is an ADK `SequentialAgent` of four `LlmAgent`s with Zod output schemas plus two custom `BaseAgent`s (rules and SOP search); the analyst is an `LlmAgent` with `FunctionTool`s.
- **Firebase App Hosting**: builds and serves the Next.js app (UI + API route handlers) from this repo; secrets come from Secret Manager.
- **Cloud Run**: App Hosting runs the Next.js server on Cloud Run (`asia-southeast1`), scaling to zero; agent progress streams to the browser over Server-Sent Events.
- **Cloud Firestore**: tickets with the full agent trace, history and officer actions, plus an `alerts` collection for escalations; the analyst agent's tools read it live. Security rules deny all client access; only the server writes.
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
firebase deploy --only apphosting,firestore
```

## Layout

```
app/              Next.js App Router: page + API route handlers (app/api/*)
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
