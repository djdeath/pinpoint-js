imports.gi.versions.ClutterGst = '3.0';

const Clutter = imports.gi.Clutter;
const ClutterGst = imports.gi.ClutterGst;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;

const Backgrounds = imports.backgrounds;
const PinpointParser = imports.pinpointParser;
const Transition = imports.transition;
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
addDefaultProperty(document, 'text_color', Utils.colorFromString('white'));
addDefaultProperty(document, 'background_color', Utils.colorFromString('black'));
addDefaultProperty(document, 'background', new Backgrounds.Null());
addDefaultProperty(document, 'font', 'Sans 60px');
addDefaultProperty(document, 'background_gravity', [Clutter.ActorAlign.CENTER,
                                                    Clutter.ActorAlign.CENTER]);
addDefaultProperty(document, 'background_scaling', 'fit');
addDefaultProperty(document, 'gravity', [Clutter.ActorAlign.CENTER,
                                         Clutter.ActorAlign.CENTER]);
addDefaultProperty(document, 'fill', false);
addDefaultProperty(document, 'use_markup', true);
addDefaultProperty(document, 'text_align', Pango.Alignment.LEFT);
addDefaultProperty(document, 'transition', Transition.Default);
addDefaultProperty(document, 'shading_opacity', 168);
addDefaultProperty(document, 'shading_color', Utils.colorFromString('black'));

document.properties['background'].load();
document.properties['background'].load = function() {};
document.properties['background'].unload = function() {};

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
  background_color: Utils.colorFromString('black'),
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

let layoutBackground = function(element, box, scaling, gravities) {
  if (!element.content) {
    element.width = box.width;
    element.height = box.height;
    return;
  }

  let [, w, h] = element.content.get_preferred_size();
  element.width = w;
  element.height = h;
  if (w == 0 || h == 0) return;

  let w_scale = box.width / w,
      h_scale = box.height / h;

  if (scaling == 'fill') {
      element.scale_x = element.scale_y = (w_scale > h_scale) ? w_scale : h_scale;
  } else if (scaling == 'fit') {
    element.scale_x = element.scale_y = (w_scale < h_scale) ? w_scale : h_scale;
  } else if (scaling == 'unscaled') {
    element.scale_x = element.scale_y = (w_scale < h_scale) ? w_scale : h_scale;
    if (element.scale_x > 1.0)
      element.scale_x = element.scale_y = 1.0;
  } else if (scaling == 'stretch') {
    element.scale_x = w_scale;
    element.scale_y = h_scale;
  }

  element.x = positionForGravity(element.width * element.scale_x,
                                 { start: box.x, end: box.x + box.width, },
                                 gravities[0]);
  element.y = positionForGravity(element.height * element.scale_y,
                                 { start: box.y, end: box.y + box.height, },
                                 gravities[1]);

  log('background=' + Utils.boxToString(element) + ' - box=' + Utils.boxToString(box));

};

let layoutText = function(element, box, gravities) {
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
  return { x: element.x,
           y: element.y,
           width: element.width * scale,
           height: element.height * scale, };
};

