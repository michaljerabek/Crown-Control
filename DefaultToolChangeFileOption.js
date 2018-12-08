/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    var MainViewManager = brackets.getModule("view/MainViewManager"),
        Commands = brackets.getModule("command/Commands"),
        CommandManager = brackets.getModule("command/CommandManager"),
        SidebarView = brackets.getModule("project/SidebarView");


    var ModifierKeys = require("ModifierKeys");


    var TOOL_OPTION_NAME_REGEX = /^ChangeFile/;


    var HIGHLIGHT_COLOR = "rgba(255, 255, 255, 0.1)";


    var lastDirection = 0,
        changeFileCounter = 0,
        changeFileDebounce = null,
        changeFileDebounceFn = null,

        sidebarWasHidden;


    function highlightFile(paneId, index, toggleSelectedClassIndex) {

        if (!sidebarWasHidden && !SidebarView.isVisible()) {

            CommandManager.execute(Commands.SHOW_SIDEBAR);

            sidebarWasHidden = true;
        }

        var workingSetListContainer = document.getElementById("working-set-list-container"),
            workingSetList = document.getElementById("working-set-list-" + paneId);

        if (workingSetList) {

            var allLiEls = Array.from(workingSetListContainer.querySelectorAll(".working-set-view li")),
                liEls = Array.from(workingSetList.querySelectorAll(".open-files-container li"));

            allLiEls.forEach(function (liEl) {

                liEl.style.backgroundColor = "";
            });

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

        if (changeFileDebounceFn) {

            clearTimeout(changeFileDebounce);

            changeFileDebounceFn();
        }

        lastDirection = 0;
    };

    exports.shouldBeUsed = function (crownMsg) {

        return crownMsg.task_options.current_tool_option.match(TOOL_OPTION_NAME_REGEX);
    };

    exports.update = function (crownMsg) {

        if (!crownMsg.ratchet_delta || !crownMsg.delta) {

            return;
        }

        var activePaneId = MainViewManager.getActivePaneId(),
            useActivePane = MainViewManager.getPaneCount() === 1 || !ModifierKeys.altKey,
            paneToChangeId = useActivePane ? activePaneId : activePaneId === MainViewManager.FIRST_PANE ? MainViewManager.SECOND_PANE : MainViewManager.FIRST_PANE,
            paneToChange = MainViewManager._getPane(paneToChangeId),
            editorToChange = paneToChange._currentView,

            files = paneToChange.getViewList(),

            currentFileIndex = files.indexOf(editorToChange.getFile()),
            fileToChangeIndex = currentFileIndex + (crownMsg.ratchet_delta > 0 ? ++changeFileCounter: --changeFileCounter);

        fileToChangeIndex = fileToChangeIndex % files.length;

        if (fileToChangeIndex <= -1) {

            fileToChangeIndex = (files.length + fileToChangeIndex);
        }

        clearTimeout(changeFileDebounce);

        if (ModifierKeys.ctrlKey) {

            changeFile(files[fileToChangeIndex].fullPath, paneToChangeId, useActivePane ? -1 : fileToChangeIndex);

        } else {

            changeFileDebounceFn = function () {

                changeFile(files[fileToChangeIndex].fullPath, paneToChangeId, useActivePane ? -1 : fileToChangeIndex);

                lastDirection = 0;

                changeFileDebounceFn = null;
            };

            changeFileDebounce = setTimeout(
                changeFileDebounceFn,
                1000 + Math.min(changeFileCounter * 100, 500) + (lastDirection && lastDirection !== crownMsg.ratchet_delta ? 2000: 0)
            );

            highlightFile(paneToChangeId, fileToChangeIndex);
        }

        lastDirection = crownMsg.ratchet_delta;
    };
});
