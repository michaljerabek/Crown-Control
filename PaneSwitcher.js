/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    const MainViewManager = brackets.getModule("view/MainViewManager");
    const CommandManager = brackets.getModule("command/CommandManager");
    const Commands = brackets.getModule("command/Commands");
    const WorkspaceManager = brackets.getModule("view/WorkspaceManager");
    const KeyBindingManager = brackets.getModule("command/KeyBindingManager");

    const Options = require("Options");

    const switchPaneCommand = "mjerabek.cz.crowncontrol.switch-pane-focus";
    const switchPaneSizeCommand = "mjerabek.cz.crowncontrol.switch-pane-focus-and-toggle-size";
    const switchPaneTypeCommand = "mjerabek.cz.crowncontrol.switch-split-view-type";
    const closeSplitViewCommand = "mjerabek.cz.crowncontrol.close-split-view";
    let lastSplitViewTypeCommand = Commands.CMD_SPLITVIEW_VERTICAL;

    function switchPaneFocus() {
        if (MainViewManager.getPaneCount() === 1) {
            CommandManager.execute(lastSplitViewTypeCommand);
        } else {
            MainViewManager.switchPaneFocus();
        }
    }

    function switchPaneFocusAndSize() {
        if (MainViewManager.getPaneCount() === 1) {
            return CommandManager.execute(lastSplitViewTypeCommand);
        }
        
        const scheme = MainViewManager.getLayoutScheme();

        const $editorHolder = $("#editor-holder");
        const $panes = $editorHolder.find(".view-pane");
        const $firstPane = $panes.first();
        const $secondPane = $panes.last();

        if (scheme.columns > 1) {
            const editorWidth = $editorHolder.width();
            const activePaneWidth = (parseFloat($firstPane.css("width")) / editorWidth) * 100;
            $firstPane.css("width", (100 - activePaneWidth) + "%");
        }
        
        if (scheme.columns === 1) {
            const editorHeight = $editorHolder.height();
            const activePaneHeight = (parseFloat($firstPane.css("height")) / editorHeight) * 100;
            $firstPane.css("height", (100 - activePaneHeight) + "%");
            $secondPane.css("height", activePaneHeight + "%");
        }

        WorkspaceManager.recomputeLayout();
        MainViewManager.switchPaneFocus();
    }

    function switchSplitViewType() {
        const scheme = MainViewManager.getLayoutScheme();
        lastSplitViewTypeCommand = scheme.columns !== 2 ? 
            Commands.CMD_SPLITVIEW_VERTICAL:
            Commands.CMD_SPLITVIEW_HORIZONTAL;

        CommandManager.execute(lastSplitViewTypeCommand);
    }

    function closeSplitView() {
        CommandManager.execute(Commands.CMD_SPLITVIEW_NONE);
    }

    CommandManager.register("Switch active pane", switchPaneCommand, switchPaneFocus);
    CommandManager.register("Switch active pane and size", switchPaneSizeCommand, switchPaneFocusAndSize);
    CommandManager.register("Switch split view type", switchPaneTypeCommand, switchSplitViewType);
    CommandManager.register("Close split view", closeSplitViewCommand, closeSplitView);
    
    KeyBindingManager.addBinding(switchPaneCommand, {
        key: (Options.get("pane-switcher-fkey") || "F9")
    });

    KeyBindingManager.addBinding(switchPaneSizeCommand, {
        key: "Ctrl-Alt-" + (Options.get("pane-switcher-fkey") || "F9")
    });

    KeyBindingManager.addBinding(switchPaneTypeCommand, {
        key: "Ctrl-" + (Options.get("pane-switcher-fkey") || "F9")
    });

    KeyBindingManager.addBinding(closeSplitViewCommand, {
        key: "Ctrl-Shift-" + (Options.get("pane-switcher-fkey") || "F9")
    });
});
