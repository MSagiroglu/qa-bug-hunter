# i18n / Localization Checks

Only applies when discovery finds the app actually supports multiple
languages/locales (a language-service/i18n framework, multiple language
resource files, a visible locale switcher). Don't force this on a
single-language app.

## Text overflow in translation

UI elements sized for one language's text length routinely break for
others — German and Finnish are classic offenders for running long;
Turkish, Russian, and Arabic each have their own expansion patterns
relative to English. Switch the app to whichever supported language is
likely to produce the longest strings for the labels/buttons/messages on
the screen under test (check the app's own language resource files for
which translations are visibly longer than the English/default one rather
than guessing), and check: does a button's text wrap or get clipped, does
a label push adjacent layout out of alignment, does a modal's title
overflow its header bar. This is a layout defect the same way
`test-design-techniques.md`'s Responsive/Viewport Testing is — same
category of "nobody manually checks this," different axis (translation
length instead of screen width).

## Locale-correct formatting

Verify displayed dates, numbers, and currency match the active locale's
convention, not a hardcoded one:

- Date: `DD.MM.YYYY` vs `MM/DD/YYYY` vs `YYYY-MM-DD`, and localized month
  names where used.
- Numbers: decimal separator (`,` vs `.`) and thousands grouping.
- Currency: symbol placement (`₺150` vs `150 ₺` vs `150,00 TL`) and which
  symbol/code is shown per locale.

A value that's *correct* in one locale's formatting convention but shown
unchanged in another locale is the defect to look for — not just "does a
number appear," but "does it appear the way this locale expects."

## RTL layout

If the app supports a right-to-left language (Arabic, Hebrew), check that
switching to it actually mirrors the layout — text alignment, icon
positions relative to text, navigation direction — rather than just
right-aligning text inside an otherwise still-LTR layout, which is the
most common half-done RTL implementation.

## Pluralization

Where UI text depends on a count ("1 gün kaldı" vs "5 gün kaldı"), check
the boundary values a real user will actually hit: 0, 1, and a plural
value, in each language that has different pluralization rules (some
languages have more than two plural forms) — a hardcoded English-style
"singular vs. everything else" split is a common defect when translated
into a language with more grammatical plural cases.

## Classification

Grounded the same way as any other finding — `oracle-hierarchy.md`
applies. The strongest oracle here is usually the app's own correct
behavior in its default/primary locale (consistent-behavior-elsewhere,
level 7) unless there's an explicit locale-formatting spec.
