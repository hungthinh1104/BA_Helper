export function scoreReferenceSet(expectedValues: Iterable<string>, predictedValues: Iterable<string>) {
  const expected = new Set(expectedValues), predicted = new Set(predictedValues);
  const missing = [...expected].filter(value => !predicted.has(value)).sort();
  const unexpected = [...predicted].filter(value => !expected.has(value)).sort();
  const truePositive = expected.size - missing.length;
  const falsePositive = unexpected.length;
  const falseNegative = missing.length;
  const f1Denominator = 2 * truePositive + falsePositive + falseNegative;
  return { expected: expected.size, predicted: predicted.size, truePositive,
    falsePositive, falseNegative,
    precision: predicted.size ? truePositive / predicted.size : null,
    recall: expected.size ? truePositive / expected.size : null,
    f1: f1Denominator ? (2 * truePositive) / f1Denominator : null, missing, unexpected };
}
