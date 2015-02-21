const Clutter = imports.gi.Clutter;
const ClutterGst = imports.gi.ClutterGst;
const Cogl = imports.gi.Cogl;
const Gio = imports.gi.Gio;
const GdkPixbuf = imports.gi.GdkPixbuf;

const Utils = imports.utils;

let Null = function() {
};
Null.prototype = {
  load: function() {},
  unload: function() {},
  setVisibility: function(value) {},
  attachContent: function(actor) {},
};

let Camera = function() {
  this._init();
};
Camera.prototype = {
  _init: function() {
    this._content = new ClutterGst.Content();
    this._camera = new ClutterGst.Camera();
    this._content.player = this._camera;
  },
  load: function() {
    this._camera.set_playing(true);
  },
  unload: function() {
    this._camera.set_playing(false);
  },
  setVisibility: function(value) {
    this._camera.set_playing(value);
  },
  attachContent: function(actor) {
    actor.content = this._content;
  },
};

let Color = function(color) {
  this._init(color);
};
Color.prototype = {
  _init: function(color) {
    this._color = color;
  },
  load: function() {
  },
  unload: function() {
  },
  setVisibility: function(value) {},
  attachContent: function(actor) {
    actor.background_color = this._color;
  },
};

let Image = function(filename) {
  this._init(filename);
};
Image.prototype = {
  _init: function(filename) {
    this._file = Utils.getFile(filename);
    this._content = new Clutter.Image();
  },
  load: function() {
    try {
      let ios = this._file.open_readwrite(null);
      let is = ios.get_input_stream();
      let bytes = is.read_bytes(this._file.query_info('*',
                                                      Gio.FileQueryInfoFlags.NONE,
                                                      null).get_size(), null);
      let loader = new GdkPixbuf.PixbufLoader();
      loader.write_bytes(bytes);
      loader.close();
      let pixbuf = loader.get_pixbuf();
      this._content.set_bytes(pixbuf.read_pixel_bytes(),
                              pixbuf.get_has_alpha() ?
                              Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
                              pixbuf.get_width(),
                              pixbuf.get_height(),
                              pixbuf.get_rowstride());
    } catch (e) {
      log('Error loading media: ' + e.message);
    }
  },
  unload: function() {
    this._content = new Clutter.Image();
  },
  setVisibility: function(value) {},
  attachContent: function(actor) {
    actor.content = this._content;
  },
};

let Video = function(filename) {
  this._init(filename);
};
Video.prototype = {
  _init: function(filename) {
    this._file = Utils.getFile(filename);
    this._content = new ClutterGst.Content();
  },
  load: function() {
    this._player = new ClutterGst.Playback();
    this._player.set_filename(this._file.get_path());
    this._content.player = this._player;
  },
  unload: function() {
    this._player.set_playing(false);
    this._player = null;
    this._content.player = null;
  },
  setVisibility: function(value) {
    this._player.set_playing(value);
  },
  attachContent: function(actor) {
    actor.content = this._content;
  },
};
