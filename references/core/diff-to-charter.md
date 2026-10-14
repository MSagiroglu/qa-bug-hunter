# Diff to Charter

Turn a code change into targeted exploratory charters.

## Procedure
1. Get the change footprint:
   ```
   git diff --stat <base>..<head>
   ```
   Use `--name-only` if only paths are needed.
2. Map each touched file to a module. If an optional domain pack is active, read its `modules.md` file-to-module table. Match by longest path prefix. Without a pack, derive the module from the top-level folders and note that the mapping is a guess.
3. Group files by module. Unmapped files go to a group called `unmapped`; list them so the mapping table can be improved.
4. Write one charter line per touched module, in the standard charter form: explore `<module>` with `<lens or technique>` to discover `<risk>`. Weight by lines changed and by risk (auth, money, data writes, migrations first).
5. Append the lines to `charters-backlog.md` (create it if missing). Do not overwrite existing lines; skip a line already present.

## Example
Input:
```
$ git diff --stat main..feature/invoice-export
 src/billing/invoice.service.ts   | 84 ++++++++++++++-----
 src/billing/export.controller.ts | 31 +++++++
 web/reports/ExportDialog.tsx     | 58 ++++++++++++
 db/migrations/0042_add_tax.sql   | 12 ++
 4 files changed, 168 insertions(+), 17 deletions(-)
```
Mapping (from `modules.md`): `src/billing/` -> Billing, `web/reports/` -> Reports UI, `db/migrations/` -> Data model.

Appended to `charters-backlog.md`:
```
- [ ] Explore Billing (invoice.service, export.controller) with API lens and boundary values to discover wrong tax or rounding in exports. (main..feature/invoice-export, 115 lines)
- [ ] Explore Reports UI (ExportDialog) with six-directions Interrupt and Network to discover duplicate exports on double click or offline. (main..feature/invoice-export, 58 lines)
- [ ] Explore Data model (migration 0042) with state and data checks to discover null or legacy rows breaking the new tax column. (main..feature/invoice-export, 12 lines)
```
