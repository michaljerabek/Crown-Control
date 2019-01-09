# Crown Control — Logitech Crown (Craft) integration for [Brackets](http://brackets.io/)

*Probably won't work on macOS.*

## Installation Instructions

**This is not an official way to install custom plugin for Logitech Options. But it works.** 

On Windows: After you have [installed the extension](https://github.com/adobe/brackets/wiki/Brackets-Extensions):

1. Open Logitech Options and select your keyboard (Craft).
2. Click on `All Applications` and select `Brackets`.
3. Click on `More` > `Software` and enable `Developer Mode`.
4. Open folder with extensions for Brackets (`Help` > `Show Extensions Folder`).
5. Copy `9df01287-806d-4292-9ee4-2c6e477fee55` folder to `C:\ProgramData\Logishrd\LogiOptionsPlugins` (folder `LogiOptionsPlugins` has to be created).
6. Go to `C:\Users\[YOUR_ACCOUNT]\AppData\Roaming\Logishrd\LogiOptions`.
7. Open `apptable.xml` and find `<profile/>` for Brackets.
8. Change `<id/>` to `9df01287-806d-4292-9ee4-2c6e477fee55`. (If there are other profiles for Brackets, remove them.)
9. Copy `9df01287-806d-4292-9ee4-2c6e477fee55.xml` from the extension folder to `C:\Users\[YOUR_ACCOUNT]\AppData\Roaming\Logishrd\LogiOptions\devices\6b350\Profiles`.
10. Kill all processes in Task Manager related to Logitech Options and close Brackets (or restart your computer).
11. Run Logitech Options and Brackets.

On macOS you can use the official method, but it may not work (it didn't work for me, but I tried it only in VirtualBox):

1. Copy `9df01287-806d-4292-9ee4-2c6e477fee55` folder from the extension folder to `~/Library/Application Support/Logitech/Logitech Options/Plugins`.
2. Enable `Developer Mode` in Logitech Options (`Logitech Options` > `Craft` > `More` > `Software`).
3. Click on `All Applications` and install the profile.
4. Click on `All Applications` > `Brackets` and then `Crown` > `Press` and set it to `F9`.
5. Try it and if it works, let me know.

## Update Instructions

*This is necessary only if the profile has changed. You should be informed about that after an update.*

On Windows: 

1. Open folder with extensions for Brackets (`Help` > `Show Extensions Folder`).
2. Copy `9df01287-806d-4292-9ee4-2c6e477fee55` folder to `C:\ProgramData\Logishrd\LogiOptionsPlugins` (rewrite previous files).
3. Kill all processes in Task Manager related to Logitech Options and close Brackets (or restart your computer).
4. Run Logitech Options and Brackets.

On macOS:

1. In Logitech Options click on `All Applications`.
2. Remove profile for `Brackets` (click on cross icon).
3. Copy `9df01287-806d-4292-9ee4-2c6e477fee55` folder from the extension folder to `~/Library/Application Support/Logitech/Logitech Options/Plugins` (rewrite previous files).
4. Click on `All Applications` and install the profile.
5. Click on `All Applications` > `Brackets` and then `Crown` > `Press` and set it to `F9` (may not be necessary).


## How To Use

*This is still in experimental state.*

### Press (Crown)
Switches currently active pane or turns on *Split View*.
- `CTRL` — switches horizontal/vertical mode
- `CTRL` + `SHIFT` — turns off *Split View*
- `CTRL` + `ALT` — switches active pane and its size

**It requires `F9` and `F9 + MODIFIER_KEYS` shortcuts to be available.**

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

### Turn: Numbers

If the cursor(s) is on any number, you can increase or decrease it by a value based on the context (unit). (I'm not sure if this is a good thing.) 

Available options:

1. Increment/Decrement number — use ratchet
2. Increment/Decrement number within selections — use ratchet
3. Increment/Decrement number in opposite directions — use ratchet
4. Increment/Decrement number — do not use ratchet
5. Increment/Decrement number within selections — do not use ratchet
6. Increment/Decrement number in opposite directions — do not use ratchet


- `CTRL` — default value * 10
- `SHIFT` — default value * 100
- `CTRL` + `SHIFT` — default value * 1000
- `ALT` — default value / 10
- `CTRL` + `ALT` — default value / 100
- `ALT` + `SHIFT` — default value / 1000
- `CTRL` + `ALT` + `SHIFT` — default value / 10000


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

If the cursor(s) is on any color, you can change its hue, saturation, lightness or alpha value. The cursor has to be on non-number part of the color definition (except colors in HEX formats).

Available options:

1. Hue
2. Saturation
3. Lightness
4. Alpha

By default Hue, Saturation and Lightness increase or decrease value by 5 and Alpha by 0.05. 

- `CTRL` — larger step (HSL: 10, A: 0.1)
- `SHIFT` — even larger step (HSL: 20, A: 0.2)
- `ALT` — smaller step (HSL: 1, A: 0.01)
- `CTRL + ALT` — even smaller step (HSL: Magic numbers, A: 0.001)
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
- `CTRL + ALT` — even smaller step
- `ALT + SHIFT` — even smaller step

---

On macOS `ALT` should correspond to `OPT` and `CTRL` to `CMD`.

**Tip: ALT-GR (right ALT) works the same as left ALT, so you can use the right modifier keys.**

---

## Changelog

- 1.0.1
  - Value for `blur()` can't by negative
- 1.0.2
  - CSS properties don't require colon and semicolon
- 1.1.0
  - Added support for CSS Filters
- 1.1.1 
  - Numbers can be adjusted within selections
  - Removed detection for CSS properties (font-weight, opacity, line-height) when adjusting numbers *(too complicated to make it consistent for the entire CSS)*


