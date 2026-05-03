#!/usr/bin/env python3
"""
Fetch 2026 Steamer projections and 2025 actual stats from FanGraphs.
Outputs projections.json in the same directory, keyed by MLBAM player ID.

Usage:
    pip install requests
    python src/scripts/fetch_projections.py

The resulting projections.json is read by seed.ts during the seed run.
"""

import requests
import json
import os
import sys
import time

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://www.fangraphs.com/",
    "Accept": "application/json",
}

BASE = "https://www.fangraphs.com/api"

ENDPOINTS = {
    "proj_hitters":   f"{BASE}/projections?type=steamerr&stats=bat&pos=all&team=0&players=0&lg=all",
    "proj_pitchers":  f"{BASE}/projections?type=steamerr&stats=pit&pos=all&team=0&players=0&lg=all",
    "prev_hitters":   f"{BASE}/leaders/major-league/data?pos=all&stats=bat&lg=all&qual=0&season=2025&season1=2025&month=0&hand=&team=0&pageitems=2000&pagenum=1&type=8&ind=0",
    "prev_pitchers":  f"{BASE}/leaders/major-league/data?pos=all&stats=pit&lg=all&qual=0&season=2025&season1=2025&month=0&hand=&team=0&pageitems=2000&pagenum=1&type=8&ind=0",
}


def fetch(url: str, label: str) -> list:
    print(f"  Fetching {label}...")
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        print(f"  ERROR fetching {label}: {e}", file=sys.stderr)
        return []

    # FanGraphs returns either a bare list or a dict with a "data" key
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("data", "people", "players"):
            if key in data and isinstance(data[key], list):
                return data[key]
    print(f"  WARNING: unexpected response shape for {label}", file=sys.stderr)
    return []


def mlbam_id(row: dict) -> int | None:
    """Try known field name variants for the MLBAM player ID."""
    for key in ("MLBAMID", "mlbamid", "xMLBAMID", "mlb_id", "MLBID"):
        val = row.get(key)
        if val is not None:
            try:
                return int(val)
            except (ValueError, TypeError):
                pass
    return None


def player_name(row: dict) -> str:
    for key in ("PlayerName", "Name", "name", "fullName"):
        val = row.get(key)
        if val:
            return str(val)
    return ""


def safe_float(row: dict, *keys: str, digits: int = 3) -> float | None:
    for key in keys:
        val = row.get(key)
        if val is not None and val != "":
            try:
                return round(float(val), digits)
            except (ValueError, TypeError):
                pass
    return None


def safe_int(row: dict, *keys: str) -> int | None:
    for key in keys:
        val = row.get(key)
        if val is not None and val != "":
            try:
                return int(float(val))
            except (ValueError, TypeError):
                pass
    return None


def build_hitter_proj(row: dict) -> dict:
    return {
        "hr":  safe_int(row, "HR"),
        "rbi": safe_int(row, "RBI"),
        "r":   safe_int(row, "R"),
        "sb":  safe_int(row, "SB"),
        "avg": safe_float(row, "AVG", digits=3),
    }


def build_pitcher_proj(row: dict) -> dict:
    return {
        "w":    safe_int(row, "W"),
        "era":  safe_float(row, "ERA", digits=2),
        "whip": safe_float(row, "WHIP", digits=2),
        "k":    safe_int(row, "SO", "K", "SO9"),
        "sv":   safe_int(row, "SV"),
        "ip":   safe_float(row, "IP", digits=1),
    }


def build_hitter_prev(row: dict) -> dict:
    return {
        "games": safe_int(row, "G"),
        "hr":    safe_int(row, "HR"),
        "rbi":   safe_int(row, "RBI"),
        "r":     safe_int(row, "R"),
        "sb":    safe_int(row, "SB"),
        "avg":   safe_float(row, "AVG", digits=3),
    }


def build_pitcher_prev(row: dict) -> dict:
    return {
        "w":    safe_int(row, "W"),
        "era":  safe_float(row, "ERA", digits=2),
        "whip": safe_float(row, "WHIP", digits=2),
        "k":    safe_int(row, "SO", "K"),
        "sv":   safe_int(row, "SV"),
        "ip":   safe_float(row, "IP", digits=1),
    }


def main():
    players: dict[int, dict] = {}

    # --- 2026 Steamer projections ---
    for row in fetch(ENDPOINTS["proj_hitters"], "2026 Steamer hitter projections"):
        mid = mlbam_id(row)
        if not mid:
            continue
        players[mid] = {
            "name": player_name(row),
            "mlbamId": mid,
            "isPitcher": False,
            "projStats": build_hitter_proj(row),
            "prevStats": None,
        }

    time.sleep(1)

    for row in fetch(ENDPOINTS["proj_pitchers"], "2026 Steamer pitcher projections"):
        mid = mlbam_id(row)
        if not mid:
            continue
        players[mid] = {
            "name": player_name(row),
            "mlbamId": mid,
            "isPitcher": True,
            "projStats": build_pitcher_proj(row),
            "prevStats": None,
        }

    time.sleep(1)

    # --- 2025 actual stats ---
    for row in fetch(ENDPOINTS["prev_hitters"], "2025 actual hitter stats"):
        mid = mlbam_id(row)
        if not mid:
            continue
        prev = build_hitter_prev(row)
        if mid in players:
            players[mid]["prevStats"] = prev
        else:
            players[mid] = {
                "name": player_name(row),
                "mlbamId": mid,
                "isPitcher": False,
                "projStats": None,
                "prevStats": prev,
            }

    time.sleep(1)

    for row in fetch(ENDPOINTS["prev_pitchers"], "2025 actual pitcher stats"):
        mid = mlbam_id(row)
        if not mid:
            continue
        prev = build_pitcher_prev(row)
        if mid in players:
            players[mid]["prevStats"] = prev
        else:
            players[mid] = {
                "name": player_name(row),
                "mlbamId": mid,
                "isPitcher": True,
                "projStats": None,
                "prevStats": prev,
            }

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "projections.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"players": {str(k): v for k, v in players.items()}}, f, indent=2)

    print(f"\nWrote {len(players)} player records to {out_path}")
    print("Run seed.ts next to import this data into MongoDB.")


if __name__ == "__main__":
    main()
