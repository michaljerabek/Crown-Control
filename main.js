/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets */

define(function (require, exports, module) {

    "use strict";
    
    const ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
    const NodeConnector = brackets.getModule("NodeConnector");
    const nodeConnector = NodeConnector.createNodeConnector("mjerabek.cz.crowncontrol", {});
    const AppInit = brackets.getModule("utils/AppInit");

    require("InstallManager");
    const Options = require("Options");
    const CrownConnection = require("CrownConnection");
    
    AppInit.appReady(function () {
        Phoenix.app.getProcessID().then(function (pid) {
            CrownConnection.init(nodeConnector, Phoenix.platform, pid);
        });
    });

    const CSSFiltersTool = require("CSSFiltersTool");
    const IncOrDecNumberTool = require("IncOrDecNumberTool");
    const DefaultTool = require("DefaultTool");
    const ChangeColorTool = require("ChangeColorTool");   
    require("PaneSwitcher");

    const TOOLS = [ChangeColorTool, CSSFiltersTool, IncOrDecNumberTool, DefaultTool];
    let currentTool = null;
    let currentToolId = "";

    Options.addTools(TOOLS);

    CrownConnection.on("close", function () {
        currentTool = null;
        currentToolId = "";
    });

    CrownConnection.on("crown_touch_event", function (crownMsg) {
        if (!crownMsg.touch_state) return;
        
        let toolFound = false;
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
    });

    CrownConnection.on("crown_turn_event", function (crownMsg) {
        currentTool?.update(crownMsg);
    });
});
