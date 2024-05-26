/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets */

define(function (require, exports, module) {

    "use strict";

    const PreferencesManager = brackets.getModule("preferences/PreferencesManager");
    const Dialogs = brackets.getModule("widgets/Dialogs");

    const PREF_PREFIX = "mjerabek.cz.crowncontrol";
    const NS = "mjerabek_cz__crowncontrol";
    const ID = {
        predefinedData: NS + "__predefined-data"
    };

    const prefs = PreferencesManager.getExtensionPrefs(PREF_PREFIX);
    const prefsOptions = {
        location: {
            scope: "user"
        }
    };
    let tools = [];
    
    prefs.definePreference("predefined-data", "string", "crowncontrol.json", prefsOptions);

    function getOptionTplForTool(tool) {
        const options = tool.getOptions();

        return (`<h3 style="margin-top: 0">${options.tool}</h3>` + options.list.map((item, i) => {
            return `
                ${item.title ? `<h4 style="margin-top: ${(i ? 17: 12)}px; margin-bottom: 13px;">${item.title}</h4>` : ""}
                ${item.options.map(option => {
                    switch (item.type) {
                         case "radio":
                            return `
                                <label>
                                    <input type="radio" name="${item.key}" value="${option.value}" ${prefs.get(item.key) === option.value ? "checked": ""}>
                                    ${option.label}
                                </label>`;

                         case "checkbox":
                            return `
                                <label>
                                    <input type="checkbox" name="${option.key}" ${prefs.get(option.key) ? "checked": ""}>
                                    ${option.label}
                                </label>`;

                         default: return "";
                    }
                }).join("")}`;
        }).join("") + `<div style="height: 1px; margin: 19px 0 14px 0; background: rgba(127, 127, 127, 0.25)"></div>`);
    }

    function getOptionsDialog() {
        const content = `
            <form>
                ${tools.filter(tool => typeof tool.getOptions === "function").reverse().map(getOptionTplForTool).join("")}
                <h3 style="margin-top: 0">Predefined data</h3>
                <label for="${ID.predefinedData}">Path to .json file</label>
                <div style="display: flex;">
                    <span style="margin-right: 2px; line-height: 28px;">project&sol;</span>
                    <input type="text" id="${ID.predefinedData}" value="${prefs.get("predefined-data")}">
                </div>
            </form>`;
        const btns = [
            {
                className: Dialogs.DIALOG_BTN_CLASS_PRIMARY,
                id: Dialogs.DIALOG_BTN_OK,
                text: "Save"
            },
            {
                className: Dialogs.DIALOG_BTN_CLASS_LEFT,
                id: Dialogs.DIALOG_BTN_CANCEL,
                text: "Cancel"
            }
        ];

        const dialog = Dialogs.showModalDialog(NS, "Crown Control Options", content, btns);
        const $dialogEl = dialog.getElement();

        dialog.done(function () {
            $dialogEl.off("." + NS);
        });

        return dialog;
    }

    function processDialog($dialogEl, btnId) {
        if (btnId === Dialogs.DIALOG_BTN_OK) {
            tools.forEach(function (tool) {
                if (typeof tool.getOptions === "function") {
                    const options = tool.getOptions();
                    options.list.forEach(function (option) {
                        switch (option.type) {

                            case "radio":
                                const $element = $dialogEl.find("[name='" + option.key + "']:checked");
                                if ($element.length) {
                                    prefs.set(option.key, $element.val(), prefsOptions);
                                }
                            break;

                            case "checkbox":
                                option.options.forEach(function (checkbox) {
                                    const $element = $dialogEl.find("[name='" + checkbox.key + "']");
                                    if ($element.length) {
                                        prefs.set(checkbox.key, $element.prop("checked"), prefsOptions);
                                    }
                                });
                            break;
                        }
                    });
                }
            });

            const predefinedData = $dialogEl.find("#" + ID.predefinedData).val();
            prefs.set("predefined-data", predefinedData, prefsOptions);
        }
    }

    const $optionIcon = $("<a>");
    $optionIcon
        .html(`
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="rgb(187, 187, 187)">
                <path d="M3 16l-3-10 7.104 4 4.896-8 4.896 8 7.104-4-3 10h-18zm0 2v4h18v-4h-18z"/>
            </svg>
        `)
        .attr({
            id: NS + "__options",
            href: "#",
            title: "Crown Control Options"
        })
        .css({
            justifyContent: "center",
            alignItems: "center"
        })
        .appendTo($("#main-toolbar .buttons"));

    $optionIcon.on("click." + NS, function () {
        const dialog = getOptionsDialog();
        dialog.done(function (btnId) {
            processDialog(dialog.getElement(), btnId);
        });
    });

    exports.addTools = function (_tools) {
        tools = _tools;
        _tools.forEach(function (tool) {
            if (tool.getDefaultOptions) {
                tool.getDefaultOptions().forEach(function (option) {
                    prefs.definePreference(option.key, option.type, option.value);
                });
            }
        });
    };

    exports.define = function (key, type, value) {
        prefs.definePreference(key, type, value);
    };

    exports.get = function (key) {
        return prefs.get(key);
    };

    exports.onChange = function (key, fn) {
        return prefs.on("change", key, fn);
    };
});
