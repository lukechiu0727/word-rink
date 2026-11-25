# Word Rink — ISEE Upper Level Vocabulary Trainer

A small, offline-capable web app for building ISEE Upper Level vocabulary in about ten minutes a day. It uses spaced repetition so each word comes back right before it would be forgotten, and it writes every example sentence in themes the learner cares about: ice hockey, basketball, and video games.

No accounts, no server, no tracking. Everything runs in the browser and progress is stored on the device.

## Features

- **595 words** in two decks: a Middle Level foundation, introduced first, followed by Upper Level words. Words from a teacher-supplied practice test are prioritized at the start of the Upper deck and can be filtered with the **Teacher list** chip.
- **Spaced repetition** (Leitner boxes): a correct answer moves a word up a box and pushes its next review further out — 1 → 3 → 7 → 14 → 30 days. A wrong answer sends it back to tomorrow.
- **ISEE-style questions**: synonyms, sentence completion, definitions, and word-form questions (e.g. *reluctant → reluctantly*).
- **Pick your theme**: 🏒 Hockey, 🏀 Basketball, 🎮 Games, or Mix. Every word has one sentence per theme.
- **Natural-voice audio** for every word, word form, and example sentence (optional pre-generated clips; falls back to the device voice).
- **Motivation without punishment**: XP, levels, combos, badges, a 60-second Shootout bonus round, and a daily streak that forgives one missed day per week. Wrong answers never cost XP.
- **Exam pacing**: set the exam date and the app suggests how many new words per day are needed to finish two weeks before the test.
- **Parent report** (optional): after each session the app can post a one-line summary — streak, accuracy, mastered words, most-missed words, and a backup code — to a Google Sheet.
- **Works offline** once installed to the home screen.

## What counts as "done for today"

The Today screen shows two numbers: reviews due and new words. When both reach zero the screen says the day is complete and the streak goes up. A session is capped at 40 reviews; if more are due, run it again.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app (UI, word list, sentences, logic) in one file |
| `sw.js` | Service worker: offline support and automatic updates |
| `manifest.json`, `icon-192.png`, `icon-512.png` | Home-screen install metadata and icons |
| `audio-manifest.json` | Every text clip the app can play, keyed by file name |
| `make_audio.py` | Generates the natural-voice MP3s into `audio/` |
| `apps-script.gs` | Optional Google Apps Script receiver for the parent report |
| `audio/` | Generated clips (not committed until you run the script) |

## Deploy to GitHub Pages

1. Put the files above in the root of a repository.
2. **Settings → Pages → Source:** `main` branch, `/ (root)`. Save.
3. After a minute or two the app is live at `https://<user>.github.io/<repo>/`.

## Generate the audio (optional, recommended)

```bash
pip install edge-tts
python make_audio.py                     # default voice: en-US-AriaNeural
python make_audio.py --voice en-US-AvaMultilingualNeural --rate -10%
python make_audio.py --shrink            # re-encode to 32 kbps mono (needs ffmpeg)
```

The script reads `audio-manifest.json`, writes `audio/<key>.mp3`, and skips clips that already exist, so it is safe to re-run after adding words. Commit the `audio/` folder. Inside the app, **Setup → Download audio pack for offline** caches every clip on the device.

List available voices with `edge-tts --list-voices`.

## Install on a phone or tablet

- **iPhone / iPad:** open the URL in Safari → Share → *Add to Home Screen*.
- **Android:** open the URL in Chrome → menu → *Install app* / *Add to Home screen*.

Open it once while online; after that it works without a connection.

## Where progress lives — read this before deleting anything

Progress is stored in the browser's `localStorage` on the device. It is never uploaded to GitHub.

- **On iOS, a home-screen web app has its own storage, separate from Safari.** Deleting the home-screen icon deletes its progress, and re-adding it from Safari starts empty.
- Back up with **Setup → Export progress** (copies a code) and restore with **Import progress**.
- If the parent report is enabled, every row in the sheet also contains a full backup code.

## Updating the app

