# Shadow DOM Testing

Shadow DOM içeren web uygulamalarında test yapma rehberi.
Playwright, Shadow DOM elementlerine `>>` syntax'ı ile erişir.

## Temel Prensip

Shadow DOM, elementlerin içeriğini gizler. Normal CSS selector'lar
çalışmaz. Playwright'ın `>>` (piercing) syntax'ı shadow boundary'yi
geçer.

## 1. Shadow DOM Element Bulma

### 1.1 Tek Seviye Shadow DOM

```typescript
// Normal selector çalışmaz:
await page.locator('#my-element').click();  // ❌ Bulamaz

// Playwright shadow piercing:
await page.locator('#my-element >> visible=true').click();  // ✅

// Deep shadow DOM:
await page.locator('my-component >> #inner-button').click();  // ✅
```

### 1.2 Çoklu Shadow DOM (Nested)

```typescript
// İç içe shadow DOM'lar:
await page.locator('outer-component >> inner-component >> #target').click();

// veya
await page.locator('outer-component').locator('inner-component').locator('#target').click();
```

### 1.3 Shadow DOM İçindeki Tüm Elementler

```typescript
// Shadow DOM içindeki tüm input'ları bul
const shadowInputs = await page.locator('* >> input').all();

// Shadow DOM içindeki tüm button'ları bul
const shadowButtons = await page.locator('* >> button').all();

// Shadow DOM içindeki tüm link'leri bul
const shadowLinks = await page.locator('* >> a').all();
```

## 2. Shadow DOM Test Senaryoları

### 2.1 Input Fields Inside Shadow DOM

```typescript
// Shadow DOM içindeki input'a değer gir
await page.locator('my-form >> #username').fill('testuser');

// Shadow DOM içindeki input'u temizle ve yeni değer gir
await page.locator('my-form >> #email').clear();
await page.locator('my-form >> #email').fill('test@example.com');

// Shadow DOM içindeki input'un değerini doğrula
const value = await page.locator('my-form >> #username').inputValue();
expect(value).toBe('testuser');
```

### 2.2 Button Clicks Inside Shadow DOM

```typescript
// Shadow DOM içindeki button'a tıkla
await page.locator('my-modal >> #close-button').click();

// Shadow DOM içindeki submit button'a tıkla
await page.locator('my-form >> button[type="submit"]').click();

// Shadow DOM içindeki disabled button kontrolü
const isDisabled = await page.locator('my-form >> #submit-btn').isDisabled();
```

### 2.3 Dropdown/Select Inside Shadow DOM

```typescript
// Shadow DOM içindeki dropdown'ı aç
await page.locator('my-dropdown >> .trigger').click();

// Shadow DOM içindeki option'ı seç
await page.locator('my-dropdown >> option[value="1"]').click();

// Shadow DOM içindeki select'in değerini al
const selected = await page.locator('my-dropdown >> select').inputValue();
```

### 2.4 Modal/Dialog Inside Shadow DOM

```typescript
// Shadow DOM içindeki modal'ı aç
await page.locator('my-app >> #open-modal-btn').click();

// Shadow DOM içindeki modal'ı bekle
await page.locator('my-modal >> .modal-content').waitFor({ state: 'visible' });

// Shadow DOM içindeki modal'da işlem yap
await page.locator('my-modal >> #confirm-btn').click();

// Shadow DOM içindeki modal'ı kapat
await page.locator('my-modal >> #close-btn').click();
```

## 3. XSS Testleri Inside Shadow DOM

```typescript
// Shadow DOM içindeki input'a XSS payloadı gir
await page.locator('my-form >> #name').fill('<script>alert("XSS")</script>');

// Shadow DOM içindeki input'a HTML injection payloadı gir
await page.locator('my-form >> #comment').fill('<button onclick="alert(\'Hacked\')">Click</button>');

// Shadow DOM içindeki input'a event handler payloadı gir
await page.locator('my-form >> #bio').fill('<img src=x onerror=alert("XSS")>');

// Formu submit et ve sonucu kontrol et
await page.locator('my-form >> button[type="submit"]').click();

// Sayfada script çalışıp çalışmadığını kontrol et
let alertFired = false;
page.on('dialog', async dialog => {
  alertFired = true;
  await dialog.dismiss();
});

// Sayfayı yenile ve tekrar kontrol et
await page.reload();
await page.waitForTimeout(3000);

// Shadow DOM içinde render edildi mi?
const renderedContent = await page.locator('my-form >> #name').innerHTML();
console.log('Rendered content:', renderedContent);
```

## 4. HTML Injection Testleri Inside Shadow DOM

