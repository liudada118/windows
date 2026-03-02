// WindoorDesigner - WindoorFormula DSL 解析器
// 将 Token 序列解析为 AST（抽象语法树）

import { TokenType, type Token } from './tokenizer';

// AST 节点类型
export type ASTNode =
  | NumberLiteral
  | StringLiteral
  | Identifier
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | ConditionalExpr
  | MemberExpr
  | AssignExpr;

export interface NumberLiteral { type: 'NumberLiteral'; value: number; }
export interface StringLiteral { type: 'StringLiteral'; value: string; }
export interface Identifier { type: 'Identifier'; name: string; }
export interface BinaryExpr { type: 'BinaryExpr'; op: string; left: ASTNode; right: ASTNode; }
export interface UnaryExpr { type: 'UnaryExpr'; op: string; operand: ASTNode; }
export interface CallExpr { type: 'CallExpr'; callee: string; args: ASTNode[]; }
export interface ConditionalExpr { type: 'ConditionalExpr'; condition: ASTNode; consequent: ASTNode; alternate: ASTNode; }
export interface MemberExpr { type: 'MemberExpr'; object: ASTNode; property: string; }
export interface AssignExpr { type: 'AssignExpr'; name: string; value: ASTNode; }

export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;

  parse(tokens: Token[]): ASTNode {
    this.tokens = tokens;
    this.pos = 0;
    return this.parseExpression();
  }

  parseStatements(tokens: Token[]): ASTNode[] {
    this.tokens = tokens;
    this.pos = 0;
    const stmts: ASTNode[] = [];
    while (!this.isAtEnd()) {
      stmts.push(this.parseExpression());
      if (this.check(TokenType.SEMICOLON)) this.advance();
    }
    return stmts;
  }

  private parseExpression(): ASTNode {
    return this.parseAssignment();
  }

  private parseAssignment(): ASTNode {
    const expr = this.parseConditional();
    if (this.check(TokenType.ASSIGN)) {
      this.advance();
      if (expr.type !== 'Identifier') {
        throw this.error('Invalid assignment target');
      }
      const value = this.parseConditional();
      return { type: 'AssignExpr', name: expr.name, value };
    }
    return expr;
  }

  private parseConditional(): ASTNode {
    // IF ... THEN ... ELSE ... 或 ... ? ... : ...
    if (this.check(TokenType.IF)) {
      this.advance();
      const condition = this.parseOr();
      this.expect(TokenType.THEN);
      const consequent = this.parseExpression();
      this.expect(TokenType.ELSE);
      const alternate = this.parseExpression();
      return { type: 'ConditionalExpr', condition, consequent, alternate };
    }

    const expr = this.parseOr();

    if (this.check(TokenType.QUESTION)) {
      this.advance();
      const consequent = this.parseExpression();
      this.expect(TokenType.COLON);
      const alternate = this.parseExpression();
      return { type: 'ConditionalExpr', condition: expr, consequent, alternate };
    }

    return expr;
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.check(TokenType.OR)) {
      this.advance();
      const right = this.parseAnd();
      left = { type: 'BinaryExpr', op: '||', left, right };
    }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseEquality();
    while (this.check(TokenType.AND)) {
      this.advance();
      const right = this.parseEquality();
      left = { type: 'BinaryExpr', op: '&&', left, right };
    }
    return left;
  }

  private parseEquality(): ASTNode {
    let left = this.parseComparison();
    while (this.check(TokenType.EQ) || this.check(TokenType.NEQ)) {
      const op = this.advance().value;
      const right = this.parseComparison();
      left = { type: 'BinaryExpr', op, left, right };
    }
    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parseAddition();
    while (this.check(TokenType.LT) || this.check(TokenType.GT) || this.check(TokenType.LTE) || this.check(TokenType.GTE)) {
      const op = this.advance().value;
      const right = this.parseAddition();
      left = { type: 'BinaryExpr', op, left, right };
    }
    return left;
  }

  private parseAddition(): ASTNode {
    let left = this.parseMultiplication();
    while (this.check(TokenType.PLUS) || this.check(TokenType.MINUS)) {
      const op = this.advance().value;
      const right = this.parseMultiplication();
      left = { type: 'BinaryExpr', op, left, right };
    }
    return left;
  }

  private parseMultiplication(): ASTNode {
    let left = this.parsePower();
    while (this.check(TokenType.MULTIPLY) || this.check(TokenType.DIVIDE) || this.check(TokenType.MODULO)) {
      const op = this.advance().value;
      const right = this.parsePower();
      left = { type: 'BinaryExpr', op, left, right };
    }
    return left;
  }

  private parsePower(): ASTNode {
    let left = this.parseUnary();
    if (this.check(TokenType.POWER)) {
      this.advance();
      const right = this.parsePower(); // right-associative
      left = { type: 'BinaryExpr', op: '**', left, right };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.check(TokenType.MINUS)) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryExpr', op: '-', operand };
    }
    if (this.check(TokenType.NOT)) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryExpr', op: '!', operand };
    }
    return this.parseCall();
  }

  private parseCall(): ASTNode {
    let expr = this.parsePrimary();

    while (true) {
      if (this.check(TokenType.LPAREN) && expr.type === 'Identifier') {
        this.advance();
        const args: ASTNode[] = [];
        if (!this.check(TokenType.RPAREN)) {
          args.push(this.parseExpression());
          while (this.check(TokenType.COMMA)) {
            this.advance();
            args.push(this.parseExpression());
          }
        }
        this.expect(TokenType.RPAREN);
        expr = { type: 'CallExpr', callee: expr.name, args };
      } else if (this.check(TokenType.DOT)) {
        this.advance();
        const prop = this.expect(TokenType.IDENTIFIER).value;
        expr = { type: 'MemberExpr', object: expr, property: prop };
      } else if (this.check(TokenType.LBRACKET)) {
        this.advance();
        const index = this.parseExpression();
        this.expect(TokenType.RBRACKET);
        if (index.type === 'StringLiteral') {
          expr = { type: 'MemberExpr', object: expr, property: index.value };
        } else if (index.type === 'NumberLiteral') {
          expr = { type: 'MemberExpr', object: expr, property: String(index.value) };
        }
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): ASTNode {
    const token = this.current();

    if (this.check(TokenType.NUMBER)) {
      this.advance();
      return { type: 'NumberLiteral', value: parseFloat(token.value) };
    }

    if (this.check(TokenType.STRING)) {
      this.advance();
      return { type: 'StringLiteral', value: token.value };
    }

    if (this.check(TokenType.IDENTIFIER)) {
      this.advance();
      return { type: 'Identifier', name: token.value };
    }

    if (this.check(TokenType.LPAREN)) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN);
      return expr;
    }

    throw this.error(`Unexpected token: ${token.type} (${token.value})`);
  }

  private current(): Token {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: '', line: 0, column: 0 };
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private advance(): Token {
    const token = this.current();
    this.pos++;
    return token;
  }

  private expect(type: TokenType): Token {
    if (!this.check(type)) {
      throw this.error(`Expected ${type}, got ${this.current().type} (${this.current().value})`);
    }
    return this.advance();
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  private error(message: string): Error {
    const token = this.current();
    return new Error(`Parse error at line ${token.line}, column ${token.column}: ${message}`);
  }
}
