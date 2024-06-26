/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    const EditorManager = brackets.getModule("editor/EditorManager");
    const Decimal = require("node_modules/decimal.js/decimal");

    const CrownConnection = require("CrownConnection");
    const ModifierKeys = require("ModifierKeys");
    const Options = require("Options");

    const TOOL_ID = "CSSFilters";
    const TEST_REGEX = /(?:-[a-zA-Z\-]+-)?filter([: ]\s?|\s*$)(?:(?:\s*(?:none|initial|inherit|unset))|(?:\s*[a-z\-]+\(([^)]*)\)\s*\)?\s*)*)/gi;
    const TEST_NUMBER_REGEX = /-?\d*\.?\d+/g;
    const CLEAR_LAST_SELECTION_TIMEOUT = 1000;
    const UPDATE_UI_TIMEOUT = 150;

    let originCounter = 0;
    let enabled = false;
    let filtersData = {};
    let lastSelection = null;
    let clearLastSelectionTimeout = null;
    let updateUIOnTouchTimeout = null;

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
        CrownConnection.updateTool(TOOL_ID, nameValueArray);
    }

    function getChangeByValue(unit) {
        switch (unit) {
            case "grad":
            case "deg":
            case "%":
                switch (true) {
                    case ModifierKeys.altKey && ModifierKeys.shiftKey: return 0.1;
                    case ModifierKeys.ctrlKey && ModifierKeys.altKey: return 0.5;
                    case ModifierKeys.shiftKey: return 20;
                    case ModifierKeys.ctrlKey: return 10;
                    case ModifierKeys.altKey: return 1;
                    default: return 5;
                }
                break;

            case "mm":
            case "ex":
            case "pt":
            case "ch":
            case "px":
                switch (true) {
                    case ModifierKeys.altKey && ModifierKeys.shiftKey: return 0.001;
                    case ModifierKeys.ctrlKey && ModifierKeys.altKey: return 0.01;
                    case ModifierKeys.shiftKey: return 20;
                    case ModifierKeys.ctrlKey: return 10;
                    case ModifierKeys.altKey: return 0.1;
                    default: return 1;
                }
                break;

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
                break;

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

    function getUpdateToolData() {
        const updateTool = {
            name: "",
            value: ""
        };

        if (filtersData) {
            filtersData[0].some(function (filter) {
                if (filter.changed) {
                    updateTool.name = filter.crownOption;
                    updateTool.value = String(filter.number);
                    return true;
                }
            });
        }

        return [updateTool];
    }

    function allChangingValuesAndUnitsAreTheSame() {
        let same = true;

        if (filtersData) {
            let firstValue = null;
            let firstUnit;

            for (let f in filtersData) {
                if (filtersData.hasOwnProperty(f)) {
                    filtersData[f].some(function (filter) {
                        if (filter.changed) {
                            if (firstValue === null) {
                                firstValue = !filter.unit ? filter.decimalNumber.mul(100).toNumber() : filter.number;
                                firstUnit = filter.unit;
                                return true;
                            }

                            let value = !filter.unit ? filter.decimalNumber.mul(100).toNumber() : filter.number;
                            if ((value !== firstValue) || (firstUnit !== filter.unit && (firstUnit !== "%" && filter.unit !== "") && (firstUnit !== "" && filter.unit !== "%"))) {
                                same = false;
                            }
                            return true;
                        }
                    });
                }
            }
        }
        
        return same;
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

    function limitValueForFilter(filterName, value, unit = "") {
        if (filterName.match(/CSSFilter$/)) {
            filterName = getFilterByCrownOption(filterName);
        }

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

    function isDefaultFilterValue(filterName, value, unit = "") {
        if (filterName.match(/CSSFilter$/)) {
            filterName = getFilterByCrownOption(filterName);
        }

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
            for (let f in filtersData) {
                if (filtersData.hasOwnProperty(f)) {
                    filtersData[f].forEach(function (filter) {
                        filter.changed = false;
                    });
                }
            }
        }
    }

    function convertDataToFilterDefData(currentText, filterData) {
        const prop = currentText.match(/^(?:-[a-zA-Z\-]+-)?filter:?/gi)[0] + " ";
        const selection = {
            start: prop.length - 1,
            end: prop.length
        };
        let value = prop;
        let changedAdded = false;

        filterData.forEach(function (filter) {
            if (isDefaultFilterValue(filter.name, filter.number, filter.unit)) {
                if (!changedAdded) {
                    selection.start = value.length - 1;
                    selection.end = value.length - 1;
                }
                changedAdded = changedAdded || filter.changed;
                return;
            }

            const filterDef = filter.crownOption ? filter.name + "(" + filter.number + filter.unit + ")" : filter.filter;
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
        const filters = cssText
            .replace(/^(?:-[a-zA-Z\-]+-)?filter[: ]?/gi, "")
            .replace(/^\s*(?:none|initial|inherit|unset)/gi, "")
            .split(/\s*\)\s*(?=[a-z]|\s*$)/ig)
            .map(filter => filter.trim().length ? filter.trim() + ")": null)
            .filter(filter => filter !== null);

        return filters.map(function (filter) {
            const name = filter.replace(/\(.*/ig, "").trim();
            let value = filter.trim().match(/\(.*\)$/ig);
            value = (value ? value[0] || "0": "0").trim().replace(/^\(|\)$/g, "");
            const number = value.match(/-?[0-9.]+/i) ? parseFloat(value.match(/-?[0-9.]+/i)[0]): NaN;

            return {
                filter: filter,
                name: name,
                crownOption: getCrownOption(name),
                value: value,
                number: number,
                decimalNumber: isNaN(number) ? null: new Decimal(value.match(/-?[0-9.]+/i)[0]),
                unit: value ? value.match(/-?[0-9.]+[a-z%]+$/i) ? value.match(/[a-z%]+$/i)[0]: "": ""
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
    });

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
            clearLastSelectionTimeout = setTimeout(
                () => (lastSelection = null), 
                CLEAR_LAST_SELECTION_TIMEOUT
            );
        }
    });

    exports.getDefaultOptions = function () {
        return [
            {
                key: "css-filters-low-priority",
                value: true,
                type: "boolean"
            }
        ];
    };

    exports.getOptions = function () {
        return {
            tool: "CSS Filters",
            list: [
                {
                    type: "checkbox",
                    options: [
                        {
                            label: "Numbers have higher priority then filters",
                            key: "css-filters-low-priority"
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
        const isFilter = selections.some(function (selection) {
            const currentLineNumber = selection.start.line;
            const currentLine = editor.document.getLine(currentLineNumber);

            let selectedNumberMatch = false;
            let selectedFilterMatch = getMatchForSelection(currentLine, TEST_REGEX, selection);
            if (selectedFilterMatch) {
                if (Options.get("css-filters-low-priority") === true) {
                    selectedNumberMatch = getMatchForSelection(currentLine, TEST_NUMBER_REGEX, selection);
                }
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

        const editor = EditorManager.getActiveEditor();
        if (!editor) return;

        clearChangedProp();

        const option = crownMsg.task_options.current_tool_option;
        const origin = "crowncontrol.cssfilter" + originCounter++;
        const inlineTextPositionChange = {};
        let isSameSelection = false;
        let selections = editor.getSelections();
        let changes;

        selections = selections.map(function (selection) {
            const currentLineNumber = selection.start.line;
            const currentLine = editor.document.getLine(currentLineNumber);

            inlineTextPositionChange[currentLineNumber] = inlineTextPositionChange[currentLineNumber] || 0;

            const selectedFilterMatch = getMatchForSelection(currentLine, TEST_REGEX, selection);
            if (selectedFilterMatch) {
                const currentText = selectedFilterMatch[0];
                const currentTextRange = {
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
        });
        selections = selections.filter(selection => !!selection);

        isSameSelection = lastSelection === JSON.stringify(selections.map(selection => [selection.currentTextRange, selection.currentText]));
        if (!isSameSelection) {
            filtersData = {};
        }

        changes = selections.map(function (selection, s) {
            const currentLineNumber = selection.currentLineNumber;
            const selectedFilterMatch = selection.selectedFilterMatch;
            const currentTextRange = selection.currentTextRange;
            const currentText = selection.currentText;
            const incOrDec = (crownMsg.ratchet_delta || crownMsg.delta) > 0 ? 1: -1;
            const updatedTextRange = {
                start: {
                    line: currentLineNumber,
                    ch: selectedFilterMatch.index + inlineTextPositionChange[currentLineNumber]
                },
                end: {
                    line: currentLineNumber,
                    ch: selectedFilterMatch.index + currentText.length + inlineTextPositionChange[currentLineNumber]
                }
            };
            let updatedText = currentText;

            if (!filtersData[s]) {
                filtersData[s] = parseFilterData(selectedFilterMatch[0]);
            }

            if (!filtersData[s].some(filterData => filterData.crownOption === option)) {
                const filterName = getFilterByCrownOption(option);
                const initValue = getInitValueForFilter(filterName);
                filtersData[s].push(parseFilterData(getFilterByCrownOption(option) + "(" + initValue + ")")[0]);
            }

            filtersData[s].some(function (filterData) {
                if (filterData.crownOption === option) {
                    const changeByValue = getChangeByValue(filterData.unit);
                    const decimalModified = filterData.decimalNumber.add(changeByValue * incOrDec);
                    const limited = limitValueForFilter(filterData.name, decimalModified.toNumber(), filterData.unit);

                    filterData.changed = true;
                    filterData.number = limited;
                    if (limited !== decimalModified.toNumber()) {
                        filterData.decimalNumber = new Decimal(filterData.number);
                    } else {
                        filterData.decimalNumber = decimalModified;
                    }
                    
                    return true;
                }
            });

            const filterDefData = convertDataToFilterDefData(currentText, filtersData[s]);
            updatedText = filterDefData.text;
            updatedTextRange.end.ch = currentTextRange.start.ch + updatedText.length + inlineTextPositionChange[currentLineNumber];
            inlineTextPositionChange[currentLineNumber] += updatedText.length - currentText.length;

            const afterSelection = {
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
            const edits = changes.map(function (change) {
                change.currentRange.text = change.replacement;
                return {
                    edit: change.currentRange
                };
            });

            editor.document.doMultipleEdits(edits, origin);
            editor.setSelections(changes.map(change => change.afterSelection), undefined, undefined, origin);
            lastSelection = JSON.stringify(changes.map(change => [change.afterRange, change.replacement]));

            if (changes.length === 1 || allChangingValuesAndUnitsAreTheSame()) {
                return updateUI(getUpdateToolData());
            }
            return updateUI([{name: option, value: ""}]);
        }
    };
});