```typescript
// Shadow DOM içinde buton oluştur
await page.locator('my-form >> #comment').fill('<button onclick="alert(\'Hacked\')">Click</button>');
await page.locator('my-form >> button[type="submit"]').click();

// Oluşturulan buton görünüyor mu?
const injectedButton = page.locator('my-form >> button:has-text("Click")');
const isVisible = await injectedButton.isVisible();
console.log('Injected button visible:', isVisible);

// Shadow DOM içinde link oluştur
await page.locator('my-form >> #website').fill('<a href="http://evil.com">Click Here</a>');
await page.locator('my-form >> button[type="submit"]').click();

// Oluşturulan link görünüyor mu?
const injectedLink = page.locator('my-form >> a:has-text("Click Here")');
const isLinkVisible = await injectedLink.isVisible();
console.log('Injected link visible:', isLinkVisible);

// Shadow DOM içinde iframe oluştur
await page.locator('my-form >> #embed').fill('<iframe src="http://evil.com"></iframe>');
await page.locator('my-form >> button[type="submit"]').click();

// Oluşturulan iframe görünüyor mu?
const injectedIframe = page.locator('my-form >> iframe');
const isIframeVisible = await injectedIframe.isVisible();
console.log('Injected iframe visible:', isIframeVisible);
```

## 5. Type Confusion Testleri Inside Shadow DOM

```typescript
// Shadow DOM içindeki sayısal alana metin gir
await page.locator('my-form >> #age').fill('abc');

// Shadow DOM içindeki email alanına URL gir
await page.locator('my-form >> #email').fill('http://evil.com');

// Shadow DOM içindeki tarih alanına sayı gir
await page.locator('my-form >> #birthdate').fill('12345');

// Shadow DOM içindeki boolean alana string gir
await page.locator('my-form >> #active').fill('true');

// Formu submit et ve hata mesajlarını kontrol et
await page.locator('my-form >> button[type="submit"]').click();

// Hata mesajları görünüyor mu?
const errorMsg = page.locator('my-form >> .error-message');
const isErrorVisible = await errorMsg.isVisible();
console.log('Error message visible:', isErrorVisible);
```

## 6. Empty Form Submission Inside Shadow DOM

```typescript
// Shadow DOM içindeki formu boş submit et
await page.locator('my-form >> button[type="submit"]').click();

// Hata mesajları görünüyor mu?
const errorMessages = await page.locator('my-form >> .error').all();
console.log('Error count:', errorMessages.length);

// Her hata mesajının metnini al
for (const error of errorMessages) {
  const text = await error.innerText();
  console.log('Error:', text);
}
```

## 7. Shadow DOM Discovery Scripti

```typescript
import { test } from '@playwright/test';

test('Shadow DOM Discovery', async ({ page }) => {
  await page.goto('https://example.com', { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  // Shadow DOM elementlerini bul
  const shadowHosts = await page.locator('*').evaluateAll(elements => {
    return elements
      .filter(el => el.shadowRoot)
      .map(el => ({
        tag: el.tagName.toLowerCase(),
        id: el.id,
        class: el.className,
        childCount: el.shadowRoot?.childElementCount || 0,
      }));
  });

  console.log('=== SHADOW DOM HOSTS ===');
  console.log('Total shadow hosts:', shadowHosts.length);
  for (const host of shadowHosts) {
    console.log(`Tag: ${host.tag}, ID: ${host.id}, Class: ${host.class}, Children: ${host.childCount}`);
  }

  // Shadow DOM içindeki tüm elementleri bul
  const allShadowElements = await page.locator('* >> *').all();
  console.log('\n=== SHADOW DOM ELEMENTS ===');
  console.log('Total shadow elements:', allShadowElements.length);

  for (const el of allShadowElements.slice(0, 50)) {
    const tag = await el.evaluate(e => e.tagName.toLowerCase());
    const id = await el.getAttribute('id');
    const type = await el.getAttribute('type');
    const isVisible = await el.isVisible().catch(() => false);
    if (isVisible) {
      console.log(`Tag: ${tag}, ID: ${id}, Type: ${type}`);
    }
  }
});
```

## 8. Prioritization

1. **Shadow DOM inputs** → En yüksek (input testleri)
2. **Shadow DOM buttons** → Yüksek (click testleri)
3. **Shadow DOM modals** → Yüksek (modal testleri)
4. **Shadow DOM dropdowns** → Orta (select testleri)
5. **Shadow DOM links** → Orta (navigation testleri)
6. **Nested shadow DOM** → Düşük (complex structure)
