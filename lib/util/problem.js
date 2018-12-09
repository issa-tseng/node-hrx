
class Problem extends Error {}

class ParseProblem extends Problem {
  constructor(message, { line, col }, details = {}) {
    super(`Parse Error: ${message} (line ${line} col ${col})`);
    this.line = line;
    this.col = col;
    this.details = details;
  }
}

class LexicalProblem extends Problem {
  constructor(message, line, details = {}) {
    super(`Lexical Error: ${message} (record ending at ${line})`);
    this.line = line;
    this.details = details;
  }
}

module.exports = { Problem, ParseProblem, LexicalProblem };

