class CircularBuffer {
  constructor(size) {
    this.size = size;
    this.buffer = new Array(size);
    this.start = 0;
    this.end = 0;
    this.length = 0;
  }

  add(element) {
    this.buffer[this.end] = element;
    this.end = (this.end + 1) % this.size;

    if (this.length < this.size) {
      this.length++;
    } else {
      this.start = (this.start + 1) % this.size;
    }
  }

  getAll() {
    const result = [];
    for (let i = 0; i < this.length; i++) {
      result.push(this.buffer[(this.start + i) % this.size]);
    }
    return result;
  }
}

module.exports = CircularBuffer;
