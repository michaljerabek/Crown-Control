/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    var EditorManager = brackets.getModule("editor/EditorManager");


    var CrownConnection = require("CrownConnection"),
        ModifierKeys = require("ModifierKeys"),

        Decimal = require("node_modules/decimal.js/decimal");


    var TOOL_ID = "IncOrDecNumber",

        TEST_REGEX = /-?\d*\.?\d+/g,
        TEST_RGB_REGEX = /rgba?\([0-9, %.]+\)/gi,
        TEST_HSL_REGEX = /hsla?\([0-9, %.\-]+\)/gi,
        TEST_BEZIER_REGEX = /cubic-bezier\([0-9, .\-]+\)/gi,
        TEST_CSS_TRANSFORMS = /(?:scale|scaleX|scaleY|scaleZ|scale3d|matrix|matrix3d)\([0-9, .\-]+\)/gi,
        TEST_ROTATE3D = /rotate3d\([0-9, .\-]+(?:turn|deg|rad|grad)\s*\)/gi,
        TEST_CSS_FILTERS = /(?:brightness|contrast|grayscale|invert|opacity|saturate|sepia)\(\s*[0-9.]+%?\s*\)/gi,
        TEST_CSS_FILTER_WITH_LENGTH_VALUES = /(?:(?:blur)\(\s*[0-9.]+[^)]+\))|(?:(?:drop-shadow)\([^)]+\)\s*\)?)/gi,
        TEST_UNITS_WITH_SMALL_VALUES = /(?:-?\d*\.?\d+)(em|rem|cm|pc|turn|rad)/gi,
        TEST_UNITS_MS = /(?:-?\d*\.?\d+)ms/gi,
        TEST_UNITS_S = /(?:-?\d*\.?\d+)s/gi,
        TEST_POSITIVE_ONLY = /(?:(?:min-|max-)?width|(?:min-|max-)?height|flex-basis|flex-grow|flex-shrink)[: ]\s*[0-9.]+[^;'"]*(?:\s*[;'"]|\s*$)/gi,
        TEST_LINEHEIGHT = /line-height[: ]\s*[0-9.\-]+(?:\s*[;'"]|\s*$)/gi,
        TEST_OPACITY = /opacity[: ]\s*[0-9.\-]+(?:\s*[;'"]|\s*$)/gi,
        TEST_FONTWEIGHT = /font-weight[: ]\s*[0-9.\-]+(?:\s*[;'"]|\s*$)/gi,

        UPDATE_UI_TIMEOUT = 150,

        CLEAR_LAST_SELECTION_TIMEOUT = 3000;


    var originCounter = 0,

        enabled = false,

        updateUIOnTouchTimeout,

        modifiersForCurrentUse = [],
        modifiersForCurrentUseInitUpdate = false,

        lastSelection = null,
        lastOptionWasCross = false,
        clearLastSelectionTimeout,

        numbersNegativity = {};

    function noNegativeValue(value) {

        return Math.max(0, value);
    }

    function getMinMaxFn(min, max) {

        return function (value) {

            return Math.min(max, Math.max(min, value));
        };
    }

    function smallNumberIncOrDecModifier(value) {

        var decimal = new Decimal(value);

        return Math.max(0.0001, Math.min(decimal.div(10), 1));
    }

    function smallNumberIncOrDecModifierNoLimit(value) {

        var decimal = new Decimal(value);

        return decimal.div(10).toNumber();
    }


    var MODIFIERS = [
        {//RGB(A)
            TEST: TEST_RGB_REGEX,
            VALUEFN: (function() {

                var zero100Fn = getMinMaxFn(0, 100),
                    zero1Fn = getMinMaxFn(0, 1),
                    zero255Fn = getMinMaxFn(0, 255);

                return function (match, numberPos) {

                    var values = match[0].match(/[0-9.]+%?/gi),

                        pct = values[numberPos].indexOf("%") !== -1;

                    if (numberPos < 3) {

                        return pct ? zero100Fn: zero255Fn;
                    }

                    return pct ? zero100Fn: zero1Fn;
                };
            }()),
            MODIFIERFN: function (match, numberPos) {

                if (numberPos !== 3) {

                    return null;
                }

                var values = match[0].match(/[0-9.]+%?/gi),

                    pct = values[numberPos].indexOf("%") !== -1;

                return pct ? null: smallNumberIncOrDecModifier;
            }
        },
        {//HSL(A)
            TEST: TEST_HSL_REGEX,
            VALUEFN: (function() {

                var zero100Fn = getMinMaxFn(0, 100),
                    zero1Fn = getMinMaxFn(0, 1),
                    rotate360Fn = function (value) {

                        var decimalValue = new Decimal(value);

                        return value < 0 ?
                            decimalValue.mod(360).add(360).toNumber():
                        decimalValue.mod(360).toNumber();
                    };

                return function (match, numberPos) {

                    if (numberPos === 0) {

                        return rotate360Fn;
                    }

                    if (numberPos === 3) {

                        var values = match[0].match(/[0-9.]+%?/gi),

                            pct = values[numberPos].indexOf("%") !== -1;

                        return pct ? zero100Fn: zero1Fn;
                    }

                    return zero100Fn;
                };
            }()),
            MODIFIERFN: function (match, numberPos) {

                if (numberPos !== 3) {

                    return null;
                }

                var values = match[0].match(/[0-9.]+%?/gi),

                    pct = values[numberPos].indexOf("%") !== -1;

                return pct ? null: smallNumberIncOrDecModifier;
            }
        },
        {//CUBIC-BEZIER
            TEST: TEST_BEZIER_REGEX,
            VALUE0: getMinMaxFn(0, 1),
            VALUE2: getMinMaxFn(0, 1),
            MODIFIER0: smallNumberIncOrDecModifier,
            MODIFIER1: smallNumberIncOrDecModifier,
            MODIFIER2: smallNumberIncOrDecModifier,
            MODIFIER3: smallNumberIncOrDecModifier
        },
        {//BLUR
            TEST: TEST_CSS_FILTER_WITH_LENGTH_VALUES,
            VALUEFN: function (match, numberPos, selection) {

                if (match[0].match(/^\s*drop-shadow/i)) {

                    var valueStart = match[0].match(/[0-9]/) ? match[0].match(/[0-9]/).index : 0;

                    numberPos = findNumberPositionInSpaceList(match, selection, valueStart);

                    if (numberPos !== 2) {

                        return null;
                    }
                }

                return noNegativeValue;
            },
            MODIFIERFN: function (match, numberPos, selection) {

                var unit;

                if (match[0].match(/^\s*drop-shadow/i)) {

                    var valueStart = match[0].match(/[0-9]/) ? match[0].match(/[0-9]/).index : 0;

                    numberPos = findNumberPositionInSpaceList(match, selection, valueStart);

                    unit = match[0].match(/[0-9.]+[a-z]+/gi);

                    return unit && unit[numberPos].match(TEST_UNITS_WITH_SMALL_VALUES) ? smallNumberIncOrDecModifierNoLimit: null;
                }

                unit = match[0].match(/[0-9.]+[a-z]+/gi);

                return unit && unit[0].match(TEST_UNITS_WITH_SMALL_VALUES) ? smallNumberIncOrDecModifierNoLimit: null;
            }
        },
        /*{PROBABLY TOO COMPLICATED FOR THE BENEFIT
            TEST: TEST_POSITIVE_ONLY,
            VALUE: noNegativeValue,
            MODIFIERFN: function (match) {

                var unit = match[0].match(/[0-9.]+[a-z]+/gi);

                return unit && unit[0].match(TEST_UNITS_WITH_SMALL_VALUES) ? smallNumberIncOrDecModifierNoLimit: null;
            }
        },*/
        {//REM, EM, TURN, ...
            TEST: TEST_UNITS_WITH_SMALL_VALUES,
            MODIFIER: smallNumberIncOrDecModifierNoLimit
        },
        {//MS, ...
            TEST: TEST_UNITS_MS,
            MODIFIER: function (value) {

                var decimal = new Decimal(value);

                return decimal.mul(10).toNumber();
            }
        },
        {//S, ...
            TEST: TEST_UNITS_S,
            MODIFIER: function (value) {

                var decimal = new Decimal(value);

                return decimal.div(10).toNumber();
            }
        },
        {//LINE-HEIGHT
            TEST: TEST_LINEHEIGHT,
            MODIFIER: smallNumberIncOrDecModifierNoLimit
        },
        {//OPACITY
            TEST: TEST_OPACITY,
            VALUE: getMinMaxFn(0, 1),
            MODIFIER: smallNumberIncOrDecModifier
        },
        {//FONT-WEIGHT
            TEST: TEST_FONTWEIGHT,
            VALUE: getMinMaxFn(0, 1000),
            MODIFIER: function (value) {

                var decimal = new Decimal(value);

                return decimal.mul(100).toNumber();
            }
        },
        {//GRAYSCALE, ...
            TEST: TEST_CSS_FILTERS,
            VALUEFN: (function() {

                var zero1Fn = getMinMaxFn(0, 1),
                    zero100Fn = getMinMaxFn(0, 100);

                return function (match) {

                    var values = match[0].match(/[0-9.]+%?/gi),

                        pct = values[0].indexOf("%") !== -1;

                    if (match[0].match(/sepia|opacity|grayscale|invert/)) {

                        return pct ? zero100Fn : zero1Fn;
                    }

                    return noNegativeValue;
                };
            }()),
            MODIFIERFN: function (match) {

                var values = match[0].match(/[0-9.]+%?/gi),

                    pct = values[0].indexOf("%") !== -1;

                return pct ? null: smallNumberIncOrDecModifier;
            }
        },
        {//SCALE, ...
            TEST: TEST_CSS_TRANSFORMS,
            MODIFIER: smallNumberIncOrDecModifier
        },
        {//ROTATE3D (?)
            TEST: TEST_ROTATE3D,
            MODIFIERFN: function (match, numberPos) {

                if (numberPos < 3) {

                    return smallNumberIncOrDecModifier;
                }

                if (numberPos === 3 && match[0].match(/turn|rad/)) {

                    return smallNumberIncOrDecModifierNoLimit;
                }

                return null;
            }
        }
    ];

    function getMatchForSelection(text, regex, selection) {

        regex.lastIndex = 0;

        var match = regex.exec(text);

        while (match && !(match.index <= selection.start.ch && match.index + match[0].length >= selection.start.ch)) {

            match = regex.exec(text);
        }

        return match;
    }

    function updateUI(value) {

        var isSameModifier = modifiersForCurrentUse.every(function (modifier) {
            return modifier.MODIFIER === modifiersForCurrentUse[0].MODIFIER;
        });

        if (isSameModifier && modifiersForCurrentUse[0] && modifiersForCurrentUse[0].MODIFIER) {

            value = modifiersForCurrentUse[0].MODIFIER(value);
        }

        value = "\u00B1" + (isSameModifier ?  value : "?");

        CrownConnection.updateTool(exports.getToolId(), [{
            name: "",
            value: value
        }]);
    }

    function findNumberPositionInSpaceList(match, selection, offset) {

        offset = offset || 0;

        var index = match[0].indexOf(" ", offset),
            position = 0;

        while (index !== -1) {

            if (selection.start.ch - match.index > index) {

                position++;
            }

            index = match[0].indexOf(" ", index + 1);
        }

        return position;
    }

    function findNumberPositionInCommaList(match, selection) {

        var index = match[0].indexOf(","),
            position = 0;

        while (index !== -1) {

            if (selection.start.ch - match.index > index) {

                position++;
            }

            index = match[0].indexOf(",", index + 1);
        }

        return position;
    }

    function findModifierForSelection(text, selection) {

        var foundModifier = {
            VALUE: null,
            MODIFIER: null
        };

        MODIFIERS.some(function (modifier) {

            var numberPos = 0,
                match = getMatchForSelection(text, modifier.TEST, selection);

            if (match) {

                numberPos = findNumberPositionInCommaList(match, selection);

                foundModifier.VALUE = modifier["VALUE" + numberPos] || modifier.VALUE || null;
                foundModifier.MODIFIER = modifier["MODIFIER" + numberPos] || modifier.MODIFIER || null;

                if (modifier.VALUEFN) {

                    foundModifier.VALUE = modifier.VALUEFN(match, numberPos, selection);
                }

                if (modifier.MODIFIERFN) {

                    foundModifier.MODIFIER = modifier.MODIFIERFN(match, numberPos, selection);
                }

                return true;
            }
        });

        return foundModifier;
    }

    function getChangeByValue() {

        switch (true) {
            case ModifierKeys.shiftKey && ModifierKeys.ctrlKey && ModifierKeys.altKey: return 0.0001;
            case ModifierKeys.shiftKey && ModifierKeys.ctrlKey: return 1000;
            case ModifierKeys.shiftKey && ModifierKeys.altKey: return 0.001;
            case ModifierKeys.shiftKey: return 100;
            case ModifierKeys.ctrlKey && ModifierKeys.altKey: return 0.01;
            case ModifierKeys.ctrlKey: return 10;
            case ModifierKeys.altKey: return 0.1;
            default: return 1;
        }
    }

    CrownConnection.on("crown_touch_event", function (crownMsg) {

        clearTimeout(updateUIOnTouchTimeout);

        if (enabled && crownMsg.touch_state) {

            clearTimeout(clearLastSelectionTimeout);

            updateUIOnTouchTimeout = setTimeout(function() {
                updateUI(getChangeByValue());
            }, UPDATE_UI_TIMEOUT);
        }

        if (enabled && !crownMsg.touch_state && lastOptionWasCross) {

            clearTimeout(clearLastSelectionTimeout);

            clearLastSelectionTimeout = setTimeout(function() {

                lastSelection = null;

            }, CLEAR_LAST_SELECTION_TIMEOUT);
        }
    });

    ModifierKeys.on("change", function () {

        clearTimeout(updateUIOnTouchTimeout);

        if (enabled) {

            updateUI(getChangeByValue());
        }
    });

    exports.disable = function () {

        clearTimeout(updateUIOnTouchTimeout);

        enabled = false;
    };

    exports.shouldBeUsed = function () {

        var editor = EditorManager.getActiveEditor();

        if (!editor) {

            return false;
        }

        modifiersForCurrentUse = [];

        var selections = editor.getSelections(),

            isNumber = selections.some(function (selection) {

                var currentLineNumber = selection.start.line,
                    currentLine = editor.document.getLine(currentLineNumber);

                return getMatchForSelection(currentLine, TEST_REGEX, selection);
            });

        if (isNumber) {

            selections.forEach(function (selection) {

                var currentLineNumber = selection.start.line,
                    currentLine = editor.document.getLine(currentLineNumber);

                modifiersForCurrentUse.push(findModifierForSelection(currentLine, selection));
            });

            modifiersForCurrentUseInitUpdate = true;
        }

        return isNumber;
    };

    exports.getToolId = function () {

        return TOOL_ID;
    };

    exports.use = function () {

        enabled = true;

        CrownConnection.changeTool(exports.getToolId());
    };

    exports.update = function (crownMsg) {

        if (crownMsg.task_options.current_tool !== TOOL_ID) {

            return;
        }

        if (!crownMsg.ratchet_delta || !crownMsg.delta) {

            return;
        }

        var editor = EditorManager.getActiveEditor();

        if (!editor) {

            return;
        }

        var selections = editor.getSelections(),

            origin = "crowncontrol.incordecnumber" + originCounter++,

            inlineTextPositionChange = {},

            defaultChangeByValue = getChangeByValue(),

            crossDirection = !!crownMsg.task_options.current_tool_option.match(/NumberCross/i),
            useSelection = !!crownMsg.task_options.current_tool_option.match(/PlusSelection$/i),
            isSameSelection = false,

            changes;

        lastOptionWasCross = crossDirection;

        selections = selections.map(function (selection) {

            var currentLineNumber = selection.start.line,
                currentLine = editor.document.getLine(currentLineNumber),

                currentText = "",
                selectedNumberMatch = "",

                currentTextRange;

            inlineTextPositionChange[currentLineNumber] = inlineTextPositionChange[currentLineNumber] || 0;

            if (useSelection) {

                if (selection.start.ch === selection.end.ch) {

                    return null;
                }

                currentText = editor.document.getRange(selection.start, selection.end);

                if (!currentLine.match(TEST_REGEX)) {

                    return null;
                }

                selectedNumberMatch = {
                    index: selection.start.ch,
                    toString: function () {
                        return currentText;
                    }
                };

                currentTextRange = {
                    start: {
                        line: selection.start.line,
                        ch: selection.start.ch
                    },
                    end: {
                        line: selection.end.line,
                        ch: selection.end.ch
                    }
                };
            } else {

                selectedNumberMatch = getMatchForSelection(currentLine, TEST_REGEX, selection);

                if (selectedNumberMatch) {

                    currentText = selectedNumberMatch[0];

                    currentTextRange = {
                        start: {
                            line: currentLineNumber,
                            ch: selectedNumberMatch.index
                        },
                        end: {
                            line: currentLineNumber,
                            ch: selectedNumberMatch.index + currentText.length
                        }
                    };
                }
            }

            if (selectedNumberMatch) {

                return {
                    selection: selection,
                    currentText: currentText,
                    currentLine: currentLine,
                    currentLineNumber: currentLineNumber,
                    selectedNumberMatch: selectedNumberMatch,
                    currentTextRange: currentTextRange
                };
            }

            return null;

        }).filter(function (selection) { return !!selection; });

        isSameSelection = lastSelection === JSON.stringify(selections.map(function (selection) { return [selection.currentTextRange, selection.currentText]; }));

        if (!isSameSelection) {

            if (!modifiersForCurrentUseInitUpdate) {

                modifiersForCurrentUse = selections.map(function (selection) {
                    return findModifierForSelection(selection.currentLine, selection.selection);
                });
            }

            numbersNegativity = {};
        }

        modifiersForCurrentUseInitUpdate = false;

        changes = selections.map(function (selection, s) {

            var currentLineNumber = selection.currentLineNumber,

                selectedNumberMatch = selection.selectedNumberMatch,

                currentTextRange = selection.currentTextRange,

                currentText = selection.currentText,
                updatedText = currentText,

                updatedTextRange = {
                    start: {
                        line: currentLineNumber,
                        ch: selectedNumberMatch.index + inlineTextPositionChange[currentLineNumber]
                    },
                    end: {
                        line: currentLineNumber,
                        ch: selectedNumberMatch.index + currentText.length + inlineTextPositionChange[currentLineNumber]
                    }
                },

                changeByValue = defaultChangeByValue,

                decimalCurrentNumber = new Decimal(currentText),

                operation = (crownMsg.ratchet_delta || crownMsg.delta) > 0 ? "add" : "sub";

            if (modifiersForCurrentUse[s] && modifiersForCurrentUse[s].MODIFIER) {

                changeByValue = modifiersForCurrentUse[s].MODIFIER(defaultChangeByValue);
            }

            if (crossDirection) {

                if (typeof numbersNegativity[s] === "undefined") {

                    numbersNegativity[s] = currentText.indexOf("-") !== -1;
                }

                if (numbersNegativity[s]) {

                    operation = operation === "add" ? "sub" : "add";
                }
            }

            decimalCurrentNumber = decimalCurrentNumber[operation](changeByValue);

            if (modifiersForCurrentUse[s] && modifiersForCurrentUse[s].VALUE) {

                var afterChangeNumber = decimalCurrentNumber.toNumber(),
                    modified = modifiersForCurrentUse[s].VALUE(afterChangeNumber);

                if (modified !== afterChangeNumber) {

                    updatedText = String(modified);

                } else {

                    updatedText = decimalCurrentNumber.toString();
                }

            } else {

                updatedText = decimalCurrentNumber.toString();
            }

            updatedTextRange.end.ch = currentTextRange.start.ch + updatedText.length + inlineTextPositionChange[currentLineNumber];

            inlineTextPositionChange[currentLineNumber] += updatedText.length - currentText.length;

            return {
                currentRange: currentTextRange,
                afterRange: updatedTextRange,
                replacement: updatedText
            };

        });

        if (changes && changes.length) {

            var edits = changes.map(function (change) {

                change.currentRange.text = change.replacement;

                return {
                    edit: change.currentRange
                };
            });

            editor.document.doMultipleEdits(edits, origin);

            editor.setSelections(changes.map(function (change) { return change.afterRange; }), undefined, undefined, origin);

            if (crossDirection) {

                lastSelection = JSON.stringify(changes.map(function (change) { return [change.afterRange, change.replacement]; }));
            }

            updateUI(defaultChangeByValue);
        }
    };
});
