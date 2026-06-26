"""Server-side rendering of World Cup stat-leader share images + OG pages.

X (Twitter) can't be sent an image via the web intent — it scrapes the shared
URL's Open Graph tags. So we expose:
  /share/wc-leaders?tab=goals     -> HTML with OG/Twitter card (image below)
  /api/share/wc-leaders.png?tab=  -> the generated leaderboard PNG
The share page redirects human visitors into the app.
"""
from io import BytesIO

ORIGIN = "https://www.pitchvision.app"

# tab key -> (label, value(stats), formatter, lower_is_better, min_minutes)
def _num(field):
    return lambda s: s.get(field, 0) or 0


def _int_fmt(v):
    return f"{int(round(v))}"


def _f2(v):
    return f"{float(v):.2f}"


def _pct(v):
    return f"{float(v):.1f}%"


def _f1(v):
    return f"{float(v):.1f}"


def _per90(stats, field):
    mins = stats.get("minutesPlayed", 0) or 0
    return ((stats.get(field, 0) or 0) / mins) * 90 if mins > 0 else 0


TABS = {
    "goals": ("Goals", _num("goals"), _int_fmt),
    "assists": ("Assists", _num("assists"), _int_fmt),
    "ga": ("Goals + Assists", lambda s: (s.get("goals", 0) or 0) + (s.get("assists", 0) or 0), _int_fmt),
    "penaltyGoals": ("Penalty Goals", _num("penaltyGoals"), _int_fmt),
    "rating": ("Rating", _num("rating"), _f2),
    "minutes": ("Minutes Played", _num("minutesPlayed"), _int_fmt),
    "foulsSuffered": ("Fouls Suffered", _num("foulsSuffered"), _int_fmt),
    "shots": ("Shots", _num("shots"), _int_fmt),
    "shotsOnTarget": ("Shots on Target", _num("shotsOnTarget"), _int_fmt),
    "xG": ("Expected Goals", _num("xG"), _f2),
    "chancesCreated": ("Chances Created", _num("chancesCreated"), _int_fmt),
    "bigChancesCreated": ("Big Chances Created", _num("bigChancesCreated"), _int_fmt),
    "bigChancesMissed": ("Big Chances Missed", _num("bigChancesMissed"), _int_fmt),
    "totalPasses": ("Passes Attempted", _num("totalPasses"), _int_fmt),
    "accuratePasses": ("Successful Passes", _num("_accuratePasses"), _int_fmt),
    "accuratePassesP90": ("Passes Completed /90", lambda s: _per90(s, "_accuratePasses"), _f1),
    "passAccuracy": ("Pass Accuracy", _num("passAccuracy"), _pct),
    "keyPasses": ("Key Passes", _num("keyPasses"), _int_fmt),
    "xA": ("Expected Assists", _num("xA"), _f2),
    "touches": ("Touches", _num("touches"), _int_fmt),
    "oppHalfPasses": ("Passes into Opp. Half", _num("oppHalfPasses"), _int_fmt),
    "crosses": ("Crosses", _num("crosses"), _int_fmt),
    "accurateCrosses": ("Accurate Crosses", _num("accurateCrosses"), _int_fmt),
    "dribbles": ("Dribbles Completed", _num("dribbles"), _int_fmt),
    "dribblesP90": ("Dribbles Completed /90", lambda s: _per90(s, "dribbles"), _f1),
    "totalDribbles": ("Dribbles Attempted", _num("_totalDribbles"), _int_fmt),
    "dribbleSuccess": ("Dribble Success", _num("dribbleSuccess"), _pct),
    "carries": ("Ball Carries", _num("carries"), _int_fmt),
    "progressiveCarries": ("Progressive Carries", _num("progressiveCarries"), _int_fmt),
    "possessionLost": ("Possession Lost", _num("possessionLost"), _int_fmt),
    "dispossessed": ("Dispossessed", _num("dispossessed"), _int_fmt),
    "miscontrols": ("Miscontrols", _num("miscontrols"), _int_fmt),
    "tackles": ("Tackles", _num("tackles"), _int_fmt),
    "successfulTackles": ("Successful Tackles", _num("successfulTackles"), _int_fmt),
    "interceptions": ("Interceptions", _num("interceptions"), _int_fmt),
    "recoveries": ("Ball Recoveries", _num("recoveries"), _int_fmt),
    "clearances": ("Clearances", _num("clearances"), _int_fmt),
    "blocks": ("Blocked Shots", _num("blocks"), _int_fmt),
    "duelsWon": ("Duels Won", _num("duelsWon"), _int_fmt),
    "aerialDuelsWon": ("Aerial Duels Won", _num("aerialDuelsWon"), _int_fmt),
    "fouls": ("Fouls Committed", _num("fouls"), _int_fmt),
    "yellowCards": ("Yellow Cards", _num("yellowCards"), _int_fmt),
    "redCards": ("Red Cards", _num("redCards"), _int_fmt),
    "distanceCovered": ("Distance Covered", _num("distanceCovered"), lambda v: f"{float(v):.1f} km"),
    "sprints": ("Sprints", _num("sprints"), _int_fmt),
    "topSpeed": ("Top Speed", _num("topSpeed"), lambda v: f"{float(v):.1f} km/h"),
    "saves": ("Total Saves", _num("saves"), _int_fmt),
    "cleanSheets": ("Clean Sheets", _num("cleanSheets"), _int_fmt),
    "goalsPrevented": ("Goals Prevented", _num("goalsPrevented"), _f2),
    "mostConceded": ("Most Conceded", _num("goalsConceded"), _int_fmt),
}


