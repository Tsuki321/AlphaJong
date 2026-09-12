"""Generate deterministic, independent shanten fixtures in GitHub Actions only.

The reference is MahjongRepository/mahjong, pinned to 1.4.0 by the workflow.
No reference code or runtime dependency is included in the userscript.
"""
import json
import random
import sys
from pathlib import Path

from mahjong.shanten import Shanten


def tile_string(counts):
    return "".join(
        "".join(str(index + 1) * count for index, count in enumerate(counts[start:end])) + suit
        for start, end, suit in [(0, 9, "m"), (9, 18, "p"), (18, 27, "s"), (27, 34, "z")]
        if sum(counts[start:end])
    )


def main():
    rng = random.Random(20260912)
    reference = Shanten()
    fixtures = []
    wall = [tile for tile in range(34) for _ in range(4)]
    melds = [[tile] * 3 for tile in range(34)] + [
        [suit * 9 + rank + offset for offset in range(3)]
        for suit in range(3) for rank in range(7)
    ]
    for case in range(3000):
        size = 13 + case % 2
        if case < 2000:
            tiles = rng.sample(wall, size)
        else:
            while True:
                tiles = sum((rng.choice(melds) for _ in range(4)), []) + [rng.randrange(34)] * 2
                if max(tiles.count(tile) for tile in set(tiles)) <= 4:
                    break
            rng.shuffle(tiles)
            tiles = tiles[:size]
            for _ in range(case % 3):
                tiles.pop(rng.randrange(len(tiles)))
                choices = [tile for tile in range(34) if tiles.count(tile) < 4]
                tiles.append(rng.choice(choices))
        counts = [tiles.count(tile) for tile in range(34)]
        fixtures.append({
            "hand": tile_string(counts),
            "standard": reference.calculate_shanten_for_regular_hand(counts),
            "sevenPairs": reference.calculate_shanten_for_chiitoitsu_hand(counts),
            "kokushi": reference.calculate_shanten_for_kokushi_hand(counts),
        })
    Path(sys.argv[1]).write_text(json.dumps(fixtures), encoding="utf-8")
    print(f"Generated {len(fixtures)} independent reference hands (seed 20260912).")


if __name__ == "__main__":
    main()
