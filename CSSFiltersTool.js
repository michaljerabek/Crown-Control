/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    var EditorManager = brackets.getModule("editor/EditorManager"),

        CrownConnection = require("CrownConnection"),
        ModifierKeys = require("ModifierKeys"),

        Decimal = require("node_modules/decimal.js/decimal");


    var TOOL_ID = "CSSFilters",

        TEST_REGEX = /(?:-[a-zA-Z\-]+-)?filter([: ]|\s*$)(?:(?:\s*(?:none|initial|inherit|unset))|(?:\s*[a-z\-]+\(([^)]*)\)\s*\)?\s*)*)/gi,
        TEST_NUMBER_REGEX = /-?\d*\.?\d+/g,

        CLEAR_LAST_SELECTION_TIMEOUT = 1000,

        UPDATE_UI_TIMEOUT = 150;


    var originCounter = 0,

        enabled = false,

        filtersData = {},

        lastSelection = null,

        clearLastSelectionTimeout,

        updateUIOnTouchTimeout;


    function getMatchForSelection(text, regex, selection) {

        regex.lastIndex = 0;

        var match = regex.exec(text);

        while (match && !(match.index <= selection.start.ch && match.index + match[0].length >= selection.start.ch)) {

            match = regex.exec(text);
        }

        return match;
    }

    function updateUI(nameValueArray) {

        clearTimeout(updateUIOnTouchTimeout);

        CrownConnection.updateTool(TOOL_ID, nameValueArray);
    }

    function getChangeByValue(unit) {

        switch (unit) {

            case "grad":
            case "deg":
            case "%":

                switch (true) {
                    case ModifierKeys.ctrlKey && ModifierKeys.altKey && ModifierKeys.shiftKey: return 0.1;
                    case ModifierKeys.ctrlKey && ModifierKeys.altKey: return 0.5;
                    case ModifierKeys.shiftKey: return 20;
                    case ModifierKeys.ctrlKey: return 10;
                    case ModifierKeys.altKey: return 1;
                    default: return 5;
                }

            case "mm":
            case "ex":
            case "pt":
            case "ch":
            case "px":

                switch (true) {
                    case ModifierKeys.ctrlKey && ModifierKeys.altKey && ModifierKeys.shiftKey: return 0.001;
                    case ModifierKeys.ctrlKey && ModifierKeys.altKey: return 0.01;
                    case ModifierKeys.shiftKey: return 20;
                    case ModifierKeys.ctrlKey: return 10;
                    case ModifierKeys.altKey: return 0.1;
                    default: return 1;
                }

            case "rad":
            case "in":
            case "cm":
            case "pc":
            case "em":
            case "rem":

                switch (true) {
                    case ModifierKeys.ctrlKey && ModifierKeys.altKey: return 0.001;
                    case ModifierKeys.shiftKey: return 10;
                    case ModifierKeys.ctrlKey: return 1;
                    case ModifierKeys.altKey: return 0.01;
                    default: return 0.1;
                }

            default:

                switch (true) {
                    case ModifierKeys.ctrlKey && ModifierKeys.altKey: return 0.001;
                    case ModifierKeys.shiftKey: return 0.2;
                    case ModifierKeys.ctrlKey: return 0.1;
                    case ModifierKeys.altKey: return 0.01;
                    default: return 0.05;
                }
        }
    }

    function allChangingValuesAreTheSame(option, changes) {

        var firstFormat = changes[0].format.replace(/a$/, "").replace(/#|name/, "rgb");

        return changes.every(function (change) {

            var comparingSameFormats = firstFormat === change.format.replace(/a$/, "").replace(/#[0-9]*|name/, "rgb");

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

    function getCrownOption(filterName) {

        switch (filterName.toLowerCase()) {
            case "brightness": return "BrightnessCSSFilter";
            case "contrast": return "ContrastCSSFilter";
            case "saturate": return "SaturateCSSFilter";
            case "hue-rotate": return "HueRotateCSSFilter";
            case "opacity": return "OpacityCSSFilter";
            case "blur": return "BlurCSSFilter";
            default: return null;
        }
    }

    function getInitValueForFilter(filterName) {

        switch (filterName.toLowerCase()) {
            case "brightness": return "100%";
            case "contrast": return "100%";
            case "saturate": return "100%";
            case "hue-rotate": return "0deg";
            case "opacity": return "100%";
            case "blur": return "0px";
            default: return null;
        }
    }

    function getFilterByCrownOption(crownOption) {

        switch (crownOption) {
            case "BrightnessCSSFilter": return "brightness";
            case "ContrastCSSFilter": return "contrast";
            case "SaturateCSSFilter": return "saturate";
            case "HueRotateCSSFilter": return "hue-rotate";
            case "OpacityCSSFilter": return "opacity";
            case "BlurCSSFilter": return "blur";
            default: return null;
        }
    }

    function limitValueForFilter(filterName, value, unit) {

        if (filterName.match(/CSSFilter$/)) {

            filterName = getFilterByCrownOption(filterName);
        }

        unit = unit || "";

        switch (filterName.toLowerCase()) {

            case "brightness":

                return Math.max(0, value);

            case "contrast":

                return Math.max(0, value);

            case "saturate":

                return Math.max(0, value);

            case "opacity":

                return unit === "%" ? Math.min(Math.max(0, value), 100) : Math.min(Math.max(0, value), 1);

            case "blur":

                return Math.max(0, value);

            default: return value;
        }
    }

    function isDefaultFilterValue(filterName, value, unit) {

        if (filterName.match(/CSSFilter$/)) {

            filterName = getFilterByCrownOption(filterName);
        }

        unit = unit || "";

        switch (filterName.toLowerCase()) {

            case "brightness":

                return unit === "%" ? value === 100 : value === 1;

            case "contrast":

                return unit === "%" ? value === 100 : value === 1;

            case "saturate":

                return unit === "%" ? value === 100 : value === 1;

            case "hue-rotate":

                return value === 0;

            case "opacity":

                return unit === "%" ? value === 100 : value === 1;

            case "blur":

                return value === 0;

            default: return false;
        }
    }

    function clearChangedProp() {

        if (filtersData) {

            var f;

            for (f in filtersData) {

                if (filtersData.hasOwnProperty(f)) {

                    filtersData[f].forEach(function (filter) {
                        filter.changed = false;
                    });
                }
            }
        }
    }

    function convertDataToFilterDefData(currentText, filterData) {

        var prop = currentText.match(/^(?:-[a-zA-Z\-]+-)?filter:?/gi)[0] + " ",

            selection = {
                start: prop.length - 1,
                end: prop.length
            },

            value = prop,

            changedAdded = false;

        filterData.forEach(function (filter) {

            if (isDefaultFilterValue(filter.name, filter.number, filter.unit)) {

                if (!changedAdded) {

                    selection.start = value.length - 1;
                    selection.end = value.length - 1;
                }

                changedAdded = changedAdded || filter.changed;

                return;
            }

            var filterDef = filter.crownOption ? filter.name + "(" + filter.number + filter.unit + ")" : filter.filter;

            if (!changedAdded) {

                selection.start = value.length - 1;
                selection.end = selection.start + (filterDef.length + 1);
            }

            value += filterDef + " ";

            changedAdded = changedAdded || filter.changed;
        });

        if (value === prop) {

            value += "none";

            selection.end += (4 + 1);
        }

        return {
            text: value.trim(),
            selection: selection
        };
    }

    function parseFilterData(cssText) {

        var filters = cssText
        .replace(/^(?:-[a-zA-Z\-]+-)?filter[: ]?/gi, "")
        .replace(/^\s*(?:none|initial|inherit|unset)/gi, "")
        .split(/\s*\)\s*(?=[a-z]|\s*$)/ig)
        .map(function (filter) {
            return filter.trim().length ? filter.trim() + ")" : null;
        })
        .filter(function (filter) {
            return filter !== null;
        });

        return filters.map(function (filter) {

            var name = filter.replace(/\(.*/ig, "").trim(),
                value = filter.trim().match(/\(.*\)$/ig);

            value = (value ? value[0] || "0" : "0").trim().replace(/^\(|\)$/g, "");

            var number = value.match(/-?[0-9.]+/i) ? parseFloat(value.match(/-?[0-9.]+/i)[0]) : NaN;

            return {
                filter: filter,
                name: name,
                crownOption: getCrownOption(name),
                value: value,
                number: number,
                decimalNumber: isNaN(number) ? null: new Decimal(value.match(/-?[0-9.]+/i)[0]),
                unit: value ? value.match(/-?[0-9.]+[a-z%]+$/i) ? value.match(/[a-z%]+$/i)[0] : "" : ""
            };
        });
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

        CrownConnection.on("crown_touch_event", function (crownMsg) {

            clearTimeout(updateUIOnTouchTimeout);

            if (enabled && crownMsg.touch_state) {

                clearTimeout(clearLastSelectionTimeout);

                updateUIOnTouchTimeout = setTimeout(function() {
                    updateUI(getChangeByValue());
                }, UPDATE_UI_TIMEOUT);
            }

            if (enabled && !crownMsg.touch_state) {

                clearTimeout(clearLastSelectionTimeout);

                clearLastSelectionTimeout = setTimeout(function() {

                    lastSelection = null;

                }, CLEAR_LAST_SELECTION_TIMEOUT);
            }
        });
    });

    exports.shouldBeUsed = function () {

        var editor = EditorManager.getActiveEditor();

        if (!editor) {

            return false;
        }

        var selections = editor.getSelections(),

            isFilter = selections.some(function (selection) {

                var currentLineNumber = selection.start.line,
                    currentLine = editor.document.getLine(currentLineNumber),

                    selectedNumberMatch = false,
                    selectedFilterMatch = getMatchForSelection(currentLine, TEST_REGEX, selection);

                if (selectedFilterMatch) {

                    selectedNumberMatch = getMatchForSelection(currentLine, TEST_NUMBER_REGEX, selection);
                }

                return selectedFilterMatch && !selectedNumberMatch;
            });

        return isFilter;
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

        clearChangedProp();

        var selections = editor.getSelections(),

            origin = "crowncontrol.cssfilter" + originCounter++,

            inlineTextPositionChange = {},

            option = crownMsg.task_options.current_tool_option,

            isSameSelection = false,

            changes;

        selections = selections.map(function (selection) {

            var currentLineNumber = selection.start.line,
                currentLine = editor.document.getLine(currentLineNumber);

            inlineTextPositionChange[currentLineNumber] = inlineTextPositionChange[currentLineNumber] || 0;

            var selectedFilterMatch = getMatchForSelection(currentLine, TEST_REGEX, selection);

            if (selectedFilterMatch) {

                var currentText = selectedFilterMatch[0],

                    currentTextRange = {
                        start: {
                            line: currentLineNumber,
                            ch: selectedFilterMatch.index
                        },
                        end: {
                            line: currentLineNumber,
                            ch: selectedFilterMatch.index + currentText.length
                        }
                    };

                return {
                    currentText: currentText,
                    currentLineNumber: currentLineNumber,
                    selectedFilterMatch: selectedFilterMatch,
                    currentTextRange: currentTextRange
                };
            }

            return null;

        }).filter(function (selection) { return !!selection; });

        isSameSelection = lastSelection === JSON.stringify(selections.map(function (selection) { return [selection.currentTextRange, selection.currentText]; }));

        if (!isSameSelection) {

            filtersData = {};
        }

        changes = selections.map(function (selection, s) {

            var currentLineNumber = selection.currentLineNumber,

                selectedFilterMatch = selection.selectedFilterMatch,

                currentTextRange = selection.currentTextRange,

                currentText = selection.currentText,
                updatedText = currentText,

                updatedTextRange = {
                    start: {
                        line: currentLineNumber,
                        ch: selectedFilterMatch.index + inlineTextPositionChange[currentLineNumber]
                    },
                    end: {
                        line: currentLineNumber,
                        ch: selectedFilterMatch.index + currentText.length + inlineTextPositionChange[currentLineNumber]
                    }
                },

                incOrDec = (crownMsg.ratchet_delta || crownMsg.delta) > 0 ? 1: -1;

            if (!filtersData[s]) {

                filtersData[s] = parseFilterData(selectedFilterMatch[0]);
            }

            if (!filtersData[s].some(function (filterData) { return filterData.crownOption === option; })) {

                var filterName = getFilterByCrownOption(option),
                    initValue = getInitValueForFilter(filterName);

                filtersData[s].push(parseFilterData(getFilterByCrownOption(option) + "(" + initValue + ")")[0]);
            }

            filtersData[s].some(function (filterData) {

                if (filterData.crownOption === option) {

                    var changeByValue = getChangeByValue(filterData.unit),

                        decimalModified = filterData.decimalNumber.add(changeByValue * incOrDec),

                        limited = limitValueForFilter(filterData.name, decimalModified.toNumber(), filterData.unit);

                    filterData.number = limited;

                    if (limited !== decimalModified.toNumber()) {

                        filterData.decimalNumber = new Decimal(filterData.number);

                    } else {

                        filterData.decimalNumber = decimalModified;
                    }

                    filterData.changed = true;

                    return true;
                }
            });

            var filterDefData = convertDataToFilterDefData(currentText, filtersData[s]);

            updatedText = filterDefData.text;

            updatedTextRange.end.ch = currentTextRange.start.ch + updatedText.length + inlineTextPositionChange[currentLineNumber];

            inlineTextPositionChange[currentLineNumber] += updatedText.length - currentText.length;

            var afterSelection = {
                start: {
                    line: updatedTextRange.start.line,
                    ch: updatedTextRange.start.ch + filterDefData.selection.start
                },
                end: {
                    line: updatedTextRange.end.line,
                    ch: updatedTextRange.start.ch + filterDefData.selection.end
                }
            };

            return {
                currentRange: currentTextRange,
                afterRange: updatedTextRange,
                afterSelection: afterSelection,
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

            editor.setSelections(changes.map(function (change) { return change.afterSelection; }), undefined, undefined, origin);

            lastSelection = JSON.stringify(changes.map(function (change) { return [change.afterRange, change.replacement]; }));

//            if (changes.length === 1) {
//
//                updateUI(getUpdateToolFromHsl(changes[0].updatedHsl, option));
//
//            } else {
//
//                if (allChangingValuesAreTheSame(option, changes)) {
//
//                    updateUI(getUpdateToolFromHsl(changes[0].updatedHsl, option));
//
//                } else {
//
//                    updateUI([{name: option, value: ""}]);
//                }
//            }
        }
    };
});
