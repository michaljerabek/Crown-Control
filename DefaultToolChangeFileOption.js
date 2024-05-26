/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    const MainViewManager = brackets.getModule("view/MainViewManager");
    const Commands = brackets.getModule("command/Commands");
    const CommandManager = brackets.getModule("command/CommandManager");
    const SidebarView = brackets.getModule("project/SidebarView");

    const ModifierKeys = require("ModifierKeys");

    const TOOL_OPTION_NAME_REGEX = /^ChangeFile/;
    const HIGHLIGHT_COLOR = "rgba(255, 255, 255, 0.1)";

    let changeFileCounter = 0;
    let changeFileOnTouchEndFn = null;
    let sidebarWasHidden = false;

    ModifierKeys.on("change", function (ctrl, alt) {
        if (alt) {
            changeFileCounter = 0;
        }
    });

    function highlightFile(paneId, index, toggleSelectedClassIndex) {
        if (!sidebarWasHidden && !SidebarView.isVisible()) {
            CommandManager.execute(Commands.SHOW_SIDEBAR);
            sidebarWasHidden = true;
        }

        const workingSetListContainer = document.getElementById("working-set-list-container");
        const workingSetList = document.getElementById("working-set-list-" + paneId);
        if (!workingSetList) return;
        const allLiEls = Array.from(workingSetListContainer.querySelectorAll(".working-set-view li"));
        const liEls = Array.from(workingSetList.querySelectorAll(".open-files-container li"));

        allLiEls.forEach(liEl => (liEl.style.backgroundColor = ""));
        if (index !== -1) {
            liEls[index].style.backgroundColor = HIGHLIGHT_COLOR;
            liEls[index].scrollIntoView();
        }

        if (typeof toggleSelectedClassIndex === "number" && toggleSelectedClassIndex !== -1) {
            liEls.some(function (liEl) {
                if (liEl.classList.contains("selected")) {
                    liEl.classList.remove("selected");
                    return true;
                }
            });
            liEls[toggleSelectedClassIndex].classList.add("selected");
        }
    }

    function changeFile(fullPath, paneToChangeId, toggleSelectedClassIndex) {
        CommandManager.execute(Commands.CMD_ADD_TO_WORKINGSET_AND_OPEN, {
            fullPath: fullPath,
            paneId: paneToChangeId,
            options: {
                noPaneActivate: true,
                noPaneRedundancyCheck: true
            }
        });

        highlightFile(paneToChangeId, -1, toggleSelectedClassIndex);
        changeFileCounter = 0;
        
        if (sidebarWasHidden) {
            CommandManager.execute(Commands.HIDE_SIDEBAR);
            sidebarWasHidden = false;
        }
    }

    exports.onTouchEnd = function () {
        if (changeFileOnTouchEndFn) {
            changeFileOnTouchEndFn();
        }
    };

    exports.shouldBeUsed = function (crownMsg) {
        return crownMsg.task_options.current_tool_option.match(TOOL_OPTION_NAME_REGEX);
    };

    exports.update = function (crownMsg) {
        if (!crownMsg.ratchet_delta || !crownMsg.delta) {
            return;
        }

        const activePaneId = MainViewManager.getActivePaneId();
        const useActivePane = MainViewManager.getPaneCount() === 1 || !ModifierKeys.altKey;
        const paneToChangeId = useActivePane ? activePaneId: activePaneId === MainViewManager.FIRST_PANE? MainViewManager.SECOND_PANE: MainViewManager.FIRST_PANE;
        const paneToChange = MainViewManager._getPane(paneToChangeId);
        const editorToChange = paneToChange._currentView;

        const files = paneToChange.getViewList();
        const currentFileIndex = files.indexOf(editorToChange.getFile());
        let fileToChangeIndex = currentFileIndex + (crownMsg.ratchet_delta > 0 ? ++changeFileCounter: --changeFileCounter);
        fileToChangeIndex = fileToChangeIndex % files.length;
        if (fileToChangeIndex <= -1) {
            fileToChangeIndex = (files.length + fileToChangeIndex);
        }

        if (ModifierKeys.ctrlKey) {
            changeFileOnTouchEndFn = null;
            changeFile(files[fileToChangeIndex].fullPath, paneToChangeId, useActivePane ? -1 : fileToChangeIndex);
        } else {
            changeFileOnTouchEndFn = function () {
                changeFile(files[fileToChangeIndex].fullPath, paneToChangeId, useActivePane ? -1 : fileToChangeIndex);
                changeFileOnTouchEndFn = null;
            };
            highlightFile(paneToChangeId, fileToChangeIndex);
        }
    };
});
