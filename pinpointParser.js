/*
  new syntax:
    #foo and `foo	match the string object 'foo' (it's also accepted in my JS)
    'abc'		match the string object 'abc'
    'c'			match the string object 'c'
    ``abc''		match the sequence of string objects 'a', 'b', 'c'
    "abc"		token('abc')
    [1 2 3]		match the array object [1, 2, 3]
    foo(bar)		apply rule foo with argument bar
    -> ...		semantic actions written in JS (see OMetaParser's atomicHostExpr rule)
*/

/*
var M = ometa {
  number = number:n digit:d -> { n * 10 + d.digitValue() }
         | digit:d          -> { d.digitValue() }
};

translates to...

var M = objectThatDelegatesTo(OMeta, {
  number: function() {
            return this._or(function() {
                              var n = this._apply("number"),
                                  d = this._apply("digit");
                              return n * 10 + d.digitValue();
                            },
                            function() {
                              var d = this._apply("digit");
                              return d.digitValue();
                            }
                           );
          }
});
M.matchAll("123456789", "number");
*/

// try to use StringBuffer instead of string concatenation to improve performance

let StringBuffer = function() {
  this.strings = [];
  for (var idx = 0; idx < arguments.length; idx++)
    this.nextPutAll(arguments[idx]);
};
StringBuffer.prototype.nextPutAll = function(s) { this.strings.push(s); };
StringBuffer.prototype.contents   = function()  { return this.strings.join(""); };
String.prototype.writeStream      = function() { return new StringBuffer(this); };

// make Arrays print themselves sensibly

let printOn = function(x, ws) {
  if (x === undefined || x === null)
    ws.nextPutAll("" + x);
  else if (x.constructor === Array) {
    ws.nextPutAll("[");
    for (var idx = 0; idx < x.length; idx++) {
      if (idx > 0)
        ws.nextPutAll(", ");
      printOn(x[idx], ws);
    }
    ws.nextPutAll("]");
  } else
    ws.nextPutAll(x.toString());
};

Array.prototype.toString = function() {
  var ws = "".writeStream();
  printOn(this, ws);
  return ws.contents();
};

// delegation

let objectThatDelegatesTo = function(x, props) {
  var f = function() { };
  f.prototype = x;
  var r = new f();
  for (var p in props)
    if (props.hasOwnProperty(p))
      r[p] = props[p];
  return r;
};

// some reflective stuff

let ownPropertyNames = function(x) {
  var r = [];
  for (var name in x)
    if (x.hasOwnProperty(name))
      r.push(name);
  return r;
};

let isImmutable = function(x) {
   return (x === null ||
           x === undefined ||
           typeof x === "boolean" ||
           typeof x === "number" ||
           typeof x === "string");
};

String.prototype.digitValue  = function() {
  return this.charCodeAt(0) - "0".charCodeAt(0);
};

let isSequenceable = function(x) {
  return (typeof x == "string" || x.constructor === Array);
};

// some functional programming stuff

Array.prototype.delimWith = function(d) {
  return this.reduce(
    function(xs, x) {
      if (xs.length > 0)
        xs.push(d);
      xs.push(x);
      return xs;
    },
    []);
};

// escape characters

String.prototype.pad = function(s, len) {
  var r = this;
  while (r.length < len)
    r = s + r;
  return r;
};

let escapeStringFor = {};
for (var c = 0; c < 128; c++)
  escapeStringFor[c] = String.fromCharCode(c);
escapeStringFor["'".charCodeAt(0)]  = "\\'";
escapeStringFor['"'.charCodeAt(0)]  = '\\"';
escapeStringFor["\\".charCodeAt(0)] = "\\\\";
escapeStringFor["\b".charCodeAt(0)] = "\\b";
escapeStringFor["\f".charCodeAt(0)] = "\\f";
escapeStringFor["\n".charCodeAt(0)] = "\\n";
escapeStringFor["\r".charCodeAt(0)] = "\\r";
escapeStringFor["\t".charCodeAt(0)] = "\\t";
escapeStringFor["\v".charCodeAt(0)] = "\\v";
let escapeChar = function(c) {
  var charCode = c.charCodeAt(0);
  if (charCode < 128)
    return escapeStringFor[charCode];
  else if (128 <= charCode && charCode < 256)
    return "\\x" + charCode.toString(16).pad("0", 2);
  else
    return "\\u" + charCode.toString(16).pad("0", 4);
};

