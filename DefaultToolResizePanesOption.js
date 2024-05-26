/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    const MainViewManager = brackets.getModule("view/MainViewManager");
    const WorkspaceManager = brackets.getModule("view/WorkspaceManager");

    const TOOL_OPTION_NAME_REGEX = /^ResizePanes/;
    const MIN_PANE_SIZE = 75;

    let updateLayoutIdleCallback;
    let $editorHolder;
    let $panes;
    let $firstPane;
    let $secondPane;

    exports.shouldBeUsed = function (crownMsg) {
        const use = crownMsg.task_options.current_tool_option.match(TOOL_OPTION_NAME_REGEX);
        if (!use) return false;

        $editorHolder = $("#editor-holder");
        $panes = $editorHolder.find(".view-pane");
        $firstPane = $panes.first();
        $secondPane = $panes.last();
        return true;
    };

    exports.onTouchEnd = function () {
        cancelIdleCallback(updateLayoutIdleCallback);
        WorkspaceManager.recomputeLayout();
    };

    exports.update = function (crownMsg) {
        if (MainViewManager.getPaneCount() === 1 || !crownMsg.delta) {
            return;
        }

        const scheme = MainViewManager.getLayoutScheme();
        const resizeDelta = !crownMsg.delta ? 0:
            crownMsg.delta > 0 ?
                Math.max(5, crownMsg.delta):
                Math.min(-5, crownMsg.delta);

        if (scheme.columns > 1) {
            const editorWidth = $editorHolder.width();
            let activePaneWidth = parseFloat($firstPane.css("width")) + resizeDelta;
            activePaneWidth = Math.max(MIN_PANE_SIZE, Math.min(activePaneWidth, editorWidth - MIN_PANE_SIZE));
            const activePaneWidthPct = (activePaneWidth / editorWidth) * 100;
            
            $firstPane.css("width", activePaneWidthPct + "%");
        } else {
            const editorHeight = $editorHolder.height();
            let activePaneHeight = parseFloat($firstPane.css("height")) + resizeDelta;
            activePaneHeight = Math.max(MIN_PANE_SIZE, Math.min(activePaneHeight, editorHeight - MIN_PANE_SIZE));
            const activePaneHeightPct = (activePaneHeight / editorHeight) * 100;
            
            $firstPane.css("height", activePaneHeightPct + "%");
            $secondPane.css("height", (100 - activePaneHeightPct) + "%");
        }

        cancelIdleCallback(updateLayoutIdleCallback);
        updateLayoutIdleCallback = requestIdleCallback(function() {
            WorkspaceManager.recomputeLayout();
        });
    };
});
