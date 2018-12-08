(function() {

    const process = require("process");

    const DOMAIN_NAME = "crowncontrolnodedomain";

    let domainManager;

    function getProcessData() {

        return {
            platform: process.platform,
            pid: process.pid
        };
    }

    exports.init = function init(_domainManager) {

        domainManager = _domainManager;

        if (!_domainManager.hasDomain(DOMAIN_NAME)) {

            _domainManager.registerDomain(DOMAIN_NAME, {major: 0, minor: 1});
        }


        domainManager.registerCommand(
            DOMAIN_NAME,
            "init",
            getProcessData,
            false,
            "Returns process.platform and process.pid.",
            [],
            [
                {
                    name: "process",
                    type: "object",
                    description: "process.platform and process.pid."
                }
            ]
        );
    };
}());
