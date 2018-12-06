/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    var MainViewManager = brackets.getModule("view/MainViewManager"),
        WorkspaceManager = brackets.getModule("view/WorkspaceManager");


    var TOOL_OPTION_NAME_REGEX = /^ResizePanes/,

        MIN_PANE_SIZE = 75;


    var updateLayoutIdleCallback;


    var $editorHolder,
        $panes,
        $firstPane,
        $secondPane;

    exports.shouldBeUsed = function (crownMsg) {

        var use = crownMsg.task_options.current_tool_option.match(TOOL_OPTION_NAME_REGEX);

        if (use) {

            $editorHolder = $("#editor-holder");
            $panes = $editorHolder.find(".view-pane");
            $firstPane = $panes.first();
            $secondPane = $panes.last();
        }

        return use;
    };

    exports.onTouchEnd = function () {

        cancelIdleCallback(updateLayoutIdleCallback);

        WorkspaceManager.recomputeLayout();
    };

    exports.update = function (crownMsg) {

        if (MainViewManager.getPaneCount() === 1 || !crownMsg.delta) {

            return;
        }

        var resizeDelta = crownMsg.delta ?
                crownMsg.delta > 0 ?
                    Math.max(5, crownMsg.delta):
                    Math.min(-5, crownMsg.delta):
                0;

        if ($editorHolder.hasClass("split-vertical")) {

            var editorWidth = $editorHolder.width(),
                activePaneWidth = parseFloat($firstPane.css("width")) + resizeDelta;

            activePaneWidth = Math.max(MIN_PANE_SIZE, Math.min(activePaneWidth, editorWidth - MIN_PANE_SIZE));

            var activePaneWidthPct = (activePaneWidth / editorWidth) * 100;

            $firstPane.css("width", activePaneWidthPct + "%");

        } else {

            var editorHeight = $editorHolder.height(),
                activePaneHeight = parseFloat($firstPane.css("height")) + resizeDelta;

            activePaneHeight = Math.max(MIN_PANE_SIZE, Math.min(activePaneHeight, editorHeight - MIN_PANE_SIZE));

            var activePaneHeightPct = (activePaneHeight / editorHeight) * 100;

            $firstPane.css("height", activePaneHeightPct + "%");

            $secondPane.css("height", (100 - activePaneHeightPct) + "%");
        }

        cancelIdleCallback(updateLayoutIdleCallback);

        updateLayoutIdleCallback = requestIdleCallback(function() {

            WorkspaceManager.recomputeLayout();

        });
    };
});
