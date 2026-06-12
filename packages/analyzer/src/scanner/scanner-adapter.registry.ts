import { ScannerAdapter, ScannerCapabilityProfile } from './scanner.types';
import { TypeScriptNestJsAdapter } from './adapters/typescript-nestjs.adapter';
import { JavaSpringAdapter } from './adapters/java-spring.adapter';
import { GoAdapter } from './adapters/go.adapter';
import { PythonAdapter } from './adapters/python.adapter';
import { CSharpAdapter } from './adapters/csharp.adapter';
import { PhpLaravelAdapter } from './adapters/php-laravel.adapter';
import { RubyRailsAdapter } from './adapters/ruby-rails.adapter';

export class ScannerAdapterRegistry {
  private adapters: ScannerAdapter[] = [];

  constructor() {
    this.registerAdapter(new TypeScriptNestJsAdapter());
    this.registerAdapter(new JavaSpringAdapter());
    this.registerAdapter(new GoAdapter('gin'));
    this.registerAdapter(new GoAdapter('net/http'));
    this.registerAdapter(new GoAdapter());
    this.registerAdapter(new PythonAdapter('fastapi'));
    this.registerAdapter(new PythonAdapter());
    this.registerAdapter(new CSharpAdapter('aspnetcore'));
    this.registerAdapter(new PhpLaravelAdapter());
    this.registerAdapter(new RubyRailsAdapter());
  }

  registerAdapter(adapter: ScannerAdapter) {
    this.adapters.push(adapter);
  }

  tryGetAdapter(language: string, framework?: string): ScannerAdapter | null {
    const lang = language.toLowerCase();
    const fw = framework?.toLowerCase();

    for (const adapter of this.adapters) {
      if (adapter.language !== lang) continue;

      // If the adapter declares a specific framework, the caller MUST supply
      // that exact framework — no implicit fallback to a framework-scoped adapter.
      if (adapter.framework !== undefined) {
        if (fw === adapter.framework) return adapter;
      } else {
        // Adapter has no framework (generic fallback) — matches when caller
        // either omits framework or passes one that no framework-specific adapter handles.
        if (!fw) return adapter;
      }
    }

    return null;
  }

  getAdapter(language: string, framework?: string): ScannerAdapter {
    const adapter = this.tryGetAdapter(language, framework);
    if (!adapter) {
      throw new Error(`UNSUPPORTED_LANGUAGE_OR_FRAMEWORK: No scanner adapter found for ${language} / ${framework || 'any'}`);
    }
    return adapter;
  }

  listCapabilities(): ScannerCapabilityProfile[] {
    return this.adapters.map(adapter => adapter.capability);
  }
}