let unescape = function(s) {
  if (s.charAt(0) == '\\')
    switch (s.charAt(1)) {
    case "'":  return "'";
    case '"':  return '"';
    case '\\': return '\\';
    case 'b':  return '\b';
    case 'f':  return '\f';
    case 'n':  return '\n';
    case 'r':  return '\r';
    case 't':  return '\t';
    case 'v':  return '\v';
    case 'x':  return String.fromCharCode(parseInt(s.substring(2, 4), 16));
    case 'u':  return String.fromCharCode(parseInt(s.substring(2, 6), 16));
    default:   return s.charAt(1);
    }
  else
    return s;
};

String.prototype.toProgramString = function() {
  var ws = '"'.writeStream();
  for (var idx = 0; idx < this.length; idx++)
    ws.nextPutAll(escapeChar(this.charAt(idx)));
  ws.nextPutAll('"');
  return ws.contents();
};

// C-style tempnam function

let tempnam = function(s) {
  return (s ? s : "_tmpnam_") + tempnam.n++;
};
tempnam.n = 0;

// unique tags for objects (useful for making "hash tables")

let getTag = (function() {
  var numIdx = 0;
  return function(x) {
    if (x === null || x === undefined)
      return x;
    switch (typeof x) {
    case "boolean": return x == true ? "Btrue" : "Bfalse";
    case "string":  return "S" + x;
    case "number":  return "N" + x;
    default:        return x.hasOwnProperty("_id_") ? x._id_ : x._id_ = "R" + numIdx++;
    }
  };
})();


// the failure exception
if (!window._OMetafail) {
  window._OMetafail = new Error();
  window._OMetafail.toString = function() { return "match failed"; };
}
let fail = window._OMetafail;

// streams and memoization

let OMInputStream = function(hd, tl) {
  this.memo = { };
  this.lst  = tl.lst;
  this.idx  = tl.idx;
  this.hd   = hd;
  this.tl   = tl;
};
OMInputStream.prototype.head = function() { return this.hd; };
OMInputStream.prototype.tail = function() { return this.tl; };
OMInputStream.prototype.type = function() { return this.lst.constructor; };
OMInputStream.prototype.upTo = function(that) {
  var r = [], curr = this;
  while (curr != that) {
    r.push(curr.head());
    curr = curr.tail();
  }
  return this.type() == String ? r.join('') : r;
};

let OMInputStreamEnd = function(lst, idx) {
  this.memo = { };
  this.lst = lst;
  this.idx = idx;
};
OMInputStreamEnd.prototype = objectThatDelegatesTo(OMInputStream.prototype);
OMInputStreamEnd.prototype.head = function() { throw fail; };
OMInputStreamEnd.prototype.tail = function() { throw fail; };

// This is necessary b/c in IE, you can't say "foo"[idx]
Array.prototype.at  = function(idx) { return this[idx]; };
String.prototype.at = String.prototype.charAt;

let ListOMInputStream = function(lst, idx) {
  this.memo = { };
  this.lst  = lst;
  this.idx  = idx;
  this.hd   = lst.at(idx);
};
ListOMInputStream.prototype = objectThatDelegatesTo(OMInputStream.prototype);
ListOMInputStream.prototype.head = function() { return this.hd; };
ListOMInputStream.prototype.tail = function() {
  return this.tl || (this.tl = makeListOMInputStream(this.lst, this.idx + 1));
};

let makeListOMInputStream = function(lst, idx) {
  return new (idx < lst.length ? ListOMInputStream : OMInputStreamEnd)(lst, idx);
};

Array.prototype.toOMInputStream  = function() {
  return makeListOMInputStream(this, 0);
}
String.prototype.toOMInputStream = function() {
  return makeListOMInputStream(this, 0);
}

let makeOMInputStreamProxy = function(target) {
  return objectThatDelegatesTo(target, {
    memo:   { },
    target: target,
    tl: undefined,
    tail:   function() {
      return this.tl || (this.tl = makeOMInputStreamProxy(target.tail()));
    }
  });
}

// Failer (i.e., that which makes things fail) is used to detect (direct) left recursion and memoize failures

let Failer = function() { }
Failer.prototype.used = false;

