import { Project, SyntaxKind, ClassDeclaration, MethodDeclaration, SourceFile } from 'ts-morph';
import { join } from 'node:path';
import type { GraphResult, GraphEdge, GraphDiagnostic } from './graph.types';
import type { ScanResult, ScanArtifact } from '../scanner/scanner.types';

export const buildGraph = (scan: ScanResult): GraphResult => {
  if (!scan.sourceRoot) {
    return { edges: [] };
  }

  const project = new Project({
    useInMemoryFileSystem: false,
    skipFileDependencyResolution: true,
  });

  // Load all TS files
  project.addSourceFilesAtPaths(join(scan.sourceRoot, 'src/**/*.ts'));
  project.addSourceFilesAtPaths(join(scan.sourceRoot, 'test/**/*.ts'));

  const edges: GraphEdge[] = [];
  const diagnostics: GraphDiagnostic[] = [];

  // 1. Build lookup tables for artifacts
  const artifactByStableId = new Map<string, ScanArtifact>();
  const artifactByClassMethod = new Map<string, ScanArtifact>();
  const artifactByClassName = new Map<string, ScanArtifact>();
  const entityByClassName = new Map<string, ScanArtifact>();
  const testArtifacts = new Map<string, ScanArtifact>();

  for (const artifact of scan.artifacts) {
    artifactByStableId.set(artifact.stableId, artifact);
    
    if (artifact.type === 'ENTITY') {
      entityByClassName.set(artifact.symbolName.toLowerCase(), artifact);
      entityByClassName.set(artifact.symbolName, artifact);
    } else if (artifact.type === 'TEST') {
      // symbolName for test might be order-cancel.spec.ts
      testArtifacts.set(artifact.filePath, artifact);
    } else if (artifact.type === 'API_ROUTE' || artifact.type === 'SERVICE_METHOD') {
      artifactByClassMethod.set(artifact.symbolName, artifact);
      const className = artifact.symbolName.split('.')[0];
      if (className) {
        if (!artifactByClassName.has(className)) {
          // Find the class artifact (or mock one if we only have methods)
          // Wait, the scanner does NOT currently output class artifacts for controllers/services, only methods!
          // Ah! Let's check scanner.ts to confirm.
        }
      }
    }
  }

  // To properly resolve, we need to know what classes exist, even if scanner didn't emit them.
  // Actually, we can just use the symbol prefix.

  // Helper to add edge avoiding duplicates
  const addedEdges = new Set<string>();
  const addEdge = (from: string, to: string, type: string, confidence: number = 1.0) => {
    const key = `${from}->${type}->${to}`;
    if (!addedEdges.has(key)) {
      addedEdges.add(key);
      edges.push({ stableId: `edge:${from}->${to}`, from, to, type, confidence });
    }
  };

  for (const sourceFile of project.getSourceFiles()) {
    const isTestFile = sourceFile.getFilePath().includes('.spec.ts') || sourceFile.getFilePath().includes('.test.ts');
    
    if (isTestFile) {
      // --- TEST EDGE EXTRACTION ---
      // We look for test artifact matching this file
      const relativePath = sourceFile.getFilePath().replace(project.getFileSystem().getCurrentDirectory() + '/', '');
      // Try to find the matching test artifact
      let testArtifact = scan.artifacts.find(a => a.type === 'TEST' && sourceFile.getFilePath().endsWith(a.filePath));
      if (!testArtifact) continue;

      // Extract imports to find which class is tested
      const imports = sourceFile.getImportDeclarations();
      const importedClasses = new Set<string>();
      for (const imp of imports) {
        for (const named of imp.getNamedImports()) {
          importedClasses.add(named.getName());
        }
      }

      // Extract method calls in the test
      const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      const methodCalls = new Set<string>();
      for (const call of calls) {
        const expr = call.getExpression();
        if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
          const name = expr.getLastChildByKind(SyntaxKind.Identifier)?.getText();
          if (name) methodCalls.add(name);
        }
      }

      for (const imported of importedClasses) {
        // Find if this imported class has methods in artifacts
        const classMethods = scan.artifacts.filter(a => a.symbolName.startsWith(`${imported}.`));
        if (classMethods.length > 0) {
          // Class level test edge
          let methodEdgeCreated = false;
          for (const method of classMethods) {
            const methodName = method.symbolName.split('.')[1];
            if (methodName && methodCalls.has(methodName)) {
              addEdge(testArtifact.stableId, method.stableId, 'TESTS');
              methodEdgeCreated = true;
            }
          }
          if (!methodEdgeCreated) {
            // fallback to any method of that class as a "class level" edge, or we can just link to the first one
            // Since we don't have a class artifact, we can link to the first method or mock a class edge
            // Or link to all methods? For MVP, we'll link to the first method found for the class.
            addEdge(testArtifact.stableId, classMethods[0].stableId, 'TESTS', 0.8);
          }
        }
      }
      continue;
    }

    // --- CLASS EDGE EXTRACTION ---
    for (const cls of sourceFile.getClasses()) {
      const className = cls.getName();
      if (!className) continue;

      // 1. Build injection map
      const injectionMap = new Map<string, string>(); // propertyName -> ClassName
      const constructors = cls.getConstructors();
      for (const ctor of constructors) {
        for (const param of ctor.getParameters()) {
          const typeNode = param.getTypeNode();
          if (typeNode) {
            let typeName = typeNode.getText();
            if (typeName.includes('<')) {
              // handle Repository<StockReservation>
              const match = typeName.match(/Repository<([^>]+)>/);
              if (match) typeName = match[1];
            }
            injectionMap.set(param.getName(), typeName);
          }
        }
      }

      // 2. Class-level entity usage (Imports)
      // We see if the class imports any known entities
      const sourceImports = sourceFile.getImportDeclarations();
      for (const imp of sourceImports) {
        for (const named of imp.getNamedImports()) {
          const importedName = named.getName();
          const entityArtifact = entityByClassName.get(importedName);
          if (entityArtifact) {
            // We know this class imports an entity. 
            // We can attach a USES edge from all its methods (with lower confidence) or wait for method-level usage.
          }
        }
      }

      // 3. Process Methods
      for (const method of cls.getMethods()) {
        const methodName = method.getName();
        const sourceArtifact = artifactByClassMethod.get(`${className}.${methodName}`);
        if (!sourceArtifact) continue;

        // Find method calls inside this method
        const calls = method.getDescendantsOfKind(SyntaxKind.CallExpression);
        for (const call of calls) {
          const expr = call.getExpression();
          if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
            const propAccess = expr.asKind(SyntaxKind.PropertyAccessExpression);
            if (!propAccess) continue;

            const caller = propAccess.getExpression().getText(); // e.g. `this.orderService`
            const targetMethod = propAccess.getName(); // e.g. `cancelOrder`

            if (caller.startsWith('this.')) {
              const propName = caller.substring(5);
              const targetClass = injectionMap.get(propName);
              if (targetClass) {
                // We know it's calling targetClass.targetMethod
                const targetArtifact = artifactByClassMethod.get(`${targetClass}.${targetMethod}`);
                if (targetArtifact) {
                  addEdge(sourceArtifact.stableId, targetArtifact.stableId, 'CALLS');
                } else {
                  // Fallback: we know the class but not the method
                  // Find any method of targetClass to use as fallback class edge
                  const anyTargetMethod = scan.artifacts.find(a => a.symbolName.startsWith(`${targetClass}.`));
                  if (anyTargetMethod) {
                    addEdge(sourceArtifact.stableId, anyTargetMethod.stableId, 'CALLS', 0.5);
                    diagnostics.push({
                      code: 'UNRESOLVED_METHOD_TARGET',
                      message: `Resolved class ${targetClass} but could not find method ${targetMethod}`,
                      filePath: sourceFile.getFilePath(),
                      sourceSymbol: sourceArtifact.symbolName,
                      targetExpression: `${targetClass}.${targetMethod}`,
                    });
                  } else {
                    // Check if targetClass is an entity (e.g. Repository calls)
                    const entityArtifact = entityByClassName.get(targetClass);
                    if (entityArtifact) {
                      addEdge(sourceArtifact.stableId, entityArtifact.stableId, 'USES');
                    } else {
                      diagnostics.push({
                        code: 'UNRESOLVED_INJECTION_TOKEN',
                        message: `Could not resolve artifact for injected ${targetClass}`,
                        filePath: sourceFile.getFilePath(),
                        sourceSymbol: sourceArtifact.symbolName,
                      });
                    }
                  }
                }
              }
            }
          }
        }

        // Find Entity usages inside method (identifiers, types)
        // A simple heuristic: check all identifiers in the method body
        const identifiers = method.getDescendantsOfKind(SyntaxKind.Identifier);
        const usedIdentifiers = new Set(identifiers.map(i => i.getText()));
        
        for (const [entityName, entityArtifact] of entityByClassName.entries()) {
          // If the entity name is used in the method body, create a USES edge
          // E.g., `OrderStatus.CANCELLED` -> uses OrderStatus entity
          // E.g., `new StockReservation()` -> uses StockReservation entity
          // Also check if Repository<EntityName> is injected and used
          let usesEntity = usedIdentifiers.has(entityArtifact.symbolName);
          
          if (!usesEntity) {
            // Check if there is an injection for this entity's repository
            for (const [propName, typeName] of injectionMap.entries()) {
              if (typeName === entityArtifact.symbolName && usedIdentifiers.has(propName)) {
                usesEntity = true;
                break;
              }
            }
          }

          if (usesEntity) {
            addEdge(sourceArtifact.stableId, entityArtifact.stableId, 'USES');
          }
        }
      }
    }
  }

  return { edges, diagnostics };
};
