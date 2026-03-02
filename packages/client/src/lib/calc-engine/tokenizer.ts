// WindoorDesigner - WindoorFormula DSL 词法分析器
// 将公式字符串分解为 Token 序列

export enum TokenType {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  IDENTIFIER = 'IDENTIFIER',
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  MULTIPLY = 'MULTIPLY',
  DIVIDE = 'DIVIDE',
  MODULO = 'MODULO',
  POWER = 'POWER',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  COMMA = 'COMMA',
  DOT = 'DOT',
  ASSIGN = 'ASSIGN',
  EQ = 'EQ',
  NEQ = 'NEQ',
  LT = 'LT',
  GT = 'GT',
  LTE = 'LTE',
  GTE = 'GTE',
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  QUESTION = 'QUESTION',
  COLON = 'COLON',
  SEMICOLON = 'SEMICOLON',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  IF = 'IF',
  THEN = 'THEN',
  ELSE = 'ELSE',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

const KEYWORDS: Record<string, TokenType> = {
  'if': TokenType.IF,
  'then': TokenType.THEN,
  'else': TokenType.ELSE,
  'and': TokenType.AND,
  'or': TokenType.OR,
  'not': TokenType.NOT,
  'IF': TokenType.IF,
  'THEN': TokenType.THEN,
  'ELSE': TokenType.ELSE,
  'AND': TokenType.AND,
  'OR': TokenType.OR,
  'NOT': TokenType.NOT,
};

export class Tokenizer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    this.tokens = [];
    this.pos = 0;
    this.line = 1;
    this.column = 1;

    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const ch = this.source[this.pos];

      // 注释
      if (ch === '/' && this.peek() === '/') {
        this.skipLineComment();
        continue;
      }

      // 数字
      if (this.isDigit(ch) || (ch === '.' && this.isDigit(this.peek()))) {
        this.readNumber();
        continue;
      }

      // 字符串
      if (ch === '"' || ch === "'") {
        this.readString(ch);
        continue;
      }

      // 标识符/关键字
      if (this.isAlpha(ch) || ch === '_' || ch === '$') {
        this.readIdentifier();
        continue;
      }

      // 运算符和标点
      switch (ch) {
        case '+': this.addToken(TokenType.PLUS, '+'); break;
        case '-': this.addToken(TokenType.MINUS, '-'); break;
        case '*':
          if (this.peek() === '*') { this.advance(); this.addToken(TokenType.POWER, '**'); }
          else this.addToken(TokenType.MULTIPLY, '*');
          break;
        case '/': this.addToken(TokenType.DIVIDE, '/'); break;
        case '%': this.addToken(TokenType.MODULO, '%'); break;
        case '^': this.addToken(TokenType.POWER, '^'); break;
        case '(': this.addToken(TokenType.LPAREN, '('); break;
        case ')': this.addToken(TokenType.RPAREN, ')'); break;
        case '[': this.addToken(TokenType.LBRACKET, '['); break;
        case ']': this.addToken(TokenType.RBRACKET, ']'); break;
        case ',': this.addToken(TokenType.COMMA, ','); break;
        case '.': this.addToken(TokenType.DOT, '.'); break;
        case '?': this.addToken(TokenType.QUESTION, '?'); break;
        case ':': this.addToken(TokenType.COLON, ':'); break;
        case ';': this.addToken(TokenType.SEMICOLON, ';'); break;
        case '=':
          if (this.peek() === '=') { this.advance(); this.addToken(TokenType.EQ, '=='); }
          else this.addToken(TokenType.ASSIGN, '=');
          break;
        case '!':
          if (this.peek() === '=') { this.advance(); this.addToken(TokenType.NEQ, '!='); }
          else this.addToken(TokenType.NOT, '!');
          break;
        case '<':
          if (this.peek() === '=') { this.advance(); this.addToken(TokenType.LTE, '<='); }
          else if (this.peek() === '>') { this.advance(); this.addToken(TokenType.NEQ, '<>'); }
          else this.addToken(TokenType.LT, '<');
          break;
        case '>':
          if (this.peek() === '=') { this.advance(); this.addToken(TokenType.GTE, '>='); }
          else this.addToken(TokenType.GT, '>');
          break;
        case '&':
          if (this.peek() === '&') { this.advance(); this.addToken(TokenType.AND, '&&'); }
          else this.addToken(TokenType.AND, '&');
          break;
        case '|':
          if (this.peek() === '|') { this.advance(); this.addToken(TokenType.OR, '||'); }
          else this.addToken(TokenType.OR, '|');
          break;
        default:
          throw new Error(`Unexpected character '${ch}' at line ${this.line}, column ${this.column}`);
      }
    }

    this.tokens.push({ type: TokenType.EOF, value: '', line: this.line, column: this.column });
    return this.tokens;
  }

  private peek(): string {
    return this.pos + 1 < this.source.length ? this.source[this.pos + 1] : '\0';
  }

  private advance(): string {
    const ch = this.source[this.pos];
    this.pos++;
    this.column++;
    if (ch === '\n') { this.line++; this.column = 1; }
    return ch;
  }

  private addToken(type: TokenType, value: string): void {
    this.tokens.push({ type, value, line: this.line, column: this.column });
    this.advance();
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length && /\s/.test(this.source[this.pos])) {
      this.advance();
    }
  }

  private skipLineComment(): void {
    while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
      this.advance();
    }
  }

  private readNumber(): void {
    const startCol = this.column;
    let num = '';
    while (this.pos < this.source.length && (this.isDigit(this.source[this.pos]) || this.source[this.pos] === '.')) {
      num += this.source[this.pos];
      this.advance();
    }
    // 科学计数法
    if (this.pos < this.source.length && (this.source[this.pos] === 'e' || this.source[this.pos] === 'E')) {
      num += this.source[this.pos];
      this.advance();
      if (this.pos < this.source.length && (this.source[this.pos] === '+' || this.source[this.pos] === '-')) {
        num += this.source[this.pos];
        this.advance();
      }
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
        num += this.source[this.pos];
        this.advance();
      }
    }
    this.tokens.push({ type: TokenType.NUMBER, value: num, line: this.line, column: startCol });
  }

  private readString(quote: string): void {
    const startCol = this.column;
    this.advance(); // skip opening quote
    let str = '';
    while (this.pos < this.source.length && this.source[this.pos] !== quote) {
      if (this.source[this.pos] === '\\') {
        this.advance();
        str += this.source[this.pos] || '';
      } else {
        str += this.source[this.pos];
      }
      this.advance();
    }
    if (this.pos < this.source.length) this.advance(); // skip closing quote
    this.tokens.push({ type: TokenType.STRING, value: str, line: this.line, column: startCol });
  }

  private readIdentifier(): void {
    const startCol = this.column;
    let id = '';
    while (this.pos < this.source.length && (this.isAlphaNumeric(this.source[this.pos]) || this.source[this.pos] === '_' || this.source[this.pos] === '$')) {
      id += this.source[this.pos];
      this.advance();
    }
    const type = KEYWORDS[id] || TokenType.IDENTIFIER;
    this.tokens.push({ type, value: id, line: this.line, column: startCol });
  }

  private isDigit(ch: string): boolean { return ch >= '0' && ch <= '9'; }
  private isAlpha(ch: string): boolean { return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch > '\u007F'; }
  private isAlphaNumeric(ch: string): boolean { return this.isDigit(ch) || this.isAlpha(ch); }
}
