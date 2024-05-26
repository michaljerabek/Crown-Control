/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    const EditorManager = brackets.getModule("editor/EditorManager");
    const MainViewManager = brackets.getModule("view/MainViewManager");

    const ModifierKeys = require("ModifierKeys");
    const CrownConnection = require("CrownConnection");

    const TOOL_OPTION_NAME_REGEX = /^Scroll/;

    exports.shouldBeUsed = function (crownMsg) {
        return crownMsg.task_options.current_tool_option.match(TOOL_OPTION_NAME_REGEX);
    };

    exports.update = function (crownMsg) {
        const editor = EditorManager.getActiveEditor();
        if (!editor) return;

        let editorToScroll = editor;
        if ((crownMsg.task_options.current_tool_option.match(/Inactive$/) && !ModifierKeys.altKey) ||
            (crownMsg.task_options.current_tool_option.match(/Active$/) && ModifierKeys.altKey)) {
            const paneId = MainViewManager.FIRST_PANE === editor._paneId ? MainViewManager.SECOND_PANE: MainViewManager.FIRST_PANE;
            editorToScroll = MainViewManager._getPane(paneId)._currentView;
        }

        const currentScroll = editorToScroll.getScrollPos();
        const scrollDelta = !crownMsg.delta ? 0:
            crownMsg.delta > 0 ?
                Math.max( 5, crownMsg.delta) * (ModifierKeys.ctrlKey ? 2: 1.25):
                Math.min(-5, crownMsg.delta) * (ModifierKeys.ctrlKey ? 2: 1.25);

        let dirH = !!crownMsg.task_options.current_tool_option.match(/^ScrollH/);
        dirH = (dirH && !ModifierKeys.shiftKey) || (!dirH && ModifierKeys.shiftKey);

        editorToScroll.setScrollPos(
            !dirH ? currentScroll.x: Math.max(0, Math.round(currentScroll.x + scrollDelta)),
            !dirH ? Math.max(0, Math.round(currentScroll.y + scrollDelta)): currentScroll.y
        );
    };
});
