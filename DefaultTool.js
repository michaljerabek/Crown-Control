/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    const MainViewManager = brackets.getModule("view/MainViewManager");

    const CrownConnection = require("CrownConnection");
    const Options = require("Options");
    const ChangeFile = require("DefaultToolChangeFileOption");
    const ResizePanes = require("DefaultToolResizePanesOption");
    const Scroll = require("DefaultToolScrollOption");
    const OPTIONS = [Scroll, ChangeFile, ResizePanes];

    const TOOL_IDS = {
        single: "DefaultTool",
        cols: "DefaultToolSplitViewCols",
        rows: "DefaultToolSplitViewRows",
        onlyActivePostfix: "OnlyActive",
        scrollPostfix: {
            hor: "ScrollHor",
            ver: "ScrollVer",
            both: "ScrollBoth"
        }
    };
    const TOOL_ID_REGEX = /^DefaultTool/;

    let enabled = false;
    let usedOption = null;

    CrownConnection.on("crown_touch_event", function (crownMsg) {
        if (enabled && !crownMsg.touch_state) {
            if (usedOption && usedOption.onTouchEnd) {
                usedOption.onTouchEnd();
            }
        }
    });

    exports.getDefaultOptions = function () {
        return [
            {
                key: "default-tool-with-inactive",
                value: true,
                type: "boolean"
            },
            {
                key: "default-tool-scroll",
                value: TOOL_IDS.scrollPostfix.both,
                type: "string"
            },
            {
                key: "pane-switcher-fkey",
                value: "F9",
                type: "string"
            }
        ];
    };

    exports.getOptions = function () {
        return {
            tool: "Default",
            list: [
                {
                    title: "Split view",
                    type: "checkbox",
                    options: [
                        {
                            label: "Show tools for inactive pane",
                            key: "default-tool-with-inactive"
                        }
                    ]
                },
                {
                    title: "Scroll direction",
                    key: "default-tool-scroll",
                    type: "radio",
                    options: [
                        {
                            label: "Horizontal",
                            value: TOOL_IDS.scrollPostfix.hor
                        },
                        {
                            label: "Vertical",
                            value: TOOL_IDS.scrollPostfix.ver
                        },
                        {
                            label: "Both",
                            value: TOOL_IDS.scrollPostfix.both
                        }
                    ]
                }
            ]
        };
    };

    exports.disable = function () {
        enabled = false;
    };

    exports.shouldBeUsed = function () {
        return true;
    };

    exports.getToolId = function getToolId() {
        const isColumnLayout = MainViewManager.getLayoutScheme().columns !== 1;
        const paneCount = MainViewManager.getPaneCount();
        
        let toolId = paneCount === 1 ? TOOL_IDS.single: isColumnLayout ? TOOL_IDS.cols: TOOL_IDS.rows;
        toolId += Options.get("default-tool-with-inactive") ? "": TOOL_IDS.onlyActivePostfix;
        toolId += Options.get("default-tool-scroll");
        return toolId;
    };

    exports.use = function () {
        enabled = true;
        CrownConnection.changeTool(exports.getToolId());
    };

    exports.update = function (crownMsg) {
        if (crownMsg.task_options.current_tool.match(TOOL_ID_REGEX)) {
            OPTIONS.some(function (option) {
                if (option.shouldBeUsed(crownMsg)) {
                    usedOption = option;
                    option.update(crownMsg);
                    return true;
                }
            });
        }
    };
});
