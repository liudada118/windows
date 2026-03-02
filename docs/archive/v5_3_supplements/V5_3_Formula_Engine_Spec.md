# 8. 算料引擎 (增强版)

## 8.1. WindoorFormula DSL (V2.0)

### 8.1.4. EBNF 语法定义

```ebnf
formula_set ::= "{" { string_literal ":" expression } "," "}"

expression ::= term { ("+" | "-") term }
term ::= factor { ("*" | "/") factor }
factor ::= number_literal | variable | function_call | "(" expression ")"

function_call ::= identifier "(" [ expression { "," expression } ] ")"

variable ::= identifier { "." identifier }

identifier ::= (letter | "_") { letter | digit | "_" }
string_literal ::= '"' ( { any_character_except_quote } ) '"'
number_literal ::= ["-"] ( "0" | (digit_1_9 { digit }) ) [ "." { digit } ]

letter ::= "a".."z" | "A".."Z"
digit ::= "0".."9"
digit_1_9 ::= "1".."9"
```

### 8.1.5. 错误处理机制

引擎在解析和执行过程中，必须能够识别并抛出具有明确错误码和信息的异常。前端应根据错误码显示友好的提示。

| 错误码 | 类型 | 描述 | 前端提示示例 |
| :--- | :--- | :--- | :--- |
| 1001 | `SyntaxError` | 括号不匹配、缺少操作符等语法错误 | "公式语法错误，请检查括号或运算符" |
| 1002 | `SyntaxError` | 非法的函数名称 | "函数 'ABC' 不存在" |
| 2001 | `ReferenceError` | 引用了不存在的变量 | "变量 'window.height_extra' 不存在" |
| 2002 | `TypeError` | 函数参数数量或类型不匹配 | "函数 'MAX' 需要至少一个参数" |
| 2003 | `TypeError` | 对非数字类型执行了数学运算 | "无法对文本 'abc' 进行数学计算" |
| 3001 | `EvaluationError` | 除以零 | "计算错误：不能除以零" |
| 3002 | `EvaluationError` | 递归深度超限（防止死循环） | "公式循环引用，无法计算" |

### 8.1.6. 安全沙箱与性能

- **安全沙箱:** 所有公式必须在严格的 JavaScript 沙箱环境中执行，与主线程隔离。沙箱环境应：
  - 禁用所有全局对象（`window`, `document`, `fetch` 等），只暴露白名单中的数学函数 (`Math.sin`, `Math.cos` 等) 和自定义的系统变量。
  - 严禁访问 `eval`, `new Function()`, `setTimeout`, `setInterval`。
  - 使用 Web Worker 在后台线程执行计算，避免阻塞 UI。
- **性能:** 
  - **超时限制:** 单个公式的执行时间不得超过 50ms。
  - **缓存:** 对于相同的输入（窗户尺寸、型材等），公式计算结果应被缓存 (memoization)，避免重复计算。
