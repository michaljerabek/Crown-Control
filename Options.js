/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets */

define(function (require, exports, module) {

    "use strict";

    var PREF_PREFIX = "mjerabek.cz.crowncontrol",
        NS = "mjerabek_cz__crowncontrol",

        ID = {
            predefinedData: NS + "__predefined-data"
        },

        tools = [],

        PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        Dialogs = brackets.getModule("widgets/Dialogs"),

        prefs = PreferencesManager.getExtensionPrefs(PREF_PREFIX);


    prefs.definePreference("predefined-data", "string", "crowncontrol.json");


    function getOptionTplForTool(tool) {

        var options = tool.getOptions();

        return (`<h3>${options.tool}</h3>` + options.list.map(item => {

            return `
                ${item.title ? `<h4 style="margin-top: 15px;">${item.title}</h4>` : ""}
                ${item.options.map(option => {

                    switch (item.type) {

                         case "radio":
                            return `
                                <label>
                                    <input type="radio" name="${item.key}" value="${option.value}" ${prefs.get(item.key) === option.value ? "checked": ""}/>
                                    ${option.label}
                                </label>`;

                         case "checkbox":
                            return `
                                <label>
                                    <input type="checkbox" name="${option.key}" ${prefs.get(option.key) ? "checked": ""}/>
                                    ${option.label}
                                </label>`;

                         default: return "";
                    }
                }).join("")}`;
        }).join("") + `<div style="height: 1px; margin: 20px 0 15px 0; background: rgba(127, 127, 127, 0.25)"></div>`);
    }

    function getOptionsDialog() {

        var content = `
            <form>
                ${tools.filter(tool => typeof tool.getOptions === "function").reverse().map(getOptionTplForTool).join("")}
                <h3>Predefined data</h3>
                <label for="${ID.predefinedData}">Path to .json file</label>
                <div style="display: flex;">
                    <span style="margin-right: 2px; line-height: 28px;">project&sol;</span>
                    <input type="text" id="${ID.predefinedData}" value="${prefs.get("predefined-data")}"/>
                </div>
            </form>`,

            btns = [
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
            ],

            dialog = Dialogs.showModalDialog(NS, "Crown Control Options", content, btns),
            $dialogEl = dialog.getElement();

        dialog.done(function () {
            $dialogEl.off("." + NS);
        });

        return dialog;
    }

    function processDialog($dialogEl, btnId) {

        var prefsOptions = {
            location: {
                scope: "user"
            }
        };

        if (btnId === Dialogs.DIALOG_BTN_OK) {

            tools.forEach(function (tool) {

                if (typeof tool.getOptions === "function") {

                    var options = tool.getOptions();

                    options.list.forEach(function (option) {

                        switch (option.type) {

                            case "radio":

                                var $element = $dialogEl.find("[name='" + option.key + "']:checked");

                                if ($element.length) {

                                    prefs.set(option.key, $element.val(), prefsOptions);
                                }
                            break;

                            case "checkbox":

                                option.options.forEach(function (checkbox) {

                                    var $element = $dialogEl.find("[name='" + checkbox.key + "']");

                                    if ($element.length) {

                                        prefs.set(checkbox.key, $element.prop("checked"), prefsOptions);
                                    }
                                });
                            break;
                        }
                    });
                }
            });

            var predefinedData = $dialogEl.find("#" + ID.predefinedData).val();

            prefs.set("predefined-data", predefinedData, prefsOptions);
        }
    }


    var $optionIcon = $("<a>");

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

        var dialog = getOptionsDialog();

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

    exports.get = function (key) {

        return prefs.get(key);
    };

    exports.onChange = function (key, fn) {

        return prefs.on("change", key, fn);
    };
});
