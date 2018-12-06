/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    var EditorManager = brackets.getModule("editor/EditorManager"),
        MainViewManager = brackets.getModule("view/MainViewManager");


    var TOOL_OPTION_NAME_REGEX = /^Scroll/;


    var modKeys = {
        altKey: false,
        ctrlKey: false,
        shiftKey: false
    };


    exports.addModKeysState = function (_modKeys) {

        modKeys = _modKeys;
    };

    exports.shouldBeUsed = function (crownMsg) {

        return crownMsg.task_options.current_tool_option.match(TOOL_OPTION_NAME_REGEX);
    };

    exports.update = function (crownMsg) {

        var editor = EditorManager.getActiveEditor();

        if (!editor) {

            return;
        }

        var editorToScroll = editor;

        if ((crownMsg.task_options.current_tool_option.match(/Inactive$/) && !modKeys.altKey) ||
            (crownMsg.task_options.current_tool_option.match(/Active$/) && modKeys.altKey)) {

            var paneId = MainViewManager.FIRST_PANE === editor._paneId ? MainViewManager.SECOND_PANE : MainViewManager.FIRST_PANE;

            editorToScroll = MainViewManager._getPane(paneId)._currentView;
        }

        var currentScroll = editorToScroll.getScrollPos(),

            scrollDelta = crownMsg.delta ?
                crownMsg.delta > 0 ?
                    Math.max(5, crownMsg.delta) * (modKeys.ctrlKey ? 2 : 1.25):
                    Math.min(-5, crownMsg.delta) * (modKeys.ctrlKey ? 2 : 1.25):
                0,

            dirH = !!crownMsg.task_options.current_tool_option.match(/^ScrollH/);

        dirH = (dirH && !modKeys.shiftKey) || (!dirH && modKeys.shiftKey);

        editorToScroll.setScrollPos(
            !dirH ? currentScroll.x : Math.max(0, currentScroll.x + scrollDelta),
            !dirH ? Math.max(0, currentScroll.y + scrollDelta) : currentScroll.y
        );
    };
});
