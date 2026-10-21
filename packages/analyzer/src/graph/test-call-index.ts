import type { CallExpression } from 'ts-morph';

type Span = { start: number; end: number };

/** Keeps source order for equal offsets; only fully contained calls belong to a body. */
export class TestCallIndex {
  private readonly calls: Array<Span & { call: CallExpression }>;

  constructor(calls: readonly CallExpression[]) {
    this.calls = calls.map(call => ({ call, start: call.getStart(), end: call.getEnd() }))
      .sort((a, b) => a.start - b.start);
  }

  within(span: Span): CallExpression[] {
    let low = 0, high = this.calls.length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (this.calls[middle].start < span.start) low = middle + 1;
      else high = middle;
    }
    const contained: CallExpression[] = [];
    for (let index = low; index < this.calls.length && this.calls[index].start <= span.end; index++) {
      const entry = this.calls[index];
      if (entry.end <= span.end) contained.push(entry.call);
    }
    return contained;
  }
}
