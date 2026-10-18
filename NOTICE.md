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
| `brand/agencies/dinsos_demak.svg` (Cloud Storage), Seal of Demak Regency | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Seal_of_Demak_Regency.svg) | Public domain (Indonesian government insignia; use must not imply official endorsement, so the app labels it "independent demo, not an official service") |
| `brand/agencies/kpai.png` (Cloud Storage), KPAI emblem, cropped from the logo | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Logo_Komisi_Perlindungan_Anak_Indonesia.png) | Public domain, same note as above |
| `agencies/dinsos_demak/sop/service-flows-en.md`, `alur-layanan-dinsos-p2pa-demak.md` | Service-flow infographics published by [Dinsos P2PA Demak](https://dinsosp2pa.demakkab.go.id), transcribed and translated by the team (research notes in `docs/research/complaint-processes.md`) | Public information; the original infographics are not redistributed |
| `agencies/kpai/sop/kpai-complaint-sop-en.md`, `sop-pengaduan-kpai.md` | KPAI's published complaint service flow ([kpai.go.id](https://www.kpai.go.id)), transcribed and translated by the team | Public information |
| `*/sop/response-standard-en.md`, `standar-respons-pengaduan.md`, `complaint-handling-sop.md` | Written for this demo | Part of Embrace, all rights reserved |

## Laws and regulations in the agency packs

Indonesian laws and regulations only, included unaltered so the SOP agent can cite them and staff and citizens can open
them. Each is copied from the official source below, hosted for the app in Firebase Storage (`docs/<agency>/`), and listed
in the pack's `sop/sources.json`. Under Indonesian copyright law (Law 28/2014, Article 42) laws and regulations are not
protected by copyright.

| File | Issuer | Official source | Packs |
|---|---|---|---|
| `uu-35-2014-perlindungan-anak.pdf`, UU 35/2014 | Government of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/uu35-2014bt.pdf) | `kpai`, `dinsos_demak` |
| `perpres-61-2016-kpai.pdf`, Perpres 61/2016 | President of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/ps61-2016.pdf) | `kpai` |
| `pp-78-2021-perlindungan-khusus-anak.pdf`, PP 78/2021 | Government of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/pp78-2021bt.pdf) | `kpai` |
| `uu-12-2022-tpks.pdf`, UU 12/2022 | Government of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/uu12-2022.pdf) | `kpai`, `dinsos_demak` |
| `uu-11-2012-sppa.pdf`, UU 11/2012 | Government of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/uu11-2012bt.pdf) | `kpai` |
| `uu-21-2007-tppo.pdf`, UU 21/2007 | Government of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/uu21-2007.pdf) | `kpai` |
| `uu-44-2008-pornografi.pdf`, UU 44/2008 | Government of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/uu44-2008.pdf) | `kpai` |
| `uu-23-2004-pkdrt.pdf`, UU 23/2004 | Government of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/uu23-2004.pdf) | `kpai`, `dinsos_demak` |
| `uu-16-2019-perkawinan.pdf`, UU 16/2019 | Government of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/uu16-2019bt.pdf) | `kpai`, `dinsos_demak` |
| `permenpanrb-5-2025-sp4n.pdf`, PermenPANRB 5/2025 | Ministry of Administrative and Bureaucratic Reform | [jdih.menpan.go.id](https://jdih.menpan.go.id) | `kpai`, `dinsos_demak` |
| `uu-11-2009-kesejahteraan-sosial.pdf`, UU 11/2009 | Government of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/uu11-2009.pdf) | `dinsos_demak` |
| `permensos-1-2018-pkh.pdf`, Permensos 1/2018 | Ministry of Social Affairs | [peraturan.bpk.go.id](https://peraturan.bpk.go.id/Download/120868/PERMENSOS%20NOMOR%20%201%20TAHUN%202018.pdf) | `dinsos_demak` |
| `permensos-4-2023-program-sembako.pdf`, Permensos 4/2023 | Ministry of Social Affairs | [peraturan.bpk.go.id](https://peraturan.bpk.go.id/Download/339294/Permensos_Nomor_4_Tahun_2023.pdf) | `dinsos_demak` |
| `uu-8-2016-penyandang-disabilitas.pdf`, UU 8/2016 | Government of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/uu8-2016bt.pdf) | `dinsos_demak` |
| `uu-13-1998-lanjut-usia.pdf`, UU 13/1998 | Government of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/uu13-1998.pdf) | `dinsos_demak` |
| `uu-24-2007-penanggulangan-bencana.pdf`, UU 24/2007 | Government of Indonesia | [peraturan.go.id](https://peraturan.go.id/files/uu24-2007.pdf) | `dinsos_demak` |
| `permen-pppa-4-2018-uptd-ppa.pdf`, Permen PPPA 4/2018 | Ministry of Women Empowerment and Child Protection | [peraturan.go.id](https://peraturan.go.id/files/bn532-2018.pdf) | `dinsos_demak` |

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
| `team/<agency>/<id>.jpg` (Cloud Storage), staff portraits | Generated with Gemini (Google) for this demo from text prompts; the people are fictional and resemble no real person | Part of Embrace, all rights reserved; Gemini terms of use |

## Software dependencies

The app's runtime dependencies are open source: 175 MIT, 104 Apache-2.0, 22 ISC, 17 BSD, 5 BlueOak-1.0.0, and one each of
0BSD, Unlicense and Python-2.0 (counted with `npm ls --omit=dev`). Two need a note:

- `caniuse-lite` (browser support data, used at build time by Next.js) is CC-BY-4.0: data by the [Can I use](https://caniuse.com) project.
- `@img/sharp-libvips-*` (image processing used by Next.js) is LGPL-3.0-or-later, loaded as a separate dynamic library and not modified.

Each package's license text ships in its folder under `node_modules`.

## Map boundaries (Cloud Storage `geo/`, not in this repository)

| File | Source | Terms |
|---|---|---|
| `geo/indonesia-provinces.json` (34 provinces, simplified, names in Indonesian) | [geoBoundaries](https://www.geoboundaries.org) gbOpen IDN ADM1 (Runfola et al., 2020) | Open Data Commons Open Database License 1.0 |
| `geo/demak-kecamatan.json` (the 14 kecamatan of Demak regency, simplified) | geoBoundaries gbHumanitarian IDN ADM3, from OCHA ROAP via HDX | CC BY 3.0 IGO |

Charts and maps use [Apache ECharts](https://echarts.apache.org) (Apache-2.0); diagrams use [React Flow](https://reactflow.dev) (`@xyflow/react`, MIT).

## Submission film (sources kept outside this repository)

| Item | Source | Terms |
|---|---|---|
| Screens | Screenshots of this app | Part of Embrace, all rights reserved |
| Voiceover | Generated with Gemini text-to-speech from the film script | Gemini API terms |
| Sound effects: [Quick air woosh](https://assets.mixkit.co/active_storage/sfx/2605/2605-preview.mp3), [Data scaner](https://assets.mixkit.co/active_storage/sfx/2847/2847-preview.mp3), [Big cinematic impact](https://assets.mixkit.co/active_storage/sfx/788/788-preview.mp3), [Quick zoom impact](https://assets.mixkit.co/active_storage/sfx/772/772-preview.mp3), [Sweeping sparkle presentation intro](https://assets.mixkit.co/active_storage/sfx/2633/2633-preview.mp3), [Quick switch click](https://assets.mixkit.co/active_storage/sfx/2582/2582-preview.mp3), [On or off light switch tap](https://assets.mixkit.co/active_storage/sfx/2585/2585-preview.mp3), [Slow sweeping swoosh](https://assets.mixkit.co/active_storage/sfx/163/163-preview.mp3), [Air zoom vacuum](https://assets.mixkit.co/active_storage/sfx/2608/2608-preview.mp3), [Message pop alert](https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3), [Fast whoosh transition](https://assets.mixkit.co/active_storage/sfx/1490/1490-preview.mp3), [Digital typewriter](https://assets.mixkit.co/active_storage/sfx/1363/1363-preview.mp3), [Magic sparkle touch](https://assets.mixkit.co/active_storage/sfx/3083/3083-preview.mp3), [Electronics power up](https://assets.mixkit.co/active_storage/sfx/2602/2602-preview.mp3) | [Mixkit](https://mixkit.co/free-sound-effects/) | Mixkit Sound Effects Free License (no attribution required) |
| Music: ["House Vibez" by Lily J](https://assets.mixkit.co/music/745/745.mp3) | [Mixkit](https://mixkit.co/free-stock-music/) | Mixkit Stock Music Free License (no attribution required) |
