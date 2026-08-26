import { Page } from 'playwright';

export interface DOMElement {
  tag: string;
  id: string | null;
  name: string | null;
  type: string | null;
  className: string | null;
  placeholder: string | null;
  ariaLabel: string | null;
  href: string | null;
  isVisible: boolean;
  text: string | null;
}

export interface DOMAnalysis {
  title: string;
  url: string;
  inputs: DOMElement[];
  buttons: DOMElement[];
  links: DOMElement[];
  images: DOMElement[];
  forms: DOMElement[];
  headings: DOMElement[];
  shadowDOMHosts: DOMElement[];
  navigation: DOMElement[];
  totalElements: number;
  visibleElements: number;
}

export class DOMAnalyzer {
  private page: Page;
  private analysis: DOMAnalysis | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  async analyze(): Promise<DOMAnalysis> {
    console.log('🔍 DOM analizi yapılıyor...');

    const [title, url] = await Promise.all([
      this.page.title(),
      this.page.url(),
    ]);

    const [
      inputs,
      buttons,
      links,
      images,
      forms,
      headings,
      shadowDOMHosts,
      navigation,
    ] = await Promise.all([
      this.getInputs(),
      this.getButtons(),
      this.getLinks(),
      this.getImages(),
      this.getForms(),
      this.getHeadings(),
      this.getShadowDOMHosts(),
      this.getNavigation(),
    ]);

    const allElements = await this.page.locator('*').count();
    const visibleElements = await this.page.locator(':visible').count();

    this.analysis = {
      title,
      url,
      inputs,
      buttons,
      links,
      images,
      forms,
      headings,
      shadowDOMHosts,
      navigation,
      totalElements: allElements,
      visibleElements,
    };

    console.log(`✅ DOM analizi tamamlandı: ${visibleElements} görünür element`);
    
    return this.analysis;
  }

  private async getInputs(): Promise<DOMElement[]> {
    const inputs = await this.page.locator('input, textarea, select').all();
    const elements: DOMElement[] = [];

    for (const input of inputs) {
      const isVisible = await input.isVisible().catch(() => false);
      elements.push({
        tag: await input.evaluate(el => el.tagName.toLowerCase()),
        id: await input.getAttribute('id'),
        name: await input.getAttribute('name'),
        type: await input.getAttribute('type'),
        className: await input.getAttribute('class'),
        placeholder: await input.getAttribute('placeholder'),
        ariaLabel: await input.getAttribute('aria-label'),
        href: null,
        isVisible,
        text: null,
      });
    }

    return elements;
  }

  private async getButtons(): Promise<DOMElement[]> {
    const buttons = await this.page.locator('button, [role="button"], input[type="submit"]').all();
    const elements: DOMElement[] = [];

    for (const button of buttons) {
      const isVisible = await button.isVisible().catch(() => false);
      const text = await button.innerText().catch(() => '');
      elements.push({
        tag: await button.evaluate(el => el.tagName.toLowerCase()),
        id: await button.getAttribute('id'),
        name: await button.getAttribute('name'),
        type: await button.getAttribute('type'),
        className: await button.getAttribute('class'),
        placeholder: null,
        ariaLabel: await button.getAttribute('aria-label'),
        href: null,
        isVisible,
        text: text.substring(0, 100),
      });
    }

    return elements;
  }

  private async getLinks(): Promise<DOMElement[]> {
    const links = await this.page.locator('a').all();
    const elements: DOMElement[] = [];

    for (const link of links) {
      const isVisible = await link.isVisible().catch(() => false);
      const text = await link.innerText().catch(() => '');
      elements.push({
        tag: 'a',
        id: await link.getAttribute('id'),
        name: null,
        type: null,
        className: await link.getAttribute('class'),
        placeholder: null,
        ariaLabel: await link.getAttribute('aria-label'),
        href: await link.getAttribute('href'),
        isVisible,
        text: text.substring(0, 100),
      });
    }

    return elements;
  }

  private async getImages(): Promise<DOMElement[]> {
    const images = await this.page.locator('img').all();
    const elements: DOMElement[] = [];

    for (const img of images) {
      const isVisible = await img.isVisible().catch(() => false);
      elements.push({
        tag: 'img',
        id: await img.getAttribute('id'),
        name: null,
        type: null,
        className: await img.getAttribute('class'),
        placeholder: null,
        ariaLabel: await img.getAttribute('alt'),
        href: await img.getAttribute('src'),
        isVisible,
        text: null,
      });
    }

    return elements;
  }

  private async getForms(): Promise<DOMElement[]> {
    const forms = await this.page.locator('form').all();
    const elements: DOMElement[] = [];

    for (const form of forms) {
      const isVisible = await form.isVisible().catch(() => false);
      elements.push({
        tag: 'form',
        id: await form.getAttribute('id'),
        name: await form.getAttribute('name'),
        type: await form.getAttribute('method'),
        className: await form.getAttribute('class'),
        placeholder: null,
        ariaLabel: await form.getAttribute('aria-label'),
        href: await form.getAttribute('action'),
        isVisible,
        text: null,
      });
    }

    return elements;
  }

  private async getHeadings(): Promise<DOMElement[]> {
    const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').all();
    const elements: DOMElement[] = [];

    for (const heading of headings) {
      const isVisible = await heading.isVisible().catch(() => false);
      const text = await heading.innerText().catch(() => '');
      elements.push({
        tag: await heading.evaluate(el => el.tagName.toLowerCase()),
        id: await heading.getAttribute('id'),
        name: null,
        type: null,
        className: await heading.getAttribute('class'),
        placeholder: null,
        ariaLabel: null,
        href: null,
        isVisible,
        text: text.substring(0, 100),
      });
    }

    return elements;
  }

  private async getShadowDOMHosts(): Promise<DOMElement[]> {
    const hosts = await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('*'))
        .filter(el => el.shadowRoot)
        .map(el => ({
          tag: el.tagName.toLowerCase(),
          id: el.id,
          className: el.className.toString(),
          childCount: el.shadowRoot?.childElementCount || 0,
        }));
    });

    return hosts.map(h => ({
      tag: h.tag,
      id: h.id,
      name: null,
      type: null,
      className: h.className,
      placeholder: null,
      ariaLabel: null,
      href: null,
      isVisible: true,
      text: `${h.childCount} children`,
    }));
  }

  private async getNavigation(): Promise<DOMElement[]> {
    const navs = await this.page.locator('nav').all();
    const elements: DOMElement[] = [];

    for (const nav of navs) {
      const isVisible = await nav.isVisible().catch(() => false);
      elements.push({
        tag: 'nav',
        id: await nav.getAttribute('id'),
        name: null,
        type: null,
        className: await nav.getAttribute('class'),
        placeholder: null,
        ariaLabel: await nav.getAttribute('aria-label'),
        href: null,
        isVisible,
        text: null,
      });
    }

    return elements;
  }

  getVisibleInputs(): DOMElement[] {
    return (this.analysis?.inputs || []).filter(i => i.isVisible);
  }

  getVisibleButtons(): DOMElement[] {
    return (this.analysis?.buttons || []).filter(b => b.isVisible);
  }

  getVisibleLinks(): DOMElement[] {
    return (this.analysis?.links || []).filter(l => l.isVisible);
  }

  getImagesWithoutAlt(): DOMElement[] {
    return (this.analysis?.images || []).filter(i => i.isVisible && (!i.ariaLabel || i.ariaLabel.trim() === ''));
  }

  getFormInputs(): DOMElement[] {
    return (this.analysis?.inputs || []).filter(i => i.isVisible && i.type !== 'hidden');
  }
}
