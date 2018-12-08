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
        TEST_UNITS = /(?:-?\d*\.?\d+)(em|rem|cm|pc|turn|rad)/gi,
        TEST_UNITS_MS = /(?:-?\d*\.?\d+)ms/gi,
        TEST_UNITS_S = /(?:-?\d*\.?\d+)s/gi,
        TEST_LINEHEIGHT = /line-height:\s*[0-9.\-]+[ ;]/gi,
        TEST_OPACITY = /opacity:\s*[0-9.\-]+[ ;]/gi,
        TEST_FONTWEIGHT = /font-weight:\s*[0-9.\-]+[ ;]/gi,

        UPDATE_UI_TIMEOUT = 150;


    var originCounter = 0,

        enabled = false,

        updateUIOnTouchTimeout,

        modifiersForCurrentUse = [],
        modifiersForCurrentUseInitUpdate = false,
        lastSelection = null,
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

                        return value < 0 ?
                            360 + (value % 360):
                        value % 360;
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
        {//REM, EM, TURN, ...
            TEST: TEST_UNITS,
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

        CrownConnection.updateTool(TOOL_ID, [{
            name: "",
            value: value
        }]);
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

            updateUIOnTouchTimeout = setTimeout(function() {
                updateUI(getChangeByValue());
            }, UPDATE_UI_TIMEOUT);
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

        CrownConnection.changeTool(TOOL_ID);
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
            isSameSelection = false,

            changes;

        selections = selections.map(function (selection) {

            var currentLineNumber = selection.start.line,
                currentLine = editor.document.getLine(currentLineNumber);

            inlineTextPositionChange[currentLineNumber] = inlineTextPositionChange[currentLineNumber] || 0;

            var selectedNumberMatch = getMatchForSelection(currentLine, TEST_REGEX, selection);

            if (selectedNumberMatch) {

                var currentText = selectedNumberMatch[0],

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

            editor.setSelections(changes.map(function (change) { return change.currentRange; }), undefined, undefined, origin);

            editor._codeMirror.replaceSelections(changes.map(function (change) { return change.replacement; }));

            editor.setSelections(changes.map(function (change) { return change.afterRange; }), undefined, undefined, origin);

            if (crossDirection) {

                lastSelection = JSON.stringify(changes.map(function (change) { return [change.afterRange, change.replacement]; }));
            }

            updateUI(defaultChangeByValue);
        }
    };
});
