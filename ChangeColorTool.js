/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets */

define(function (require, exports, module) {

    "use strict";

    const EditorManager = brackets.getModule("editor/EditorManager");
    const tinycolor = require("node_modules/tinycolor2/tinycolor");

    const CrownConnection = require("CrownConnection");
    const ModifierKeys = require("ModifierKeys");
    const PredefinedData = require("PredefinedData");
    const Options = require("Options");

    const TOOL_ID = "ChangeColor";
    const TOOL_WITH_PREDEFINED_ID = "ChangeColorWithPredefined";

    const TEST_NAME_REGEX = new RegExp(
        "\\b" + Object.keys(tinycolor.names).sort((a, b) => b.length - a.length).join("\\b|\\b") + "|\\btransparent\\b", 
        "gi"
    );
    const TEST_HEX_REGEX = /#[0-9a-f]{8}|#[0-9a-f]{6}|#[0-9a-f]{4}|#[0-9a-f]{3}/gi;
    const TEST_RGB_HSL_REGEX = /rgba?\([0-9, %.]+\)|hsla?\([0-9, %.\-]+\)/gi;
    const TEST_NUMBER_REGEX = /-?\d*\.?\d+/g;

    const UPDATE_UI_TIMEOUT = 150;
    let updateUIOnTouchTimeout;

    let currentToolId = TOOL_ID;
    let enabled = false;
    
    let originCounter = 0;
    let lastSelection = null;
    let colorsData = {};
    
    let predefinedColorIndex = 0;
    let predefinedColors = [];
    let predefinedTinyColors = [];

    PredefinedData.onChange(function (data) {
        predefinedColors = data ? (data.colors || []) : [];
        predefinedTinyColors = predefinedColors.map(color => tinycolor(color));
    });

    function getMatchForSelection(text, regex, selection) {
        regex.lastIndex = 0;

        let match = regex.exec(text);
        while (match && !(match.index <= selection.start.ch && match.index + match[0].length >= selection.start.ch)) {
            match = regex.exec(text);
        }

        return match;
    }

    function updateUI(nameValueArray) {
        clearTimeout(updateUIOnTouchTimeout);
        CrownConnection.updateTool(exports.getToolId(), nameValueArray);
    }

    function getUpdateToolFromHsl(hsl, option) {
        if (!hsl) return [];
        return [
            {
                name: option,
                value: String(option === "Alpha" ? Math.round((typeof hsl.a === "number" ? hsl.a : 1) * 100) / 100 : Math.round(
                    hsl[option.substr(0, 1).toLowerCase()] * (option.match(/Lightness|Saturation/i) ? 100 : 1)
                ))
            }
        ];
    }

    function getChangeByValue(option) {
        switch (option) {
            case "Alpha":
                switch (true) {
                    case ModifierKeys.ctrlKey && ModifierKeys.altKey: return 0.001;
                    case ModifierKeys.shiftKey: return 0.2;
                    case ModifierKeys.ctrlKey: return 0.1;
                    case ModifierKeys.altKey: return 0.01;
                    default: return 0.05;
                }
                break;

            case "Hue":
                switch (true) {
                    case ModifierKeys.ctrlKey && ModifierKeys.altKey: return 0.25;
                    case ModifierKeys.shiftKey: return 20;
                    case ModifierKeys.ctrlKey: return 10;
                    case ModifierKeys.altKey: return 1;
                    default: return 5;
                }
                break;

            default:
                switch (true) {
                    case ModifierKeys.altKey && ModifierKeys.shiftKey: return 0.2;
                    case ModifierKeys.ctrlKey && ModifierKeys.altKey: return 1 / 3;
                    case ModifierKeys.shiftKey: return 20;
                    case ModifierKeys.ctrlKey: return 10;
                    case ModifierKeys.altKey: return 1;
                    default: return 5;
                }
        }
    }

    function allChangingValuesAreTheSame(option, changes) {
        const firstFormat = changes[0].format.replace(/a$/, "").replace(/#|name/, "rgb");

        return changes.every(function (change) {
            const comparingSameFormats = firstFormat === change.format.replace(/a$/, "").replace(/#[0-9]*|name/, "rgb");
            
            switch (option) {
                case "Hue":
                    return (comparingSameFormats && change.updatedHsl.h === changes[0].updatedHsl.h) ||
                        (!comparingSameFormats && Math.abs(change.updatedHsl.h - changes[0].updatedHsl.h) <= 1);

                case "Saturation":
                    return (comparingSameFormats && change.updatedHsl.s === changes[0].updatedHsl.s) ||
                        (!comparingSameFormats && Math.abs(change.updatedHsl.s - changes[0].updatedHsl.s) <= 1);

                case "Lightness":
                    return (comparingSameFormats && change.updatedHsl.l === changes[0].updatedHsl.l) ||
                        (!comparingSameFormats && Math.abs(change.updatedHsl.l - changes[0].updatedHsl.l) <= 1);

                case "Alpha":
                    return change.updatedHsl.a === changes[0].updatedHsl.a;

                default: return false;
            }
        });
    }

    function setInitialColorData(colorText, colorHsl, index) {
        const colorHslFromText = colorText.match(/^hsl/i) ? colorText.match(/[0-9]+/ig) : null;

        if (colorHsl.l === 1 || colorHsl.h === 0) {
            colorsData[index].hueLost = true;
            colorsData[index].hue = colorHslFromText ? parseFloat(colorHslFromText[0]): 0;
        }

        if (colorHsl.l === 1 || colorHsl.s === 0) {
            colorsData[index].saturationLost = true;
            colorsData[index].saturation = colorHslFromText ? (parseFloat(colorHslFromText[1]) / 100): 0;
        }

        if (colorsData[index].hueLost !== true) {
            colorsData[index].hue = colorHsl.h;
        }

        if (colorsData[index].saturationLost !== true) {
            colorsData[index].saturation = colorHsl.s;
        }

        switch (true) {
            case !!colorText.match(/^#/i):
                colorsData[index].format = "#" + (colorText.length - 1);
                break;

            case !!colorText.match(/^rgb/i):
                colorsData[index].format = "rgb" + (colorText.match(/^rgba/i) ? "a": "");
                break;

            case !!colorText.match(/^hsl/i):
                colorsData[index].format = "hsl" + (colorText.match(/^hsla/i) ? "a": "");
                break;

            case !!tinycolor.names[colorText] || colorText === "transparent":
                colorsData[index].format = "name";
                break;
        }
    }

    function changeColor(tinycolorColor, option, byValue, incOrDec, currentHsl, index) {
        let afterChangeHsl;

        switch (option) {
            case "Hue":
                if (colorsData[index].hueLost) {
                    colorsData[index].hue += (byValue * incOrDec);
                    colorsData[index].hue %= 360;
                    if (colorsData[index].hue < 0) {
                        colorsData[index].hue = 360 + colorsData[index].hue;
                    }
                    break;
                }

                tinycolorColor.spin(byValue * incOrDec);
                colorsData[index].hue = tinycolorColor.toHsl().h;
                break;

            case "Saturation":
                if (colorsData[index].saturationLost) {
                    colorsData[index].saturation += ((byValue / 100) * incOrDec);
                    colorsData[index].saturation = Math.min(1, Math.max(0, colorsData[index].saturation));
                    break;
                }

                tinycolorColor.saturate(byValue * incOrDec);
                afterChangeHsl = tinycolorColor.toHsl();
                colorsData[index].saturation = afterChangeHsl.s;

                if (afterChangeHsl.s === 0 || (currentHsl.h && !afterChangeHsl.h)) {
                    colorsData[index].hueLost = true;
                }

                if (currentHsl.s && afterChangeHsl.s > 0 && currentHsl.l > 0) {
                    colorsData[index].hueLost = false;
                }
                break;

            case "Lightness":
                tinycolorColor.lighten(byValue * incOrDec);
                afterChangeHsl = tinycolorColor.toHsl();

                if (afterChangeHsl.l === 1 || afterChangeHsl.l === 0 || (currentHsl.h && !afterChangeHsl.h)) {
                    colorsData[index].hueLost = true;
                }

                if (afterChangeHsl.l === 1 || afterChangeHsl.l === 0 || (currentHsl.s && !afterChangeHsl.s)) {
                    colorsData[index].saturationLost = true;
                }

                if (!currentHsl.h && afterChangeHsl.l > 0 && afterChangeHsl.s > 0) {
                    colorsData[index].hueLost = false;
                }

                if (!currentHsl.s && afterChangeHsl.l > 0 && afterChangeHsl.s > 0) {
                    colorsData[index].saturationLost = false;
                }
                break;

            case "Alpha":
                tinycolorColor.setAlpha(Math.max(0, tinycolorColor.getAlpha() + (byValue * incOrDec)));
                break;
        }

        return tinycolorColor;
    }

    function updateColor(tinycolorColor, updatedHsl, index) {
        let updatedText = "";

        switch (colorsData[index].format) {
            case "#8":
                updatedText = tinycolorColor.toHex8String(false);
                break;

            case "#4":
                updatedText = tinycolorColor.toHex8String(true);
                break;

            case "#6":
                if (tinycolorColor.getAlpha() < 1) {
                    updatedText = tinycolorColor.toRgbString();
                } else {
                    updatedText = tinycolorColor.toHexString(false);
                }
                break;

            case "#3":
                if (tinycolorColor.getAlpha() < 1) {
                    updatedText = tinycolorColor.toRgbString();
                } else {
                    updatedText = tinycolorColor.toHexString(true);
                }
                break;

            case "rgb":
                updatedText = tinycolorColor.toRgbString();
                break;

            case "rgba":
                updatedText = tinycolorColor.toRgbString();
                if (!updatedText.match(/^rgba/i)) {
                    updatedText = updatedText.replace(/^rgb/i, "rgba")
                        .replace(/\)/i, ", 1)");
                }
                break;

            case "hsl":
                updatedText = tinycolorColor.toHslString();
                break;

            case "hsla":
                updatedText = tinycolorColor.toHslString();
                if (!updatedText.match(/^hsla/i)) {
                    updatedText = updatedText.replace(/^hsl/i, "hsla")
                        .replace(/\)/i, ", 1)");
                }
                break;

            case "name":
                if (tinycolorColor.getAlpha() === 1 && tinycolor.hexNames[tinycolorColor.toHex(true)]) {
                    updatedText = tinycolor.hexNames[tinycolorColor.toHex(true)];
                    break;
                }

                if (tinycolorColor.getAlpha() === 0) {
                    updatedText = "transparent";
                    break;
                }

                updatedText = tinycolorColor.toRgbString();
                break;

            default:
                updatedText = tinycolorColor.toString(tinycolorColor.getFormat());
        }

        //allow 0.xxx value for alpha
        const updatedAlphaString = String(tinycolorColor.getAlpha());
        if (updatedAlphaString.length >= 5 && updatedText.match(/^hsla|^rgba/i)) {
            const updatedAlpha = updatedAlphaString.length > 5 ? Math.round(tinycolorColor.getAlpha() * 1000) / 1000: updatedAlphaString;
            updatedText = updatedText.replace(/1\)|0\.[0-9]+\)$/, updatedAlpha + ")");
        }
        ///

        //always use all hsl values
        if (updatedText.match(/^hsl/)) {
            if (+updatedText.match(/[0-9]+/g)[0] === 0 && colorsData[index].hue !== 0) {
                updatedText = updatedText.replace(/^(hsla?\()0/, "$1" + Math.round(colorsData[index].hue));
                updatedHsl.h = colorsData[index].hue;
            }

            if (+updatedText.match(/[0-9]+/g)[1] === 0 && colorsData[index].saturation !== 0) {
                updatedText = updatedText.replace(/^(hsla?\([0-9.]+, )0/, "$1" + Math.round(colorsData[index].saturation * 100));
                updatedHsl.s = colorsData[index].saturation;
            }
        }
        ///

        return updatedText;
    }

    exports.disable = function () {
        clearTimeout(updateUIOnTouchTimeout);
        enabled = false;
    };

    CrownConnection.on("crown_touch_event", function (crownMsg) {
        clearTimeout(updateUIOnTouchTimeout);
        
        if (enabled && crownMsg.touch_state) {
            updateUIOnTouchTimeout = setTimeout(function() {
                updateUI([{name: "", value: ""}]);
            }, UPDATE_UI_TIMEOUT);
        }
    });

    exports.getDefaultOptions = function () {
        return [
            {
                key: "change-color-low-priority",
                value: true,
                type: "boolean"
            }
        ];
    };

    exports.getOptions = function () {
        return {
            tool: "Colors",
            list: [
                {
                    type: "checkbox",
                    options: [
                        {
                            label: "Numbers have higher priority then colors",
                            key: "change-color-low-priority"
                        }
                    ]
                }
            ]
        };
    };

    exports.shouldBeUsed = function () {
        const editor = EditorManager.getActiveEditor();
        if (!editor) return false;

        const selections = editor.getSelections();
        const isColor = selections.some(function (selection) {
            const currentLineNumber = selection.start.line;
            const currentLine = editor.document.getLine(currentLineNumber);

            let selectedNumberMatch = false;
            let selectedColorMatch = getMatchForSelection(currentLine, TEST_HEX_REGEX, selection);
            if (!selectedColorMatch)  {
                selectedColorMatch = getMatchForSelection(currentLine, TEST_RGB_HSL_REGEX, selection);
                if (selectedColorMatch) {
                    if (Options.get("change-color-low-priority") === true) {
                        selectedNumberMatch = getMatchForSelection(currentLine, TEST_NUMBER_REGEX, selection);
                    }
                } else {
                    selectedColorMatch = getMatchForSelection(currentLine, TEST_NAME_REGEX, selection);
                }
            }

            return selectedColorMatch && !selectedNumberMatch;
        });

        return isColor;
    };

    exports.getToolId = function () {
        currentToolId = predefinedColors.length ? TOOL_WITH_PREDEFINED_ID: TOOL_ID;
        return currentToolId;
    };

    exports.use = function () {
        enabled = true;
        CrownConnection.changeTool(exports.getToolId());
    };

    exports.update = function (crownMsg) {
        if (crownMsg.task_options.current_tool !== exports.getToolId()) {
            return;
        }

        if (!crownMsg.ratchet_delta || !crownMsg.delta) {
            return;
        }

        const editor = EditorManager.getActiveEditor();
        if (!editor) return;

        const origin = "crowncontrol.changecolor" + originCounter++;
        const option = crownMsg.task_options.current_tool_option;
        const incOrDec = (crownMsg.ratchet_delta || crownMsg.delta) > 0 ? 1: -1;
        const changeByValue = getChangeByValue(option);
        const inlineTextPositionChange = {};
        let selections = editor.getSelections();
        let isSameSelection = false;
        let changes;

        selections = selections.map(function (selection) {
            const currentLineNumber = selection.start.line;
            const currentLine = editor.document.getLine(currentLineNumber);

            inlineTextPositionChange[currentLineNumber] = inlineTextPositionChange[currentLineNumber] || 0;
            let selectedColorMatch = getMatchForSelection(currentLine, TEST_HEX_REGEX, selection);
            if (!selectedColorMatch)  {
                selectedColorMatch = getMatchForSelection(currentLine, TEST_RGB_HSL_REGEX, selection);
                if (!selectedColorMatch)  {
                    selectedColorMatch = getMatchForSelection(currentLine, TEST_NAME_REGEX, selection);
                }
            }

            if (selectedColorMatch) {
                const currentText = selectedColorMatch[0];
                const currentTextRange = {
                    start: {
                        line: currentLineNumber,
                        ch: selectedColorMatch.index
                    },
                    end: {
                        line: currentLineNumber,
                        ch: selectedColorMatch.index + currentText.length
                    }
                };

                return {
                    currentText: currentText,
                    currentLineNumber: currentLineNumber,
                    selectedColorMatch: selectedColorMatch,
                    currentTextRange: currentTextRange
                };
            }

            return null;
        });
        selections = selections.filter(selection => !!selection);

        isSameSelection = lastSelection === JSON.stringify(selections.map(selection => [selection.currentTextRange, selection.currentText]));
        if (!isSameSelection) {
            colorsData = {};
        }

        if (option === "Predefined") {
            if (!isSameSelection) {
                predefinedColorIndex = incOrDec ? -1: 0;
                const firstHsl = tinycolor(selections[0].currentText).toHslString();

                predefinedTinyColors.some(function (tinycolor, t) {
                    if (selections[0].currentText === predefinedColors[t] || firstHsl === tinycolor.toHslString()) {
                        predefinedColorIndex = t;
                        return true;
                    }
                });
            }

            predefinedColorIndex = (predefinedColorIndex + incOrDec) % predefinedTinyColors.length;
            predefinedColorIndex = predefinedColorIndex < 0 ? predefinedTinyColors.length - 1: predefinedColorIndex;
        }

        changes = selections.map(function (selection, s) {
            const incOrDec = (crownMsg.ratchet_delta || crownMsg.delta) > 0 ? 1: -1;
            const currentLineNumber = selection.currentLineNumber;
            const selectedColorMatch = selection.selectedColorMatch;
            const currentTextRange = selection.currentTextRange;
            const currentText = selection.currentText;
            const updatedTextRange = {
                start: {
                    line: currentLineNumber,
                    ch: selectedColorMatch.index + inlineTextPositionChange[currentLineNumber]
                },
                end: {
                    line: currentLineNumber,
                    ch: selectedColorMatch.index + currentText.length + inlineTextPositionChange[currentLineNumber]
                }
            };
            let updatedText = currentText;
            let tinycolorColor = colorsData[s] ? colorsData[s].tinycolor: tinycolor(currentText === "transparent" ? "rgba(0, 0, 0, 0)": currentText);

            const currentHsl = tinycolorColor.toHsl();
            let updatedHsl;

            if (typeof colorsData[s] === "undefined" || colorsData[s].predefined) {
                colorsData[s] = {};
                colorsData[s].tinycolor = tinycolorColor;
                setInitialColorData(currentText, currentHsl, s);
                colorsData[s].predefined = false;
            }

            if (option === "Predefined") {
                tinycolorColor = (predefinedTinyColors[predefinedColorIndex] || tinycolorColor).clone();
                colorsData[s].tinycolor = tinycolorColor;
                colorsData[s].predefined = true;
                
                updatedText = predefinedColors[predefinedColorIndex] || currentText;
                updatedHsl = tinycolorColor.toHsl();
                setInitialColorData(updatedText, updatedHsl, s);
            } else {
                changeColor(tinycolorColor, option, changeByValue, incOrDec, currentHsl, s);
                //restore hue and saturation
                updatedHsl = tinycolorColor.toHsl();
                if ((currentHsl.s === 0 && updatedHsl.s !== 0) || (currentHsl.s === 0 || updatedHsl.l !== 1)) {
                    updatedHsl.h = colorsData[s].hue;
                    updatedHsl.s = colorsData[s].saturation;
                    tinycolorColor = tinycolor(updatedHsl);
                    colorsData[s].tinycolor = tinycolorColor;
                }
                ///
                updatedText = updateColor(tinycolorColor, updatedHsl, s) || updatedText;
            }

            updatedTextRange.end.ch = currentTextRange.start.ch + updatedText.length + inlineTextPositionChange[currentLineNumber];
            inlineTextPositionChange[currentLineNumber] += updatedText.length - currentText.length;
            updatedHsl.a = typeof updatedHsl.a === "number" ? updatedHsl.a: 1;

            return {
                currentRange: currentTextRange,
                afterRange: updatedTextRange,
                replacement: updatedText,
                updatedHsl: updatedHsl,
                format: colorsData[s].format
            };
        });

        if (changes && changes.length) {
            const edits = changes.map(function (change) {
                change.currentRange.text = change.replacement;
                return {
                    edit: change.currentRange
                };
            });

            editor.document.doMultipleEdits(edits, origin);
            editor.setSelections(changes.map(change => change.afterRange), undefined, undefined, origin);
            lastSelection = JSON.stringify(changes.map(change => [change.afterRange, change.replacement]));

            if (option === "Predefined") {
                return updateUI([{name: option, value: ""}]);
            } 
            if (changes.length === 1 || allChangingValuesAreTheSame(option, changes)) {
                return updateUI(getUpdateToolFromHsl(changes[0].updatedHsl, option));
            }
            return updateUI([{name: option, value: ""}]);
        }
    };
});
