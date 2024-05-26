const WebSocketClient = require("ws");
const nodeConnector = global.createNodeConnector("mjerabek.cz.crowncontrol", exports);

let initialized = false;
const RECONNECT_TIMEOUT = 2000;
let reconnectDebounce = null;
let connection = null;

function connect() {
    if (connection) return;
    connection = new WebSocketClient("ws://127.0.0.1:10134");
    
    connection.onopen = function (event) {
        //console.log("onopen", event);
        nodeConnector.triggerPeer("open", {});
    };

    connection.onmessage = function (event) {
        //console.log("onmessage", event);
        nodeConnector.triggerPeer("message", {
            data: event.data
        });
    };

    connection.onclose = function (event) {
        //console.log("onclose", event);
        nodeConnector.triggerPeer("close", {});
        connection = null;
        clearTimeout(reconnectDebounce);
        reconnectDebounce = setTimeout(connect, RECONNECT_TIMEOUT);
    };

    connection.onerror = function (event) {
        //console.log("onerror", event);
        nodeConnector.triggerPeer("error", {});
        connection.close();
    };
}

exports.send = async function (message) {
    //console.log("send", message);
    connection?.send(message);
};

exports.init = async function () {
    if (initialized) return;
    connect();
    initialized = true;
};