/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    const EditorManager = brackets.getModule("editor/EditorManager");
    const Decimal = require("node_modules/decimal.js/decimal");

    const CrownConnection = require("CrownConnection");
    const ModifierKeys = require("ModifierKeys");
    const Options = require("Options");

    const TOOL_IDS = {
        both: "IncOrDecNumber",
        ratchet: "IncOrDecNumberRatchet",
        noratchet: "IncOrDecNumberWithoutRatchet"
    };
    let TOOL_ID = TOOL_IDS.ratchet;

    const TEST_REGEX = /-?\d*\.?\d+/g;
    const TEST_COMMA_SPACE = /\s*,\s*|(?!,)\s+(?!,)/gi;
    const TEST_RGB_REGEX = /rgba?\([0-9, %.]+\)/gi;
    const TEST_HSL_REGEX = /hsla?\([0-9, %.\-]+\)/gi;
    const TEST_BEZIER_REGEX = /cubic-bezier\([0-9, .\-]+\)/gi;
    const TEST_LINEAR_REGEX = /linear\([0-9, %.\-]+\)/gi;
    const TEST_CSS_TRANSFORMS = /(?:scale|scaleX|scaleY|scaleZ|scale3d|matrix|matrix3d)\([0-9, .\-]+\)/gi;
    const TEST_ROTATE3D = /rotate3d\([0-9, .\-]+(?:turn|deg|rad|grad)\s*\)/gi;
    const TEST_CSS_FILTERS = /(?:brightness|contrast|grayscale|invert|opacity|saturate|sepia)\(\s*[0-9.]+%?\s*\)/gi;
    const TEST_CSS_FILTER_WITH_LENGTH_VALUES = /(?:(?:blur)\(\s*[0-9.]+[^)]+\))|(?:(?:drop-shadow)\([^)]+\)\s*\)?)/gi;
    const TEST_UNITS_WITH_SMALL_VALUES = /(?:-?\d*\.?\d+)(em|rem|cm|pc|turn|rad)/gi;
    const TEST_UNITS_MS = /(?:-?\d*\.?\d+)ms/gi;
    const TEST_UNITS_S = /(?:-?\d*\.?\d+)s/gi;
    //const TEST_POSITIVE_ONLY = /(?:(?:min-|max-)?width|(?:min-|max-)?height|flex-basis|flex-grow|flex-shrink)[: ]\s*[0-9.]+[^;'"]*(?:\s*[;'"]|\s*$)/gi;
    //const TEST_LINEHEIGHT = /line-height[: ]\s*[0-9.\-]+(?:\s*[;'"]|\s*$)/gi;
    //const TEST_OPACITY = /opacity[: ]\s*[0-9.\-]+(?:\s*[;'"]|\s*$)/gi;
    //const TEST_FONTWEIGHT = /font-weight[: ]\s*[0-9.\-]+(?:\s*[;'"]|\s*$)/gi;

    const UPDATE_UI_TIMEOUT = 150;
    let updateUIOnTouchTimeout;
    const CLEAR_LAST_SELECTION_TIMEOUT = 3000;
    let clearLastSelectionTimeout;

    let originCounter = 0;
    let enabled = false;
    let lastSelection = null;
    let lastOptionWasCross = false;
    
    let modifiersForCurrentUse = [];
    let modifiersForCurrentUseInitUpdate = false;
    let numbersNegativity = {};

    function noNegativeValue(value) {
        return Math.max(0, value);
    }

    function getMinMaxFn(min, max) {
        return value => Math.min(max, Math.max(min, value));
    }

    function smallNumberIncOrDecModifier(value) {
        const decimal = new Decimal(value);
        return Math.max(0.0001, Math.min(decimal.div(10), 1));
    }

    function smallNumberIncOrDecModifierNoLimit(value) {
        const decimal = new Decimal(value);
        return decimal.div(10).toNumber();
    }

    const MODIFIERS = [
        {//RGB(A)
            TEST: TEST_RGB_REGEX,
            VALUEFN: (function() {
                const zero100Fn = getMinMaxFn(0, 100);
                const zero1Fn = getMinMaxFn(0, 1);
                const zero255Fn = getMinMaxFn(0, 255);

                return function (match, numberPos) {
                    const values = match[0].match(/[0-9.]+%?/gi);
                    const pct = values[numberPos].indexOf("%") !== -1;
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

                const values = match[0].match(/[0-9.]+%?/gi);
                const pct = values[numberPos].indexOf("%") !== -1;
                return pct ? null: smallNumberIncOrDecModifier;
            },
            MODIFIER_OPTION_KEY: "inc-dec-number-other-step"
        },
        {//HSL(A)
            TEST: TEST_HSL_REGEX,
            VALUEFN: (function() {
                const zero100Fn = getMinMaxFn(0, 100);
                const zero1Fn = getMinMaxFn(0, 1);
                const rotate360Fn = function (value) {
                    const decimalValue = new Decimal(value);
                    return value < 0 ?
                        decimalValue.mod(360).add(360).toNumber():
                        decimalValue.mod(360).toNumber();
                };

                return function (match, numberPos) {
                    if (numberPos === 0) {
                        return rotate360Fn;
                    }

                    if (numberPos === 3) {
                        const values = match[0].match(/[0-9.]+%?/gi);
                        const pct = values[numberPos].indexOf("%") !== -1;
                        return pct ? zero100Fn: zero1Fn;
                    }
                    
                    return zero100Fn;
                };
            }()),
            MODIFIERFN: function (match, numberPos) {
                if (numberPos !== 3) {
                    return null;
                }

                const values = match[0].match(/[0-9.]+%?/gi);
                const pct = values[numberPos].indexOf("%") !== -1;
                return pct ? null: smallNumberIncOrDecModifier;
            },
            MODIFIER_OPTION_KEY: "inc-dec-number-other-step"
        },
        {//CUBIC-BEZIER
            TEST: TEST_BEZIER_REGEX,
            VALUE0: getMinMaxFn(0, 1),
            VALUE2: getMinMaxFn(0, 1),
            MODIFIER0: smallNumberIncOrDecModifier,
            MODIFIER1: smallNumberIncOrDecModifier,
            MODIFIER2: smallNumberIncOrDecModifier,
            MODIFIER3: smallNumberIncOrDecModifier,
            MODIFIER_OPTION_KEY: "inc-dec-number-other-step"
        },
        {//LINEAR
            TEST: TEST_LINEAR_REGEX,
            MODIFIERFN: function (match, numberPos, selection) {
                numberPos = findNumberPositionInSpaceAndCommaList(match, selection);
                const values = match[0].match(/[0-9.]+%?/gi);
                const pct = values[numberPos].indexOf("%") !== -1;
                return pct ? null: smallNumberIncOrDecModifierNoLimit;
            },
            MODIFIER_OPTION_KEY: "inc-dec-number-other-step"
        },
        {//BLUR
            TEST: TEST_CSS_FILTER_WITH_LENGTH_VALUES,
            VALUEFN: function (match, numberPos, selection) {
                if (match[0].match(/^\s*drop-shadow/i)) {
                    const valueStart = match[0].match(/[0-9]/) ? match[0].match(/[0-9]/).index: 0;
                    numberPos = findNumberPositionInSpaceList(match, selection, valueStart);
                    if (numberPos !== 2) {
                        return null;
                    }
                }
                
                return noNegativeValue;
            },
            MODIFIERFN: function (match, numberPos, selection) {
                if (match[0].match(/^\s*drop-shadow/i)) {
                    const valueStart = match[0].match(/[0-9]/) ? match[0].match(/[0-9]/).index: 0;
                    numberPos = findNumberPositionInSpaceList(match, selection, valueStart);
                    const unit = match[0].match(/[0-9.]+[a-z]+/gi);
                    return unit && unit[numberPos].match(TEST_UNITS_WITH_SMALL_VALUES) ? smallNumberIncOrDecModifierNoLimit: null;
                }

                const unit = match[0].match(/[0-9.]+[a-z]+/gi);
                return unit && unit[0].match(TEST_UNITS_WITH_SMALL_VALUES) ? smallNumberIncOrDecModifierNoLimit: null;
            },
            MODIFIER_OPTION_KEY: "inc-dec-number-other-step"
        },
        /*{PROBABLY TOO COMPLICATED FOR THE BENEFIT
            TEST: TEST_POSITIVE_ONLY,
            VALUE: noNegativeValue,
            MODIFIERFN: function (match) {
                const unit = match[0].match(/[0-9.]+[a-z]+/gi);
                return unit && unit[0].match(TEST_UNITS_WITH_SMALL_VALUES) ? smallNumberIncOrDecModifierNoLimit: null;
            }
        },*/
        {//REM, EM, TURN, ...
            TEST: TEST_UNITS_WITH_SMALL_VALUES,
            MODIFIER: smallNumberIncOrDecModifierNoLimit,
            MODIFIER_OPTION_KEY: "inc-dec-number-units-step"
        },
        {//MS, ...
            TEST: TEST_UNITS_MS,
            MODIFIER: function (value) {
                const decimal = new Decimal(value);
                return decimal.mul(10).toNumber();
            },
            MODIFIER_OPTION_KEY: "inc-dec-number-units-step"
        },
        {//S, ...
            TEST: TEST_UNITS_S,
            MODIFIER: function (value) {
                const decimal = new Decimal(value);
                return decimal.div(10).toNumber();
            },
            MODIFIER_OPTION_KEY: "inc-dec-number-units-step"
        },
        /*{//LINE-HEIGHT
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
                const decimal = new Decimal(value);
                return decimal.mul(100).toNumber();
            }
        },*/
        {//GRAYSCALE, ...
            TEST: TEST_CSS_FILTERS,
            VALUEFN: (function() {
                const zero1Fn = getMinMaxFn(0, 1);
                const zero100Fn = getMinMaxFn(0, 100);

                return function (match) {
                    const values = match[0].match(/[0-9.]+%?/gi);
                    const pct = values[0].indexOf("%") !== -1;
                    if (match[0].match(/sepia|opacity|grayscale|invert/)) {
                        return pct ? zero100Fn: zero1Fn;
                    }

                    return noNegativeValue;
                };
            }()),
            MODIFIERFN: function (match) {
                const values = match[0].match(/[0-9.]+%?/gi);
                const pct = values[0].indexOf("%") !== -1;
                return pct ? null: smallNumberIncOrDecModifier;
            },
            MODIFIER_OPTION_KEY: "inc-dec-number-other-step"
        },
        {//SCALE, ...
            TEST: TEST_CSS_TRANSFORMS,
            MODIFIER: smallNumberIncOrDecModifier,
            MODIFIER_OPTION_KEY: "inc-dec-number-other-step"
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
            },
            MODIFIER_OPTION_KEY: "inc-dec-number-other-step"
        }
    ];

    function getMatchForSelection(text, regex, selection) {
        regex.lastIndex = 0;

        let match = regex.exec(text);
        while (match && !(match.index <= selection.start.ch && match.index + match[0].length >= selection.start.ch)) {
            match = regex.exec(text);
        }

        return match;
    }

    function updateUI(value) {
        const isSameModifier = modifiersForCurrentUse.every(function (modifier) {
            return modifier.MODIFIER === modifiersForCurrentUse[0].MODIFIER;
        });

        if (isSameModifier && modifiersForCurrentUse[0]?.MODIFIER) {
            value = modifiersForCurrentUse[0].MODIFIER(value);
        }
        value = "\u00B1" + (isSameModifier ? value: "?");

        CrownConnection.updateTool(exports.getToolId(), [{
            name: "",
            value: value
        }]);
    }

    function findNumberPositionInSpaceList(match, selection, offset = 0) {
        let index = match[0].indexOf(" ", offset);
        let position = 0;
        while (index !== -1) {
            if (selection.start.ch - match.index > index) {
                position++;
            }
            index = match[0].indexOf(" ", index + 1);
        }
        return position;
    }

    function findNumberPositionInCommaList(match, selection) {
        let index = match[0].indexOf(",");
        let position = 0;
        while (index !== -1) {
            if (selection.start.ch - match.index > index) {
                position++;
            }
            index = match[0].indexOf(",", index + 1);
        }
        return position;
    }

    function findNumberPositionInSpaceAndCommaList(match, selection) {
        TEST_COMMA_SPACE.lastIndex = 0;
        
        let test = TEST_COMMA_SPACE.exec(match[0]);
        let position = 0;
        while (test !== null) {
            if (selection.start.ch - match.index > test.index) {
                position++;
            }
            test = TEST_COMMA_SPACE.exec(match[0]);
        }
        return position;
    }

    function findModifierForSelection(text, selection) {
        const foundModifier = {
            VALUE: null,
            MODIFIER: null
        };

        MODIFIERS.some(function (modifier) {
            const match = getMatchForSelection(text, modifier.TEST, selection);

            if (match) {
                const numberPos = findNumberPositionInCommaList(match, selection);

                foundModifier.VALUE = modifier["VALUE" + numberPos] || modifier.VALUE || null;
                foundModifier.MODIFIER = modifier["MODIFIER" + numberPos] || modifier.MODIFIER || null;
                if (modifier.VALUEFN) {
                    foundModifier.VALUE = modifier.VALUEFN(match, numberPos, selection);
                }
                if (modifier.MODIFIERFN) {
                    foundModifier.MODIFIER = modifier.MODIFIERFN(match, numberPos, selection);
                }
                if (modifier.MODIFIER_OPTION_KEY && Options.get(modifier.MODIFIER_OPTION_KEY) === false) {
                    foundModifier.MODIFIER = null;
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
            clearLastSelectionTimeout = setTimeout(
                () => (lastSelection = null), 
                CLEAR_LAST_SELECTION_TIMEOUT
            );
        }
    });

    ModifierKeys.on("change", function () {
        clearTimeout(updateUIOnTouchTimeout);

        if (enabled) {
            updateUI(getChangeByValue());
        }
    });

    exports.getDefaultOptions = function () {
        return [
            {
                key: "inc-dec-number-tool",
                value: TOOL_IDS.ratchet,
                type: "string"
            },
            {
                key: "inc-dec-number-units-step",
                value: true,
                type: "boolean"
            },
            {
                key: "inc-dec-number-other-step",
                value: true,
                type: "boolean"
            }
        ];
    };

    exports.getOptions = function () {
        return {
            tool: "Numbers",
            list: [
                {
                    title: "Tool type",
                    key: "inc-dec-number-tool",
                    type: "radio",
                    options: [
                        {
                            label: "With ratchet",
                            value: TOOL_IDS.ratchet
                        },
                        {
                            label: "Without ratchet",
                            value: TOOL_IDS.noratchet
                        },
                        {
                            label: "Both",
                            value: TOOL_IDS.both
                        }
                    ]
                },
                {
                    title: "Step",
                    type: "checkbox",
                    options: [
                        {
                            label: "Adjust step for numbers with units typically with lower/higher values (rem, ms, turn, ...)",
                            key: "inc-dec-number-units-step"
                        },
                        {
                            label: "Adjust step for other numbers typically with lower/higher values (alpha, cubic-bezier, ...)",
                            key: "inc-dec-number-other-step"
                        }
                    ]
                }
            ]
        };
    };

    exports.disable = function () {
        clearTimeout(updateUIOnTouchTimeout);
        enabled = false;
    };

    exports.shouldBeUsed = function () {
        const editor = EditorManager.getActiveEditor();
        if (!editor) return false;

        modifiersForCurrentUse = [];
        const selections = editor.getSelections();
        const isNumber = selections.some(function (selection) {
            const currentLineNumber = selection.start.line;
            const currentLine = editor.document.getLine(currentLineNumber);
            return getMatchForSelection(currentLine, TEST_REGEX, selection);
        });

        if (isNumber) {
            selections.forEach(function (selection) {
                const currentLineNumber = selection.start.line;
                const currentLine = editor.document.getLine(currentLineNumber);
                modifiersForCurrentUse.push(findModifierForSelection(currentLine, selection));
            });
            modifiersForCurrentUseInitUpdate = true;
        }

        return isNumber;
    };

    exports.getToolId = function () {
        TOOL_ID = Options.get("inc-dec-number-tool") || TOOL_ID;
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

        const editor = EditorManager.getActiveEditor();
        if (!editor) return;

        const origin = "crowncontrol.incordecnumber" + originCounter++;
        const crossDirection = !!crownMsg.task_options.current_tool_option.match(/NumberCross/i);
        const useSelection = !!crownMsg.task_options.current_tool_option.match(/PlusSelection$/i);
        const defaultChangeByValue = getChangeByValue();
        const inlineTextPositionChange = {};

        let selections = editor.getSelections();
        let isSameSelection = false;
        let changes;

        lastOptionWasCross = crossDirection;

        selections = selections.map(function (selection) {
            const currentLineNumber = selection.start.line;
            const currentLine = editor.document.getLine(currentLineNumber);
            let currentText = "";
            let selectedNumberMatch = "";
            let currentTextRange;

            inlineTextPositionChange[currentLineNumber] = inlineTextPositionChange[currentLineNumber] || 0;

            if (useSelection) {
                if (selection.start.ch === selection.end.ch) {
                    return null;
                }

                if (!currentLine.match(TEST_REGEX)) {
                    return null;
                }

                currentText = editor.document.getRange(selection.start, selection.end);
                selectedNumberMatch = {
                    index: selection.start.ch,
                    toString: () => currentText
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
        });
        selections = selections.filter(selection => !!selection);

        isSameSelection = lastSelection === JSON.stringify(selections.map(selection => [selection.currentTextRange, selection.currentText]));
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
            const currentLineNumber = selection.currentLineNumber;
            const selectedNumberMatch = selection.selectedNumberMatch;
            const currentTextRange = selection.currentTextRange;
            const currentText = selection.currentText;
            const updatedTextRange = {
                start: {
                    line: currentLineNumber,
                    ch: selectedNumberMatch.index + inlineTextPositionChange[currentLineNumber]
                },
                end: {
                    line: currentLineNumber,
                    ch: selectedNumberMatch.index + currentText.length + inlineTextPositionChange[currentLineNumber]
                }
            };
            let updatedText = currentText;
            let changeByValue = defaultChangeByValue;
            let operation = (crownMsg.ratchet_delta || crownMsg.delta) > 0 ? "add" : "sub";
            let decimalCurrentNumber = new Decimal(currentText);

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
                const afterChangeNumber = decimalCurrentNumber.toNumber();
                const modified = modifiersForCurrentUse[s].VALUE(afterChangeNumber);

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
            const edits = changes.map(function (change) {
                change.currentRange.text = change.replacement;
                return {
                    edit: change.currentRange
                };
            });

            editor.document.doMultipleEdits(edits, origin);
            editor.setSelections(changes.map(change => change.afterRange), undefined, undefined, origin);
            
            if (crossDirection) {
                lastSelection = JSON.stringify(changes.map(change => [change.afterRange, change.replacement]));
            }

            updateUI(defaultChangeByValue);
        }
    };
});
