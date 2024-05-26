/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {

    "use strict";

    const FileSystem = brackets.getModule("filesystem/FileSystem");
    const ExtensionLoader = brackets.getModule("utils/ExtensionLoader");
    const Dialogs = brackets.getModule("widgets/Dialogs");

    const EXTENSION_PATH = ExtensionLoader.getUserExtensionPath() + "/mjerabek.cz.crowncontrol";
    const APP_SUPPORT_DIR = brackets.app.getApplicationSupportDirectory();
    const FILE_NAME = "mjerabek.cz.crowncontrol.json";

    const packageDOTjsonFile = FileSystem.getFileForPath(EXTENSION_PATH + "/package.json");
    const manifestDOTjsonFile = FileSystem.getFileForPath(EXTENSION_PATH + "/11c8bb28-9fca-4489-a59f-bd11c0d689c5/Manifest/defaults.json");
    const extensionDOTjsonFile = FileSystem.getFileForPath(APP_SUPPORT_DIR + "/" + FILE_NAME);

    brackets.fs.readFile(packageDOTjsonFile.fullPath, "utf8", function (pkgErr, pkgContent) {
        brackets.fs.readFile(manifestDOTjsonFile.fullPath, "utf8", function (mftErr, mftContent) {
            brackets.fs.readFile(extensionDOTjsonFile.fullPath, "utf8", function (extErr, extContent) {
                try {
                    const packageObj = JSON.parse(pkgContent);
                    const extensionObj = typeof extContent === "string" ? JSON.parse(extContent) : {};
                    const manifestObj = JSON.parse(mftContent);

                    //first install
                    if (typeof extContent !== "string") { 
                        Dialogs.showModalDialog(
                            "crown-control",
                            "Crown Control",
                            "To finish installation, follow <a href='" + packageObj.homepage + "'>instructions on GitHub</a> or in the README.md file in the <a href='#' onclick='Phoenix.app.openPathInFileBrowser(\"" + EXTENSION_PATH + "/README.md" + "\"); return false;'>extension folder</a>."
                        );

                        extensionDOTjsonFile.write(JSON.stringify({
                            version: packageObj.version,
                            profileVersion: manifestObj.info.version
                        }));
                        
                    //update
                    } else {
                        //update requires to reinstall profile
                        if (extensionObj.version !== packageObj.version && extensionObj.profileVersion !== manifestObj.info.version) { 
                            Dialogs.showModalDialog(
                                "crown-control",
                                "Crown Control",
                                "To finish updating, you have to reinstall your profile for Logitech Options. Follow <a href='" + packageObj.homepage + "'>instructions on GitHub</a> or in the README.md file in the <a href='#' onclick='Phoenix.app.openPathInFileBrowser(\"" + EXTENSION_PATH + "/README.md" + "\"); return false;'>extension folder</a>."
                            );

                            extensionDOTjsonFile.unlink(function () {
                                extensionDOTjsonFile.write(JSON.stringify({
                                    version: packageObj.version,
                                    profileVersion: manifestObj.info.version
                                }));
                            });
                        }
                    }

                } catch (e) {
                    console.log("CROWNCONTROL: InstallManager error!", e);
                }
            });
        });
    });
});
