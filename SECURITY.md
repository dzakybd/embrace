# Security

Embrace is a prototype for the AI Builder Cup 2026. It runs with synthetic data only: no real complainant, case or
staff member is in the repository, the demo deployment or the film. Please do not send real personal data to the demo.

## Reporting a vulnerability

Email **dzaky.fawwaz@nalaria.ai.id** (founder; copy luluil.maknuna@nalaria.ai.id, head of business) with "Embrace security" in the subject. Please include what you found, how to reproduce
it and what an attacker could do with it. Do not open a public issue, and do not test against other people's data
or run load or denial-of-service tests on embrace.nalaria.ai.id. We aim to reply within 3 working days and to fix
confirmed issues in the demo within 14 days, and we credit reporters who want it.

## Secrets

| Secret | Where it lives | Notes |
|---|---|---|
| Gemini API key | Google Secret Manager `gemini-api-key`, injected into Cloud Run at deploy | Never in the repository, the browser or logs; the AI control tower shows its last 4 characters only (as the Google Cloud console does) |
| Telegram bot tokens (built-in agencies) | Secret Manager `telegram-bot-dinsos-demak`, `telegram-bot-kpai` | The Channels page shows where a token is stored and a masked hint, never the token |
| Telegram bot tokens (agencies created in the app) | Firestore `integrations`, server only | Firestore rules deny every client read and write |
| Settings password | Secret Manager `embrace-admin-password` | Required for every change to an agency's setup and to view a bot token; checked with scrypt, wrong guesses rate-limited; the browser never stores it, it gets a signed HttpOnly session cookie (8 hours) |
| Telegram webhook secret | Secret Manager `telegram-webhook-secret` | Every webhook call must carry it in `X-Telegram-Bot-Api-Secret-Token` |

`.env*` files are gitignored. `.env.example` lists the variable names only.

### The Firebase web API key

The browser runs no Firebase SDK, so no Google API key is in the code or in the JavaScript the site serves. Older
commits contain the Firebase web key from an earlier Analytics setup; GitHub secret scanning flagged it and the alert
was reviewed. That key is restricted to Firebase Installations and Firebase Management and to our domains, cannot call
the Gemini API (not enabled on the Firebase project), and the app no longer uses it.

## How the app is protected

- **Data access.** Firestore rules deny all client access; only the server (Admin SDK on App Hosting) reads and writes
  cases. Storage rules allow public reads of `docs/` (Indonesian laws and regulations, not copyright protected) and
  nothing else, and no client writes.
- **Personal data.** The intake agent masks names, phone numbers, ID numbers and addresses before staff see a case;
  the original stays behind a "Show original" toggle. Voice notes and photos are kept in private Cloud Storage (`reports/`, closed to clients by the Storage rules) and shown to staff behind the same toggle.
  Citizens see a privacy notice (`/privacy`, Law 27/2022 on Personal Data Protection) in the chat and the Telegram bot.
- **Abuse and cost.** Per-IP rate limits on every public endpoint (20 web reports per hour), per-chat limits and a
  daily AI budget for the Telegram bot shared across instances (past it, keyword rules decide), Gemini retries with
  backoff, and a monthly billing budget with alerts.
- **Prompt injection.** Public text is fenced as data in every prompt. Reports with instructions aimed at the AI go to
  a person, and the reply drafter sees only a neutral restatement of them. Drafts are checked in code for copied
  personal data, foreign links, invented citations, promised outcomes, leaked instructions and false "case closed"
  claims. A red-team set of 14 synthetic attacks (`npm run eval:attacks`) runs through the full pipeline; the last runs
  held 14 of 14.
- **People decide.** Escalation is decided by rules in code, never by the model alone, and no reply reaches a citizen
  without a caseworker's approval. Every action on a case is kept in its audit trail, and changes to AI settings and
  procedures are logged to Cloud Logging.
- **Gemini safety filters** block high-probability harm when reading reports (so victims are not silenced) and
  medium-and-above harm in drafted replies.

## Known limitations of the prototype

- **No staff sign-in.** The staff workspace lets anyone switch between demo accounts so judges can try every role,
  and case work (delegating, approving replies) is open. Every change to an agency's setup (settings, AI models and
  guardrails, procedures, resources, channels, demo reset) needs the settings password, checked on the server. A real deployment needs Firebase Authentication
  with roles on the user, checked on the server, before it holds real data.
- **Rate limits** on most endpoints are per instance; the Telegram limits are shared through Firestore.
- **Attachments** are served to the staff case page by the server without sign-in, like the rest of the demo staff
  workspace.
- **Data retention** is not automated: there is no scheduled deletion of closed cases yet.
- **Dependencies** are kept current but not scanned automatically in CI.

Anything not listed here that lets someone read case data, act as staff without the demo switch, spend the AI budget
beyond the rate limits, or make the agents leak their instructions or another case is in scope.
