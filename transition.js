const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const TransitionParser = imports.transitionParser;
const Utils = imports.utils;

const Default = {
  duration: 250,
  pre: { main: { opacity: {
    animation: Clutter.AnimationMode.LINEAR,
    value: 0, }, }, },
  show: { main: { opacity: {
    animation: Clutter.AnimationMode.LINEAR,
    value: 255, }, }, },
  post: { main: { opacity: {
    animation: Clutter.AnimationMode.LINEAR,
    value: 0, }, }, },
};

let load = function(name) {
  let file = Gio.File.new_for_path('./transitions/' + name + '.trans');
  try {
    let [, source] = file.load_contents(null);
    source = '' + source;
    let transition = TransitionParser.parse(source);
    transition.duration = 250;
    return transition;
  } catch (e) {
    log('Cannot load transition ' + name + ' : ' + e.message);
  }

  return Default;
};

const TEST = false;
if (TEST) log(JSON.stringify(load(ARGV[0]), null, 2));
