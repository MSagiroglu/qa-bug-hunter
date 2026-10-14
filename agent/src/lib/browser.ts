import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';

export interface BrowserConfig {
  headless: boolean;
  timeout: number;
  viewport: { width: number; height: number };
  videoDir: string;
  screenshotDir: string;
  /** Opt-in only: disables same-origin protections. Never default. */
  insecure: boolean;
}

export interface NetworkRecord {
  method: string;
  url: string;
  status: number;
  headers: Record<string, string>;
  postData: string | null;
  /** 'load' = traffic during initial navigation; 'run' = traffic while the agent was acting. */
  phase: 'load' | 'run';
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class BrowserManager {
  private networkLog: NetworkRecord[] = [];
  private pendingNetwork: Promise<void>[] = [];
  phase: 'load' | 'run' = 'load';
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;

  constructor(config: Partial<BrowserConfig> = {}) {
    this.config = {
      headless: false, // Default to headed mode
      timeout: 60000,
      viewport: { width: 1920, height: 1080 },
      videoDir: './evidence/videos',
      screenshotDir: './evidence/screenshots',
      insecure: false,
      ...config,
    };
  }

  async launch(): Promise<void> {
    console.log('🚀 Tarayıcı başlatılıyor...');
    
    const args = ['--start-maximized'];
    if (this.config.insecure) {
      console.warn('WARNING: --insecure enabled: browser web security (same-origin policy, site isolation) is disabled. Results may not reflect real-user behavior; use only on throwaway targets.');
      args.push('--disable-web-security', '--disable-features=IsolateOrigins,site-per-process');
    }
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args,
    });

    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
      recordVideo: {
        dir: this.config.videoDir,
        size: this.config.viewport,
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    this.context.setDefaultTimeout(this.config.timeout);
    this.context.on('response', (response) => {
      const req = response.request();
      const status = response.status();
      if (!WRITE_METHODS.has(req.method()) || status < 200 || status > 299) return;
      const phase = this.phase;
      this.pendingNetwork.push(
        (async () => {
          const headers = await req.allHeaders().catch(() => ({} as Record<string, string>));
          const postData = req.postData() ?? null;
          this.networkLog.push({
            method: req.method(),
            url: req.url(),
            status,
            headers,
            postData: postData && postData.length <= 65536 ? postData : null,
            phase,
          });
        })().catch(() => {}),
      );
    });
    this.page = await this.context.newPage();
    
    // Maximize window
    await this.page.setViewportSize(this.config.viewport);
    
    console.log('✅ Tarayıcı başlatıldı');
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  async acceptCookies(): Promise<void> {
    if (!this.page) return;
    
    // Try common cookie consent selectors
    const selectors = [
      '#sp-cc-accept',
      '[data-testid="cookie-accept"]',
      'button:has-text("Accept")',
      'button:has-text("Kabul")',
      'button:has-text("Tamam")',
      '#onetrust-accept-btn-handler',
    ];

    for (const selector of selectors) {
      try {
        const button = this.page.locator(selector);
        if (await button.isVisible({ timeout: 2000 })) {
          await button.click();
          console.log('🍪 Çerez kabul edildi');
          break;
        }
      } catch {
        // Continue to next selector
      }
    }
  }

  /** Captured 2xx write requests (POST/PUT/PATCH/DELETE). Kept in memory only. */
  async getNetworkLog(): Promise<NetworkRecord[]> {
    await Promise.allSettled(this.pendingNetwork);
    return this.networkLog;
  }

  async newPage(): Promise<Page> {
    if (!this.page) throw new Error('Browser not launched');
    return this.page;
  }

  async getPage(): Promise<Page> {
    if (!this.page) throw new Error('Browser not launched');
    return this.page;
  }

  async close(): Promise<void> {
    console.log('🛑 Tarayıcı kapatılıyor...');
    
    if (this.page) {
      // Save video
      const video = this.page.video();
      if (video) {
        try {
          const videoPath = await video.path();
          console.log(`📹 Video kaydedildi: ${videoPath}`);
        } catch (e) {
          // Video might not be available
        }
      }
    }
    
    if (this.context) {
      await this.context.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    
    console.log('✅ Tarayıcı kapatıldı');
  }

  async screenshot(name: string): Promise<string> {
    if (!this.page) throw new Error('Browser not launched');
    
    const screenshotPath = path.join(this.config.screenshotDir, `${name}-${Date.now()}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  }

  async getVideoPath(): Promise<string | null> {
    if (!this.page) return null;
    
    const video = this.page.video();
    if (video) {
      try {
        return await video.path();
      } catch {
        return null;
      }
    }
    return null;
  }
}
