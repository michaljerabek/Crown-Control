/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */

define(function (require, exports, module) {

    var WS_ADDRESS = "ws://127.0.0.1:10134",

        PLUGIN_GUID = "9df01287-806d-4292-9ee4-2c6e477fee55";

    var RECONNECT_TIMEOUT = 2000;

    var ws,
        reconnectTimeout,
        reconnecting,
        sessionId;

    var eventHandlers = {
        activate_plugin: [],
        deactivate_plugin: [],
        crown_touch_event: [],
        crown_turn_event: [],
        open: [],
        close: [],
        message: [],
        error: []
    };

    function reconnect(platform, pid) {

        if (!reconnecting) {

            console.log("BRACKETSCROWN: reconnect");

            ws = null;

            clearInterval(reconnectTimeout);

            reconnectTimeout = setInterval(createConnection.bind(null, platform, pid), RECONNECT_TIMEOUT);
        }
    }

    function registerPlugin(platform, pid) {

        if (!ws) {

            return;
        }

        ws.send(JSON.stringify({
            message_type: "register",
            plugin_guid: PLUGIN_GUID,
            PID: Number(pid),
            execName: platform === "darwin" ? "Brackets.app": "Brackets.exe"
        }));
    }

    function createConnection(platform, pid) {

        if (ws || reconnecting) {

            return;
        }

        //console.info("BRACKETSCROWN: create");

        reconnecting = true;

        ws = new WebSocket(WS_ADDRESS);

        ws.onopen = function (event) {

            //console.info("BRACKETSCROWN: open");

            clearInterval(reconnectTimeout);

            reconnecting = false;

            registerPlugin(platform, pid);

            eventHandlers.open.forEach(function (eventHandlerFn) {
                eventHandlerFn(event);
            });
        };

        ws.onmessage = function (msg) {

            var jsonObj = JSON.parse(msg.data);

            //console.info("BRACKETSCROWN: " + jsonObj.message_type);

            eventHandlers.message.forEach(function (eventHandlerFn) {
                eventHandlerFn(msg, jsonObj);
            });

            if (jsonObj.message_type === "register_ack") {

                sessionId = jsonObj.session_id;

                return;
            }

            if (eventHandlers[jsonObj.message_type]) {

                eventHandlers[jsonObj.message_type].forEach(function (eventHandlerFn) {
                    eventHandlerFn(jsonObj, msg);
                });
            }
        };

        ws.onclose = function (event) {

            console.info("BRACKETSCROWN: close");
            console.log(event);

            reconnecting = false;

            eventHandlers.close.forEach(function (eventHandlerFn) {
                eventHandlerFn(event);
            });

            reconnect(platform, pid);
        };

        ws.onerror = function (event) {

            console.error("BRACKETSCROWN: error");
            console.log(event);

            reconnecting = false;

            eventHandlers.error.forEach(function (eventHandlerFn) {
                eventHandlerFn(event);
            });

            ws.close();
        };
    }

    exports.changeTool = function changeTool(toolId) {

        if (!ws) {

            return;
        }

        ws.send(JSON.stringify({
            message_type: "tool_change",
            session_id: sessionId,
            tool_id: toolId
        }));
    };

    exports.updateTool = function updateTool(toolId, options, showOverlay) {

        if (!ws) {

            return;
        }

        ws.send(JSON.stringify({
            message_type: "tool_update",
            session_id: sessionId,
            tool_id: toolId,
            show_overlay: showOverlay,
            tool_options: options
        }));
    };

    exports.on = function (event, handler) {

        if (eventHandlers[event]) {

            eventHandlers[event].push(handler);
        }
    };

    exports.init = function (platform, pid) {

        createConnection(platform, pid);
    };
});
