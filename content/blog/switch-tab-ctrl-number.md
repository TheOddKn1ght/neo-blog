+++
date = "2026-09-13"
title = "Switch Tab with Ctrl+Number"
description = "My tiny Firefox extension that brings Ctrl+1..9 tab switching to Linux"
+++

I made a tiny Firefox extension.

On Windows and macOS, Firefox lets you jump to tabs with `Ctrl+1` … `Ctrl+8`, and `Ctrl+9` jumps to the last tab. On Linux? Nope. That bugged me enough that I just fixed it myself.

So this extension does exactly one thing:

- `Ctrl+1` … `Ctrl+8` switch to tab 1-8
- `Ctrl+9` switch to the last tab

No toolbar button, no settings page, no tracking. It just listens for those shortcuts and activates the right tab in the current window.

## Download

<a href="/downloads/switch-tab-ctrl-number-1.0.0.xpi" download>Download switch-tab-ctrl-number-1.0.0.xpi (v1.0.0, Firefox 109+)</a>

## Install

Firefox doesn't let you install random `.xpi` files with one click from a personal site, so:

1. Download the file above.
2. Go to `about:addons` in Firefox.
3. Click the gear icon → **Install Add-on From File…**
4. Pick the downloaded `.xpi` and confirm.

Or drag-and-drop the `.xpi` file onto a Firefox window.

After that, just press `Ctrl+1` … `Ctrl+9` and enjoy Windows-style tab switching on Linux.

## Source code

The whole thing is two files. That's it.

`background.js`:

```js
const switchToTab = async (slot) => {
  const tabs = await browser.tabs.query({ currentWindow: true });
  if (tabs.length === 0) return;
  const ordered = tabs.slice().sort((a, b) => a.index - b.index);
  const target = slot === 9 ? ordered[ordered.length - 1] : ordered[slot - 1];
  if (target) await browser.tabs.update(target.id, { active: true });
};

browser.commands.onCommand.addListener((name) => {
  const match = /^switch-to-tab-([1-9])$/.exec(name);
  if (!match) return;
  switchToTab(parseInt(match[1], 10));
});
```

`manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Switch Tab with Ctrl+Number",
  "version": "1.0.0",
  "description": "Switch tabs with Ctrl+1..8 (and Ctrl+9 for last tab) on Linux Firefox, matching the Windows/macOS behavior.",
  "browser_specific_settings": {
    "gecko": {
      "id": "switch-tab-ctrl-number@dmitryside",
      "strict_min_version": "109.0",
      "data_collection_permissions": {
        "required": [
          "none"
        ]
      }
    }
  },
  "background": {
    "scripts": [
      "background.js"
    ]
  },
  "commands": {
    "switch-to-tab-1": {
      "suggested_key": {
        "default": "Ctrl+1"
      },
      "description": "Switch to tab 1"
    },
    "switch-to-tab-2": {
      "suggested_key": {
        "default": "Ctrl+2"
      },
      "description": "Switch to tab 2"
    },
    "switch-to-tab-3": {
      "suggested_key": {
        "default": "Ctrl+3"
      },
      "description": "Switch to tab 3"
    },
    "switch-to-tab-4": {
      "suggested_key": {
        "default": "Ctrl+4"
      },
      "description": "Switch to tab 4"
    },
    "switch-to-tab-5": {
      "suggested_key": {
        "default": "Ctrl+5"
      },
      "description": "Switch to tab 5"
    },
    "switch-to-tab-6": {
      "suggested_key": {
        "default": "Ctrl+6"
      },
      "description": "Switch to tab 6"
    },
    "switch-to-tab-7": {
      "suggested_key": {
        "default": "Ctrl+7"
      },
      "description": "Switch to tab 7"
    },
    "switch-to-tab-8": {
      "suggested_key": {
        "default": "Ctrl+8"
      },
      "description": "Switch to tab 8"
    },
    "switch-to-tab-9": {
      "suggested_key": {
        "default": "Ctrl+9"
      },
      "description": "Switch to last tab"
    }
  }
}
```

No bundlers, no minified blob, no network requests. It queries the tabs in the current window, picks the one at the requested index (or the last one for `Ctrl+9`), and activates it.

## Check it yourself

An `.xpi` is just a `.zip`. You don't have to trust the code block above. Inspect the exact file you're installing:

```sh
# 1. Download it, then list what's inside
unzip -l switch-tab-ctrl-number-1.0.0.xpi

# 2. Unpack it somewhere
mkdir ext-src && unzip switch-tab-ctrl-number-1.0.0.xpi -d ext-src
ls -R ext-src

# 3. Read the actual code
cat ext-src/manifest.json
cat ext-src/background.js
```

You'll see `background.js`, `manifest.json`, plus a `META-INF/` folder. That folder (`cose.sig`, `mozilla.rsa`, etc.) is Mozilla's signature — it's what lets Firefox install the file without complaining about it being unsigned. You can ignore it for review purposes; the executable part is only the two files above.

Optional, verify the download wasn't corrupted/tampered with in transit:

```sh
sha256sum switch-tab-ctrl-number-1.0.0.xpi
# expected: 239813cbb50b615608527fd364bab75ea6c1e853b6266cc58e6ab5b579e4e90c
```

If the hash matches and the two source files match what's posted here, you're running exactly what I wrote.
