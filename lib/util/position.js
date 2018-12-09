const newline = '\u000a';

class PositionCounter {
  constructor() {
    this.line = 1;
    this.col = 1;
  }

  count(char) {
    if (char === newline) {
      this.line += 1;
      this.col = 1;
    } else {
      this.col += 1;
    }
  }

  toString() { return `${this.line}:${this.col}`; }
}

module.exports = { PositionCounter };

