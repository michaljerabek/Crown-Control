# Crown Control — Logitech Crown (Craft) integration for [Phoenix Code](https://phcode.io/)

*Probably won't work on macOS. It was tested only inside a virtual machine, where it refuses to connect to Logitech Options. Any help with testing is welcome!*

## Installation Instructions

After you have installed the extension:

1. Open folder with extensions for Phoenix Code (`Help` > `Show Extensions Folder`).
2. Copy `11c8bb28-9fca-4489-a59f-bd11c0d689c5` folder to:
    - Windows: `C:\ProgramData\Logishrd\LogiOptionsPlugins` (folder `LogiOptionsPlugins` has to be created).
    - macOS: `~/Library/Application Support/Logitech/Logitech Options/Plugins`.
3. Open Logitech Options and select your keyboard (Craft).
4. Click on `More` > `Software` and enable `Developer Mode`.
5. Click on `All Applications` and if there is a profile for `Phoenix Code` remove it.
6. Click on `All Applications` > `Add Application` and install the profile. (If you don't see a green dot on the icon or the profile, restart Logitech Options or OS.)
7. Click on `All Applications` > `Phoenix Code` and then `Crown` > `Press` and set it to `F9` (you may need to manually choose *Keystroke* option).
8. Restart Phoenix Code.

## Update Instructions

*This is necessary only if the profile has changed. You should be informed about that after the update.*

1. Replace the profile (see installation instructions).
2. Restart Phoenix Code (possibly Logitech Options or OS).

## How To Use

### Press (Crown)
Switches currently active pane or turns on *Split View*.
- `CTRL` — switches horizontal/vertical mode
- `CTRL + SHIFT` — turns off *Split View*
- `CTRL + ALT` — switches active pane and its size

**It requires `F9` and `F9 + MODIFIER_KEYS` shortcuts to be available.**

*Note: This behavior will probably change to support more then two panes.*

### Turn: Default

Available options:

1. Horizontal scrolling (active pane)
    - `SHIFT` — vertical scrolling
    - `CTRL` — faster scrolling
    - `ALT` — inactive pane
2. Vertical scrolling (active pane)
    - `SHIFT` — horizontal scrolling
    - `CTRL` — faster scrolling
    - `ALT` — inactive pane
3. Open next / previous file (active pane)
    - `CTRL` — instantly opens next / previous file
    - `ALT` — inactive pane
4. Horizontal scrolling — inactive pane
    - `SHIFT` — vertical scrolling
    - `CTRL` — faster scrolling
    - `ALT` — active pane
5. Vertical scrolling — inactive pane
    - `SHIFT` — horizontal scrolling
    - `CTRL` — faster scrolling
    - `ALT` — active pane
6. Resize panes

*Note: This behavior will probably change to support more then two panes.*

### Turn: Numbers

If the cursor(s) is on any number, you can increase or decrease it by a value based on the context (unit). 

Available options:

1. Increment/Decrement number — use ratchet
2. Increment/Decrement number within selections — use ratchet
3. Increment/Decrement number in opposite directions — use ratchet
4. Increment/Decrement number — do not use ratchet
5. Increment/Decrement number within selections — do not use ratchet
6. Increment/Decrement number in opposite directions — do not use ratchet


- `CTRL` — default value * 10
- `SHIFT` — default value * 100
- `CTRL + SHIFT` — default value * 1000
- `ALT` — default value / 10
- `ALT + CTRL` — default value / 100
- `ALT + SHIFT` — default value / 1000
- `ALT + CTRL + SHIFT` — default value / 10000


*In opposite directions* means that *turning to the right* increases positive numbers and decreases negative numbers (and vice versa). What is it good for? For example:

```
/* CSS triangle */
div::after {
    content: "";
    
    position: absolute;
    bottom: 100%;
    left: 50%;
    
    martin-left: -10px;
    
    border: 10px solid transparent;
    border-bottom-color: white;
}
/* You can select 10px and -10px values and resize the triangle 
 * by turning the Crown. If you increase the border to 12px, 
 * the margin will be -12px (and not -8px), so the triangle 
 * will always be in the center. (From 1.1.1 this can be 
 * limitedly achieved with "Inc/Dec within selections".)
 */
```

### Turn: Colors

If the cursor(s) is on any color, you can change its hue, saturation, lightness or alpha value. The cursor has to be on non-number part of the color definition (except colors in HEX formats). You can also create a file (see below) with a list of predefined colors.

Available options:

1. Hue
2. Saturation
3. Lightness
4. Alpha
5. List?

By default Hue, Saturation and Lightness increase or decrease value by 5 and Alpha by 0.05. 

- `CTRL` — larger step (HSL: 10, A: 0.1)
- `SHIFT` — even larger step (HSL: 20, A: 0.2)
- `ALT` — smaller step (HSL: 1, A: 0.01)
- `ALT + CTRL` — even smaller step (HSL: Magic numbers, A: 0.001)
- `ALT + SHIFT` — even smaller step for Saturation and Lightness (0.2)

### Turn: CSS Filters

If the cursor(s) is on a filter definition, you can change these functions: brightness, contrast, saturate, hue-rotate, opacity and blur. The cursor has to be on non-number/non-color part of the definition and the definition must be on one line. Functions that are not used will be added to the end of the definition.

Available options:

1. Brightness
2. Contrast
3. Saturation (saturate)
4. Hue (hue-rotate)
5. Opacity
6. Blur

By default Brightness, Contrast, Saturate and Opacity increase or decrease value by 5%, Hue by 5deg and Blur by 1px.

- `CTRL` — larger step
- `SHIFT` — even larger step
- `ALT` — smaller step
- `ALT + CTRL` — even smaller step
- `ALT + SHIFT` — even smaller step

---

On macOS `ALT` should correspond to `OPT` and `CTRL` to `CMD`.

**Tip: ALT-GR (right ALT) works the same as left ALT, so you can use the right modifier keys.**

---

## Predefined values

In the project folder you can create a file named `crowncontrol.json` with predefined values. Currently supports only colors. The path to the file can be changed in the options.

```
{
    "colors": [
        "deepskyblue",
        "rgba(255, 255, 0, 0.5)"
    ]
}
```

---

## Changelog

- 1.0.1
  - Value for `blur()` can not be negative
- 1.0.2
  - CSS properties don't require colon and semicolon
  - Informs user if update requires reinstallation of profile
- 1.1.0
  - Added support for CSS Filters
  - Consistent behavior of modifier keys: `CTRL + ALT + SHIFT` -> `ALT + SHIFT`
- 1.1.1 
  - Numbers can be adjusted within selections
  - Removed detection for CSS properties (font-weight, opacity, line-height) when adjusting numbers *(too complicated to make it consistent for the entire CSS)*
- 1.1.2
  - Colors can be changed from a list with predefined colors
- 1.2.0
  - Options
- 2.0.0
  - Migration from Brackets to Phoenix Code
  - Added support for `linear()` easing when adjusting numbers 