"""Build data.js for the Israeli polling dashboard from the per-cycle combined CSVs.

Reads seat_projections_combined_long.csv + events.csv from each ~/israel-polls-* folder,
applies light DISPLAY-ONLY party-alias merging (so the chart shows clean lines), and emits
window.POLLDATA. Source CSVs are not modified.
"""
import json
import os
import re
import pandas as pd

BASE = r"C:\Users\yarde"
OUT = os.path.join(BASE, "israel-polls-dashboard", "data.js")

CYCLES = [
    {"id": "2019a", "dir": "israel-polls-2019a", "label": "April 2019",    "knesset": "21st Knesset", "election": "2019-04-09"},
    {"id": "2019b", "dir": "israel-polls-2019b", "label": "September 2019", "knesset": "22nd Knesset", "election": "2019-09-17"},
    {"id": "2020",  "dir": "israel-polls-2020",  "label": "2020",          "knesset": "23rd Knesset", "election": "2020-03-02"},
    {"id": "2021",  "dir": "israel-polls-2021",  "label": "2021",          "knesset": "24th Knesset", "election": "2021-03-23"},
    {"id": "2022",  "dir": "israel-polls-2022",  "label": "2022",          "knesset": "25th Knesset", "election": "2022-11-01"},
]

# Display-only aliases: pure spelling/abbreviation variants of the SAME party (safe merges).
ALIAS = {
    "B&W": "Blue & White", "Likud–Kulanu": "Likud", "YB": "Yisrael Beiteinu",
    "RZ": "Religious Zionist", "JH": "Jewish Home", "OY": "Otzma Yehudit",
    "NEP": "New Economic",
}

# Pollster canonicalisation for the ANALYTICAL views (accuracy ranking + trends pollster filter).
# The same firm is split in the source by commissioning outlet ("Midgam/Channel 12" vs
# "Midgam/Channel 13") and by spelling/casing/word-order ("Maagar Mohot" vs "Maagar Mochot",
# "KANTAR", "Camile Fuchs"), which made one firm appear several times in the accuracy tab.
# canon_pollster() drops the outlet/collaboration suffix and folds the variants below.
# The Browse table keeps the faithful source string (incl. outlet) — it is the raw record.
POLLSTER_FIX = {
    "direct polls": "Direct Polls",
    "kantar": "Kantar",
    "maagar mohot": "Maagar Mochot", "maagar mochot": "Maagar Mochot",
    "camile fuchs": "Camil Fuchs", "camil fuchs": "Camil Fuchs",
    "panel hamidgam project": "Panel Project HaMidgam",
    "panel project hamidgam": "Panel Project HaMidgam",
}

# Election-day EXIT polls: each TV channel's exit poll is run by the same firm every cycle, but the
# source labels it inconsistently — by channel in 2019a ("Channel 13 exit poll"), by the fieldwork
# firm in 2019b (Channel 13 → "Panel Project HaMidgam"), and by the firm directly in 2020-2022
# ("Camil Fuchs"). Normalise the election-day poll to the channel's firm, keyed off the channel: the
# `publisher` column for 2019b+ (empty in 2019a), else the "Channel NN exit poll" pollster label.
EXIT_FIRM = {"Channel 11": "Kantar", "Channel 12": "Midgam", "Channel 13": "Camil Fuchs", "Kan 11": "Kantar"}

