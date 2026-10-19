# Ticket Format (Jira-style)

For every CONFIRMED DEFECT, and any POTENTIAL DEFECT worth filing before
full confirmation, format it as a paste-ready ticket using this exact
structure — this is the per-defect output format, used instead of a plain
prose paragraph. It carries the same required content as
`references/core/defect-classification.md`, just laid out the way a ticket reader expects:
precisely where the bug lives, exactly how to reproduce it, and what
"actual" vs. "expected" means in concrete, checkable terms.

No Jira API/MCP integration is assumed — produce the ticket text ready to
paste into Jira (or any tracker). If the environment you're running in
does have a way to create the ticket directly, ask the user whether to
file it there or just hand them the text; don't assume.

## Structure

```markdown
TEST SET ID: TS_<module-or-area>_<seq>
TEST CASE ID: TC_<module-or-area>_<seq>
Title: <one-line, states the defective behavior, not just the feature name>

📋 Steps to Reproduce

1. ...
2. ...

🖼️ Actual Result

* ...

🎯 Expected Result

* ...

📎 Ekler / Attachments

* ...
```

## Field rules

**TEST SET ID / TEST CASE ID** — if the target repo already has a test
numbering convention (e.g. `TS_003_...`/`TC_003_...` sequential IDs in an
existing suite), match it: same module prefix, next number in the
sequence. Don't invent a separate scheme that will collide or look
foreign next to the project's real test IDs. If there's no existing
convention, use `TS_<MODULE_SLUG>_<seq>` / `TC_<MODULE_SLUG>_<seq>` with
the module name in caps (matches the worked example below).

**Title** — states what's wrong, in the user-facing terms a ticket reader
(who may not read code) understands. Not "objective KR validation bug" —
"Admin mevcut yorumları görüntüleyemiyor" style: role, action, what fails.

**Steps to Reproduce** — numbered, precise, minimal, and includes the
verification steps that actually surfaced the defect, not just the
navigation to get there. If checking Network/Console was part of how you
confirmed it, include those as explicit numbered steps (see the worked
example) — a ticket reader should be able to re-run your exact
investigation, not just the user-facing click path. If you compared
behavior across two roles/accounts (as in the worked example: admin vs.
the affected employee), include both sides as steps — the comparison is
often the evidence that makes the defect legible.

**Actual Result** — bullet list of what is observed, stated as fact. Keep
one root-cause hypothesis as its own clearly-labeled bullet if you have
one from investigation (Phase 4) — phrase it as an assessment
("değerlendirilmektedir", "kaynaklandığı düşünülmektedir"), not as
confirmed fact, unless you've verified it in source. Don't blend
observation and speculation into the same bullet.

**Expected Result** — bullet list of what correct behavior looks like,
grounded in the oracle you used (`references/core/oracle-hierarchy.md`) — say so if it's
not obvious. Two patterns worth calling out explicitly when they apply:

- If the fix is ambiguous between "grant access" and "the UI shouldn't
  imply access exists" (e.g. a clickable-looking element that leads
  nowhere), state both options and which one the current product behavior
  points toward as primary, per the worked example's approach — don't
  silently pick one without saying why.
- **If the root cause is a frontend-only constraint or an
  authorization gap** (the highest-yield finding class this skill looks
  for — see `references/core/discovery.md` §3 / `references/lenses/mobile/mobile-discovery.md` §3), the Expected
  Result must say explicitly that the control needs to be enforced at the
  backend/API level, not just hidden or disabled in the UI. Don't let the
  expected result quietly settle for a frontend-only fix when the gap you
  found was exactly a frontend-only enforcement problem — that would just
  reproduce the same bug class one layer down.

**Ekler / Attachments** — the manifest of what `references/core/evidence-capture.md`
actually wrote for this finding: relative paths under
`docs/qa-reports/evidence/<date>-<module>/` (e.g.
`screenshot-1-blocked-toast.png`, `network-1-min-target.json`,
`console-1-error.log`). No ticket-tracker API is assumed — this list is
what the person filing the ticket manually attaches. Every path listed
must correspond to a file that was actually saved; if a piece of evidence
was only captured interactively and isn't a saved file, say that
explicitly here instead of listing a path that doesn't exist.

## Filing workflow (when the environment can create tickets directly)

1. **De-duplicate first.** Query the tracker for the module (label, component or text) and list existing tickets. Record the list in the report as the exclusion list; do not file a finding that is already tracked. A tracked ticket with a wrong or incomplete cause is **edited**, not duplicated.
2. **Number the findings and show the ordered list** before creating anything (title, severity, scope class, evidence file). Then file **one ticket at a time**, only when the user asks for the next one.
3. **Verify before filing.** Re-run the steps on fresh data and read the code path for the claimed cause (`references/core/second-opinion.md`, `references/core/calculation-verification.md`). A finding that turns out to be by design is dropped or reframed, not filed.
4. **Use the team's existing template and fields** (type, labels, assignee, priority from the severity rubric, due date, sprint). Copy them from a recent ticket by the same author instead of inventing a layout.
5. **Language:** write for a non-technical reader in the team's language: role, action, what the user sees, what they expected. No code terms in Steps / Actual / Expected; put code findings in a clearly labeled assessment bullet.
6. **In the same reply as each filed ticket** give the ticket link and send the evidence image file (name it), because the tracker tool cannot attach files and the person must paste it.
7. **Scope in the title:** prefix NEW-ONLY findings with the rewrite wording the team uses; BOTH findings carry no prefix and the Environment row names both sides (`references/core/parity-sweep.md`).
8. **Credentials in tickets:** use only what the team's template already carries for test accounts; never add real credentials the person did not put in the template.
9. After the batch, give the person the full list in the team's own bulk format (links first, then titles with keys) when they ask for it.

