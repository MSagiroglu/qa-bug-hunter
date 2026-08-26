import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';

export interface BrowserConfig {
  headless: boolean;
  timeout: number;
  viewport: { width: number; height: number };
  videoDir: string;
  screenshotDir: string;
}

export class BrowserManager {
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
      ...config,
    };
  }

  async launch(): Promise<void> {
    console.log('🚀 Tarayıcı başlatılıyor...');
    
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--start-maximized',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
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
