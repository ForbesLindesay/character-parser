export enum TOKEN_TYPES {
  LINE_COMMENT = 'LINE_COMMENT',
  BLOCK_COMMENT = 'BLOCK_COMMENT',
  SINGLE_QUOTE = 'SINGLE_QUOTE',
  DOUBLE_QUOTE = 'DOUBLE_QUOTE',
  TEMPLATE_QUOTE = 'TEMPLATE_QUOTE',
  REGEXP = 'REGEXP',
  ROUND_BRACKET = 'ROUND_BRACKET',
  CURLY_BRACKET = 'CURLY_BRACKET',
  SQUARE_BRACKET = 'SQUARE_BRACKET',
}

type OpenBracket = '(' | '{' | '[';
type CloseBracket = ')' | '}' | ']';
function isOpenBracket(character: string): character is OpenBracket {
  return character === '(' || character === '{' || character === '[';
}
function isCloseBracket(character: string): character is CloseBracket {
  return character === ')' || character === '}' || character === ']';
}
function getBracketType(openBracket: OpenBracket): TOKEN_TYPES {
  switch (openBracket) {
    case '(':
      return TOKEN_TYPES.ROUND_BRACKET;
    case '{':
      return TOKEN_TYPES.CURLY_BRACKET;
    case '[':
      return TOKEN_TYPES.SQUARE_BRACKET;
  }
}
function isMatchingBracket(closeBracket: CloseBracket, bracketType: TOKEN_TYPES): boolean {
  switch (bracketType) {
    case TOKEN_TYPES.ROUND_BRACKET:
      return closeBracket === ')';
    case TOKEN_TYPES.CURLY_BRACKET:
      return closeBracket === '}';
    case TOKEN_TYPES.SQUARE_BRACKET:
      return closeBracket === ']';
    default:
      return false;
  }
}

export class State {
  stack:  Array<TOKEN_TYPES> = [];
  regexpStart: boolean = false;
  escaped: boolean = false;
  hasDollar: boolean = false;

  src: string = '';
  history: string = '';
  lastChar: string = '';

  current(): TOKEN_TYPES {
    return this.stack[this.stack.length - 1];
  }
  isString(): boolean {
    return (
      this.current() === TOKEN_TYPES.SINGLE_QUOTE ||
      this.current() === TOKEN_TYPES.DOUBLE_QUOTE ||
      this.current() === TOKEN_TYPES.TEMPLATE_QUOTE
    );
  }
  isComment(): boolean {
    return this.current() === TOKEN_TYPES.LINE_COMMENT || this.current() === TOKEN_TYPES.BLOCK_COMMENT;
  }
  isNesting(opts?: {readonly ignoreLineComment?: boolean}): boolean {
    if (
      opts && opts.ignoreLineComment &&
      this.stack.length === 1 && this.stack[0] === TOKEN_TYPES.LINE_COMMENT
    ) {
      // if we are only inside a line comment, and line comments are ignored
      // don't count it as nesting
      return false;
    }
    return !!this.stack.length;
  }
}
export function defaultState() {
  return new State();
}



export function parse(src: string, state: State = defaultState(), options: {readonly start?: number, readonly end?: number} = {}): State {
  options = options || {};
  state = state || defaultState();

  const start = options.start || 0;
  const end = options.end || src.length;
  let index = start;
  for (let index = start; index < end; index++) {
    try {
      state = parseChar(src[index], state);
    } catch (ex) {
      (ex as any).index = index;
      throw ex;
    }
  }
  return state;
}
export default parse;

export function parseUntil(src: string, delimiter: string | RegExp, options: {readonly start?: number, readonly end?: number, readonly ignoreLineComment?: boolean, readonly ignoreNesting?: boolean} = {}) {
  options = options || {};
  const start = options.start || 0;
  const index = start;
  const state = defaultState();
  for (let index = start; index < src.length; index++) {
    if ((options.ignoreNesting || !state.isNesting(options)) && matches(src, delimiter, index)) {
      const end = index;
      return {
        start: start,
        end: end,
        src: src.substring(start, end)
      };
    }
    try {
      parseChar(src[index], state);
      console.dir({src: src.substr(0, index) + '^' + src.substr(index), state});
    } catch (ex) {
      ex.index = index;
      throw ex;
    }
  }
  const err = new Error('The end of the string was reached with no closing bracket found.');
  (err as any).code = 'CHARACTER_PARSER:END_OF_STRING_REACHED';
  (err as any).index = index;
  throw err;
}

