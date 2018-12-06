/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    var MainViewManager = brackets.getModule("view/MainViewManager");


    var ChangeFile = require("DefaultToolChangeFileOption"),
        ResizePanes = require("DefaultToolResizePanesOption"),
        Scroll = require("DefaultToolScrollOption");


    var TOOL_ID = "DefaultTool",
        SPLIT_VIEW_COLS_TOOL_ID = "DefaultToolSplitViewCols",
        SPLIT_VIEW_ROWS_TOOL_ID = "DefaultToolSplitViewRows",
        TOOL_ID_REGEX = /^DefaultTool/;


    var OPTIONS = [Scroll, ChangeFile, ResizePanes];

    var usedOption = null;


    var CrownConnection = null,

        modKeys = {
            altKey: false,
            ctrlKey: false,
            shiftKey: false
        };

    exports.addModKeysState = function (_modKeys) {

        modKeys = _modKeys;

        OPTIONS.forEach(function (option) {

            if (option.addModKeysState) {

                option.addModKeysState(modKeys);
            }
        });
    };

    exports.onModKeyChanged = function () {

        OPTIONS.forEach(function (option) {

            if (option.onModKeyChanged) {

                option.onModKeyChanged();
            }
        });
    };

    exports.onTouchEnd = function () {

        if (usedOption && usedOption.onTouchEnd) {

            usedOption.onTouchEnd();
        }
    };

    exports.shouldBeUsed = function () {

        return true;
    };

    exports.getToolId = function getToolId() {

        return MainViewManager.getPaneCount() === 1 ?
            TOOL_ID:
            MainViewManager.getLayoutScheme().columns !== 1 ?
                SPLIT_VIEW_COLS_TOOL_ID:
                SPLIT_VIEW_ROWS_TOOL_ID;
    };

    exports.use = function (_CrownConnection) {

        CrownConnection = _CrownConnection;

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
