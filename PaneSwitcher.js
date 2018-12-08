/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    var MainViewManager = brackets.getModule("view/MainViewManager"),
        CommandManager = brackets.getModule("command/CommandManager"),
        Commands = brackets.getModule("command/Commands"),
        WorkspaceManager = brackets.getModule("view/WorkspaceManager"),
        KeyBindingManager = brackets.getModule("command/KeyBindingManager");


    var switchPaneCommand = "mjerabek.cz.crowncontrol.switch-pane-focus",
        switchPaneSizeCommand = "mjerabek.cz.crowncontrol.switch-pane-focus-and-toggle-size",
        switchPaneTypeCommand = "mjerabek.cz.crowncontrol.switch-split-view-type",
        closeSplitViewCommand = "mjerabek.cz.crowncontrol.close-split-view";


    var FKEY = "F9";


    var lastSplitViewTypeCommand = Commands.CMD_SPLITVIEW_VERTICAL;


    function switchPaneFocus() {

        if (MainViewManager.getPaneCount() === 1) {

            CommandManager.execute(lastSplitViewTypeCommand);

        } else {

            MainViewManager.switchPaneFocus();
        }
    }

    function switchPaneFocusAndSize() {

        if (MainViewManager.getPaneCount() === 1) {

            CommandManager.execute(lastSplitViewTypeCommand);

        } else {

            var scheme = MainViewManager.getLayoutScheme(),

                $editorHolder = $("#editor-holder"),
                $panes = $editorHolder.find(".view-pane"),
                $firstPane = $panes.first(),
                $secondPane = $panes.last();

            if (scheme.columns > 1) {

                var editorWidth = $editorHolder.width(),
                    activePaneWidth = (parseFloat($firstPane.css("width")) / editorWidth) * 100;

                $firstPane.css("width", (100 - activePaneWidth) + "%");

            } else {

                var editorHeight = $editorHolder.height(),
                    activePaneHeight = (parseFloat($firstPane.css("height")) / editorHeight) * 100;

                $firstPane.css("height", (100 - activePaneHeight) + "%");

                $secondPane.css("height", activePaneHeight + "%");
            }

            WorkspaceManager.recomputeLayout();

            MainViewManager.switchPaneFocus();
        }
    }

    function switchSplitViewType() {

        var scheme = MainViewManager.getLayoutScheme();

        if (scheme.columns !== 2) {

            lastSplitViewTypeCommand = Commands.CMD_SPLITVIEW_VERTICAL;

        } else {

            lastSplitViewTypeCommand = Commands.CMD_SPLITVIEW_HORIZONTAL;
        }

        CommandManager.execute(lastSplitViewTypeCommand);
    }

    function closeSplitView() {

        CommandManager.execute(Commands.CMD_SPLITVIEW_NONE);
    }

    CommandManager.register("Switch active pane", switchPaneCommand, switchPaneFocus);
    CommandManager.register("Switch active pane and size", switchPaneSizeCommand, switchPaneFocusAndSize);
    CommandManager.register("Switch split view type", switchPaneTypeCommand, switchSplitViewType);
    CommandManager.register("Close split view", closeSplitViewCommand, closeSplitView);

    if (!KeyBindingManager.getKeyBindings(switchPaneCommand).length) {

        KeyBindingManager.addBinding(switchPaneCommand, {
            key: FKEY
        });
    }

    if (!KeyBindingManager.getKeyBindings(switchPaneSizeCommand).length) {

        KeyBindingManager.addBinding(switchPaneSizeCommand, {
            key: "Ctrl-Alt-" + FKEY
        });
    }

    if (!KeyBindingManager.getKeyBindings(switchPaneTypeCommand).length) {

        KeyBindingManager.addBinding(switchPaneTypeCommand, {
            key: "Ctrl-" + FKEY
        });
    }

    if (!KeyBindingManager.getKeyBindings(closeSplitViewCommand).length) {

        KeyBindingManager.addBinding(closeSplitViewCommand, {
            key: "Ctrl-Shift-" + FKEY
        });
    }
});
