/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    var FileSystem = brackets.getModule("filesystem/FileSystem"),
        ExtensionLoader = brackets.getModule("utils/ExtensionLoader"),
        Dialogs = brackets.getModule("widgets/Dialogs");


    var EXTENSION_PATH = ExtensionLoader.getUserExtensionPath() + "/mjerabek.cz.crowncontrol",
        APP_SUPPORT_DIR = brackets.app.getApplicationSupportDirectory(),
        FILE_NAME = "mjerabek.cz.crowncontrol.json",

        LINK_TO_INSTRUCTIONS = "https://github.com/michaljerabek/Crown-Control",
        COMMAND_TO_OPEN_EXT_FOLDER = "onclick='window.__mjerabek_cz_crowncontrol__open_extention_folder(event);'";


    var packageDOTjsonFile = FileSystem.getFileForPath(EXTENSION_PATH + "/package.json"),
        manifestDOTjsonFile = FileSystem.getFileForPath(EXTENSION_PATH + "/9df01287-806d-4292-9ee4-2c6e477fee55/Manifest/defaults.json"),
        extensionDOTjsonFile = FileSystem.getFileForPath(APP_SUPPORT_DIR + "/" + FILE_NAME);


    window.__mjerabek_cz_crowncontrol__open_extention_folder = function (event) {

        event.preventDefault();

        brackets.app.showOSFolder(EXTENSION_PATH);

        return false;
    };


    brackets.fs.readFile(packageDOTjsonFile.fullPath, "utf8", function (pkgCode, pkgContent) {

        brackets.fs.readFile(manifestDOTjsonFile.fullPath, "utf8", function (mftCode, mftContent) {

            brackets.fs.readFile(extensionDOTjsonFile.fullPath, "utf8", function (extCode, extContent) {

                var packageObj = JSON.parse(pkgContent),
                    extensionObj = extContent ? JSON.parse(extContent) : {},
                    manifestObj = JSON.parse(mftContent);

                if (extCode !== brackets.fs.NO_ERROR) {//first install

                    Dialogs.showModalDialog(
                        "crown-control",
                        "Crown Control",
                        "To finish installation, follow <a href='" + LINK_TO_INSTRUCTIONS + "'>instructions on GitHub</a> or in the README.md file in the <a href='#' " + COMMAND_TO_OPEN_EXT_FOLDER + ">extension folder</a>."
                    );

                    extensionDOTjsonFile.write(JSON.stringify({
                        version: packageObj.version,
                        profileVersion: manifestObj.info.version
                    }));

                } else {//update

                    if (extensionObj.version !== packageObj.version && extensionObj.profileVersion !== manifestObj.info.version) {//update requires to reinstall profile

                        Dialogs.showModalDialog(
                            "crown-control",
                            "Crown Control",
                            "To finish updating, you have to reinstall your profile for Logitech Options. Follow <a href='" + LINK_TO_INSTRUCTIONS + "'>instructions on GitHub</a> or in the README.md file in the <a href='#' " + COMMAND_TO_OPEN_EXT_FOLDER + ">extension folder</a>."
                        );

                        extensionDOTjsonFile.unlink(function () {

                            extensionDOTjsonFile.write(JSON.stringify({
                                version: packageObj.version,
                                profileVersion: manifestObj.info.version
                            }));
                        });
                    }
                }
            });
        });
    });
});
