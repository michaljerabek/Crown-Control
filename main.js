/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    var ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        NodeDomain = brackets.getModule("utils/NodeDomain");

    var Node = new NodeDomain("bracketscrownnode", ExtensionUtils.getModulePath(module, "Node.js")),
        CrownConnection = require("CrownConnection"),

        IncOrDecNumberTool = require("IncOrDecNumberTool"),
        DefaultTool = require("DefaultTool"),
        ChangeColorTool = require("ChangeColorTool");

    require("PaneSwitcher");


    var TOOLS = [ChangeColorTool, IncOrDecNumberTool, DefaultTool];


    var currentTool = null,
        currentToolId = "",
        updateUIOnTouchTimeout = null;


    var modKeysState = {
            altKey: false,
            ctrlKey: false,
            shiftKey: false
        },

        lastModKeysState = {
            altKey: false,
            ctrlKey: false,
            shiftKey: false
        },

        touchState = false,

        ctrlKeyCode;


    function onKeyHandler(event) {

        if ([16, 17, 18, 91, 93].indexOf(event.which) === -1) {

            return;
        }

        if (touchState) {

            event.preventDefault();
        }

        modKeysState.shiftKey = event.shiftKey;

        if (event.type === "keydown") {

            if (event.code.match(/^Alt/)) {

                modKeysState.altKey = true;

                if (event.code.match(/^AltRight/) && ctrlKeyCode === "ControlLeft") {

                    modKeysState.ctrlKey = false;
                }
            }

            if (event.code.match(/^Control|^OSLeft$|^OSRight$/)) {

                modKeysState.ctrlKey = true;
                ctrlKeyCode = event.code;
            }
        } else {

            if (event.code.match(/^Alt/)) {

                modKeysState.altKey = false;
            }

            if ((event.code.match(/^Control/) && (ctrlKeyCode !== "ControlRight" || event.code === "ControlRight")) || event.code.match(/^OSLeft$|^OSRight$/)) {

                modKeysState.ctrlKey = false;
                ctrlKeyCode = null;
            }
        }

        if (lastModKeysState.altKey !== modKeysState.altKey || lastModKeysState.ctrlKey !== modKeysState.ctrlKey || lastModKeysState.shiftKey !== modKeysState.shiftKey) {

            if (currentTool && currentTool.onModKeyChanged) {

                currentTool.onModKeyChanged(modKeysState, touchState);
            }

            lastModKeysState.altKey = modKeysState.altKey;
            lastModKeysState.ctrlKey = modKeysState.ctrlKey;
            lastModKeysState.shiftKey = modKeysState.shiftKey;
        }
    }

    window.addEventListener("keydown", onKeyHandler, true);
    window.addEventListener("keyup", onKeyHandler, true);

    TOOLS.forEach(function (tool) {

        if (tool.addModKeysState) {

            tool.addModKeysState(modKeysState);
        }
    });

    CrownConnection.on("close", function () {

        currentTool = null;
        currentToolId = "";
    });

    CrownConnection.on("deactivate_plugin", function () {

        modKeysState.altKey = false;
        modKeysState.ctrlKey = false;
        modKeysState.shiftKey = false;

        ctrlKeyCode = null;

        if (currentTool && currentTool.onModKeyChanged) {

            currentTool.onModKeyChanged(modKeysState, touchState);
        }
    });

    CrownConnection.on("crown_touch_event", function (crownMsg) {

        clearTimeout(updateUIOnTouchTimeout);

        touchState = !!crownMsg.touch_state;

        if (touchState) {

            TOOLS.some(function (tool) {

                if (tool.shouldBeUsed(crownMsg)) {

                    if (currentToolId !== tool.getToolId()) {

                        tool.use(CrownConnection);

                        currentTool = tool;

                        currentToolId = tool.getToolId();
                    }

                    if (tool.updateUIOnTouch) {

                        updateUIOnTouchTimeout = tool.updateUIOnTouch(CrownConnection);
                    }

                    return true;
                }
            });

        } else {

            if (currentTool && currentTool.onTouchEnd) {

                currentTool.onTouchEnd();
            }
        }
    });

    CrownConnection.on("crown_turn_event", function (crownMsg) {

        if (currentTool && currentTool.update) {

            currentTool.update(crownMsg);
        }
    });


    Node.exec("init").done(function (process) {

        CrownConnection.init(process.platform, process.pid);
    });
});
