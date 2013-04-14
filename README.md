# character-parser

Parse JavaScript one character at a time to look for snippets in Templates.  This is not a validator, it's just designed to allow you to have sections of JavaScript delimited by brackets robustly.

## Usage

Work out how much depth changes:

```js
var state = parse('foo(arg1, arg2, {\n  foo: [a, b\n');
assert(state.roundDepth === 1);
assert(state.curlyDepth === 1);
assert(state.squareDepth === 1);
parse('    c, d]\n  })', state);
assert(state.squareDepth === 0);
assert(state.curlyDepth === 0);
assert(state.roundDepth === 0);
```

### Bracketed Expressions

Find all the contents of a bracketed expression:

```js
var section = parser.parseMax('foo="(", bar="}") bing bong');
assert(section.start === 0);
assert(section.end === 16);//exclusive end of string
assert(section.src = 'foo="(", bar="}"');


var section = parser.parseMax('{foo="(", bar="}"} bing bong', 1);
assert(section.start === 1);
assert(section.end === 17);//exclusive end of string
assert(section.src = 'foo="(", bar="}"');
```

The bracketed expression parsing simply parses up to but excluding any unmatched closed bracket (`)`, `}`, `]`).  It is clever enough to ignore brackets in comments or strings.


### Custom Delimited Expressions

Find code up to a custom delimiter:

```js
var section = parser.parseUntil('foo.bar("%>").baz%> bing bong', '%>');
assert(section.start === 0);
assert(section.end === 17);//exclusive end of string
assert(section.src = 'foo.bar("%>").baz');

var section = parser.parseUntil('<%foo.bar("%>").baz%> bing bong', '%>', 2);
assert(section.start === 2);
assert(section.end === 19);//exclusive end of string
assert(section.src = 'foo.bar("%>").baz');
```

## License

MIT