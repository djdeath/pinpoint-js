imports.gi.versions.ClutterGst = '3.0';

const Clutter = imports.gi.Clutter;
const ClutterGst = imports.gi.ClutterGst;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;

const Backgrounds = imports.backgrounds;
const PinpointParser = imports.pinpointParser;
const Utils = imports.utils;

ClutterGst.init(null, null);

let file = Gio.File.new_for_path(ARGV[0]);
Utils.setDirectory(file.get_parent());

let [, source] = file.load_contents(null);
let source = '' + source;
let document = PinpointParser.parse(source);

let properties = [];
let addDefaultProperty = function(doc, prop, val) {
  properties.push(prop);
  if (!doc.properties[prop])
    doc.properties[prop] = val;
};
addDefaultProperty(document, 'text-color', 'white');
addDefaultProperty(document, 'background-color', Backgrounds.colorFromString('black'));
addDefaultProperty(document, 'background', new Backgrounds.Null());
addDefaultProperty(document, 'font', 'Sans 60px');
addDefaultProperty(document, 'gravity', [Clutter.ActorAlign.CENTER, Clutter.ActorAlign.CENTER]);
addDefaultProperty(document, 'fill', false);
addDefaultProperty(document, 'no-markup', false);

let getProperties = function(doc, slide) {
  let props = {};
  properties.forEach(function(name) {
    if (slide.properties[name])
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
let _currentSlide = {
  index: 0,
  slide: null,
  text: null,
};

let marginBox = function(box) {
  return { x: box.width * 0.05,
           y: box.height * 0.05,
           width: box.width * 0.90,
           height: box.height * 0.90, };
};

let relayoutSlideInBox = function(box) {
  let props = getProperties(document, _currentSlide.slide);
  let mbox = marginBox(box);
  layoutText(mbox, _currentSlide.text, props.gravity);
};

let showSlide = function() {
  stage.remove_all_children();

  let slide = _currentSlide.slide = document.slides[_currentSlide.index];
  let props = getProperties(document, slide);

  props.background.load();

  let bgActor = new Clutter.Actor({
    x_align: Clutter.ActorAlign.FILL,
    y_align: Clutter.ActorAlign.FILL,
    x_expand: true,
    y_expand: true,
    background_color: props['background-color'],
    content_gravity: Clutter.ContentGravity.RESIZE_ASPECT,
  });
  props.background.attachContent(bgActor);
  stage.add_actor(bgActor);

  let str = slide.content.join('').trim();
  //log('text=|' + str + '|');
  let text = _currentSlide.text = new Clutter.Text({
    text: str,
    font_name: props.font,
    color: Backgrounds.colorFromString(props['text-color']),
    use_markup: !props['no-markup'],
  });
  bgActor.add_actor(text);

  relayoutSlideInBox(stage);
};
let previousSlide = function() {
  _currentSlide.index = Math.max(0, _currentSlide.index - 1);
  showSlide();
};
let nextSlide = function() {
  _currentSlide.index = Math.min(document.slides.length - 1, _currentSlide.index + 1);
  showSlide();
};


stage.connect('allocation-changed', function(actor, box, flags) {
  let b = { x: box.x1, y: box.y1, width: box.get_width(), height: box.get_height(), };
  Mainloop.timeout_add(0, function() {
    relayoutSlideInBox(b);
    return false;
  }.bind(this));
});

stage.connect('key-press-event', function(actor, event) {
  log(event.get_key_symbol());
  switch (event.get_key_symbol()) {
  case Clutter.KEY_Left: previousSlide(); break;
  case Clutter.KEY_Right: nextSlide(); break;
  case Clutter.KEY_q:
  case Clutter.KEY_Escape:
    stage.hide();
    Clutter.main_quit(); break;
  }
}.bind(this));

showSlide();

Clutter.main();