# Percentage leaderboards require minimum volume to qualify, so a player on
# 100% from one action can't top the rate-based boards.
# tab key -> (attempt stat field, minimum attempts, minimum minutes)
MIN_ATTEMPTS = {
    "dribbleSuccess": ("_totalDribbles", 6, 100),     # 6 attempted dribbles, 100 min
    "passAccuracy": ("_accuratePasses", 40, 180),     # 40 completed passes, 180 min
    "accuratePassesP90": ("_accuratePasses", 0, 180),  # per-90 needs a real sample
    "dribblesP90": ("dribbles", 0, 100),
}


def rank_players(players, tab_key, limit=10):
    spec = TABS.get(tab_key)
    if not spec:
        return None, None, None
    label, getter, fmt = spec
    rows = [p for p in players if (getter(p.stats or {}) or 0) > 0]
    gate = MIN_ATTEMPTS.get(tab_key)
    if gate:
        field, minimum, min_minutes = gate
        rows = [
            p for p in rows
            if ((p.stats or {}).get(field, 0) or 0) >= minimum
            and ((p.stats or {}).get("minutesPlayed", 0) or 0) >= min_minutes
        ]
    rows.sort(key=lambda p: getter(p.stats or {}) or 0, reverse=True)
    out = []
    for p in rows[:limit]:
        out.append({
            "name": p.name,
            "team": p.club,
            "value": fmt(getter(p.stats or {})),
        })
    return label, out, fmt


