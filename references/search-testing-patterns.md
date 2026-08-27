# Search Testing Patterns

## Purpose

Search functionality is one of the most common features in web applications
and one of the most bug-prone areas. This guide provides systematic patterns
for testing search beyond basic "type and find."

## Search Test Matrix

### 1. Case Sensitivity Tests

| Test Case | Input | Expected | Why |
|-----------|-------|----------|-----|
| Exact case match | "Zeynep" | Find results | Baseline |
| All uppercase | "ZEYNEP" | Find results | Case-insensitive search |
| All lowercase | "zeynep" | Find results | Case-insensitive search |
| Mixed case | "ZeyNep" | Find results | Case-insensitive search |
| First letter capital | "Zeynep" | Find results | Title case handling |

**Source code check:** Look for `toLowerCase()`, `toUpperCase()`, `ILIKE`,
`COLLATE`, or case-insensitive regex flags in search implementation.

### 2. Partial Match Tests

| Test Case | Input | Expected | Why |
|-----------|-------|----------|-----|
| First 3 chars | "Zey" | Find results | Prefix matching |
| Middle chars | "yn" | Find results | Contains matching |
| Last chars | "nep" | Find results | Suffix matching |
| Single char | "Z" | Find results | Minimum input |
| Two chars | "Ze" | Find results | Short prefix |

**Source code check:** Look for `LIKE '%..%'`, `includes()`, `indexOf()`,
or full-text search configuration.

### 3. Multi-Word Search Tests

| Test Case | Input | Expected | Why |
|-----------|-------|----------|-----|
| Full name | "Zeynep Kaplan" | Find results | Multi-field search |
| First + Last | "Zey K" | Find results | Partial multi-field |
| Last + First | "Kaplan Zeynep" | Find results | Reversed order |
| With extra space | "Zeynep  Kaplan" | Find results | Whitespace handling |
| Tab character | "Zeynep\tKaplan" | Find results | Tab handling |
| Newline | "Zeynep\nKaplan" | Find results | Newline handling |

**BUG PATTERN:** Many search implementations split on space and require
ALL tokens to match against a SINGLE field. This breaks multi-word search
when the user expects it to search across multiple fields.

**Source code check:** Look for how search query is parsed:
```javascript
// BUGGY: searches single field with full query
const results = items.filter(item => 
  item.name.includes(searchQuery)
);

// CORRECT: splits query and searches each field
const tokens = searchQuery.split(' ');
const results = items.filter(item =>
  tokens.every(token => 
    item.firstName.includes(token) || 
    item.lastName.includes(token)
  )
);
```

### 4. Special Character Tests

| Test Case | Input | Expected | Why |
|-----------|-------|----------|-----|
| XSS payload | `<script>alert(1)</script>` | No alert, safe rendering | Security |
| SQL injection | `'; DROP TABLE users;--` | No error, safe handling | Security |
| Regex special | `.*+?^${}()|[\]` | Literal search | Regex escaping |
| HTML entities | `&amp; &lt; &gt;` | Literal search | HTML escaping |
| Unicode | `é ü ñ ç` | Find results | Unicode support |
| Emoji | `🔥 😊` | Find results or empty | Emoji handling |
| RTL text | `العربية` | Find results or empty | RTL support |
| Zero-width chars | `\u200B \u200C \u200D` | Find results or empty | Invisible chars |

### 5. Empty and Whitespace Tests

| Test Case | Input | Expected | Why |
|-----------|-------|----------|-----|
| Empty string | `""` | Show all or default | Empty search |
| Single space | `" "` | Show all or default | Whitespace only |
| Multiple spaces | `"   "` | Show all or default | Whitespace only |
| Leading space | `" Zeynep"` | Find results | Trim handling |
| Trailing space | `"Zeynep "` | Find results | Trim handling |
| Both sides | `" Zeynep "` | Find results | Trim handling |

### 6. Non-Existent Data Tests

| Test Case | Input | Expected | Why |
|-----------|-------|----------|-----|
| Random string | "XYZNONEXISTENT" | Empty results, message | Empty state |
| Very long string | "A".repeat(1000) | Empty results or error | Length handling |
| Numbers only | "12345" | Empty results or matches | Type handling |
| Special only | "!@#$%^&*" | Empty results or error | Special chars |

### 7. Debounce/Throttle Tests

**Critical question:** Does the search fire on every keystroke or after
a delay?

**How to test:**
1. Open browser DevTools Network tab
2. Type "Zeynep" quickly
3. Count API requests

**Expected behavior:**
- Debounced: 1-2 requests (after typing stops)
- Non-debounced: 6+ requests (one per keystroke)

**BUG PATTERN:** Non-debounced search causes:
- Server overload
- Rate limiting
- Poor performance
- Unnecessary network traffic

**Source code check:** Look for `debounce`, `throttle`, `setTimeout`,
`debounceTime`, or RXJS `debounce` operator.

### 8. Search with Existing Data

**Before testing search, first discover what data exists:**

1. Navigate to the data table/list
2. Note the visible records (names, IDs, statuses)
3. Use these actual values for search tests
4. Test combinations of existing data

**Example:**
- If table shows "Zeynep Kaplan", test:
  - "Zeynep" → should find
  - "Kaplan" → should find
  - "Zeynep Kaplan" → should find
  - "kaplan" → should find (case-insensitive)
  - "Zey" → should find (partial)
  - "xyz" → should not find

### 9. Search Result Validation

**For each search test, verify:**
1. Result count matches expected
2. Results contain the search term
3. Results are sorted correctly (if sorting applies)
4. Pagination works with filtered results
5. Empty state appears when no results
6. Clear search restores full list

### 10. Combined Filter Tests

**When search exists with other filters:**
1. Search + Status filter
2. Search + Date filter
3. Search + Category filter
4. All filters combined

**Test order:**
1. Apply filter first, then search
2. Search first, then apply filter
3. Apply all filters simultaneously
4. Clear filters in different orders

## Source Code Analysis Checklist

When reading source code for search functionality:

- [ ] Search endpoint identified (URL, method)
- [ ] Request payload structure understood
- [ ] Response structure understood
- [ ] Debounce/throttle mechanism identified
- [ ] Case sensitivity implementation noted
- [ ] Partial match implementation noted
- [ ] Multi-word handling implementation noted
- [ ] Special character escaping identified
- [ ] Empty state handling identified
- [ ] Error handling identified
- [ ] Rate limiting identified
- [ ] Caching mechanism identified (if any)

## Common Bugs Found in Search

1. **No case-insensitive search** — "zeynep" doesn't find "Zeynep"
2. **No partial match** — "Zey" doesn't find "Zeynep"
3. **Multi-word broken** — "Zeynep Kaplan" returns 0 results
4. **No debounce** — fires request on every keystroke
5. **No empty state** — blank search shows nothing, no message
6. **XSS vulnerability** — `<script>` in search executes
7. **SQL injection** — `' OR 1=1--` returns all records
8. **No trim handling** — " Zeynep" doesn't find "Zeynep"
9. **Race conditions** — slow request returns after fast request
10. **No rate limiting** — rapid typing causes server overload