Pages (`index.html`) are fetched network-first, so a new upload appears the next time the app is opened. Static files are cache-first, so **change the `VERSION` string at the top of `sw.js` on every release** — that is what tells installed copies to refresh their cache. Audio clips live in a separate cache and survive updates.

The app also checks for a new service worker whenever it returns to the foreground and reloads itself when one takes over (never in the middle of a question). The installed version is shown at the bottom of the Setup screen.

If a device seems stuck on an old version, fully close the app (swipe it away) and reopen it, once or twice. On iOS, avoid deleting the icon unless progress has been exported first.

## Parent report (optional)

1. Create a Google Sheet → **Extensions → Apps Script**, paste `apps-script.gs`, save.
2. **Deploy → New deployment → Web app.** Execute as: *Me*. Who has access: *Anyone*.
3. Copy the `/exec` URL into the app under **Setup → Parent report** and tap **Send a test report**.

Each session then appends a row: date, name, streak, XP, mastered/seen/total, due count, today's questions and accuracy, new words, most-missed words, and a backup code. Reports that fail while offline are retried the next time the app opens online.

Note that anyone who has the `/exec` URL can append rows to that sheet; keep the URL private.

## Editing the word list

Words live in `index.html` as arrays of `[word, part of speech, definition, Chinese gloss, [synonyms], default sentence]`, with themed sentences in maps of `word: [hockey sentence, basketball sentence, games sentence]`. Each sentence must contain `___` where the word goes.

**Add new words at the end of the list.** Progress is keyed by each word's position, so inserting words in the middle would shift saved progress onto the wrong words. After adding words, regenerate `audio-manifest.json` and run `make_audio.py` again.

## How the method works

- **Spaced retrieval.** Reviewing just before forgetting, at growing intervals, is what moves a word into long-term memory. Testing (retrieving the answer) beats re-reading.
- **Immediate retrieval for new words.** Each new word is shown once, then quizzed twice in the same session.
- **Varied context.** Rotating sentences across themes keeps the learner from memorizing a single sentence instead of the word.
- **Small, daily, forgiving.** Ten minutes a day, six days a week, with streaks that tolerate a missed day, is easier to sustain than large weekly targets.

## Restore from the sheet

Every parent-report row now records which app it came from, and the backup code is compact (well under Google Sheets' 50,000-character cell limit, even with a full word list learned).

To move progress to a new device: install the app, enter the same name, paste the sheet URL in **Setup → Parent report**, and tap **Restore from sheet**. The app fetches the latest backup for that name *in this app* and asks before replacing anything.

This needs the updated `apps-script.gs`: paste it over the old script, then **Deploy → Manage deployments → edit → Version: New version → Deploy** (the URL stays the same). Optionally set `SECRET` at the top of the script and enter the same value as **Sheet password** in each app; then only apps that know it can write rows or read backups.

## Sync across devices

Progress now syncs automatically between every device that uses the same **name** and the same **sheet URL** (Setup → Parent report). A phone, a tablet and a laptop all end up with the same words/skills, review dates, XP, streak and badges.

- **When it syncs:** when the app opens, after each finished session, when the app comes back to the foreground or goes to the background, when the device comes back online, and every few minutes while open. **Setup → Sync now** forces it; the status line under it shows the last sync time or the error.
- **Nothing is lost when two devices are used offline.** For each item the version with more practice attempts wins, so learning only adds up. XP and best scores take the higher value, badges are combined, and the streak follows whichever device practised most recently.
- **Mid-session safety:** progress from another device is never applied in the middle of a quiz; it is merged at the end.
- **Reset** on one device resets every device (the reset is newer than the old progress). Export a backup first if unsure.
- The server keeps one merged copy per name and app in a sheet tab called `sync`; parent-report rows still go to the first tab as before.
- The sheet URL and password stay on each device only — they are never synced, never stored in the code, and should not be committed to the repository.

This needs the updated `apps-script.gs`: paste it over the old script, then **Deploy → Manage deployments → edit → Version: New version → Deploy** (the URL stays the same). The first sync on each device merges whatever progress it already has, so existing progress is kept.
