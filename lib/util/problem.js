
class Problem extends Error {
  constructor(message, line, col, details = {}) {
    super(message);
    this.line = line;
    this.col = col;
    this.details = details;
  }
}

class ParseProblem extends Problem {
  toString() { return `Parse Error: ${this.message} (line ${this.line} col ${this.col})`; }
}

class LexicalProblem extends Problem {
  toString() { return `Lexical Error: ${this.message} (record ending at ${this.line} col ${this.col})`; }
}

module.exports = { Problem, ParseProblem, LexicalProblem };

