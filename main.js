/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets */

define(function (require, exports, module) {

    "use strict";

    var ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        NodeDomain = brackets.getModule("utils/NodeDomain");


    require("InstallManager");

    var Node = new NodeDomain("crowncontrolnodedomain", ExtensionUtils.getModulePath(module, "Node.js")),

        CrownConnection = require("CrownConnection"),

        CSSFiltersTool = require("CSSFiltersTool"),
        IncOrDecNumberTool = require("IncOrDecNumberTool"),
        DefaultTool = require("DefaultTool"),
        ChangeColorTool = require("ChangeColorTool"),

        Options = require("Options");

    require("PaneSwitcher");


    var TOOLS = [ChangeColorTool, CSSFiltersTool, IncOrDecNumberTool, DefaultTool];

    Options.addTools(TOOLS);

    var currentTool = null,
        currentToolId = "";


    CrownConnection.on("close", function () {

        currentTool = null;
        currentToolId = "";
    });

    CrownConnection.on("crown_touch_event", function (crownMsg) {

        if (crownMsg.touch_state) {

            var toolFound = false;

            TOOLS.forEach(function (tool) {

                if (!toolFound && tool.shouldBeUsed(crownMsg)) {

                    if (currentToolId !== tool.getToolId()) {

                        tool.use(CrownConnection);

                        currentTool = tool;

                        currentToolId = tool.getToolId();
                    }

                    toolFound = true;

                    return;
                }

                tool.disable();
            });
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
