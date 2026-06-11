import * as fs from 'node:fs/promises';
import { relative } from 'node:path';
import { ANALYZER_VERSION } from './scanner.types';
import type { ScanInput, ScanResult, ScanArtifact } from './scanner.types';
import { computeArtifactContentHash } from './content-hasher';

export const scanJavaSpringProject = async (
  input: ScanInput & { javaFiles: string[], coverage?: import('./scanner.types').ScanCoverage },
): Promise<ScanResult> => {
  const artifacts: ScanArtifact[] = [];
  const diagnostics: { code: string, message: string }[] = [];

  const normalizePath = (base: string, methodPath: string) => {
    let fullPath = `${base}/${methodPath}`;
    fullPath = fullPath.replace(/\/+/g, '/');
    if (!fullPath.startsWith('/')) fullPath = '/' + fullPath;
    if (fullPath.length > 1 && fullPath.endsWith('/')) {
      fullPath = fullPath.slice(0, -1);
    }
    return fullPath;
  };

  const extractBlock = (text: string, startIndex: number) => {
    const firstBrace = text.indexOf('{', startIndex);
    if (firstBrace === -1) return text.substring(startIndex);
    let depth = 0;
    for (let i = firstBrace; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) return text.substring(startIndex, i + 1);
      }
    }
    return text.substring(startIndex);
  };

  for (const file of input.javaFiles) {
    let content = '';
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }

    const filePath = relative(input.fixturePath, file);
    const normalizedFilePath = filePath.split('\\').join('/');
    
    // Class level extraction
    const classPattern = /@(RestController|Controller|Service|Entity|Test|SpringBootTest)[\s\S]*?(?:public\s+|abstract\s+|class\s+)+class\s+(\w+)/g;
    let classMatch;

    while ((classMatch = classPattern.exec(content)) !== null) {
      const annotation = classMatch[1];
      const className = classMatch[2];
      const startIndex = classMatch.index;
      
      const contentUpToClass = content.substring(0, startIndex);
      const startLine = contentUpToClass.split('\n').length;
      
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
        // Extract top 10-15 meaningful lines for display
        const canonicalContentForHash = extractBlock(content, startIndex);
        const lines = canonicalContentForHash.split('\n');
        const excerptLines = lines.slice(0, 15).join('\n');
        artifacts.push({
          stableId: `${type === 'SPRING_ENTITY' ? 'entity' : 'test'}:${normalizedFilePath}:${className}`,
          type: rawType,
          filePath,
          symbolName: className,
          startLine,
          endLine: startLine + (lines.length > 0 ? lines.length - 1 : 15),
          excerpt: excerptLines,
          contentHash: computeArtifactContentHash(canonicalContentForHash),
        });
      } else if (type === 'SPRING_CONTROLLER' || type === 'SPRING_SERVICE') {
        let methodsExtracted = 0;
        const classBodyStart = content.indexOf('{', startIndex);
        const classContent = classBodyStart > -1 ? content.substring(classBodyStart) : content.substring(startIndex);

        if (type === 'SPRING_CONTROLLER') {
          // Extract class level @RequestMapping
          let classBasePath = '';
          const classAnnotationsContent = content.substring(startIndex, classBodyStart);
          const classRequestMappingMatch = classAnnotationsContent.match(/@RequestMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?["']([^"']*)["']/);
          if (classRequestMappingMatch) {
            classBasePath = classRequestMappingMatch[1];
          }

          const methodPattern = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)(?:\s*\(([^)]*)\))?[\s\S]*?public\s+(?:[\w<>[\]?]+\s+)+(\w+)\s*\(/g;
          let methodMatch;

          while ((methodMatch = methodPattern.exec(classContent)) !== null) {
            const annotationType = methodMatch[1];
            const params = methodMatch[2] || '';
            const methodName = methodMatch[3];
            
            let httpMethod = 'UNKNOWN';
            let methodPath = '';

            if (annotationType === 'RequestMapping') {
              const methodRegex = /method\s*=\s*RequestMethod\.([A-Z]+)/;
              const match = params.match(methodRegex);
              if (match) httpMethod = match[1];
            } else {
              httpMethod = annotationType.replace('Mapping', '').toUpperCase();
            }

            const pathMatch = params.match(/(?:path|value)\s*=\s*["']([^"']*)["']|^\s*["']([^"']*)["']/);
            if (pathMatch) {
              methodPath = pathMatch[1] || pathMatch[2];
            }

            const fullPath = normalizePath(classBasePath, methodPath);
            
            // Handle specific UNKNOWN logic per requirements
            if (httpMethod === 'UNKNOWN' && annotationType === 'RequestMapping') {
              diagnostics.push({ code: 'SPRING_HTTP_METHOD_UNKNOWN', message: `Unknown HTTP method for ${className}.${methodName}` });
            }
            if (params.includes('{') && !params.includes('"{')) {
               // A very complex annotation that we didn't parse properly
               diagnostics.push({ code: 'SPRING_UNSUPPORTED_COMPLEX_ANNOTATION', message: `Complex annotation skipped at ${className}.${methodName}` });
            }

            const methodStartLine = startLine + classContent.substring(0, methodMatch.index).split('\n').length - 1;
            
            const canonicalContentForHash = extractBlock(classContent, methodMatch.index);

            // Excerpt should include HTTP method + full path
            const excerpt = `// ${httpMethod} ${fullPath}\n// Extracted method ${methodName} from ${className}`;
            
            artifacts.push({
              stableId: `api:${normalizedFilePath}:${className}.${methodName}:${httpMethod}:${fullPath}`,
              type: 'SPRING_CONTROLLER_METHOD',
              filePath,
              symbolName: `${httpMethod} ${fullPath} -> ${className}.${methodName}`,
              startLine: methodStartLine,
              endLine: methodStartLine + canonicalContentForHash.split('\n').length - 1,
              excerpt,
              contentHash: computeArtifactContentHash(canonicalContentForHash),
            });
            methodsExtracted++;
          }
        } else if (type === 'SPRING_SERVICE') {
          const serviceMethodPattern = /public\s+(?:[\w<>[\]?]+\s+)+(\w+)\s*\(/g;
          let methodMatch;
          while ((methodMatch = serviceMethodPattern.exec(classContent)) !== null) {
            const methodName = methodMatch[1];
            if (methodName === className) continue;

            const methodStartLine = startLine + classContent.substring(0, methodMatch.index).split('\n').length - 1;
            const canonicalContentForHash = extractBlock(classContent, methodMatch.index);
            
            // Extract signature
            const signatureMatch = classContent.substring(methodMatch.index).match(/public[\s\S]*?\{/);
            const signature = signatureMatch ? signatureMatch[0].replace('{', '').trim() : `public void ${methodName}(...)`;
            
            artifacts.push({
              stableId: `service-method:${normalizedFilePath}:${className}.${methodName}`,
              type: 'SPRING_SERVICE_METHOD',
              filePath,
              symbolName: `${className}.${methodName}`,
              startLine: methodStartLine,
              endLine: methodStartLine + canonicalContentForHash.split('\n').length - 1,
              excerpt: `// Extracted method ${methodName} from ${className}\n${signature}`,
              contentHash: computeArtifactContentHash(canonicalContentForHash),
            });
            methodsExtracted++;
          }
        }

        if (methodsExtracted === 0) {
          diagnostics.push({ code: 'SPRING_EXTRACTION_INCOMPLETE', message: `No methods extracted for stereotypic class ${className}` });
        }
      }
    }
  }

  const defaultCoverage: import('./scanner.types').ScanCoverage = {
    status: 'PARTIAL',
    skippedFiles: [],
    skippedSummary: {
        IGNORED_DIRECTORY: 0,
        UNSUPPORTED_EXTENSION: 0,
        GENERATED_FILE: 0,
        VENDOR_FILE: 0,
        BUILD_OUTPUT: 0,
        FILE_TOO_LARGE: 0,
        REPO_FILE_LIMIT_EXCEEDED: 0,
        REPO_SIZE_LIMIT_EXCEEDED: 0,
        SYMLINK_OUTSIDE_ROOT: 0,
        BINARY_FILE: 0,
        READ_ERROR: 0,
        UNSUPPORTED_FRAMEWORK: 0,
        UNSUPPORTED_LANGUAGE: 0,
    },
    limits: { maxFiles: 0, maxFileBytes: 0 },
    limitHits: { fileLimitHit: false, repoSizeLimitHit: false }
  };

  const coverage = input.coverage || defaultCoverage;
  coverage.status = 'PARTIAL';

  return {
    analyzerVersion: input.analyzerVersion || ANALYZER_VERSION,
    artifacts,
    coverage,
    sourceRoot: input.fixturePath,
    // Note: Diagnostics should ideally be passed back through a dedicated channel or diagnostic array if the ScanResult schema allows it.
    // For now, these are internal warnings generated by the parser. If the system supports it, they should be attached to ScanHealthDiagnostics.
  };
};
