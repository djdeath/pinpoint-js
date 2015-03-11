const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Pango = imports.gi.Pango;

let _directory = null;
let setDirectory = function(directory) { _directory = directory; };

let getFile = function(filename) { return _directory.get_child(filename); };

//
let _textAlignments = {
  "left":    Pango.Alignment.LEFT,
  "center":  Pango.Alignment.CENTER,
  "right":   Pango.Alignment.RIGHT,
};
let isTextAlignment = function(str) {
  return _textAlignments.hasOwnProperty(str);
};
let textAlignmentFromString = function(str) { return _textAlignments[str]; };

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
  return _gravities.hasOwnProperty(str);
};
let gravityFromString = function(str) { return _gravities[str]; };

//

let isAnimationMode = function(str) {
  let s = str.toUpperCase().replace('-', '_');
  return Clutter.AnimationMode[s] != undefined || str == 'none';
};

let animationModeFromString = function(str) {
  if (str == 'none') return 0;
  let s = str.toUpperCase().replace('-', '_');
  return Clutter.AnimationMode[s];
};

//

let colorFromString = function(str) {
  let [ret, color] = Clutter.Color.from_string(str);
  return color;
};

let isColor = function(str) {
  let [success, color] = Clutter.Color.from_string(str);
  return success;
};

let isMimeType = function(filename, mime) {
  let [type, uncertain] = Gio.content_type_guess(getFile(filename).get_path(),
                                                 null);
  return type.indexOf(mime) == 0;
};

//

let indexToPosition = function(source, idx) {
  let linePos = 0, lineNum = 0;
  for (let i = 0; i < idx; i++) {
    if (source.charAt(i) == '\n') {
      linePos = i;
      lineNum++;
    }
  }
  return { line: lineNum + 1, offset: idx - linePos };
};

//

let returnValue = function(value) { return function() { return value; }; };

let forEachKeyVal = function(object, callback) {
  for (let k in object) {
    if (object.hasOwnProperty(k))
      callback(k, object[k]);
  }
};

let mergeObjects = function(level, obj1, obj2) {
  if (obj1 === undefined) return obj2;
  if (obj2 === undefined) return obj1;
  if (level <= 0) return obj2;

  let keys = {};
  Object.keys(obj1).concat(Object.keys(obj2)).forEach(function(k) {
    keys[k] = true;
  });
  let ret = {};
  for (let i in keys) {
    if (typeof obj1[i] === 'object')
      ret[i] = mergeObjects(level - 1, obj1[i], obj2[i]);
    else if (obj2[i] !== undefined)
      ret[i] = obj2[i];
    else
      ret[i] = obj1[i];
  }
  return ret;
};

//

let boxToString = function(box) {
  return '' + box.width + 'x' + box.height + ' @ ' + box.x + 'x' + box.y;
};
