# Security

Embrace is a prototype for the AI Builder Cup 2026. It runs with synthetic data only: no real complainant, case or
staff member is in the repository, the demo deployment or the film. Please do not send real personal data to the demo.

## Reporting a vulnerability

Email **dzakybd@gmail.com** with "Embrace security" in the subject. Please include what you found, how to reproduce
it and what an attacker could do with it. Do not open a public issue, and do not test against other people's data
or run load or denial-of-service tests on embrace.nalaria.ai.id. We aim to reply within 3 working days and to fix
confirmed issues in the demo within 14 days, and we credit reporters who want it.

## Secrets

| Secret | Where it lives | Notes |
|---|---|---|
| Gemini API key | Google Secret Manager `gemini-api-key`, injected into Cloud Run at deploy | Never in the repository, the browser or logs; the AI control tower shows its last 4 characters only (as the Google Cloud console does) |
| Telegram bot tokens (built-in agencies) | Secret Manager `telegram-bot-dinsos-demak`, `telegram-bot-kpai` | The Channels page shows where a token is stored and a masked hint, never the token |
| Telegram bot tokens (agencies created in the app) | Firestore `integrations`, server only | Firestore rules deny every client read and write |
| Telegram webhook secret | Secret Manager `telegram-webhook-secret` | Every webhook call must carry it in `X-Telegram-Bot-Api-Secret-Token` |
| Firebase web API key | Secret Manager `firebase-web-api-key`, read at build time (`NEXT_PUBLIC_FIREBASE_API_KEY`) | Ends up in the browser bundle by design; see below |

`.env*` files are gitignored. `.env.example` lists the variable names only.

### The Firebase web API key

The browser needs the Firebase web `apiKey` for Analytics, so it is in the JavaScript the site serves. It is not in the
repository any more (it comes from Secret Manager at build time; older commits still contain it). Firebase web config is
meant to be public: the key identifies the project and grants no access on its own
([Firebase docs](https://firebase.google.com/docs/projects/api-keys)). GitHub secret scanning flags it as a Google API key; the alert was reviewed and closed. The key is restricted anyway:

- **APIs:** Firebase Installations and Firebase Management (web config) only, the two calls Firebase Analytics makes.
  It cannot call the Gemini API, Firestore, Storage, Cloud Logging or any other Google API.
- **Websites:** `embrace.nalaria.ai.id`, the App Hosting domain and localhost only.
- The Gemini API is not enabled on the Firebase project; Gemini runs with a separate key from Secret Manager.

## How the app is protected

- **Data access.** Firestore rules deny all client access; only the server (Admin SDK on App Hosting) reads and writes
  cases. Storage rules allow public reads of `docs/` (Indonesian laws and regulations, not copyright protected) and
  nothing else, and no client writes.
- **Personal data.** The intake agent masks names, phone numbers, ID numbers and addresses before staff see a case;
  the original stays behind a "Show original" toggle. Voice notes and photos go to Gemini and are not stored.
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

- **No staff sign-in.** The staff workspace lets anyone switch between demo accounts so judges can try every role.
  Role checks on the server trust the account the browser names. A real deployment needs Firebase Authentication
  with roles on the user, checked on the server, before it holds real data.
- **Rate limits** on most endpoints are per instance; the Telegram limits are shared through Firestore.
- **Data retention** is not automated: there is no scheduled deletion of closed cases yet.
- **Dependencies** are kept current but not scanned automatically in CI.

Anything not listed here that lets someone read case data, act as staff without the demo switch, spend the AI budget
beyond the rate limits, or make the agents leak their instructions or another case is in scope.