// the OMeta "class" and basic functionality

let OMeta = {
  _createStructure: function(rule, start, stop, value, children) {
    if (children)
      return [ rule, start, stop, value, children, ];
    return [ rule, start, stop, value, [], ];
  },
  _updateStructure: function(struct) {
    if (OMeta[struct[0]] === undefined &&
        // start !== stop
        struct[1] !== struct[2]) {
      if (this._structure.length < 1) {
        this._structure.push(struct);
      } else {
        let lastChild = this._structure[this._structure.length - 1];
        if (lastChild[1] == struct[1] && // start
            lastChild[2] == struct[2]) { // stop
          // Override same match
          lastChild[0].name = struct[0]; // name
        } else {
          // Group if needed (could use dichotomie here...)
          let istart = -1;
          for (let i = 0; i < this._structure.length; i++) {
            let child = this._structure[i];
            if (child[1] >= struct[1]) { // start
              istart = i;
              break;
            }
          }
          if (istart != -1) {
            let children = this._structure.splice(istart, this._structure.length - istart);
            this._structure.push([
              struct[0],
              struct[1],
              children[children.length - 1][2],
              struct[3],
              children,
            ]);
            return;
          }
          // Or just append
          this._structure.push(struct);
        }
      }
    }
  },
  _apply: function(rule) {
    var start = this.pos();
    var memoRec = this.input.memo[rule];
    if (memoRec == undefined) {
      var origInput = this.input,
          failer    = new Failer();
      if (this[rule] === undefined)
        throw 'tried to apply undefined rule "' + rule + '"';
      this.input.memo[rule] = failer;
      this.input.memo[rule] = memoRec = {ans: this[rule].call(this),
                                         nextInput: this.input };
      if (failer.used) {
        var sentinel = this.input;
        while (true) {
          try {
            this.input = origInput;
            var ans = this[rule].call(this);
            if (this.input == sentinel)
              throw fail;
            memoRec.ans       = ans;
            memoRec.nextInput = this.input;
          } catch (f) {
            if (f != fail)
              throw f;
            break;
          }
        }
      }
    } else if (memoRec instanceof Failer) {
      memoRec.used = true;
      throw fail;
    }
    var stop = this.pos();
    this._updateStructure(this._createStructure(rule, start, stop, memoRec.ans));

    this.input = memoRec.nextInput;
    return memoRec.ans;
  },

  // note: _applyWithArgs and _superApplyWithArgs are not memoized, so they can't be left-recursive
  _applyWithArgs: function(rule) {
    var ruleFn = this[rule];
    var ruleFnArity = ruleFn.length;
    for (var idx = arguments.length - 1; idx >= ruleFnArity + 1; idx--) // prepend "extra" arguments in reverse order
      this._prependInput(arguments[idx]);
    return ruleFnArity == 0 ?
      ruleFn.call(this) :
      ruleFn.apply(this, Array.prototype.slice.call(arguments, 1, ruleFnArity + 1));
  },
  _superApplyWithArgs: function(recv, rule) {
    var ruleFn = this[rule];
    var ruleFnArity = ruleFn.length;
    for (var idx = arguments.length - 1; idx >= ruleFnArity + 2; idx--) // prepend "extra" arguments in reverse order
      recv._prependInput(arguments[idx]);
    return ruleFnArity == 0 ?
      ruleFn.call(recv) :
      ruleFn.apply(recv, Array.prototype.slice.call(arguments, 2, ruleFnArity + 2));
  },
  _prependInput: function(v) {
    this.input = new OMInputStream(v, this.input);
  },

  // if you want your grammar (and its subgrammars) to memoize parameterized rules, invoke this method on it:
  memoizeParameterizedRules: function() {
    this._prependInput = function(v) {
      var newInput;
      if (isImmutable(v)) {
        newInput = this.input[getTag(v)];
        if (!newInput) {
          newInput = new OMInputStream(v, this.input);
          this.input[getTag(v)] = newInput;
        }
      } else
        newInput = new OMInputStream(v, this.input);
      this.input = newInput;
    };
    this._applyWithArgs = function(rule) {
      var ruleFnArity = this[rule].length;
      for (var idx = arguments.length - 1; idx >= ruleFnArity + 1; idx--) // prepend "extra" arguments in reverse order
        this._prependInput(arguments[idx]);
      return ruleFnArity == 0 ?
        this._apply(rule) :
        this[rule].apply(this, Array.prototype.slice.call(arguments, 1, ruleFnArity + 1));
    };
  },

  _pred: function(b) {
    if (b)
      return true;
    throw fail;
  },
  _not: function(x) {
    var origInput = this.input;
    try {
      x.call(this);
    } catch (f) {
      if (f != fail)
        throw f;
      this.input = origInput;
      return true;
    }
    throw fail;
  },
  _lookahead: function(x) {
    var origInput = this.input,
        r         = x.call(this);
    this.input = origInput;
    return r;
  },
  _or: function() {
    var origInput = this.input;
    for (var idx = 0; idx < arguments.length; idx++) {
      try {
        this.input = origInput;
        return arguments[idx].call(this);
      } catch (f) {
        if (f != fail)
          throw f;
      }
    }
    throw fail;
  },
  _xor: function(ruleName) {
    var origInput = this.input, idx = 1, newInput, ans;
    while (idx < arguments.length) {
      try {
        this.input = origInput;
        ans = arguments[idx].call(this);
        if (newInput)
          throw 'more than one choice matched by "exclusive-OR" in ' + ruleName;
        newInput = this.input;
      } catch (f) {
        if (f != fail)
          throw f;
      }
      idx++;
    }
    if (newInput) {
      this.input = newInput;
      return ans;
    } else
      throw fail;
  },
  disableXORs: function() {
    this._xor = this._or;
  },
  _opt: function(x) {
    var origInput = this.input, ans;
    try {
      ans = x.call(this);
    } catch (f) {
      if (f != fail)
        throw f;
      this.input = origInput;
    }
    return ans;
  },
  _many: function(x) {
    var ans = arguments[1] != undefined ? [arguments[1]] : [];
    while (true) {
      var origInput = this.input;
      try {
        ans.push(x.call(this));
      } catch (f) {
        if (f != fail)
          throw f;
        this.input = origInput;
        break;
      }
    }
    return ans;
  },
  _many1: function(x) { return this._many(x, x.call(this)); },
  _form: function(x) {
    var v = this._apply("anything");
    if (!isSequenceable(v))
      throw fail;
    var origInput = this.input;
    this.input = v.toOMInputStream();
    var r = x.call(this);
    this._apply("end");
    this.input = origInput;
    return v;
  },
  _consumedBy: function(x) {
    var origInput = this.input;
    x.call(this);
    return origInput.upTo(this.input);
  },
  _idxConsumedBy: function(x) {
    var origInput = this.input;
    x.call(this);
    return {fromIdx: origInput.idx, toIdx: this.input.idx};
  },
  _interleave: function(mode1, part1, mode2, part2 /* ..., moden, partn */) {
    var currInput = this.input, ans = [];
    for (var idx = 0; idx < arguments.length; idx += 2)
      ans[idx / 2] = (arguments[idx] == "*" || arguments[idx] == "+") ? [] : undefined;
    while (true) {
      var idx = 0, allDone = true;
      while (idx < arguments.length) {
        if (arguments[idx] != "0")
          try {
            this.input = currInput;
            switch (arguments[idx]) {
            case "*":
              ans[idx / 2].push(arguments[idx + 1].call(this));
              break;
            case "+":
              ans[idx / 2].push(arguments[idx + 1].call(this));
              arguments[idx] = "*";
              break;
            case "?":
              ans[idx / 2] = arguments[idx + 1].call(this);
              arguments[idx] = "0";
              break;
            case "1":
              ans[idx / 2] = arguments[idx + 1].call(this);
              arguments[idx] = "0";
              break;
            default:
              throw "invalid mode '" + arguments[idx] + "' in OMeta._interleave";
            }
            currInput = this.input;
            break;
          } catch (f) {
            if (f != fail)
              throw f;
            // if this (failed) part's mode is "1" or "+", we're not done yet
            allDone = allDone && (arguments[idx] == "*" || arguments[idx] == "?");
          }
        idx += 2;
      }
      if (idx == arguments.length) {
        if (allDone)
          return ans;
        else
          throw fail;
      }
    }
  },
  _currIdx: function() { return this.input.idx; },

  // some basic rules
  anything: function() {
    var r = this.input.head();
    this.input = this.input.tail();
    return r;
  },
  end: function() {
    return this._not(function() { return this._apply("anything"); });
  },
  pos: function() {
    return this.input.idx;
  },
  empty: function() { return true; },
  apply: function(r) {
    return this._apply(r);
  },
  foreign: function(g, r) {
    var start = this.pos();
    var gi  = objectThatDelegatesTo(g, {input: makeOMInputStreamProxy(this.input),
                                        _structure: []}),
        ans = gi._apply(r);
    this.input = gi.input.target;
    var stop = this.pos();

    this._updateStructure(this._createStructure('foreign', start, stop, ans, gi.getStructure()));

    return ans;
  },

  //  some useful "derived" rules
  exactly: function(wanted) {
    if (wanted === this._apply("anything"))
      return wanted;
    throw fail;
  },
  "true": function() {
    var r = this._apply("anything");
    this._pred(r === true);
    return r;
  },
  "false": function() {
    var r = this._apply("anything");
    this._pred(r === false);
    return r;
  },
  "undefined": function() {
    var r = this._apply("anything");
    this._pred(r === undefined);
    return r;
  },
  number: function() {
    var r = this._apply("anything");
    this._pred(typeof r === "number");
    return r;
  },
  string: function() {
    var r = this._apply("anything");
    this._pred(typeof r === "string");
    return r;
  },
  char: function() {
    var r = this._apply("anything");
    this._pred(typeof r === "string" && r.length == 1);
    return r;
  },
  space: function() {
    var r = this._apply("char");
    this._pred(r.charCodeAt(0) <= 32);
    return r;
  },
  spaces: function() {
    return this._many(function() { return this._apply("space"); });
  },
  digit: function() {
    var r = this._apply("char");
    this._pred(r >= "0" && r <= "9");
    return r;
  },
  lower: function() {
    var r = this._apply("char");
    this._pred(r >= "a" && r <= "z");
    return r;
  },
  upper: function() {
    var r = this._apply("char");
    this._pred(r >= "A" && r <= "Z");
    return r;
  },
  letter: function() {
    return this._or(function() { return this._apply("lower"); },
                    function() { return this._apply("upper"); });
  },
  letterOrDigit: function() {
    return this._or(function() { return this._apply("letter"); },
                    function() { return this._apply("digit");  });
  },
  firstAndRest: function(first, rest)  {
     return this._many(function() { return this._apply(rest); },
                       this._apply(first));
  },
  seq: function(xs) {
    for (var idx = 0; idx < xs.length; idx++)
      this._applyWithArgs("exactly", xs.at(idx));
    return xs;
  },
  notLast: function(rule) {
    var r = this._apply(rule);
    this._lookahead(function() { return this._apply(rule); });
    return r;
  },
  listOf: function(rule, delim) {
    return this._or(function() {
      var r = this._apply(rule)
      return this._many(function() {
        this._applyWithArgs("token", delim);
        return this._apply(rule);
      },
                        r);
    },
                    function() { return []; });
  },
  token: function(cs) {
    this._apply("spaces");
    return this._applyWithArgs("seq", cs);
  },
  fromTo: function (x, y) {
    return this._consumedBy(function() {
      this._applyWithArgs("seq", x);
      this._many(function() {
        this._not(function() { this._applyWithArgs("seq", y); })
        this._apply("char");
      });
      this._applyWithArgs("seq", y);
    });
  },

  initialize: function() {},
  getStructure: function() {
    return this._structure;
  },
  // match and matchAll are a grammar's "public interface"
  _genericMatch: function(input, rule, args, callback) {
    if (args == undefined)
      args = [];
    var realArgs = [rule];
    for (var idx = 0; idx < args.length; idx++)
      realArgs.push(args[idx]);
    var m = objectThatDelegatesTo(this, {input: input,
                                         _structure: []});
    m.initialize();
    try {
      let ret = realArgs.length == 1 ? m._apply.call(m, realArgs[0]) : m._applyWithArgs.apply(m, realArgs);
      if (callback)
        callback(null, m, ret);
      return ret;
    } catch (f) {
      if (f != fail)
        throw f;

      var einput = m.input;
      if (einput.idx != undefined) {
        while (einput.tl != undefined && einput.tl.idx != undefined)
          einput = einput.tl;
        einput.idx--;
      }
      var err = new Error();

      err.idx = einput.idx;
      if (callback)
        callback(err, m);
      else
        throw err;
    }
    return null;
  },
  match: function(obj, rule, args, callback) {
    return this._genericMatch([obj].toOMInputStream(), rule, args, callback);
  },
  matchAll: function(listyObj, rule, args, matchFailed) {
    return this._genericMatch(listyObj.toOMInputStream(), rule, args, matchFailed);
  },
  createInstance: function() {
    var m = objectThatDelegatesTo(this, { _structure: [] });
    m.initialize();
    m.matchAll = function(listyObj, aRule) {
      this.input = listyObj.toOMInputStream();
      return this._apply(aRule);
    };
    return m;
  }
};

