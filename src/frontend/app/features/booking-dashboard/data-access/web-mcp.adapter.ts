import {
  createEnvironmentInjector,
  declareExperimentalWebMcpTool,
  DOCUMENT,
  EnvironmentInjector,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { SiteTool } from './booking-site-tools';

@Injectable({ providedIn: 'root' })
export class WebMcpAdapter {
  private readonly document = inject(DOCUMENT);
  private readonly parentInjector = inject(EnvironmentInjector);
  private registration: EnvironmentInjector | null = null;
  private readonly detected = signal(false);
  private readonly registered = signal(false);
  readonly available = this.detected.asReadonly();
  readonly ready = this.registered.asReadonly();

  mount(tools: readonly SiteTool[]): () => void {
    const navigator = this.document.defaultView?.navigator as
      (Navigator & Pick<Document, 'modelContext'>) | undefined;
    const context = this.document.modelContext ?? navigator?.modelContext;
    this.detected.set(typeof context?.registerTool === 'function');
    if (!this.available() || this.registration) return () => {};

    const injector = createEnvironmentInjector([], this.parentInjector);
    this.registration = injector;
    void this.register(tools, injector);

    return () => this.release(injector);
  }

  private release(injector: EnvironmentInjector): void {
    if (injector !== this.registration) return;
    this.registration = null;
    this.registered.set(false);
    injector.destroy();
  }

  private async register(tools: readonly SiteTool[], injector: EnvironmentInjector): Promise<void> {
    try {
      for (const tool of tools) {
        if (injector !== this.registration) return;
        await declareExperimentalWebMcpTool(tool, injector);
      }
      if (injector === this.registration) this.registered.set(true);
    } catch {
      this.release(injector);
    }
  }
}
