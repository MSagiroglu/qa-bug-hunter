# SENIOR QA EXPLORER - MANDATORY ENFORCEMENT CHECKLIST

**Bu dosya her test çalıştırmasından ÖNCE okunmalı ve her madde uygulanmalıdır.**
**Bu dosya OKUNMADAN test başlatılamaz.**

## 🚨 CRITICAL RULES ( Bunlar ATLANAMAZ )

### BROWSER RULES (MANDATORY for UI work; N/A for API-only and Load modes — state the mode in the report header)
- [ ] **Playwright is the engine** for web work (always)
- [ ] **Someone is watching → HEADED**: `headless: false`, window maximized/full screen, user sees every action live
- [ ] **Unattended (CI / scheduled / no human) → HEADLESS**: `headless: true` (when `CI` is set or `QA_HEADLESS=1`)
- [ ] The chosen mode is stated in the report header; screenshots, video and trace are captured in both modes
- [ ] Playwright config: `headless` derived from the mode above, viewport: `{ width: 1920, height: 1080 }`

### BEFORE TESTING (Phase 1)
- [ ] Source code read (ALL relevant files, not just one)
- [ ] Data flow traced: UI → Frontend → API → Backend → DB → Response → UI
- [ ] DOM structure analyzed (elements, states, hidden items)
- [ ] Existing data identified (READ-ONLY; collision/duplicate tests use only `TEST_*` data created in this run)
- [ ] Authentication verified
- [ ] API endpoints identified

### DURING TESTING (Phase 3-4)
- [ ] Reference files read: all of `references/core/`, the selected lens folder(s), `references/invariants/` for UI modes, and the selected domain pack's `pack.md` + files it lists
- [ ] Search tests: case sensitivity, partial match, multi-word, debounce
- [ ] Date filter tests: invalid ranges, boundary values
- [ ] CRUD tests: empty submit, duplicate, type confusion
- [ ] **SENKRON UI CHECK**: After create/update/delete, UI updated WITHOUT refresh?
- [ ] If refresh required → DOCUMENTED AS DEFECT

### TEST DATA RULES (MANDATORY)
- [ ] Created NEW test data (unique: TEST_<feature>_<timestamp>_<seq>)
- [ ] NEVER modified existing production data
- [ ] ALL created data CLEANED UP after tests
- [ ] Cleanup verified in UI AND via API/database
- [ ] System state SAME as before testing

### EVIDENCE (Phase 5)
- [ ] Screenshots: before, during, after each action
- [ ] Network requests logged
- [ ] Console errors captured
- [ ] Video/trace enabled if available

### REPORT (Phase 7)
- [ ] Report saved to `docs/qa-reports/YYYY-MM-DD-<module>.md`
- [ ] Each defect formatted as Jira ticket
- [ ] Evidence files referenced (not described)
- [ ] Regression lock-in offered for confirmed defects

## 🔍 SELF-AUDIT (Test sonunda kendi kendine sor)

1. "Tüm reference dosyalarını okudum mu?" → EVET/HAYIR
2. "Mevcut production data'yı değiştirdim mi?" → EVET/HAYIR (olmamalı)
3. "Oluşturduğum tüm test data'sını sildim mi?" → EVET/HAYIR
4. "Senkron UI kontrolü yaptım mı?" → EVET/HAYIR
5. "Refresh gerekiyorsa bunu defect olarak document ettim mi?" → EVET/HAYIR
6. "Her defect için screenshot/network/console aldım mı?" → EVET/HAYIR

## ⚠️ COMMON FAILURES TO AVOID

1. ❌ "Happy path çalışıorum, test bitti" → HAYIR, asıl şimdi başlıyor
2. ❌ "Mevcut data ile test ediyorum" → HAYIR, yeni data oluştur
3. ❌ "Test sonunda temizlik yapmıyorum" → HAYIR, mutlaka temizle
4. ❌ "Refresh yapınca güncellendi, sorun yok" → HAYIR, bu DEFECT
5. ❌ "Reference dosyalarını okumuyorum, biliyorum" → HAYIR, her seferinde oku
6. ❌ "Screenshot almaya gerek yok, prose yazayım" → HAYIR, delil gerekli
