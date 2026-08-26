# QA Bug Hunter Agent

Standalone CLI tool for automated QA testing of web applications.

## Quick Start

```bash
npm install
npm run build
node dist/cli.js test --url https://example.com
```

## Commands

- `test` — Run QA tests on a URL
- `analyze` — Analyze DOM structure

## Test Suites

- Security (XSS, SQL Injection, HTML Injection)
- Input (Empty, Long, Special chars, Unicode, Type confusion)
- Responsive (Mobile, Tablet, Desktop)
- Accessibility (Alt text, Labels, Headings)
- Navigation (Broken links, Console errors)

## Output

Reports saved to `docs/qa-reports/<date>/`