# Brand-ish colours for recognisability; unmapped parties fall back to a categorical palette.
COLORS = {
    "Likud": "#2b7bba", "Blue & White": "#17b3c4", "Yesh Atid": "#37c0e8",
    "National Unity": "#274b9b", "Zionist Spirit": "#7e57c2", "New Hope": "#6ec6e0",
    "Kulanu": "#00bfa5", "Hosen": "#3f51b5", "Hosen-Telem": "#3f51b5", "Hosen Yisrael": "#3f51b5",
    "Labor": "#e23b3b", "Labor-Gesher": "#e23b3b", "Emet": "#e23b3b", "Labor-Meretz": "#d94f6a",
    "Zionist Union": "#d6336c", "Hatnuah": "#c2185b", "Gesher": "#ad1457",
    "Meretz": "#49a942", "Dem. Union": "#5cb85c", "Green": "#2e7d32",
    "Shas": "#1c1c1c", "UTJ": "#6b5b4a",
    "Yisrael Beiteinu": "#86a8cf",
    "Joint List": "#2e8b57", "Hadash–Ta'al": "#39a06b", "Ra'am": "#8bc34a",
    "Ra'am–Balad": "#5fa052", "Balad": "#1b5e20", "Ta'al": "#43a047",
    "Yamina": "#3f8f5b", "New Right": "#2f9e7d", "Jewish Home": "#e0901e",
    "URWP": "#b5651d", "Religious Zionist": "#8b1a1a", "RZP-OY": "#8b1a1a",
    "Otzma Yehudit": "#b71c1c", "Otzma": "#b71c1c", "Zehut": "#ff8c1a",
    "Jewish Home–NU": "#cf7a1e", "JH–NU": "#cf7a1e", "NU": "#c98a3a", "New Economic": "#9c8f2e",
}
PALETTE = ["#8e7cc3", "#76a5af", "#c27ba0", "#a2c4c9", "#d5a6bd", "#b6d7a8",
           "#ffd966", "#a4c2f4", "#f9cb9c", "#d9d2e9", "#b4a7d6", "#ea9999"]

# Non-poll rows to drop / detect.
BASELINE = re.compile(r"(?:pre-election seats|seats at dissolution|current seats|outgoing knesset)", re.I)
RESULT = re.compile(r"election result", re.I)
SPECIAL_SET = {"Others", "Gov.", "Opp.", "L", "R", "C", "O"}   # bloc/total columns, not parties
META_COLS = {"date_iso", "date", "pollster", "publisher", "period", "source_file"}
ALL_DEFAULT = ["Likud", "Shas", "UTJ", "Yisrael Beiteinu", "Labor", "Meretz", "Joint List"]


def canon(p):
    return ALIAS.get(p, p)


def canon_pollster(name):
    s = name.split("/")[0].split(" & ")[0]        # drop commissioning outlet + collaboration partner
    s = re.sub(r"\[[^\]]*\]", "", s)              # drop [fn 5] / [dead link] footnote markers
    s = re.sub(r"\s+", " ", s).strip()
    return POLLSTER_FIX.get(s.lower(), s)


def color_for(party, fallback_idx):
    return COLORS.get(party) or PALETTE[fallback_idx % len(PALETTE)]


