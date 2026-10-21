import { Node } from 'ts-morph';
import type { CallExpression } from 'ts-morph';
import type { TestModifier } from '../scanner.types';

type JestApi = 'describe' | 'it' | 'test';
const apis = new Set(['describe', 'it', 'test']);

export function readJestDeclaration(call: CallExpression): {
  api: JestApi; modifier: TestModifier; supported: boolean; parameterized?: boolean;
} | undefined {
  let expression: Node = call.getExpression();
  let parameterized = false;
  // Parse the curried declaration, never evaluate its table or expand data rows.
  if (Node.isCallExpression(expression) && expression.getArguments().length === 1 &&
    Node.isArrayLiteralExpression(expression.getArguments()[0])) {
    const each = expression.getExpression();
    if (Node.isPropertyAccessExpression(each) && each.getName() === 'each') {
      parameterized = true;
      expression = each.getExpression();
    }
  }
  const modifiers: string[] = [];
  let factory = false;
  while (!Node.isIdentifier(expression)) {
    if (Node.isPropertyAccessExpression(expression)) {
      modifiers.push(expression.getName());
      expression = expression.getExpression();
    } else if (Node.isCallExpression(expression)) {
      factory = true;
      expression = expression.getExpression();
    } else if (Node.isTaggedTemplateExpression(expression)) {
      factory = true;
      expression = expression.getTag();
    } else return undefined;
  }
  const declarations = expression.getSymbol()?.getDeclarations() ?? [];
  let name = expression.getText();
  let importedFromJest = true;
  if (declarations.length) {
    const imported = declarations.find(Node.isImportSpecifier);
    if (!imported) return undefined; // A local helper shadowing a Jest global.
    name = imported.getName();
    importedFromJest = imported.getImportDeclaration().getModuleSpecifierValue() === '@jest/globals';
  }
  if (!apis.has(name)) return undefined;
  const modifier = modifiers[0]?.toUpperCase() ?? 'NORMAL';
  const validSpelling = modifiers.length === 0 || ['skip', 'only', 'todo'].includes(modifiers[0]);
  const supported = importedFromJest && !factory && modifiers.length <= 1 &&
    validSpelling &&
    ['NORMAL', 'SKIP', 'ONLY', ...(name === 'describe' ? [] : ['TODO'])].includes(modifier) &&
    (!parameterized || (name !== 'describe' && modifier !== 'TODO'));
  return { api: name as JestApi, modifier: supported ? modifier as TestModifier : 'NORMAL', supported,
    ...(supported && parameterized ? { parameterized: true } : {}) };
}

export function literalJestTitle(node: Node | undefined): string | undefined {
  if (!node || (!Node.isStringLiteral(node) && !Node.isNoSubstitutionTemplateLiteral(node))) return undefined;
  const title = node.getLiteralText();
  return title.trim().length && title.length <= 1000 ? title : undefined;
}

export function effectiveTestModifier(parent: TestModifier, local: TestModifier): TestModifier {
  if (parent === 'SKIP' || local === 'SKIP') return 'SKIP';
  if (local === 'TODO') return 'TODO';
  if (parent === 'ONLY' || local === 'ONLY') return 'ONLY';
  return 'NORMAL';
}
