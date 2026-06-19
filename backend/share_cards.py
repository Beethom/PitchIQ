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
    "passAccuracy": ("Pass Accuracy", _num("passAccuracy"), _pct),
    "keyPasses": ("Key Passes", _num("keyPasses"), _int_fmt),
    "xA": ("Expected Assists", _num("xA"), _f2),
    "touches": ("Touches", _num("touches"), _int_fmt),
    "oppHalfPasses": ("Passes into Opp. Half", _num("oppHalfPasses"), _int_fmt),
    "crosses": ("Crosses", _num("crosses"), _int_fmt),
    "accurateCrosses": ("Accurate Crosses", _num("accurateCrosses"), _int_fmt),
    "dribbles": ("Dribbles Completed", _num("dribbles"), _int_fmt),
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


def rank_players(players, tab_key, limit=10):
    spec = TABS.get(tab_key)
    if not spec:
        return None, None, None
    label, getter, fmt = spec
    rows = [p for p in players if (getter(p.stats or {}) or 0) > 0]
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
    top = 230
    row_h = 86
    H = top + max(1, len(rows)) * row_h + 70

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

    # header
    d.text((56, 48), "PITCHVISION", font=font(34), fill="#38bdf8")
    d.text((W - 56, 52), "STAT LEADERS", font=font(24), fill="#94a3b8", anchor="ra")
    d.text((56, 110), label.upper(), font=font(60), fill="#ffffff")
    d.text((56, 188), "FIFA World Cup 2026", font=font(26), fill="#94a3b8")
    d.line([(56, 222), (W - 56, 222)], fill="#1e293b", width=2)

    for i, r in enumerate(rows):
        y = top + i * row_h
        accent = "#facc15" if i < 3 else "#64748b"
        if i == 0:
            d.rounded_rectangle([44, y - 6, W - 44, y + row_h - 18], radius=16, fill="#0e2235")
        d.text((70, y + 8), f"{i + 1}", font=font(34), fill=accent, anchor="ma")
        d.text((118, y + 6), r["name"], font=font(34), fill="#ffffff")
        if r.get("team"):
            d.text((118, y + 48), r["team"], font=font(20, bold=False), fill="#64748b")
        d.text((W - 64, y + 16), r["value"], font=font(40), fill="#38bdf8", anchor="ra")

    d.text((W // 2, H - 34), "pitchvision.app", font=font(24), fill="#475569", anchor="ma")

    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def share_page_html(label, tab_key):
    img = f"{ORIGIN}/api/share/wc-leaders.png?tab={tab_key}"
    title = f"{label} Leaders — FIFA World Cup 2026 | PitchVision"
    desc = f"The {label.lower()} leaders at the FIFA World Cup 2026, live on PitchVision."
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
<meta property="og:url" content="{target}" />
<meta property="og:image" content="{img}" />
<meta property="og:image:width" content="1200" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title}" />
<meta name="twitter:description" content="{desc}" />
<meta name="twitter:image" content="{img}" />
<meta http-equiv="refresh" content="0; url={target}" />
</head><body>
<p>Redirecting to <a href="{target}">PitchVision</a>…</p>
<script>window.location.replace({target!r})</script>
</body></html>"""
