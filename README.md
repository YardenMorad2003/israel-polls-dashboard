# The Israeli Polling Saga · 2019–2026

An interactive, **fully-offline** dashboard over opinion polling for the **five completed Israeli
general elections of 2019–2022** (21st–25th Knesset) plus the **live run-up to the 26th Knesset
(2026)**. It chains every cycle's polls into one continuous 2018 → 2026 timeline, scores how
accurately each pollster called each *completed* election, and reproduces the Wikipedia poll tables
— all in a **single self-contained HTML file** with no server, no build step, and no internet
connection required. The 2026 cycle is polling-only for now: accuracy scoring unlocks once that
election is held.

Open `index.html` in any browser and it just works.

**Live demo:** <https://yardenmorad2003.github.io/israel-polls-dashboard/>

| Election | Knesset | Election day | Polls | Pollsters | Lists | Events | Polling window |
|----------|:-------:|:------------:|------:|:---------:|:-----:|:------:|----------------|
| April 2019     | 21st | 2019-04-09 | 122 | 16 | 22 | 26 | 2018-11-14 → 2019-04-09 |
| September 2019 | 22nd | 2019-09-17 |  70 | 11 | 20 | 16 | 2019-05-26 → 2019-09-17 |
| March 2020     | 23rd | 2020-03-02 |  82 |  8 | 19 | 15 | 2019-10-03 → 2020-03-02 |
| March 2021     | 24th | 2021-03-23 | 172 |  8 | 25 | 33 | 2020-03-12 → 2021-03-23 |
| November 2022  | 25th | 2022-11-01 | 158 |  7 | 23 | 27 | 2021-04-05 → 2022-11-01 |
| 2026 *(in progress)* | 26th | — | 566 | 12 | 19 | 13 | 2022-12-23 → 2026-07-01 |

**Totals:** 1,170 polls · 130 campaign events · 28 distinct pollsters · 59 lists · 5 completed
elections + the in-progress 2026 cycle. Each cycle's polling begins within days/weeks of the previous
result, so the combined view is a near-continuous **eight-year** record (2018 → 2026). Every
*completed* election result sums to exactly **120 seats**; the 2026 cycle has no result yet.

> The 2026 cycle's polls come from the sibling `../polls-main` datasets (the FastAPI/React live
> tracker): `polls.xlsx` (pre-Bennett scenario, through Dec 2024) spliced with `polls_bennet.xlsx`
> (Bennett/Beyachad era). Party lines begin/end as parties actually form — e.g. Bennett's list from
> late 2024, the Bennett–Lapid "Beyachad" merger and Eisenkot's "Yashar" from 2026.

---

## Quick start

Double-click **`index.html`** (or open it in any browser). It is fully self-contained and **offline**:
the chart library (`echarts.min.js`) is vendored locally and the data is baked into `data.js`, so no
internet, server, or install is needed.