const Clutter=imports["gi"]["Clutter"];const Backgrounds=imports["backgrounds"];let Parser=objectThatDelegatesTo(OMeta,{
"spacesNoNl":function(){var $elf=this,_fromIdx=this.input.idx;return this._many(function(){this._not(function(){return this._applyWithArgs("exactly","\n");});return this._apply("space");});},
"background":function(){var $elf=this,_fromIdx=this.input.idx,f;return this._or(function(){return (function(){switch(this._apply('anything')){case "camera":return ["background",new Backgrounds.Camera()];default: throw fail}}).call(this);},function(){f=this._many1(function(){this._not(function(){return this._applyWithArgs("exactly","]");});return this._apply("anything");});this._pred(Backgrounds.isMimeType(f.join(""),"image/"));return ["background",new Backgrounds.Image(f.join(""))];},function(){f=this._many1(function(){this._not(function(){return this._applyWithArgs("exactly","]");});return this._apply("anything");});this._pred(Backgrounds.isMimeType(f.join(""),"video/"));return ["background",new Backgrounds.Video(f.join(""))];});},
"style":function(){var $elf=this,_fromIdx=this.input.idx,k,v,c,s;return this._or(function(){k=this._applyWithArgs("token","duration");this._applyWithArgs("token","=");v=this._many1(function(){this._not(function(){return this._applyWithArgs("exactly","]");});return this._apply("anything");});return [k,parseFloat(v.join(""))];},function(){c=this._many1(function(){this._not(function(){return this._applyWithArgs("exactly","]");});return this._apply("anything");});this._pred(Backgrounds.isValidColor(c.join("")));return ["background-color",Backgrounds.colorFromString(c.join(""))];},function(){this._apply("spaces");s=this._consumedBy(function(){this._apply("letter");return this._many1(function(){return this._or(function(){return this._apply("letter");},function(){return this._apply("digit");},function(){return (function(){switch(this._apply('anything')){case "-":return "-";default: throw fail}}).call(this);});});});this._pred(Parser.isGravity(s));this._apply("spaces");return ["gravity",Parser.getGravity(s)];},function(){this._apply("spaces");s=this._consumedBy(function(){this._apply("letter");return this._many1(function(){return this._or(function(){return this._apply("letter");},function(){return this._apply("digit");},function(){return (function(){switch(this._apply('anything')){case "-":return "-";default: throw fail}}).call(this);});});});this._pred(Parser.isKeyword(s));this._apply("spaces");return [s,true];},function(){this._apply("spaces");k=this._consumedBy(function(){this._apply("letter");return this._many1(function(){return this._or(function(){return this._apply("letter");},function(){return this._apply("digit");},function(){return (function(){switch(this._apply('anything')){case "-":return "-";default: throw fail}}).call(this);});});});this._applyWithArgs("exactly","=");v=this._many1(function(){this._not(function(){return this._applyWithArgs("exactly","]");});return this._apply("anything");});return [k,v.join("")];});},
"property":function(){var $elf=this,_fromIdx=this.input.idx,p;this._applyWithArgs("exactly","[");p=this._or(function(){return this._apply("style");},function(){return this._apply("background");});this._applyWithArgs("exactly","]");return p;},
"headerProperty":function(){var $elf=this,_fromIdx=this.input.idx,p;p=this._apply("property");this._apply("spaces");return p;},
"slideProperty":function(){var $elf=this,_fromIdx=this.input.idx,p;p=this._apply("property");this._apply("spacesNoNl");return p;},
"comment":function(){var $elf=this,_fromIdx=this.input.idx,s;s=this._applyWithArgs("fromTo","#","\n");return s.slice((1));},
"content":function(){var $elf=this,_fromIdx=this.input.idx,s;s=this._many(function(){this._not(function(){return (function(){switch(this._apply('anything')){case "\n":return "\n";case "-":return this._applyWithArgs("exactly","-");default: throw fail}}).call(this);});return this._apply("anything");});this._applyWithArgs("exactly","\n");return (s.join("") + "\n");},
"slideContent":function(){var $elf=this,_fromIdx=this.input.idx,s,cmt,cnt;s=this._apply("anything");this._many1(function(){return this._or(function(){cmt=this._apply("comment");return this._applyWithArgs("appendComment",s,cmt);},function(){cnt=this._apply("content");return this._applyWithArgs("appendContent",s,cnt);});});return s;},
"header":function(){var $elf=this,_fromIdx=this.input.idx;return this._many(function(){return this._apply("headerProperty");});},
"slide":function(){var $elf=this,_fromIdx=this.input.idx,s,ps;s=this._apply("newSlide");this._applyWithArgs("exactly","-");this._applyWithArgs("exactly","-");this._apply("spacesNoNl");ps=this._many1(function(){return this._apply("slideProperty");});this._applyWithArgs("appendProperties",s,ps);this._applyWithArgs("exactly","\n");this._applyWithArgs("slideContent",s);return s;},
"document":function(){var $elf=this,_fromIdx=this.input.idx,d,ps,sds;d=this._apply("newDocument");ps=this._many(function(){return this._apply("headerProperty");});this._applyWithArgs("appendProperties",d,ps);sds=this._many1(function(){return this._apply("slide");});this._apply("end");return ({"properties": d["properties"],"slides": sds});}});(Parser["_gravities"]=({"top-left": [Clutter["ActorAlign"]["START"],Clutter["ActorAlign"]["START"]],"top": [Clutter["ActorAlign"]["CENTER"],Clutter["ActorAlign"]["START"]],"top-right": [Clutter["ActorAlign"]["END"],Clutter["ActorAlign"]["START"]],"left": [Clutter["ActorAlign"]["START"],Clutter["ActorAlign"]["CENTER"]],"center": [Clutter["ActorAlign"]["CENTER"],Clutter["ActorAlign"]["CENTER"]],"right": [Clutter["ActorAlign"]["END"],Clutter["ActorAlign"]["CENTER"]],"bottom-left": [Clutter["ActorAlign"]["START"],Clutter["ActorAlign"]["END"]],"bottom": [Clutter["ActorAlign"]["CENTER"],Clutter["ActorAlign"]["END"]],"bottom-right": [Clutter["ActorAlign"]["END"],Clutter["ActorAlign"]["END"]]}));(Parser["isGravity"]=(function (str){return this["_gravities"].hasOwnProperty(str);}));(Parser["getGravity"]=(function (str){log(((("gravity " + str) + " = ") + this["_gravities"][str]));return this["_gravities"][str];}));(Parser["_keywords"]=({"fill": true,"no-markup": true}));(Parser["isKeyword"]=(function (str){return this["_keywords"].hasOwnProperty(str);}));(Parser["newDocument"]=(function (){return ({"properties": ({}),"slides": []});}));(Parser["newSlide"]=(function (){return ({"comments": [],"content": [],"properties": ({})});}));(Parser["appendComment"]=(function (slide,comment){slide["comments"].push(comment);}));(Parser["appendContent"]=(function (slide,content){slide["content"].push(content);}));(Parser["appendProperties"]=(function (slide,properties){properties.map((function (tuple){(slide["properties"][tuple[(0)]]=tuple[(1)]);}));}));let parse=(function (str){let indexToPosition=(function (source,idx){let linePos=(0),lineNum=(0);for(let i=(0);(i < idx);i++){if((source.charAt(i) == "\n")){(linePos=i);lineNum++;}else{undefined;};}return ({"line": (lineNum + (1)),"offset": (idx - linePos)});});let document=undefined;try {(document=Parser.matchAll(str,"document"));log(JSON.stringify(document,null,(2)));}catch(e){let pos=indexToPosition(str,e["idx"]);log(((("Parsing error at : line " + pos["line"]) + " offset ") + pos["offset"]));throw e;}finally{undefined;}return document;})
