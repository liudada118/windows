// WindoorDesigner - WindoorFormula DSL 求值器
// 遍历 AST 执行计算，支持内置函数和变量上下文

import type { ASTNode } from './parser';

export type Value = number | string | boolean | null | Value[] | Record<string, Value>;

export interface EvalContext {
  variables: Record<string, Value>;
  functions: Record<string, (...args: Value[]) => Value>;
}

// 内置数学/工具函数
const BUILTIN_FUNCTIONS: Record<string, (...args: Value[]) => Value> = {
  // 数学
  abs: (x) => Math.abs(Number(x)),
  ceil: (x) => Math.ceil(Number(x)),
  floor: (x) => Math.floor(Number(x)),
  round: (x, d) => {
    const decimals = d != null ? Number(d) : 0;
    const factor = Math.pow(10, decimals);
    return Math.round(Number(x) * factor) / factor;
  },
  min: (...args) => Math.min(...args.map(Number)),
  max: (...args) => Math.max(...args.map(Number)),
  sqrt: (x) => Math.sqrt(Number(x)),
  pow: (x, y) => Math.pow(Number(x), Number(y)),
  log: (x) => Math.log(Number(x)),
  log10: (x) => Math.log10(Number(x)),
  sin: (x) => Math.sin(Number(x)),
  cos: (x) => Math.cos(Number(x)),
  tan: (x) => Math.tan(Number(x)),
  PI: () => Math.PI,

  // 门窗专用
  // 切割长度 = 实际长度 - 2 * 切割余量
  cutLength: (length, margin) => Number(length) - 2 * Number(margin || 0),
  // 玻璃尺寸 = 洞口尺寸 - 2 * 玻璃间隙
  glassSize: (openingSize, gap) => Number(openingSize) - 2 * Number(gap || 3),
  // 型材重量 = 长度(mm) * 线密度(kg/m) / 1000
  profileWeight: (length, density) => Number(length) * Number(density) / 1000,
  // 面积(m²) = 宽(mm) * 高(mm) / 1000000
  area: (w, h) => Number(w) * Number(h) / 1000000,
  // 周长(mm) = 2 * (宽 + 高)
  perimeter: (w, h) => 2 * (Number(w) + Number(h)),

  // 条件
  iif: (cond, trueVal, falseVal) => (cond ? trueVal : falseVal) as Value,

  // 字符串
  concat: (...args) => args.map(String).join(''),
  len: (s) => String(s).length,
  upper: (s) => String(s).toUpperCase(),
  lower: (s) => String(s).toLowerCase(),

  // 数组
  sum: (...args) => args.reduce((s: number, v) => s + Number(v), 0),
  avg: (...args) => args.reduce((s: number, v) => s + Number(v), 0) / args.length,
  count: (...args) => args.length,
};

export class Evaluator {
  private context: EvalContext;

  constructor(context?: Partial<EvalContext>) {
    this.context = {
      variables: { ...context?.variables },
      functions: { ...BUILTIN_FUNCTIONS, ...context?.functions },
    };
  }

  evaluate(node: ASTNode): Value {
    switch (node.type) {
      case 'NumberLiteral':
        return node.value;

      case 'StringLiteral':
        return node.value;

      case 'Identifier':
        if (node.name in this.context.variables) {
          return this.context.variables[node.name];
        }
        // 可能是无参函数调用
        if (node.name in this.context.functions) {
          return this.context.functions[node.name]();
        }
        throw new Error(`Undefined variable: ${node.name}`);

      case 'BinaryExpr':
        return this.evalBinary(node.op, this.evaluate(node.left), this.evaluate(node.right));

      case 'UnaryExpr':
        return this.evalUnary(node.op, this.evaluate(node.operand));

      case 'CallExpr': {
        const fn = this.context.functions[node.callee];
        if (!fn) throw new Error(`Undefined function: ${node.callee}`);
        const args = node.args.map(a => this.evaluate(a));
        return fn(...args);
      }

      case 'ConditionalExpr': {
        const cond = this.evaluate(node.condition);
        return this.isTruthy(cond)
          ? this.evaluate(node.consequent)
          : this.evaluate(node.alternate);
      }

      case 'MemberExpr': {
        const obj = this.evaluate(node.object);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          return (obj as Record<string, Value>)[node.property] ?? null;
        }
        if (Array.isArray(obj)) {
          const idx = parseInt(node.property, 10);
          return isNaN(idx) ? null : obj[idx] ?? null;
        }
        return null;
      }

      case 'AssignExpr': {
        const value = this.evaluate(node.value);
        this.context.variables[node.name] = value;
        return value;
      }

      default:
        throw new Error(`Unknown AST node type: ${(node as ASTNode).type}`);
    }
  }

  evaluateAll(nodes: ASTNode[]): Value {
    let result: Value = null;
    for (const node of nodes) {
      result = this.evaluate(node);
    }
    return result;
  }

  setVariable(name: string, value: Value): void {
    this.context.variables[name] = value;
  }

  setVariables(vars: Record<string, Value>): void {
    Object.assign(this.context.variables, vars);
  }

  getVariable(name: string): Value {
    return this.context.variables[name] ?? null;
  }

  private evalBinary(op: string, left: Value, right: Value): Value {
    const l = Number(left);
    const r = Number(right);

    switch (op) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left) + String(right);
        }
        return l + r;
      case '-': return l - r;
      case '*': return l * r;
      case '/':
        if (r === 0) throw new Error('Division by zero');
        return l / r;
      case '%': return l % r;
      case '**': return Math.pow(l, r);
      case '==': return left === right || l === r;
      case '!=': case '<>': return left !== right && l !== r;
      case '<': return l < r;
      case '>': return l > r;
      case '<=': return l <= r;
      case '>=': return l >= r;
      case '&&': return this.isTruthy(left) && this.isTruthy(right);
      case '||': return this.isTruthy(left) || this.isTruthy(right);
      default: throw new Error(`Unknown operator: ${op}`);
    }
  }

  private evalUnary(op: string, operand: Value): Value {
    switch (op) {
      case '-': return -Number(operand);
      case '!': return !this.isTruthy(operand);
      default: throw new Error(`Unknown unary operator: ${op}`);
    }
  }

  private isTruthy(value: Value): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    return true;
  }
}
