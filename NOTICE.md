# Notices and attributions

Embrace itself is proprietary, all rights reserved (see [LICENSE](LICENSE)): the repository is public for review, not open source. This file lists everything in the repository, the app and the
submission material that comes from someone else, with its source and terms. Synthetic data only: every complaint,
case and staff member in the demo is made up.

## Agencies

The two demo agencies, Dinas Sosial, Pemberdayaan Perempuan dan Perlindungan Anak Kabupaten Demak (Dinsos P2PA Demak)
and Komisi Perlindungan Anak Indonesia (KPAI), are prospective users of this prototype. They have not endorsed it, and it
is not an official service of either. Their unit structure and service flows are taken from their public materials.

| Item | Source | Terms |
|---|---|---|
| `public/agencies/dinsos_demak.svg`, Seal of Demak Regency | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Seal_of_Demak_Regency.svg) | Public domain (Indonesian government insignia; use must not imply official endorsement, so the app labels it "independent demo, not an official service") |
| `public/agencies/kpai.png`, KPAI emblem, cropped from the logo | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Logo_Komisi_Perlindungan_Anak_Indonesia.png) | Public domain, same note as above |
| `agencies/dinsos_demak/sop/service-flows-en.md`, `alur-layanan-dinsos-p2pa-demak.md` | Service-flow infographics published by [Dinsos P2PA Demak](https://dinsosp2pa.demakkab.go.id), transcribed and translated by the team (research notes in `docs/research/complaint-processes.md`) | Public information; the original infographics are not redistributed |
| `agencies/kpai/sop/kpai-complaint-sop-en.md`, `sop-pengaduan-kpai.md` | KPAI's published complaint service flow ([kpai.go.id](https://www.kpai.go.id)), transcribed and translated by the team | Public information |
| `*/sop/response-standard-en.md`, `standar-respons-pengaduan.md`, `complaint-handling-sop.md` | Written for this demo | Part of Embrace, all rights reserved |

## Laws, regulations and treaties in the agency packs

Included unaltered so the SOP agent can cite them; each has its source in the pack's `sop/sources.json`. Under Indonesian
copyright law (Law 28/2014, Article 42) laws and regulations are not protected by copyright.

| File | Issuer | Source |
|---|---|---|
| `uu-35-2014-perlindungan-anak.pdf` | Government of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/uu35-2014bt.pdf) |
| `perpres-61-2016-kpai.pdf` | President of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/ps61-2016.pdf) |
| `permenpanrb-5-2025-sp4n.pdf` | Ministry of Administrative and Bureaucratic Reform | [jdih.menpan.go.id](https://jdih.menpan.go.id) |
| `permensos-1-2018-pkh.pdf`, `permensos-4-2023-program-sembako.pdf` | Ministry of Social Affairs | [peraturan.bpk.go.id](https://peraturan.bpk.go.id) |
| `standar-layanan-uptd-ppa-kab-tapin.pdf` | DPPPA Tapin Regency (public service standard, used as an example of a district UPTD PPA standard) | [dpppa.profile.tapinkab.go.id](https://dpppa.profile.tapinkab.go.id/storage/assets/dpppa/file/ipAH6UkH3KvjhUXd08KIMvr2LRk1wa4mgzKrEAYv.pdf) |
| `un-crc.pdf`, Convention on the Rights of the Child | United Nations, OHCHR | [ohchr.org](https://www.ohchr.org/sites/default/files/crc.pdf) |

## Google services and models

The agents run on the Gemini API through the Agent Development Kit (`@google/adk`, Apache-2.0), on Firebase App Hosting,
Cloud Run, Firestore, Pub/Sub, Cloud Functions, Cloud Trace, Cloud Monitoring and Cloud Logging, under the Google Cloud and
Gemini API terms. The film's voiceover is generated with Gemini text-to-speech. Gemini, Firebase, Google Cloud and Google
Sans are trademarks of Google LLC.

## Fonts and icons

| Item | Source | Terms |
|---|---|---|
| Google Sans, Google Sans Code | Loaded from the [Google Fonts](https://fonts.google.com) API | Open font licenses as listed on each family's Google Fonts page |
| Brand marks (WhatsApp, Telegram, Instagram, Threads, Gmail, Gemini, Firebase, Google Cloud) | [Simple Icons](https://simpleicons.org) through [react-icons](https://github.com/react-icons/react-icons) | Icons CC0-1.0, package MIT. The marks are trademarks of their owners and show which channel or service is meant; no affiliation is implied |
| Interface icons and the Embrace logo | Drawn for this project | Part of Embrace, all rights reserved |

## Software dependencies

The app's runtime dependencies are open source: 175 MIT, 104 Apache-2.0, 22 ISC, 17 BSD, 5 BlueOak-1.0.0, and one each of
0BSD, Unlicense and Python-2.0 (counted with `npm ls --omit=dev`). Two need a note:

- `caniuse-lite` (browser support data, used at build time by Next.js) is CC-BY-4.0: data by the [Can I use](https://caniuse.com) project.
- `@img/sharp-libvips-*` (image processing used by Next.js) is LGPL-3.0-or-later, loaded as a separate dynamic library and not modified.

Each package's license text ships in its folder under `node_modules`.

## Submission film (`video/`)

| Item | Source | Terms |
|---|---|---|
| Screens | Screenshots of this app | Part of Embrace, all rights reserved |
| Voiceover | Generated with Gemini text-to-speech from `video/vo.json` | Gemini API terms |
| Sound effects `air-woosh-quick`, `data-scan`, `impact-cine-big`, `impact-zoom-quick`, `shimmer-sparkle-sweep`, `switch-click-quick`, `switch-tap`, `swoosh-slow`, `transition-soft`, `ui-message-pop`, `whoosh-fast` | [Mixkit](https://mixkit.co/free-sound-effects/) | Mixkit Sound Effects Free License (no attribution required) |
| Sound effects `keyboard`, `riser-cine`, `sparkle` and background music `bgm` (Tech House) | Mixkit; the individual tracks could not be traced back to their pages | Mixkit Free License, to be re-verified before any commercial use |
| Sound effect `pop` | Source not recorded | To be replaced or verified before any use beyond this submission |
