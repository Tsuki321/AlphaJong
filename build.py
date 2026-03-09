#!/usr/bin/env python3
#-*-coding:utf-8-*-

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

def updateVersionInSelf(new_version):
    """Rewrite the VERSION = "..." line in this script with the new version."""
    script_path = os.path.abspath(__file__)
    with open(script_path, encoding="utf-8") as fp:
        source = fp.read()
    source = re.sub(r'^VERSION = "[^"]+"', f'VERSION = "{new_version}"', source, count=1, flags=re.MULTILINE)
    with open(script_path, "w", encoding="utf-8") as fp:
        fp.write(source)

VERSION = "1.3.9"

REPO = "Tsuki321/AlphaJong"
BRANCH = "master"
SCRIPT_NAME = "AlphaJong.user.js"
RAW_BASE = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/{SCRIPT_NAME}"

def main():
    global VERSION

    # Auto-bump patch version and persist it back into this file
    VERSION = bumpVersion(VERSION)
    updateVersionInSelf(VERSION)

    data = f"""// ==UserScript==
// @name         AlphaJong
// @namespace    alphajong
// @version      {VERSION}
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
        
    with open('build/AlphaJong_' + VERSION + '.user.js', 'w', encoding="utf-8") as fp:
        fp.write(data)

    # Write stable filename for Tampermonkey auto-updates via @updateURL / @downloadURL
    with open(SCRIPT_NAME, 'w', encoding="utf-8") as fp:
        fp.write(data)

    print(f"Built version {VERSION}")

if __name__ == "__main__":
    main()
