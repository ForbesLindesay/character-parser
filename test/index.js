var assert = require('assert');
var test = require('testit');
var parser = require('../');
var parse = parser.parse;
var StackElement = parser.StackElement;

test('parse', function () {
  test('works out how much depth changes', function () {
    var state = parse('foo(arg1, arg2, {\n  foo: [a, b\n');
    assert.deepEqual(state.stack, [ StackElement.ROUND_BRACKET, StackElement.CURLY_BRACKET, StackElement.SQUARE_BRACKET ]);

    parse('    c, d]\n  })', state);
    assert.deepEqual(state.stack, []);
  });
});

test('parseUntil', function () {
  test('finds contents of bracketed expressions with specified bracket', function () {
    var section = parser.parseUntil('foo="(", bar="}"] bing bong', ']');
    assert(section.start === 0);
    assert(section.end === 16);//exclusive end of string
    assert(section.src === 'foo="(", bar="}"');

    var section = parser.parseUntil('foo="(", bar="}")] bing bong', ')');
    assert(section.start === 0);
    assert(section.end === 16);//exclusive end of string
    assert(section.src === 'foo="(", bar="}"');
  });
  test('finds code up to a custom delimiter', function () {
    var section = parser.parseUntil('foo.bar("%>").baz%> bing bong', '%>');
    assert(section.start === 0);
    assert(section.end === 17);//exclusive end of string
    assert(section.src === 'foo.bar("%>").baz');

    var section = parser.parseUntil('<%foo.bar("%>").baz%> bing bong', '%>', {start: 2});
    assert(section.start === 2);
    assert(section.end === 19);//exclusive end of string
    assert(section.src === 'foo.bar("%>").baz');

    var section = parser.parseUntil('x = `foo${`)`}`)', ')');
    assert.deepEqual(section, {
      start: 0,
      end: 15,
      src: 'x = `foo${`)`}`'
    });

    var section = parser.parseUntil('x = `foo${`)`}`])', /^[\])]/);
    assert.deepEqual(section, {
      start: 0,
      end: 15,
      src: 'x = `foo${`)`}`'
    });

    try {
      var section = parser.parseUntil('x = `foo${)}`)', ')');
    } catch (ex) {
      assert(ex.code === 'CHARACTER_PARSER:MISMATCHED_BRACKET');
      return;
    }
    throw new Error('Expected mismatched brackets');
  });
});

test('regressions', function () {
  test('#1', function () {
    test('parses regular expressions', function () {
      var section = parser.parseUntil('foo=/\\//g, bar="}") bing bong', ')');
      assert(section.start === 0);
      assert(section.end === 18);//exclusive end of string
      assert(section.src === 'foo=/\\//g, bar="}"');

      var section = parser.parseUntil('foo = typeof /\\//g, bar="}") bing bong', ')');
      assert(section.start === 0);
      //assert(section.end === 18);//exclusive end of string
      assert(section.src === 'foo = typeof /\\//g, bar="}"');
    })
  })
  test('#6', function () {
    test('parses block comments', function () {
      var section = parser.parseUntil('/* ) */) bing bong', ')');
      assert(section.start === 0);
      assert(section.end === 7);//exclusive end of string
      assert(section.src === '/* ) */');
      var section = parser.parseUntil('/* /) */) bing bong', ')');
      assert(section.start === 0);
      assert(section.end === 8);//exclusive end of string
      assert(section.src === '/* /) */');
    })
  })
})
