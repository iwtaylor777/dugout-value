# Projection archive

Every study so far has been limited by the same gap: there are no saved copies of what the public projections said on a given date. The 2027 untouched test needs those copies from before Opening Day. This archiver keeps them.

## What it saves

Each capture is a new, timestamped folder that is never rewritten:

- FanGraphs projection pages for Steamer, ZiPS, Depth Charts, ATC, THE BAT, THE BAT X and OOPSY, plus their rest-of-season versions, for hitters and pitchers. The raw page is stored gzipped, and the projection rows are extracted next to it. Systems not yet published on a given day are recorded as missing; they are not treated as errors.
- The FanGraphs RosterResource injury report.
- For all 30 clubs: MLB 40-man, active, and full rosters, dated to the capture day.
- MLB transactions: the previous day in season, the previous week in the offseason. These cover IL placements, options, DFAs and signings.

`manifest.json` records the URL, HTTP status, retrieval time, size and SHA-256 of every response, plus row counts and the seasons found in the projection rows. `index.jsonl` gets one line per capture with the manifest hash, so a later edit is detectable.

**Schedule:** daily from March through October, and Mondays from November through February. The job runs at 6:20 a.m. local time, before first pitch. If the Mac is asleep, launchd runs it on wake, and the capture records the actual time.

## Install (once, on the Mac)

```sh
bash scripts/projection-archive/install-macos.sh
```

This copies the script to `~/DugoutValueArchive/bin/`, schedules it, runs one capture immediately, and verifies the archive. The archive goes in `~/DugoutValueArchive`. It sits outside Documents because macOS blocks background jobs from Documents.

## Commands

```sh
python3 scripts/projection-archive/archive_projections.py status
python3 scripts/projection-archive/archive_projections.py verify     # re-hash everything
python3 scripts/projection-archive/archive_projections.py capture --dry-run
bash scripts/projection-archive/install-macos.sh uninstall           # stop the schedule, keep the archive
```

After you edit the script, re-run the install so the scheduled copy updates.

## Rules

- The captures are provider data for private research. Publish derived results and hashes, not raw files.
- A study that uses the archive cites the capture IDs and manifest hashes it read.
- A scoring study uses only captures whose retrieval time precedes the start of its target window.
