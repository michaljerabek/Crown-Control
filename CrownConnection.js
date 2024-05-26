/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */

define(function (require, exports, module) {

    const PLUGIN_GUID = "11c8bb28-9fca-4489-a59f-bd11c0d689c5";
    let sessionId = "";
    let nodeConnector = null;
    
    const eventHandlers = {
        activate_plugin: [],
        deactivate_plugin: [],
        crown_touch_event: [],
        crown_turn_event: [],
        open: [],
        close: [],
        message: [],
        error: []
    };

    function registerPlugin(platform, pid) {
        nodeConnector?.execPeer("send", JSON.stringify({
            message_type: "register",
            plugin_guid: PLUGIN_GUID,
            PID: Number(pid),
            execName: platform.startsWith("win") ? "Phoenix Code.exe": "Phoenix Code.app"
        }));
    }

    exports.changeTool = function changeTool(toolId) {
        nodeConnector?.execPeer("send", JSON.stringify({
            message_type: "tool_change",
            session_id: sessionId,
            tool_id: toolId
        }));
    };

    exports.updateTool = function updateTool(toolId, options, showOverlay) {
        nodeConnector?.execPeer("send", JSON.stringify({
            message_type: "tool_update",
            session_id: sessionId,
            tool_id: toolId,
            show_overlay: showOverlay,
            tool_options: options
        }));
    };

    exports.on = function (event, handler) {
        eventHandlers[event]?.push(handler);
    };

    exports.init = async function (_nodeConnector, platform, pid) {
        nodeConnector = _nodeConnector;
        
        nodeConnector?.execPeer("init");
        
        nodeConnector?.on("open", function (event, data) {
            registerPlugin(platform, pid);
            eventHandlers.open.forEach(fn => fn(data));
        });
        
        nodeConnector?.on("message", function (event, message) {
            const data = JSON.parse(message.data);

            eventHandlers.message.forEach(fn => fn(message, data));

            if (data.message_type === "register_ack") {
                sessionId = data.session_id;
                return;
            }

            eventHandlers[data.message_type]?.forEach(fn => fn(data, message));
        });

        nodeConnector?.on("close", function (event, data) {
            eventHandlers.close.forEach(fn => fn(data));
        });

        nodeConnector?.on("error", function (event, data) {
            eventHandlers.error.forEach(fn => fn(data));
        });
    };
});