## Worked example

```markdown
TEST SET ID: TS_XXX_STATUS_REPORT
TEST CASE ID: TC_XXX_STATUS_REPORT_XXX
Title: Durum Raporlarında Admin Kullanıcının Mevcut Yorumları Görüntüleyememesi

📋 Steps to Reproduce

1. Admin rolündeki kullanıcı sisteme giriş yapar.
2. Yönetim Paneli → Durum Raporları Ayarları sayfasına geçer.
3. Daha önce oluşturulmuş dönemlerden birini seçer.
4. İlgili haftayı açar ve mevcut çalışan listesini görüntüler.
5. Daha önce yorum yapılmış bir çalışanın durum raporunu bulur.
6. İlgili çalışanın yorum sayısının bulunduğu alana veya Yorum Ekle aksiyonuna tıklar.
7. Daha önce eklenmiş yorumların görüntülenip görüntülenmediği kontrol edilir.
8. Tarayıcının Network sekmesi açılır.
9. Yorum Ekle aksiyonuna tekrar tıklanır ve herhangi bir API request oluşturulup oluşturulmadığı kontrol edilir.
10. Browser Console kontrol edilir ve herhangi bir hata oluşup oluşmadığı incelenir.
11. Aynı çalışanın hesabıyla sisteme giriş yapılır.
12. Durum Raporları sayfasına gidilir.
13. Daha önce oluşturulmuş aynı durum raporu açılır.
14. Yorum Ekle alanına tıklanır ve mevcut yorumların çalışan tarafından görüntülenebildiği doğrulanır.
15. Admin ve çalışan kullanıcılarının aynı yorum verisine erişim davranışları karşılaştırılır.

🖼️ Actual Result

* Admin, daha önce yorum yapılmış durum raporunu görüntüleyebilmektedir; ancak mevcut yorumların bulunduğu alana tıkladığında yorum detayları gösterilmemektedir.
* Admin Yorum Ekle aksiyonuna tıkladığında mevcut yorumlarla ilgili herhangi bir veri yüklenmemektedir.
* Network sekmesinde yorumların getirilmesi için herhangi bir API request oluşmamaktadır.
* Console üzerinde de ilgili yorum verisinin yüklenmesini sağlayan bir işlem görülmemektedir.
* Mevcut davranışın, admin kullanıcısının ilgili grubun/takımın yöneticisi olmaması nedeniyle yorum detaylarına erişememesinden kaynaklandığı değerlendirilmektedir.
* Aynı durum raporu ilgili çalışan hesabıyla açıldığında mevcut yorumlar doğru şekilde görüntülenmektedir.
* Dolayısıyla yorum verisinin mevcut olduğu, ancak admin kullanıcının yönetim panelindeki durum raporları ekranından bu verilere erişemediği görülmektedir.
* Yorum/rakam alanları hover edildiğinde veya tıklanabilir şekilde göründüğünde kullanıcıda detayların açılabileceği beklentisi oluşmaktadır; ancak herhangi bir veri gösterilmemektedir.

🎯 Expected Result

* Admin rolündeki kullanıcı, yönetim panelindeki Durum Raporları ekranında mevcut yorumları görüntüleyebilmelidir.
* Admin'in ilgili grubun takım yöneticisi olup olmaması, yönetim panelindeki yetkisi kapsamında mevcut yorumları görüntülemesini engellememelidir.
* Daha önce oluşturulmuş yorumlar Yorum Ekle alanı açıldığında doğru şekilde listelenmelidir.
* Yorumların yüklenmesi için gerekli API çağrısı admin kullanıcı için de doğru şekilde gerçekleştirilmelidir.
* Admin mevcut yorumları görüntüleyebilmeli ve mevcut admin yetkileri kapsamında yorumlar üzerinde işlem yapabilmelidir.
* Admin'in bu yorumları görmesi iş kuralı gereği desteklenmiyorsa, yorum/rakam alanları kesinlikle tıklanabilir veya açılabilir izlenimi vermemelidir. Bu durumda: hover efekti kaldırılmalı, tıklanabilir görünüm kaldırılmalı, ilgili alan kullanıcıya yalnızca bilgi amaçlı gösterilmelidir.
* Ancak mevcut ürün davranışında admin'in genel olarak yorumları görüntüleme/silme yetkisi bulunduğundan, öncelikli çözüm admin kullanıcının mevcut durum raporu yorumlarına erişebilmesinin sağlanmasıdır.
* Çalışan kullanıcı açısından mevcut çalışan bazlı yorum görüntüleme davranışı korunmalıdır.
* Admin ve çalışan için uygulanacak erişim kontrolü backend seviyesinde de açık şekilde tanımlanmalı; yalnızca frontend'de alanın gizlenmesiyle yetinilmemelidir.
* Yetki kontrolü nedeniyle veri getirilmiyorsa, hangi rolün hangi yorum verisine erişebileceği iş kuralı netleştirilmeli ve buna uygun API authorization uygulanmalıdır.

📎 Ekler / Attachments

* screenshot-1-admin-yorum-alani-bos.png
* network-1-yorum-ekle-tiklandiginda-request-yok.json
* console-1-hata-yok.log
```