def render_leaders_png(label, rows) -> bytes:
    from PIL import Image, ImageDraw, ImageFont

    W = 1200
    H = 630
    top = 218
    row_h = 66
    rows = rows[:5]

    img = Image.new("RGB", (W, H), "#0a1120")
    d = ImageDraw.Draw(img)

    import os
    font_path = os.path.join(os.path.dirname(__file__), "assets", "fonts", "DejaVuSans.ttf")

    def font(size, bold=True):
        # Vendored DejaVu — full Latin coverage (accented player names render).
        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            try:
                return ImageFont.load_default(size)
            except TypeError:
                return ImageFont.load_default()

    # Fixed 1200x630 social-card layout for X/Twitter large preview cards.
    d.rounded_rectangle([34, 32, W - 34, H - 32], radius=28, fill="#0d172a", outline="#1e293b", width=2)
    d.text((70, 72), "PITCHVISION", font=font(30), fill="#38bdf8")
    d.text((W - 70, 76), "WORLD CUP STAT LEADERS", font=font(22), fill="#94a3b8", anchor="ra")
    d.text((70, 132), label.upper(), font=font(54), fill="#ffffff")
    d.text((70, 178), "FIFA World Cup 2026", font=font(24), fill="#94a3b8")
    d.line([(70, 202), (W - 70, 202)], fill="#1e293b", width=2)

    if not rows:
        d.text((W // 2, 350), "No leaderboard data available yet", font=font(34), fill="#94a3b8", anchor="ma")

    for i, r in enumerate(rows):
        y = top + i * row_h
        accent = "#facc15" if i < 3 else "#64748b"
        if i == 0:
            d.rounded_rectangle([58, y - 8, W - 58, y + row_h - 8], radius=16, fill="#0e2235")
        d.text((88, y + 9), f"{i + 1}", font=font(30), fill=accent, anchor="ma")
        d.text((132, y + 8), r["name"], font=font(30), fill="#ffffff")
        if r.get("team"):
            d.text((132, y + 44), r["team"], font=font(18, bold=False), fill="#64748b")
        d.text((W - 76, y + 12), r["value"], font=font(38), fill="#38bdf8", anchor="ra")

    d.text((W // 2, H - 58), "pitchvision.app", font=font(24), fill="#475569", anchor="ma")

    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


FORMATIONS = {
    "4-3-3": [4, 3, 3], "4-4-2": [4, 4, 2], "4-2-3-1": [4, 2, 3, 1],
    "4-3-1-2": [4, 3, 1, 2], "4-1-2-1-2": [4, 1, 2, 1, 2], "4-4-1-1": [4, 4, 1, 1],
    "4-2-2-2": [4, 2, 2, 2], "3-5-2": [3, 5, 2], "3-4-3": [3, 4, 3],
    "3-4-2-1": [3, 4, 2, 1], "3-4-1-2": [3, 4, 1, 2], "3-1-4-2": [3, 1, 4, 2],
    "5-3-2": [5, 3, 2], "5-4-1": [5, 4, 1], "5-2-3": [5, 2, 3],
    "4-5-1": [4, 5, 1], "4-1-4-1": [4, 1, 4, 1],
}


def _xi_slots(formation):
    lines = FORMATIONS.get(formation, FORMATIONS["4-3-3"])
    slots = [(50.0, 90.0)]
    k = len(lines)
    for li, count in enumerate(lines):
        y = 74 - li * (62 / (k - 1)) if k > 1 else 44
        for j in range(count):
            slots.append((((j + 1) / (count + 1)) * 100, y))
    return slots


def render_xi_png(formation, names) -> bytes:
    from PIL import Image, ImageDraw, ImageFont
    import os
    W, H = 1080, 1350
    img = Image.new("RGB", (W, H), "#0b1428")
    d = ImageDraw.Draw(img)
    fp = os.path.join(os.path.dirname(__file__), "assets", "fonts", "DejaVuSans.ttf")

    def font(sz):
        try:
            return ImageFont.truetype(fp, sz)
        except Exception:
            return ImageFont.load_default(sz)

    # header
    d.text((48, 40), "PITCHVISION", font=font(30), fill="#38bdf8")
    d.text((W - 48, 44), formation, font=font(30), fill="#ffffff", anchor="ra")
    d.text((48, 84), "MY STARTING XI", font=font(22), fill="#94a3b8")

    # pitch
    px, py, pw, ph = 60, 150, W - 120, H - 230
    d.rounded_rectangle([px, py, px + pw, py + ph], radius=18, fill="#357a45")
    d.rectangle([px + 16, py + 16, px + pw - 16, py + ph - 16], outline="#ffffff55", width=2)
    d.line([(px + 16, py + ph / 2), (px + pw - 16, py + ph / 2)], fill="#ffffff55", width=2)
    d.ellipse([px + pw / 2 - 60, py + ph / 2 - 60, px + pw / 2 + 60, py + ph / 2 + 60], outline="#ffffff55", width=2)

    slots = _xi_slots(formation)
    for i, (sx, sy) in enumerate(slots):
        cx = px + 16 + (sx / 100) * (pw - 32)
        cy = py + 16 + (sy / 100) * (ph - 32)
        d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill="#0b1428", outline="#ffffff", width=3)
        name = names[i] if i < len(names) and names[i] else "—"
        # last name only for space
        short = name.split()[-1] if name and name != "—" else "+"
        d.text((cx, cy + 30), short, font=font(20), fill="#ffffff", anchor="ma")

    d.text((W // 2, H - 36), "Build yours at pitchvision.app", font=font(22), fill="#64748b", anchor="ma")
    from io import BytesIO
    buf = BytesIO(); img.save(buf, format="PNG"); return buf.getvalue()


def xi_share_page_html(formation, p):
    img = f"{ORIGIN}/api/share/xi.png?f={formation}&p={p}"
    title = f"My {formation} Starting XI | PitchVision"
    desc = f"Check out my {formation} starting XI, built on PitchVision."
    target = f"{ORIGIN}/line-builder"
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<meta name="description" content="{desc}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="PitchVision" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{desc}" />
<meta property="og:url" content="{target}" />
<meta property="og:image" content="{img}" />
<meta property="og:image:width" content="1080" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title}" />
<meta name="twitter:description" content="{desc}" />
<meta name="twitter:image" content="{img}" />
</head><body>
<p>Opening <a href="{target}">PitchVision</a>…</p>
<script>window.location.replace({target!r})</script>
</body></html>"""


def share_page_html(label, tab_key, v=""):
    from urllib.parse import quote_plus

    safe_tab = quote_plus(str(tab_key))
    safe_v = quote_plus(str(v)) if v else ""
    cache_key = f"&v={safe_v}" if safe_v else ""
    img = f"{ORIGIN}/api/share/wc-leaders.png?tab={safe_tab}{cache_key}"
    title = f"{label} Leaders — FIFA World Cup 2026 | PitchVision"
    desc = f"The {label.lower()} leaders at the FIFA World Cup 2026, live on PitchVision."
    share_url = f"{ORIGIN}/share/wc-leaders/{safe_tab}?v={safe_v}" if safe_v else f"{ORIGIN}/share/wc-leaders/{safe_tab}"
    target = f"{ORIGIN}/world-cup"
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<meta name="description" content="{desc}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="PitchVision" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{desc}" />
<meta property="og:url" content="{share_url}" />
<meta property="og:image" content="{img}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title}" />
<meta name="twitter:description" content="{desc}" />
<meta name="twitter:image" content="{img}" />
<meta name="twitter:image:alt" content="{title}" />
</head><body>
<p>Opening <a href="{target}">PitchVision</a>…</p>
<!-- JS-only redirect: crawlers (which don't run JS) read the card above; humans
     get sent into the app. No meta-refresh, or the scraper follows it and reads
     the destination's generic tags instead of this leaderboard card. -->
<script>window.location.replace({target!r})</script>
</body></html>"""
