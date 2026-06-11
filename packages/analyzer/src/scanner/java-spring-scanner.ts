import * as fs from 'node:fs/promises';
import { relative } from 'node:path';
import type { ScanInput, ScanResult, ScanArtifact } from './scanner.types';

export const scanJavaSpringProject = async (
  input: ScanInput & { javaFiles: string[] },
): Promise<ScanResult> => {
  const artifacts: ScanArtifact[] = [];

  for (const file of input.javaFiles) {
    let content = '';
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }

    const filePath = relative(input.fixturePath, file);
    
    // Very basic regex-based extraction for pilot MVP

    // Class level extraction
    // This matches decorators like @RestController, @Service and then the class name
    const classPattern = /@(RestController|Controller|Service|Entity|Test|SpringBootTest)[\s\S]*?(?:public\s+|abstract\s+|class\s+)+class\s+(\w+)/g;
    let classMatch;

    while ((classMatch = classPattern.exec(content)) !== null) {
      const annotation = classMatch[1];
      const className = classMatch[2];
      const startIndex = classMatch.index;
      
      // Approximation of line number
      const startLine = content.substring(0, startIndex).split('\n').length;
      
      let type: string | null = null;
      let rawType = '';

      if (annotation === 'RestController' || annotation === 'Controller') {
        type = 'SPRING_CONTROLLER';
        rawType = 'SPRING_CONTROLLER';
      } else if (annotation === 'Service') {
        type = 'SPRING_SERVICE';
        rawType = 'SPRING_SERVICE';
      } else if (annotation === 'Entity') {
        type = 'SPRING_ENTITY';
        rawType = 'SPRING_ENTITY';
      } else if (annotation === 'Test' || annotation === 'SpringBootTest') {
        type = 'SPRING_TEST';
        rawType = 'SPRING_TEST';
      }

      if (type === 'SPRING_ENTITY' || type === 'SPRING_TEST') {
        artifacts.push({
          stableId: `java-${type.toLowerCase()}:${className}`,
          type: rawType,
          filePath,
          symbolName: className,
          startLine,
          endLine: startLine + 10, // approximate since regex doesn't easily parse matching braces
          excerpt: `// Extract from ${className}\n// Full content excluded in pilot adapter.`,
        });
      } else if (type === 'SPRING_CONTROLLER' || type === 'SPRING_SERVICE') {
        // Extract public methods for Controller and Service
        // A naive regex to find public methods inside this file
        // It matches @GetMapping(...) public ReturnType methodName(...)
        const methodPattern = /@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)(?:\([^)]*\))?[\s\S]*?public\s+(?:[\w<>[\]?]+\s+)+(\w+)\s*\(/g;
        
        let methodMatch;
        // Search from the class definition onwards
        const classContent = content.substring(startIndex);
        
        if (type === 'SPRING_CONTROLLER') {
          while ((methodMatch = methodPattern.exec(classContent)) !== null) {
            const methodName = methodMatch[1];
            const methodStartLine = startLine + classContent.substring(0, methodMatch.index).split('\n').length - 1;
            
            artifacts.push({
              stableId: `java-api:${className}.${methodName}`,
              type: 'SPRING_CONTROLLER_METHOD',
              filePath,
              symbolName: `${className}.${methodName}`,
              startLine: methodStartLine,
              endLine: methodStartLine + 5,
              excerpt: `// Extracted method ${methodName} from ${className}`,
            });
          }
        } else if (type === 'SPRING_SERVICE') {
          // For service, we just match public methods generically
          const serviceMethodPattern = /public\s+(?:[\w<>[\]?]+\s+)+(\w+)\s*\(/g;
          while ((methodMatch = serviceMethodPattern.exec(classContent)) !== null) {
            const methodName = methodMatch[1];
            // Skip constructors
            if (methodName === className) continue;

            const methodStartLine = startLine + classContent.substring(0, methodMatch.index).split('\n').length - 1;
            
            artifacts.push({
              stableId: `java-service-method:${className}.${methodName}`,
              type: 'SPRING_SERVICE_METHOD',
              filePath,
              symbolName: `${className}.${methodName}`,
              startLine: methodStartLine,
              endLine: methodStartLine + 5,
              excerpt: `// Extracted method ${methodName} from ${className}`,
            });
          }
        }
      }
    }
  }

  return {
    analyzerVersion: input.analyzerVersion,
    artifacts,
    // Spring Boot adapter natively sets PARTIAL coverage in the usecase.
    coverage: { status: 'READY', skippedFiles: [] },
    sourceRoot: input.fixturePath,
  };
};