let layoutShading = function(element, text, box) {
  let padding = 0.01 * box.width;

  element.x = text.x - padding;
  element.y = text.y - padding;
  element.width = text.width + 2 * padding;
  element.height = text.height + 2 * padding;
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

let noMarginBox = function(element) {
  return { x: element.x,
           y: element.y,
           width: element.width,
           height: element.height, };
};

let marginBox = function(element) {
  return { x: element.width * 0.05,
           y: element.height * 0.05,
           width: element.width * 0.90,
           height: element.height * 0.90, };
};

let relayoutSlideInBox = function(slide, box) {
  let props = getProperties(document, slide.slideDef);

  layoutBackground(slide.background, box,
                   props.background_scaling,
                   props.background_gravity);

  let mbox = marginBox(box);
  let textBox = layoutText(slide.text, mbox, props.gravity);

  layoutShading(slide.shading, textBox, box);
};

let blankSlide = function(slide) {
  slide.main.visible = !slide.main.visible;
};

let setSlideState = function(slide, state, animate) {
  let props = getProperties(document, slide.slideDef);
  let transition = props.transition[state];
  Utils.forEachKeyVal(transition, function(actorName, actorProps) {
    let actor = slide[actorName];
    Utils.forEachKeyVal(actorProps, function(property, value) {
      if (animate) {
        actor.save_easing_state();
        actor.set_easing_duration(props.transition.duration);
        actor.set_easing_mode(value.animation);
      }
      actor[property] = value.value;
      if (animate)
        actor.restore_easing_state();
    });
  });
};

let loadSlide = function(index) {
  for (let i = 0; i < _slides.length; i++)
    if (_slides[i].index == index) {
      _slides = _slides.concat(_slides.splice(i));
      return _slides[_slides.length - 1];
    }

  let slideDef = document.slides[index];
  let props = getProperties(document, slideDef);
  let slide = {
    index: index,
    slideDef: slideDef,
    main: new Clutter.Actor({
      x_align: Clutter.ActorAlign.FILL,
      y_align: Clutter.ActorAlign.FILL,
      x_expand: true,
      y_expand: true,
      pivot_point: new Clutter.Point({x: 0.5, y: 0.5}),
    }),
    background: new Clutter.Actor({
      background_color: props.background_color,
      //pivot_point: new Clutter.Point({x: 0.5, y: 0.5}),
    }),
    shading: new Clutter.Actor({
      background_color: props.shading_color,
      opacity: props.shading_opacity,
    }),
    text: new Clutter.Text({
      text: slideDef.content.join('').trim(),
      font_name: props.font,
      color: props.text_color,
      use_markup: props.use_markup,
      line_alignment: props.text_align,
    }),
    relayout: function() {
      relayoutSlideInBox(this, stage);
    },
  };

  props.background.load();
  props.background.attachContent(slide.background, slide);

  slide.main.add_actor(slide.background);
  slide.main.add_actor(slide.shading);
  slide.main.add_actor(slide.text);
  stage.add_actor(slide.main);

  slide.main.show();
  setSlideState(slide, 'pre', false);

  _slides.push(slide);

  return slide;
};

let slideRange = function(index) {
  let delta = Math.round(_maxLoadedSlides / 2)
  let low = Math.max(0, index - delta);
  return {
    low: low,
    high: Math.min(document.slides.length - 1,
                   low + _maxLoadedSlides - 1),
  };
};

let loadSlides = function(index) {
  // let range = slideRange(index);
  // for (let i = range.low; i <= range.high; i++)
  //   relayoutSlideInBox(loadSlide(i), stage);
  relayoutSlideInBox(loadSlide(index), stage);
};

let pruneSlides = function() {
  let range = slideRange(currentSlide().index);
  let newSlides = [];
  _slides.forEach(function (slide) {
    if (slide.index >= range.low &&
        slide.index <= range.high)
      newSlides.push(slide);
    else {
      slide.main.destroy();
      let props = getProperties(document, slide.slideDef);
      props.background.unload();
    }
  });
  log('prune done : ' + (_slides.length - newSlides.length) + ' index: ' + currentSlide().index);
  _slides = newSlides;
};

let showSlide = function(index) {
  let old = currentSlide();
  if (old) {
    if (old.index == index) return; // Same slide

    setSlideState(old, old.index < index ? 'post' : 'pre', true);
    let props = getProperties(document, old.slideDef);
    props.background.setVisibility(false);
  }

  loadSlides(index);
  _currentSlide = index;
  let slide = currentSlide();
  let props = getProperties(document, slide.slideDef);
  setSlideState(slide, 'show', true);
  props.background.setVisibility(true);

  relayoutSlideInBox(slide, stage);

  pruneSlides();
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
stage.connect('button-press-event', function(actor, event) {
  nextSlide();
  return false;
}.bind(this));
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
