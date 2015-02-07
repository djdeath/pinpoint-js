const Gio = imports.gi.Gio;

let _directory = null;
let setDirectory = function(directory) {
    _directory = directory;
};

let getFile = function(filename) {
    return _directory.get_child(filename);
};