There is **no build step** — it's plain HTML/CSS/JS. To rebuild the data after editing the source
CSVs, see [Regenerating the data](#regenerating-the-data).

---

## The interface

A **mode toggle** (top) switches between three views; a row of **cycle tabs** below it filters every
view by election; five **KPI cards** summarise whatever you're looking at.

### Cycle tabs

`All cycles` (one continuous 2018 → 2022 timeline) or any single election (April 2019 … 2022). The
tabs **filter every mode** and are the quickest way to **jump to a single campaign**: click `2021`
to see just the 24th-Knesset run-up, then zoom/pan within it freely.

The URL hash tracks the current mode + cycle, so any view is linkable (see [Deep links](#deep-links)).

---

## Mode 1 · Polling trends

A seat-projection chart across the selected window, fully **zoomable**: mouse-wheel (or pinch) to
zoom the time axis, drag to pan, or use the **range slider** under the chart. **Reset zoom** (in the
toolbar) restores the full window.

- **Zoom & pan** — wheel/pinch to zoom, drag to pan, slider below the chart for coarse navigation.
  Zoom is **x-only** (the y-axis stays fixed per cycle so seat counts remain comparable); the window
  survives filter changes and mode switches, and resets when you change cycle. Clicking an event
  outside the current window pans to it.
- **Trend lines** — each party's **±14-day moving average** over the raw poll dots. The line is
  **broken across gaps longer than 35 days** (e.g. a quiet pre-campaign stretch), so it never draws
  a misleading straight bridge over months with no polling.
- **Raw poll dots** — every individual poll, coloured by party.
- **Election markers** — labelled vertical lines at each election day.
- **Event lines** — faint dashed verticals for campaign events, each with a small dot at the top.
  **Hover** to read the event; **click** the line or dot to jump to that event in the side panel.
- **Party chips** — click to show/hide parties; `all` / `major` / `none` shortcuts. The all-cycles
  view defaults to the seven lists that persist across the whole period (Likud, Shas, UTJ, Yisrael
  Beiteinu, Labor, Meretz, Joint List); single cycles default to that election's top lists.
- **Pollster filter** — include/exclude individual polling firms.
- **View modes** — `Trend + polls` / `Trend only` / `Polls only`.
- **Events panel** (right) — the full campaign timeline, newest first. Click an event to **mark it
  gold on the chart** and highlight it; conversely, clicking an event line on the chart **scrolls to
  and highlights** it in this panel. The link is bidirectional.

The y-axis is fixed per cycle (0 → a rounded max with headroom) so it stays stable as you change
filters; lines are drawn crisply (no shadow) for legibility at a glance.

---

## Mode 2 · Pollster accuracy

How each pollster's projection compared to the **actual election result**. Two independent toggles
shape the calculation:

### Metric — *which* projection to score (each vs. the final result)

- **Campaign average** — the mean of all the pollster's campaign polls.
- **Final month** — the mean of the pollster's polls from the **last 30 days** before election day.
  A campaign average over a long cycle mostly measures how much *opinion moved* (2021's polling
  window spans a full year); the final-month window is a fairer test of a firm's closing call.
- **Last poll** — their final poll *before* election day. The ranking shows how many days before
  the election it was taken (firms stop at different distances — Israeli law bars publishing polls
  in the campaign's final days).
- **Election day** — their **exit poll** published on election day itself.

Campaign-average, Final-month and Last-poll **exclude** the election-day polls; Election-day uses
**only** them.

### Lists — *which* parties to score over

- **Seated** *(default)* — only lists that **won seats** (final result > 0). This is the classic
  measure.
- **All polled** — also credits the **threshold call**: any list a pollster projected *with seats*
  that then **missed** the 3.25% threshold is scored against its real **0**, so over-projecting a
  doomed list now counts as error. (Lists that both the pollster and reality put at 0 carry no signal
  and are skipped, so the score isn't diluted by correctly-zeroed micro-parties.)

In both scopes, only lists that **actually stood in the election** are graded (they appear in the
result — sub-threshold lists at 0). Lists that merged, withdrew or were renamed mid-campaign (e.g.
pre-merger "Labor" polling in the September 2019 cycle, before Labor–Gesher) are *not* counted as
misses — a projection for a list that never reached the ballot is a naming artifact, not a
threshold call.

Switching to **All polled** typically raises everyone's error and **reorders the ranking** — firms
that nailed the seated parties but kept projecting lists that ultimately flopped fall behind those who
correctly called who would survive.

### Scoring

For each rated pollster, the per-list projection (per the chosen metric) is compared to the result;
**MAE** = mean |projection − result| over the scored lists. A firm needs **≥ 3 polls** to be rated
(**≥ 2** within the window under *Final month*, **≥ 1** for the single exit poll under *Election day*).

- **Single election** → a **bias heatmap** (pollster × list; red = over-projected, blue = under) plus
  an **accuracy ranking** (lowest MAE = most accurate). Under *All polled*, extra columns appear for
  the lists that missed the threshold, making over-projection visible as red.
- **All cycles** → a **pollster × election** mean-error heatmap (green = more accurate) and an overall
  ranking by **skill score**: each firm's error divided by that election's **field-average** error,
  averaged over the firm's elections (1× = typical firm, lower = better). Raw seat errors aren't
  comparable across elections — some cycles were much harder to poll — and firms were rated in
  different subsets of them, so averaging raw errors would flatter a firm that skipped the hard
  cycles. Heatmap cells still show the raw error in seats (the tooltip adds the ×-field figure).
  Firms appearing in ≥ 2 elections are ranked; under *Election day*, one-time exit pollsters
  (e.g. 2022's Direct Polls) are included too.

---

## Mode 3 · Browse polls

Every poll in **table form, like the Wikipedia pages**: rows = polls (date, polling firm + publisher),
columns = each party's seats with **colour-coded headers**, plus the Gov/Opp (and bloc) totals.

- The **election-result row is highlighted** (gold date, bold), sub-threshold parties show as
  `(x.x%)`, and each row's leading party is bold.
- Sticky header + Date/firm columns; horizontal scroll for the full party set.
- **Filter by election** with the cycle tabs; the **search box** filters by pollster.
  *All elections* stacks all five tables.
- The Browse table keeps the **faithful source labels** (including outlet/channel) — the display and
  analysis merges described below **do not** apply here.

---

## KPI cards

The five cards update with the view and filters:

| Mode | Cards |
|------|-------|
| Trends | polls · pollsters · parties polled · events · period |
| Accuracy (single) | pollsters rated · most accurate · best error · mean error · parties/lists scored |
| Accuracy (all) | pollsters (≥2 elections) · most accurate · best skill score · elections · period |
| Browse | polls · pollsters · parties/elections · election · period |

---

## Deep links

The URL **hash** encodes mode + cycle (+ metric), and updates as you click:

| Link | Opens |
|------|-------|
| `#2022` | Trends, 2022 cycle |
| `#all` | Trends, all cycles |
| `#accuracy/2021` | Accuracy, March 2021 |
| `#accuracy/2022/elecday` | Accuracy, 2022, Election-day metric |
| `#accuracy/all/last` | Accuracy, all cycles, Last-poll metric |
| `#browse/2020` | Browse, March 2020 |
| `#browse/all` | Browse, all elections |

Cycle ids: `2019a`, `2019b`, `2020`, `2021`, `2022`, `all`. Metric tokens: `avg`, `month`, `last`,
`elecday` (`exit`/`eday` also map to election-day). The Lists scope is a UI toggle and defaults to
*Seated*.

---

## Data & build pipeline

### Sources

Each **completed** election's **Wikipedia "Opinion polling for the … Israeli legislative election"**
page is parsed into a per-cycle folder (`israel-polls-2019a`, `…2019b`, `…2020`, `…2021`, `…2022`).
The sixth cycle, `israel-polls-2026`, is instead built from the sibling `../polls-main` live-tracker
datasets (26th-Knesset seat projections), emitted into the **same** CSV schema:

- [Opinion polling for the April 2019 Israeli legislative election](https://en.wikipedia.org/wiki/Opinion_polling_for_the_April_2019_Israeli_legislative_election)
- [Opinion polling for the September 2019 Israeli legislative election](https://en.wikipedia.org/wiki/Opinion_polling_for_the_September_2019_Israeli_legislative_election)
- [Opinion polling for the 2020 Israeli legislative election](https://en.wikipedia.org/wiki/Opinion_polling_for_the_2020_Israeli_legislative_election)
- [Opinion polling for the 2021 Israeli legislative election](https://en.wikipedia.org/wiki/Opinion_polling_for_the_2021_Israeli_legislative_election)
- [Opinion polling for the 2022 Israeli legislative election](https://en.wikipedia.org/wiki/Opinion_polling_for_the_2022_Israeli_legislative_election)

Each folder contains:

- `seat_projections_combined_long.csv` — one row per (poll, party): `date_iso, date, pollster,
  publisher, party, seats, period, source_file`.
- `seat_projections_combined_wide.csv` — one row per poll with a column per party + bloc/total columns
  (`Gov.`, `Opp.`, `L/R/C/O`, `Others`); powers the Browse table.
- `events.csv` — campaign timeline (`date_iso, date, event`).

### `build_data.py`

Reads all five cycles, applies **display-only** and **analysis-only** normalisation (below), and emits
`data.js` as `window.POLLDATA`. **Source CSVs are never modified.**

```bash
python build_data.py     # regenerates data.js (~580 KB), prints a per-cycle summary
```

### Three normalisation regimes

1. **Party aliases — display only** (trends + accuracy lines). Pure spelling/abbreviation variants of
   the *same* list are unified so lines stay clean: `B&W`→Blue & White, `Likud–Kulanu`→Likud,
   `YB`→Yisrael Beiteinu, `RZ`/`JH`/`OY`→Religious Zionist / Jewish Home / Otzma Yehudit,
   `NEP`→New Economic.
2. **Pollster canonicalisation — analysis only** (accuracy ranking + pollster filter). The same firm is
   split in the source by commissioning outlet (`Midgam/Channel 12` vs `Midgam/Channel 13`) and by
   spelling/casing (`Maagar Mohot` ≡ `Maagar Mochot`, `KANTAR`, `Camile Fuchs`); these are folded so a
   firm isn't double-counted.
3. **Exit-poll firm attribution.** Each TV channel's election-day exit poll is run by the same firm
   every cycle but labelled inconsistently in the source. Election-day polls are normalised to the
   channel's firm — Channel 13 → Camil Fuchs, Channel 12 → Midgam, Kan 11 / Channel 11 → Kantar — so
   they line up across all five elections.

### Data-hygiene rules

- **Result table** is taken only from the `00`-prefixed period table; older period tables carry the
  *prior* election's result as their baseline, which is excluded so each cycle's result is its own.
- **Boundary polls** that appear in two overlapping period tables are de-duplicated on
  `(date, pollster, party, seats)` — never summed.
- **Baseline / result rows** (e.g. "seats at dissolution", "election result") are regex-detected and
  excluded from the poll series (the result row is kept separately for scoring + the Browse highlight).
- Seats are out of **120**; a value of **0** means the list polled **below the 3.25% threshold**.

### `window.POLLDATA` schema

```js
{
  generated: "2026-06-06",
  allDefault: ["Likud","Shas","UTJ","Yisrael Beiteinu","Labor","Meretz","Joint List"],
  aliases: { … }, colors: { … },
  cycles: [{
    id, label, knesset, election,            // "2022", "2022", "25th Knesset", "2022-11-01"
    start, end,                              // first/last poll date (ISO)
    parties: [{ name, color, result, peak }], // result: seats won (0 = ran & missed the threshold,
                                              //   null = never on the final ballot), peak: max polled
    major:   [ … ],                          // top ~9 lists (default-visible in trends)
    pollsters: [ … ],                        // canonicalised firm names
    polls:   [{ d, f, p, s }],               // date, firm, party, seats
    events:  [{ d, dl, e }],                 // date(iso), date(display), text
    result:  { party: seats },               // final result; contested sub-threshold lists appear at 0
    nPolls, nPollsters, nEvents,
    table: {                                  // Browse: faithful source rows
      cols: [{ n, c, b }],                    // name, colour, isBloc
      rows: [{ d, dt, f, pub, k, v[] }]       // k = "poll" | "result" | "baseline"
    }
  }]
}
```

(The front-end synthesises the *All cycles* view by concatenating each cycle's `polls`/`events` and
unioning `parties` by name.)

---

## Methodology notes & caveats

The accuracy tab shows these in-app too, in plain language:

- **Polls measure the day they're taken, not election day.** The *campaign average* therefore mixes
  real opinion change with pollster error — in long cycles (2021's window spans a full year) much of
  everyone's "error" is just that opinion moved. *Final month* and *Last poll* are fairer tests of a
  firm's closing call.
- **"Last polls" differ in age.** Publishing polls is banned in the campaign's final days and firms
  stop at different distances from the finish; the ranking shows each firm's days-before-election.
- **Seats are a blunt yardstick.** The 3.25% threshold and seat allocation can turn a small
  vote-share miss into several seats, and per-list errors aren't independent — seats sum to 120, so
  over-counting one list forces under-counting another. (Vote-share scoring would be cleaner, but
  the source tables record seat projections.)
- **No error bars.** Rankings are point estimates; a firm rated on a handful of polls can rank high
  or low by luck. Treat gaps of a few tenths of a seat as a tie.
- **Cross-election comparisons are normalised.** The all-cycles ranking scores each firm *relative
  to the field* per election (skill, 1× = average), because elections differ in difficulty and firms
  took part in different ones.
- **Only lists on the final ballot are graded.** Contested lists that missed the threshold count at
  0; lists that merged or withdrew mid-campaign are excluded, not scored as misses.

Plus the standing notes:

- **Display merges affect only the trends & accuracy lines.** The Browse table and the source CSVs keep
  the original labels.
- **Accuracy default = seated lists.** That ignores how pollsters did on lists that missed the
  threshold; the **All polled** toggle adds exactly that dimension (see above).
- **Exit-poll quirk:** a firm that only ever produced election-day exit polls (no campaign polls) is
  rateable only under the *Election day* metric, and only with the ≥1-poll cutoff.
- Trends zoom is **time-axis only**: the y-axis stays fixed per cycle so seat counts stay comparable
  while you zoom. Changing cycle resets the zoom window.

---

## Regenerating the data

```bash
# from the project folder; needs Python 3 + pandas, with the israel-polls-* source
# folders (2019a–2022 + 2026) present as siblings of this directory.
python build_data.py
```

The script prints a per-cycle summary (`polls / pollsters / parties / events` and the date span) and
overwrites `data.js`. Nothing else needs rebuilding — reload `index.html`.

---

## Files

| File | What it is |
|------|------------|
| `index.html` | The entire dashboard — HTML, CSS, and JS (uses ECharts). |
| `data.js` | Generated data blob (`window.POLLDATA`), ~580 KB. |
| `echarts.min.js` | Vendored Apache ECharts **5.6.0** (Apache-2.0). |
| `build_data.py` | Regenerates `data.js` from the per-cycle CSVs. |
| `README.md` | This file. |

---

## Tech stack

- **Front-end:** vanilla HTML / CSS / JavaScript — no framework, no bundler, no dependencies to install.
  Dark theme, responsive (stacks below 1080 px; dedicated phone layout below 640 px — on touch
  screens the chart pans by drag and zooms via the slider, so the page itself stays scrollable).
- **Charts:** Apache **ECharts 5.6.0**, vendored locally, SVG renderer (avoids a canvas-clearing
  glitch on some GPU/driver combos that left ghost frames behind on repaints).
- **Data build:** Python 3 + **pandas**.

---

## Credits & data licence

- **Poll data & campaign events** come from the English Wikipedia opinion-polling pages linked under
  [Sources](#sources), written by their respective **Wikipedia contributors** and licensed under
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The derived data in this project
  (`data.js` and the per-cycle CSVs it is built from) is a transformation of that content and is
  shared under the same licence.
- **Charts:** [Apache ECharts](https://echarts.apache.org/) 5.6.0, vendored as `echarts.min.js`
  ([Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)).

---

*Built from the per-cycle Wikipedia opinion-polling datasets (2019–2022) + the polls-main live
tracker (2026 cycle). Data generated 2026-07-02; README current as of 2026-07-02.*
