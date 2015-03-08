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
// Make load/unload functions no-ops on default background
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
  width: 800,
  height: 600,
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
    return { width: box.width,
             height: box.height,
             opacity: 255, };
  }

  let ret = { opacity: 255, };
  let [, w, h] = element.content.get_preferred_size();
  ret.width = w;
  ret.height = h;
  if (w == 0 || h == 0) return ret;

  let w_scale = box.width / w,
      h_scale = box.height / h;

  if (scaling == 'fill') {
      ret.scale_x = ret.scale_y = (w_scale > h_scale) ? w_scale : h_scale;
  } else if (scaling == 'fit') {
    ret.scale_x = ret.scale_y = (w_scale < h_scale) ? w_scale : h_scale;
  } else if (scaling == 'unscaled') {
    ret.scale_x = ret.scale_y = (w_scale < h_scale) ? w_scale : h_scale;
    if (element.scale_x > 1.0)
      ret.scale_x = ret.scale_y = 1.0;
  } else if (scaling == 'stretch') {
    ret.scale_x = w_scale;
    ret.scale_y = h_scale;
  }

  ret.x = positionForGravity(ret.width * ret.scale_x,
                             { start: box.x, end: box.x + box.width, },
                             gravities[0]);
  ret.y = positionForGravity(ret.height * ret.scale_y,
                             { start: box.y, end: box.y + box.height, },
                             gravities[1]);
  return ret;
};

let layoutText = function(element, box, gravities) {
  let ret = { opacity: 255, };
  let [, , w, h] = element.get_preferred_size();
  let scale =
      ret.scale_x =
      ret.scale_y = Math.min(Math.min(1, box.width / w),
                             box.height / h);
  ret.x = positionForGravity(w * scale,
                             { start: box.x,
                               end: box.x + box.width, },
                             gravities[0]);
  ret.y = positionForGravity(h * scale,
                             { start: box.y,
                               end: box.y + box.height, },
                             gravities[1]);
  ret.width = w;
  ret.height = h;

  return ret;
};

let layoutShading = function(element, text, box, props) {
  let padding = 0.01 * box.width;
  return { x: text.x - padding,
           y: text.y - padding,
           width: text.width + 2 * padding,
           height: text.height + 2 * padding,
           opacity: props.shading_opacity, };
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

let slideIndexToState = function(index) {
  return (index < _currentSlide ? 'pre' :
          (index > _currentSlide ? 'post' : 'show'));
};

let marginBox = function(element) {
  return { x: element.width * 0.05,
           y: element.height * 0.05,
           width: element.width * 0.90,
           height: element.height * 0.90, };
};

let computeSlideLayout = function(slide, box) {
  let mbox = marginBox(box);
  let props = getProperties(document, slide.slideDef);
  let layout = { main: { width: box.width, height: box.height, opacity: 255 } };

  layout.background = layoutBackground(slide.background, box,
                                       props.background_scaling,
                                       props.background_gravity);
  layout.text = layoutText(slide.text, mbox, props.gravity);
  layout.shading = layoutShading(slide.shading,
                                 { x: layout.text.x,
                                   y: layout.text.y,
                                   width: layout.text.width * layout.text.scale_x,
                                   height: layout.text.height * layout.text.scale_y, },
                                 box,
                                 props);

  for (let a in layout)
    for (let k in layout[a])
      layout[a][k] = { animation: Clutter.AnimationMode.LINEAR,
                       getValue: Utils.returnValue(layout[a][k]) };

  return layout;
};

let blankSlide = function(slide) {
  slide.main.visible = !slide.main.visible;
};

let setSlideState = function(slide, state, animate) {
  //log('======> slide=' + slide.index + ' state=' + state + ' animate=' + animate);
  let props = getProperties(document, slide.slideDef);
  props.background.setVisibility(state == 'show');

  // TODO: We should compute the max of all elements.
  let ctx = { width: slide.background.width * slide.background.scale_x,
              height: slide.background.height * slide.background.scale_y, };

  let transition;
  if (state == 'show')
    transition = Utils.mergeObjects(3, props.transition[state], slide.layout);
  else
    transition = Utils.mergeObjects(3, slide.layout, props.transition[state]);
  Utils.forEachKeyVal(transition, function(actorName, actorProps) {
    let actor = slide[actorName];
    Utils.forEachKeyVal(actorProps, function(property, value) {
      if (animate) {
        actor.save_easing_state();
        actor.set_easing_duration(props.transition.duration);
        actor.set_easing_mode(value.animation);
      }
      actor[property] = value.getValue(ctx);
      if (animate)
        actor.restore_easing_state();
    });
  });
};

let relayoutSlideInBox = function(slide, box, animate) {
  slide.layout = computeSlideLayout(slide, box);
  let pv = slide.main.get_paint_volume();
  setSlideState(slide, slideIndexToState(slide.index), animate);
  let ppv = slide.main.get_paint_volume();
  if (pv == null || ppv == null ||
      pv.get_width() != ppv.get_width() ||
      pv.get_height() != ppv.get_height()) {
    setSlideState(slide, slideIndexToState(slide.index), animate);
  }
};


let loadSlide = function(index) {
  for (let i = 0; i < _slides.length; i++)
    if (_slides[i].index == index) {
      return _slides[i];
    }

  let slideDef = document.slides[index];
  let props = getProperties(document, slideDef);
  let slide = {
    index: index,
    slideDef: slideDef,
    main: new Clutter.Actor({
    }),
    background: new Clutter.Actor({
      background_color: props.background_color,
    }),
    shading: new Clutter.Actor({
      background_color: props.shading_color,
    }),
    text: new Clutter.Text({
      text: slideDef.content.join('').trim(),
      font_name: props.font,
      color: props.text_color,
      use_markup: props.use_markup,
      line_alignment: props.text_align,
    }),
    relayout: function() {
      relayoutSlideInBox(this, stage, false);
    },
  };

  props.background.load();
  props.background.attachContent(slide.background, slide);

  slide.main.add_actor(slide.background);
  slide.main.add_actor(slide.shading);
  slide.main.add_actor(slide.text);
  stage.add_actor(slide.main);
  slide.main.show();

  _slides.push(slide);

  return slide;
};

let slideRange = function(index) {
  let delta = Math.round(_maxLoadedSlides / 2);
  let ret = { low: index - delta, high: index + delta };
  ret.low = Math.max(0, ret.low);
  ret.high = Math.min(document.slides.length - 1, ret.low + 2 * delta + 1);
  ret.low = Math.max(0, ret.high - (2 * delta + 1));
  return ret;
};

let loadSlides = function(index, animate) {
  let range = slideRange(index);
  for (let i = range.low; i <= range.high; i++) {
    let slide = loadSlide(i);
    relayoutSlideInBox(slide, stage, Math.abs(index - i) <= 1);
  }
  _slides.sort(function(s1, s2) { return s1.index - s2.index; });
  let previous = null;
  _slides.forEach(function(slide, idx) {
    stage.set_child_above_sibling(slide.main, previous);
    previous = slide.main;
  });
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
  if (_currentSlide == index) return;

  _currentSlide = index;
  loadSlides(index, true);

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

showSlide(0);

Clutter.main();