export function parseChar(character: string, state: State = defaultState()): State {
  if (character.length !== 1) {
    const err = new Error('Character must be a string of length 1');
    err.name = 'InvalidArgumentError';
    (err as any).code = 'CHARACTER_PARSER:CHAR_LENGTH_NOT_ONE';
    throw err;
  }
  state = state || defaultState();
  state.src += character;
  const wasComment = state.isComment();
  const lastChar = state.history ? state.history[0] : '';


  if (state.regexpStart) {
    if (character === '/' || character == '*') {
      state.stack.pop();
    }
    state.regexpStart = false;
  }
  switch (state.current()) {
    case TOKEN_TYPES.LINE_COMMENT:
      if (character === '\n') {
        state.stack.pop();
      }
      break;
    case TOKEN_TYPES.BLOCK_COMMENT:
      if (state.lastChar === '*' && character === '/') {
        state.stack.pop();
      }
      break;
    case TOKEN_TYPES.SINGLE_QUOTE:
      if (character === '\'' && !state.escaped) {
        state.stack.pop();
      } else if (character === '\\' && !state.escaped) {
        state.escaped = true;
      } else {
        state.escaped = false;
      }
      break;
    case TOKEN_TYPES.DOUBLE_QUOTE:
      if (character === '"' && !state.escaped) {
        state.stack.pop();
      } else if (character === '\\' && !state.escaped) {
        state.escaped = true;
      } else {
        state.escaped = false;
      }
      break;
    case TOKEN_TYPES.TEMPLATE_QUOTE:
      if (character === '`' && !state.escaped) {
        state.stack.pop();
        state.hasDollar = false;
      } else if (character === '\\' && !state.escaped) {
        state.escaped = true;
        state.hasDollar = false;
      } else if (character === '$' && !state.escaped) {
        state.hasDollar = true;
      } else if (character === '{' && state.hasDollar) {
        state.stack.push(TOKEN_TYPES.CURLY_BRACKET);
      } else {
        state.escaped = false;
        state.hasDollar = false;
      }
      break;
    case TOKEN_TYPES.REGEXP:
      if (character === '/' && !state.escaped) {
        state.stack.pop();
      } else if (character === '\\' && !state.escaped) {
        state.escaped = true;
      } else {
        state.escaped = false;
      }
      break;
    default:
      if (isOpenBracket(character)) {
        state.stack.push(getBracketType(character));
      } else if (isCloseBracket(character)) {
        if (!isMatchingBracket(character, state.current())) {
          const err = new SyntaxError('Mismatched Bracket: ' + character);
          (err as any).code = 'CHARACTER_PARSER:MISMATCHED_BRACKET';
          throw err;
        };
        state.stack.pop();
      } else if (lastChar === '/' && character === '/') {
        // Don't include comments in history
        state.history = state.history.substr(1);
        state.stack.push(TOKEN_TYPES.LINE_COMMENT);
      } else if (lastChar === '/' && character === '*') {
        // Don't include comment in history
        state.history = state.history.substr(1);
        state.stack.push(TOKEN_TYPES.BLOCK_COMMENT);
      } else if (character === '/' && isRegexp(state.history)) {
        state.stack.push(TOKEN_TYPES.REGEXP);
        // N.B. if the next character turns out to be a `*` or a `/`
        //      then this isn't actually a regexp
        state.regexpStart = true;
      } else if (character === '\'') {
        state.stack.push(TOKEN_TYPES.SINGLE_QUOTE);
      } else if (character === '"') {
        state.stack.push(TOKEN_TYPES.DOUBLE_QUOTE);
      } else if (character === '`') {
        state.stack.push(TOKEN_TYPES.TEMPLATE_QUOTE);
      }
      break;
  }
  if (!state.isComment() && !wasComment) {
    state.history = character + state.history;
  }
  state.lastChar = character; // store last character for ending block comments
  return state;
}

function matches(str: string, matcher: string | RegExp, i: number = 0): boolean {
  if (typeof matcher === 'string') {
    return str.substr(i || 0, matcher.length) === matcher;
  }
  return matcher.test(str.substr(i || 0));
}

export function isPunctuator(c: string): boolean {
  if (!c) return true; // the start of a string is a punctuator
  const code = c.charCodeAt(0)

  switch (code) {
    case 46:   // . dot
    case 40:   // ( open bracket
    case 41:   // ) close bracket
    case 59:   // ; semicolon
    case 44:   // , comma
    case 123:  // { open curly brace
    case 125:  // } close curly brace
    case 91:   // [
    case 93:   // ]
    case 58:   // :
    case 63:   // ?
    case 126:  // ~
    case 37:   // %
    case 38:   // &
    case 42:   // *:
    case 43:   // +
    case 45:   // -
    case 47:   // /
    case 60:   // <
    case 62:   // >
    case 94:   // ^
    case 124:  // |
    case 33:   // !
    case 61:   // =
      return true;
    default:
      return false;
  }
}

export function isKeyword(id: string): boolean {
  return (id === 'if') || (id === 'in') || (id === 'do') || (id === 'var') || (id === 'for') || (id === 'new') ||
         (id === 'try') || (id === 'let') || (id === 'this') || (id === 'else') || (id === 'case') ||
         (id === 'void') || (id === 'with') || (id === 'enum') || (id === 'while') || (id === 'break') || (id === 'catch') ||
         (id === 'throw') || (id === 'const') || (id === 'yield') || (id === 'class') || (id === 'super') ||
         (id === 'return') || (id === 'typeof') || (id === 'delete') || (id === 'switch') || (id === 'export') ||
         (id === 'import') || (id === 'default') || (id === 'finally') || (id === 'extends') || (id === 'function') ||
         (id === 'continue') || (id === 'debugger') || (id === 'package') || (id === 'private') || (id === 'interface') ||
         (id === 'instanceof') || (id === 'implements') || (id === 'protected') || (id === 'public') || (id === 'static');
}

function isRegexp(history: string): boolean {
  //could be start of regexp or divide sign

  history = history.replace(/^\s*/, '');

  //unless its an `if`, `while`, `for` or `with` it's a divide, so we assume it's a divide
  if (history[0] === ')') return false;
  //unless it's a function expression, it's a regexp, so we assume it's a regexp
  if (history[0] === '}') return true;
  //any punctuation means it's a regexp
  if (isPunctuator(history[0])) return true;
  //if the last thing was a keyword then it must be a regexp (e.g. `typeof /foo/`)
  const match = /^\w+\b/.exec(history);
  if (match && isKeyword(match[0].split('').reverse().join(''))) return true;

  return false;
}
