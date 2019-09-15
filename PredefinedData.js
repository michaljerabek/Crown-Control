/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets */

define(function (require, exports, module) {

    "use strict";

    var FileSystem = brackets.getModule("filesystem/FileSystem"),
        ProjectManager = brackets.getModule("project/ProjectManager");


    var FILE_NAME = "crowncontrol.json";


    var onChange = [],
        currentFile = null,
        currentFilePath = "",

        data = {};

    function loadData() {

        if (currentFile && currentFile.fullPath) {

            brackets.fs.readFile(currentFile.fullPath, "utf8", function (code, content) {

                data = {};

                if (code === brackets.fs.NO_ERROR) {

                    try {

                        data = JSON.parse(content);

                    } catch (e) {}
                }

                onChange.forEach(function (fn) {

                    fn(data);
                });
            });
        }
    }

    FileSystem.on("change", function (event, fileOrDir) {

        if (fileOrDir && fileOrDir.isFile && fileOrDir.fullPath === currentFilePath) {

            currentFile = fileOrDir;

            loadData();
        }
    });

    ProjectManager.on("projectOpen", function (event, dir) {

        currentFilePath = dir.fullPath + FILE_NAME;
        currentFile = FileSystem.getFileForPath(currentFilePath);

        loadData();
    });

    exports.onChange = function (fn) {

        onChange.push(fn);
    };
});
