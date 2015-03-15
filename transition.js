const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const TransitionParser = imports.transitionParser;
const Utils = imports.utils;

let returnValue = function(val) { return function() { return val; }; };
const Default = {
  name: 'default',
  duration: 250,
  pre: { main: { opacity: {
    animation: Clutter.AnimationMode.LINEAR,
    getValue: returnValue(0), }, }, },
  show: { main: { opacity: {
    animation: Clutter.AnimationMode.LINEAR,
    getValue: returnValue(255), }, }, },
  post: { main: { opacity: {
    animation: Clutter.AnimationMode.LINEAR,
    getValue: returnValue(0), }, }, },
};

let load = function(name) {
  let file = Gio.File.new_for_path('./transitions/' + name + '.trans');
  try {
    let [, source] = file.load_contents(null);
    source = '' + source;
    try {
      let transition = TransitionParser.parse(source);
      if (!transition.duration) transition.duration = 800;
      transition.name = name;
      return transition;
    } catch (e) {
      let pos = Utils.indexToPosition(source, e.idx);
      log('Parsing error in transition ' + name +
          ' : line ' + pos.line + ' offset ' + pos.offset);
    }
  } catch (e) {
    log('Cannot load transition ' + name + ' : ' + e.message);
  }

  return Default;
};

const TEST = false;
if (TEST) log(JSON.stringify(load(ARGV[0]), null, 2));
