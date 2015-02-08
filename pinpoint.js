imports.gi.versions.ClutterGst = '3.0';

const Clutter = imports.gi.Clutter;
const ClutterGst = imports.gi.ClutterGst;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;

const Backgrounds = imports.backgrounds;
const PinpointParser = imports.pinpointParser;
const Utils = imports.utils;

ClutterGst.init(null, null);

if (ARGV.length < 1)
  throw "need at least one argument";

let document;
try {
  let file = Gio.File.new_for_path(ARGV[0]);
  Utils.setDirectory(file.get_parent());
  let [, source] = file.load_contents(null);
  document = PinpointParser.parse('' + source);
} catch (e) {
  if (e.idx !== undefined) {
    let pos = Utils.indexToPosition(str, e.idx);
    log('Parsing error at : line ' + pos.line + ' offset ' + pos.offset);
  } else
    log(e.message);
  throw e;
}

let properties = [];
let addDefaultProperty = function(doc, prop, val) {
  properties.push(prop);
  if (doc.properties[prop] === undefined)
    doc.properties[prop] = val;
};
addDefaultProperty(document, 'text-color', Utils.colorFromString('white'));
addDefaultProperty(document, 'background-color', Utils.colorFromString('black'));
addDefaultProperty(document, 'background', new Backgrounds.Null());
addDefaultProperty(document, 'font', 'Sans 60px');
addDefaultProperty(document, 'background-gravity', Clutter.ContentGravity.RESIZE_ASPECT);
addDefaultProperty(document, 'gravity', [Clutter.ActorAlign.CENTER,
                                         Clutter.ActorAlign.CENTER]);
addDefaultProperty(document, 'fill', false);
addDefaultProperty(document, 'use-markup', true);
addDefaultProperty(document, 'text-align', Pango.Alignment.LEFT);

let getProperties = function(doc, slide) {
  let props = {};
  properties.forEach(function(name) {
    if (slide.properties[name] !== undefined)
      props[name] = slide.properties[name];
    else
      props[name] = doc.properties[name];
  });
  return props;
};

let stage = new Clutter.Stage({
  width: 640,
  height: 480,
  layout_manager: new Clutter.BinLayout(),
  user_resizable: true,
  background_color: new Clutter.Color(), // Black
  title: 'Pinpoint-js presentation'
});
stage.show();

let positionForGravity = function(position, container, gravity) {
  switch (gravity) {
  case Clutter.ActorAlign.START:
    return container.start;
  case Clutter.ActorAlign.END:
    return container.end - position;
  case Clutter.ActorAlign.CENTER:
    return container.start + ((container.end - container.start) - position) / 2;
  }
  return -1;
};

let layoutText = function(box, element, gravities) {
  //log('layout text in : ' + box.width + 'x' + box.height + ' @ ' + box.x + 'x' + box.y);
  let x, y;
  let [, , w, h] = element.get_preferred_size();
  let scale =
      element.scale_x =
      element.scale_y = Math.min(Math.min(1, box.width / w),
                                 box.height / h);
  element.x = positionForGravity(w * scale,
                                 { start: box.x,
                                   end: box.x + box.width, },
                                 gravities[0]);
  element.y = positionForGravity(h * scale,
                                 { start: box.y,
                                   end: box.y + box.height, },
                                 gravities[1]);
};

//
let _slides = [];
let _maxLoadedSlides = 5;

//
let _currentSlide = -1;
let currentSlide = function() {
  for (let i = 0; i < _slides.length; i++)
    if (_slides[i].index == _currentSlide)
      return _slides[i];
  return null;
}

let marginBox = function(box) {
  return { x: box.width * 0.05,
           y: box.height * 0.05,
           width: box.width * 0.90,
           height: box.height * 0.90, };
};

let relayoutSlideInBox = function(slide, box) {
  let props = getProperties(document, slide.slideDef);
  let mbox = marginBox(box);
  layoutText(mbox, slide.text, props.gravity);
  slide.background.width = box.width;
  slide.background.height = box.height;
};

let blankSlide = function(slide) {
  slide.main.visible = !slide.main.visible;
};

let loadSlide = function(index) {
  for (let i = 0; i < _slides.length; i++)
    if (_slides[i].index == index)
      return _slides[i];

  let slideDef = document.slides[index];
  let props = getProperties(document, slideDef);
  let slide = { index: index,
                slideDef: slideDef,
                main: new Clutter.Actor({
                  x_align: Clutter.ActorAlign.FILL,
                  y_align: Clutter.ActorAlign.FILL,
                  x_expand: true,
                  y_expand: true,
                }),
                background: new Clutter.Actor({
                  x_align: Clutter.ActorAlign.FILL,
                  y_align: Clutter.ActorAlign.FILL,
                  x_expand: true,
                  y_expand: true,
                  background_color: props['background-color'],
                  content_gravity: props['background-gravity'],
                }),
                text: new Clutter.Text({
                  text: slideDef.content.join('').trim(),
                  font_name: props.font,
                  color: props['text-color'],
                  use_markup: props['use-markup'],
                  line_alignment: props['text-align'],
                }), };

  props.background.load();
  props.background.attachContent(slide.background);

  slide.main.add_actor(slide.background);
  slide.main.add_actor(slide.text);
  stage.add_actor(slide.main);

  slide.main.hide();

  _slides.push(slide);

  return slide;
};

let loadSlides = function(index) {
  let delta = Math.round(_maxLoadedSlides / 2),
      low = Math.max(0, index - delta),
      up = Math.min(document.slides.length - 1, low + _maxLoadedSlides);

  for (let i = low; i < up; i++)
    relayoutSlideInBox(loadSlide(i), stage);
};

let showSlide = function(index) {
  let old = currentSlide();
  if (old) {
    old.main.hide();
  }

  loadSlide(index);
  _currentSlide = index;
  currentSlide().main.show();

  relayoutSlideInBox(currentSlide(), stage);
};
let previousSlide = function() {
  showSlide(Math.max(0, currentSlide().index - 1));
};
let nextSlide = function() {
  showSlide(Math.min(document.slides.length - 1, currentSlide().index + 1));
};


stage.connect('allocation-changed', function(actor, box, flags) {
  let b = { x: box.x1, y: box.y1, width: box.get_width(), height: box.get_height(), };
  Mainloop.timeout_add(0, function() {
    relayoutSlideInBox(currentSlide(), b);
    return false;
  }.bind(this));
});

stage.connect('destroy', function(actor) { Clutter.main_quit(); });
stage.connect('key-press-event', function(actor, event) {
  switch (event.get_key_symbol()) {
  case Clutter.KEY_Up:
  case Clutter.KEY_Left: previousSlide(); break;
  case Clutter.KEY_Down:
  case Clutter.KEY_Right:
  case Clutter.KEY_space: nextSlide(); break;
  case Clutter.KEY_q:
  case Clutter.KEY_Escape: stage.destroy(); Clutter.main_quit(); break;
  case Clutter.KEY_b: blankSlide(currentSlide()); break;
  case Clutter.KEY_F11: stage.set_fullscreen(!stage.fullscreen_set); break;
  }
  return false;
}.bind(this));

loadSlides(0);
showSlide(0);

Clutter.main();
