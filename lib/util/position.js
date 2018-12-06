const newline = '\u000a';

class PositionCounter {
  constructor() {
    this.line = 1;
    this.char = 1;
  }

  count(char) {
    if (char === newline) {
      this.line += 1;
      this.char = 1;
    } else {
      this.char += 1;
    }
  }

  toString() { return `${this.line}:${this.char}`; }
}

module.exports = { PositionCounter };

