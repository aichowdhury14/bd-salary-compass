"""Turn a job-post CSV you are licensed to use into extra model anchors.

    python ingest.py posts.csv            # writes data/anchors_jobposts.csv
    python build.py                       # refits with the extra anchors

Input CSV columns: title, text (full post body), and optionally posted (date) and source.
Only posts with a stated salary and a confident job-function match and a recognisable employer are used. Posts are grouped
by function x level x employer group x city, and each group with at least MIN_POSTS posts becomes
one anchor (median of the posted salary mid-points, IQR as the range).

Do not scrape sites whose robots.txt or terms forbid it (Bdjobs.com disallows crawlers).
Use a licensed feed, an export you own, or posts you collected by hand.
"""

from __future__ import annotations

import csv
import statistics
import sys
from collections import defaultdict

from salary_compass import DATA_DIR
from salary_compass.jobpost import level_for_years, match_function, parse
from salary_compass.model import load_taxonomy

MIN_POSTS = 5
MIN_ROLE_SCORE = 3.0


def main(path: str) -> int:
    taxonomy = load_taxonomy()
    groups: dict[tuple, list[float]] = defaultdict(list)
    used = skipped = 0
    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            text = f"{row['title']}\n{row.get('text', '')}"
            post = parse(text, taxonomy)
            function, score = match_function(text, taxonomy["functions"])
            level = level_for_years(post.experience_min)
            group = post.employer_group
            if post.salary_min is None or function is None or score < MIN_ROLE_SCORE or level is None or group is None:
                skipped += 1
                continue
            key = (function, level, group, post.city or "dhaka")
            groups[key].append((post.salary_min + post.salary_max) / 2)
            used += 1

    out = DATA_DIR / "anchors_jobposts.csv"
    fields = ["id", "function", "level", "group", "city", "low", "high", "median", "range_type", "source_type",
              "sample_size", "weight", "source_name", "source_url", "published", "note"]
    n_anchors = 0
    with open(out, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for (function, level, group, city), mids in sorted(groups.items()):
            if len(mids) < MIN_POSTS:
                continue
            q = statistics.quantiles(mids, n=4) if len(mids) >= 4 else [min(mids), 0, max(mids)]
            w.writerow({
                "id": f"jp_{function}_{level}_{group}_{city}", "function": function, "level": level, "group": group, "city": city,
                "low": round(q[0]), "high": round(q[2]), "median": round(statistics.median(mids)),
                "range_type": "p25_p75", "source_type": "job_post", "sample_size": len(mids),
                "weight": min(3.0, 0.5 + len(mids) / 20), "source_name": f"Job posts ({path})", "source_url": "",
                "published": "", "note": "Median of posted salary mid-points",
            })
            n_anchors += 1
    print(f"Used {used} posts, skipped {skipped}; wrote {n_anchors} anchors to {out}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