cycles_out, all_polls, all_events = [], [], []
for c in CYCLES:
    d = os.path.join(BASE, c["dir"])
    lf = pd.read_csv(os.path.join(d, "seat_projections_combined_long.csv"), dtype=str, keep_default_na=False)
    lf["party"] = lf["party"].map(canon)
    lf["pollster"] = lf["pollster"].map(canon_pollster)   # merge same-firm/outlet variants (analysis only)
    ed = lf["date_iso"] == c["election"]                  # attribute each channel's exit poll to its firm
    lf.loc[ed, "pollster"] = [EXIT_FIRM.get(pub or f.replace(" exit poll", ""), f)
                              for f, pub in zip(lf.loc[ed, "pollster"], lf.loc[ed, "publisher"])]
    lf["seats_n"] = pd.to_numeric(lf["seats"], errors="coerce")

    is_base = lf["pollster"].str.contains(BASELINE)
    is_res = lf["pollster"].str.contains(RESULT)
    polls_df = lf[~is_base & ~is_res & lf["seats_n"].notna() & (lf["date_iso"] != "")].copy()
    # The current election's result lives in the period-00 table; older period tables carry the
    # PRIOR election's result as their baseline — exclude those so result is this election only.
    res_df = lf[is_res & lf["seats_n"].notna() & lf["source_file"].str.startswith("00")].copy()

    # drop exact-duplicate rows (a boundary poll can appear in two overlapping period tables);
    # keep genuinely distinct polls. Do NOT sum — that would double-count.
    polls_df = polls_df.drop_duplicates(subset=["date_iso", "pollster", "party", "seats_n"])
    polls = [{"d": r.date_iso, "f": r.pollster, "p": r.party, "s": int(r.seats_n)}
             for r in polls_df.itertuples()]

    # result dict (party -> seats); use the latest result row group
    result = {}
    if len(res_df):
        rg = res_df.groupby("party", as_index=False)["seats_n"].max()
        result = {r.party: int(r.seats_n) for r in rg.itertuples()}

    # party ordering: by result seats, else by max polled seats
    rank = {}
    for r in polls_df.itertuples():
        rank[r.party] = max(rank.get(r.party, 0), r.seats_n)
    order = sorted(set(polls_df["party"]),
                   key=lambda p: (-result.get(p, 0), -rank.get(p, 0), p))

    parties = [{"name": p, "color": color_for(p, i), "result": result.get(p),
                "peak": int(rank.get(p, 0))} for i, p in enumerate(order)]
    major = [p["name"] for p in parties[:9]]

    ev = pd.read_csv(os.path.join(d, "events.csv"), dtype=str, keep_default_na=False)
    events = [{"d": r.date_iso, "dl": r.date, "e": r.event} for r in ev.itertuples()]

    pollsters = sorted(set(polls_df["pollster"]))
    dates = sorted(x for x in polls_df["date_iso"] if x)
    cyc = {
        "id": c["id"], "label": c["label"], "knesset": c["knesset"], "election": c["election"],
        "start": dates[0] if dates else "", "end": dates[-1] if dates else "",
        "parties": parties, "major": major, "pollsters": pollsters,
        "polls": polls, "events": events, "result": result,
        "nPolls": int(polls_df.groupby(["date_iso", "pollster"]).ngroups),
        "nPollsters": len(pollsters), "nEvents": len(events),
    }
    # Full wiki-style table (one row per poll, party + bloc columns, original cell values).
    wf = pd.read_csv(os.path.join(d, "seat_projections_combined_wide.csv"), dtype=str, keep_default_na=False)
    datacols = [x for x in wf.columns if x not in META_COLS]
    tcols = [{"n": cc, "c": ("#5f6e82" if cc in SPECIAL_SET else color_for(canon(cc), j)),
              "b": cc in SPECIAL_SET} for j, cc in enumerate(datacols)]
    trows = []
    for rec in wf.to_dict("records"):
        ff = rec.get("pollster", "")
        kind = "result" if RESULT.search(ff) else ("baseline" if BASELINE.search(ff) else "poll")
        trows.append({"d": rec.get("date_iso", ""), "dt": rec.get("date", ""), "f": ff,
                      "pub": rec.get("publisher", ""), "k": kind, "v": [rec.get(cc, "") for cc in datacols]})
    cyc["table"] = {"cols": tcols, "rows": trows}

    cycles_out.append(cyc)
    for p in polls:
        all_polls.append({**p, "c": c["id"]})
    for e in events:
        all_events.append({**e, "c": c["id"]})

data = {
    "generated": "2026-06-06",
    "cycles": cycles_out,
    "aliases": ALIAS,
    "allDefault": ALL_DEFAULT,
    "colors": COLORS,
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.POLLDATA = ")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

size = os.path.getsize(OUT)
tot_polls = sum(len(c["polls"]) for c in cycles_out)
print(f"Wrote {OUT}  ({size/1024:.0f} KB)")
print(f"cycles: {len(cycles_out)} | poll-rows: {tot_polls} | events: {sum(c['nEvents'] for c in cycles_out)}")
for c in cycles_out:
    print(f"  {c['id']:5} {c['label']:15} polls={c['nPolls']:3} pollsters={c['nPollsters']:2} "
          f"parties={len(c['parties']):2} events={c['nEvents']:2}  {c['start']}..{c['end']}")
