import { Project, SyntaxKind } from 'ts-morph';
import { TestCallIndex } from '../../src/graph/test-call-index';

function calls(text: string) {
  return new Project({ useInMemoryFileSystem: true }).createSourceFile('test.ts', text)
    .getDescendantsOfKind(SyntaxKind.CallExpression);
}

describe('test-body call index', () => {
  it('matches full containment, including nested calls, without including enclosing declarations', () => {
    const source = calls("beforeEach(() => setup()); it.each([table()])('title', () => { wrap(service.refund()); }); afterAll(() => cleanup());");
    const start = source.find(call => call.getText() === 'wrap(service.refund())')!.getStart();
    const end = source.find(call => call.getText() === 'wrap(service.refund())')!.getEnd();
    const index = new TestCallIndex(source);
    expect(index.within({ start, end })).toEqual(source.filter(call =>
      call.getStart() >= start && call.getEnd() <= end));
    expect(index.within({ start, end }).map(call => call.getText())).toEqual([
      'wrap(service.refund())', 'service.refund()',
    ]);
  });

  it('preserves preorder for nested calls sharing a start offset', () => {
    const source = calls('factory().execute();');
    const index = new TestCallIndex([...source].reverse());
    // Source preorder is caller-owned; equal offsets retain their input order.
    expect(index.within({ start: 0, end: 100 })).toEqual([...source].reverse());
    expect(index.within({ start: 0, end: 9 }).map(call => call.getText())).toEqual(['factory()']);
  });

  it('handles empty inputs, disjoint bodies and repeated/overlapping lookups independently', () => {
    expect(new TestCallIndex([]).within({ start: 0, end: 1 })).toEqual([]);
    const source = calls('first(); second(); third();');
    const index = new TestCallIndex(source);
    for (const call of source) {
      expect(index.within({ start: call.getStart(), end: call.getEnd() })).toEqual([call]);
    }
    expect(index.within({ start: 0, end: 0 })).toEqual([]);
    expect(index.within({ start: 10_000, end: 10_001 })).toEqual([]);
    expect(index.within({ start: 0, end: 100 })).toEqual(source);
    expect(index.within({ start: 1, end: 0 })).toEqual([]);
  });

  it('reads AST positions once rather than again for every test body', () => {
    const source = calls(Array.from({ length: 200 }, (_, i) => `call${i}();`).join('\n'));
    const starts = source.map(call => jest.spyOn(call, 'getStart'));
    const ends = source.map(call => jest.spyOn(call, 'getEnd'));
    const index = new TestCallIndex(source);
    const spans = source.map((call, i) => ({ start: starts[i].mock.results[0].value, end: ends[i].mock.results[0].value }));
    for (const span of spans) expect(index.within(span)).toHaveLength(1);
    for (const spy of [...starts, ...ends]) expect(spy).toHaveBeenCalledTimes(1);
  });
});
