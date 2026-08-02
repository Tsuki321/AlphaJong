#!/usr/bin/env python3
#-*-coding:utf-8-*-

import argparse
import os
import re

def addFileToString(inputString, filename):
    inputString += "\n\n"
    
    with open('src/' + filename, encoding="utf-8") as fp:
        inputString += fp.read()
        
    return inputString

def bumpVersion(version):
    """Increment the patch segment of a semver string (major.minor.patch)."""
    parts = version.split(".")
    parts[-1] = str(int(parts[-1]) + 1)
    return ".".join(parts)

REPO = "Tsuki321/AlphaJong"
BRANCH = "master"
SCRIPT_NAME = "AlphaJong.user.js"
RAW_BASE = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/{SCRIPT_NAME}"

def getCurrentVersion():
    """Read the last published version so every clean CI checkout advances it."""
    with open(SCRIPT_NAME, encoding="utf-8") as fp:
        match = re.search(r'^// @version\s+([^\s]+)', fp.read(), flags=re.MULTILINE)
    if match is None:
        raise ValueError(f"Could not find @version in {SCRIPT_NAME}")
    return match.group(1)

def main():
    parser = argparse.ArgumentParser(description="Assemble the AlphaJong userscript.")
    parser.add_argument(
        "--no-bump",
        action="store_true",
        help="Assemble without incrementing @version. Use for CI bundle validation so the "
             "test job does not consume a version number that the publish job then bumps again.",
    )
    args = parser.parse_args()

    version = getCurrentVersion()
    if not args.no_bump:
        version = bumpVersion(version)

    data = f"""// ==UserScript==
// @name         AlphaJong
// @namespace    alphajong
// @version      {version}
// @description  A Mahjong Soul Bot.
// @author       Jimboom7
// @match        https://mahjongsoul.game.yo-star.com/*
// @match        https://majsoul.com/*
// @match        https://game.maj-soul.com/*
// @match        https://game.maj-soul.net/*
// @match        https://majsoul.union-game.com/*
// @match        https://game.mahjongsoul.com/*
// @updateURL    {RAW_BASE}
// @downloadURL  {RAW_BASE}
// ==/UserScript==
"""

    if not os.path.exists("build"):
        os.mkdir("build")

    data = addFileToString(data, "parameters.js")
    data = addFileToString(data, "gui.js")
    data = addFileToString(data, "api.js")
    data = addFileToString(data, "utils.js")
    data = addFileToString(data, "logging.js")
    data = addFileToString(data, "yaku.js")
    data = addFileToString(data, "ai_offense.js")
    data = addFileToString(data, "ai_defense.js")
    data = addFileToString(data, "main.js")
        
    with open('build/AlphaJong_' + version + '.user.js', 'w', encoding="utf-8") as fp:
        fp.write(data)

    # Write stable filename for Tampermonkey auto-updates via @updateURL / @downloadURL
    with open(SCRIPT_NAME, 'w', encoding="utf-8") as fp:
        fp.write(data)

    print(f"Built version {version}")

if __name__ == "__main__":
    main()
