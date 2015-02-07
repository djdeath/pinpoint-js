const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Pango = imports.gi.Pango;

let _directory = null;
let setDirectory = function(directory) {
    _directory = directory;
};

let getFile = function(filename) {
    return _directory.get_child(filename);
};

//
let _textAlignments = {
  "left":    Pango.Alignment.LEFT,
  "center":  Pango.Alignment.CENTER,
  "right":   Pango.Alignment.RIGHT,
};
let isTextAlignment = function(str) {
  return this._textAlignments.hasOwnProperty(str);
};
let getTextAlignment = function(str) {
  return this._textAlignments[str];
};

//

let _gravities = {
  "top-left":     [Clutter.ActorAlign.START,  Clutter.ActorAlign.START],
  "top":          [Clutter.ActorAlign.CENTER, Clutter.ActorAlign.START],
  "top-right":    [Clutter.ActorAlign.END,    Clutter.ActorAlign.START],
  "left":         [Clutter.ActorAlign.START,  Clutter.ActorAlign.CENTER],
  "center":       [Clutter.ActorAlign.CENTER, Clutter.ActorAlign.CENTER],
  "right":        [Clutter.ActorAlign.END,    Clutter.ActorAlign.CENTER],
  "bottom-left":  [Clutter.ActorAlign.START,  Clutter.ActorAlign.END],
  "bottom":       [Clutter.ActorAlign.CENTER, Clutter.ActorAlign.END],
  "bottom-right": [Clutter.ActorAlign.END,  Clutter.ActorAlign.END],
};
let isGravity = function(str) {
  return this._gravities.hasOwnProperty(str);
};
let getGravity = function(str) {
  return this._gravities[str];
};

//

let colorFromString = function(str) {
  let [ret, color] = Clutter.Color.from_string(str);
  return color;
};

let isValidColor = function(str) {
  let [success, color] = Clutter.Color.from_string(str);
  return success;
};

let isMimeType = function(filename, mime) {
  let [type, uncertain] = Gio.content_type_guess(getFile(filename).get_path(),
                                                 null);
  return type.indexOf(mime) == 0;
};
