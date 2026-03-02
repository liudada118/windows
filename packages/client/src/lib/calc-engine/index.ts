// WindoorDesigner - 算料引擎统一入口
export { Tokenizer, TokenType } from './tokenizer';
export type { Token } from './tokenizer';

export { Parser } from './parser';
export type { ASTNode, NumberLiteral, StringLiteral, Identifier, BinaryExpr, UnaryExpr, CallExpr, ConditionalExpr, MemberExpr, AssignExpr } from './parser';

export { Evaluator } from './evaluator';
export type { Value, EvalContext } from './evaluator';

export { calculateBOM, groupBOMByWindow, groupBOMByCategory } from './calc-module';
export type { BOMItem, BOMResult } from './calc-module';
