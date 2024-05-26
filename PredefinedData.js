/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets */

define(function (require, exports, module) {

    "use strict";

    const FileSystem = brackets.getModule("filesystem/FileSystem");
    const ProjectManager = brackets.getModule("project/ProjectManager");

    const Options = require("Options");

    const onChange = [];
        
    function getCurrentFilePath() {
        const fileName = Options.get("predefined-data");
        return ProjectManager.getProjectRoot().fullPath + fileName;
    }
    
    function getFile() {
        return FileSystem.getFileForPath(getCurrentFilePath());
    }

    function loadData(file) {
        if (!file?.fullPath) return;
        
        brackets.fs.readFile(file.fullPath, "utf8", function (err, content) {
            let data = {};
            if (typeof content === "string") {
                try {
                    data = JSON.parse(content);
                } catch (e) {}
            }

            onChange.forEach(fn => fn(data));
        });
    }

    FileSystem.on("change", function (event, subject) {
        if (subject.isFile && subject.fullPath === getCurrentFilePath()) {
            loadData(subject);
        }
    });

    ProjectManager.on("projectOpen", function () {
        loadData(getFile());
    });

    Options.onChange("predefined-data", function () {
        loadData(getFile());
    });

    exports.onChange = function (fn) {
        onChange.push(fn);
    };
});
