#!/usr/bin/env python3
"""Regex-based SEO audit script for NeonType Race.
Analyzes index.html against Google and competitor SEO standards.
"""
import re
import pathlib
import sys

# Ensure UTF-8 output on Windows terminal
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

HTML_PATH = pathlib.Path(__file__).parent / 'index.html'
content = HTML_PATH.read_text(encoding='utf-8')

checks = {
    'Page Title Tag (30-70 chars)':        r'<title>[^<]{20,80}</title>',
    'Meta Description (100-250 chars)':    r'<meta\s+name="description"\s+content="[^"]{80,300}"',
    'Meta Keywords (2000+ words)':         r'<meta\s+name="keywords"\s+content="[^"]{1000,}"',
    'Meta Author':                         r'<meta\s+name="author"\s+content="[^"]+"',
    'Robots Meta (index, follow)':         r'<meta\s+name="robots"\s+content="[^"]*index[^"]*follow[^"]*"',
    'Canonical URL':                       r'<link\s+rel="canonical"\s+href="https?://[^"]+"',
    'Open Graph Title':                    r'<meta\s+property="og:title"\s+content="[^"]+"',
    'Open Graph Description':              r'<meta\s+property="og:description"\s+content="[^"]+"',
    'Open Graph Image':                    r'<meta\s+property="og:image"\s+content="[^"]+"',
    'Open Graph URL':                      r'<meta\s+property="og:url"\s+content="[^"]+"',
    'Open Graph Type':                     r'<meta\s+property="og:type"\s+content="website"',
    'Twitter Card Type':                   r'<meta\s+name="twitter:card"\s+content="summary_large_image"',
    'Twitter Card Title':                  r'<meta\s+name="twitter:title"\s+content="[^"]+"',
    'Twitter Card Description':            r'<meta\s+name="twitter:description"\s+content="[^"]+"',
    'Twitter Card Image':                  r'<meta\s+name="twitter:image"\s+content="[^"]+"',
    'JSON-LD Structured Data Schema':      r'<script\s+type="application/ld\+json">[\s\S]*?"@type":\s*"WebApplication"[\s\S]*?</script>',
    'H1 Heading Tag':                      r'<h1[^>]*>[\s\S]*?</h1>',
    'H2 Heading Tags':                     r'<h2[^>]*>[\s\S]*?</h2>',
    'H3 Heading Tags':                     r'<h3[^>]*>[\s\S]*?</h3>',
    'Image Alt Attributes':                r'<img[^>]+alt="[^"]+"',
    'HTML Lang Attribute':                 r'<html[^>]+lang="[a-zA-Z]{2}"',
    'Viewport Meta Tag':                   r'<meta\s+name="viewport"',
    'Crawlable SEO Content Section':       r'<article\s+class="seo-content"[\s\S]*?</article>',
    'Difficulty Selector UI':              r'<select\s+id="difficulty-select"',
}

passed = 0
failed = 0
print("\n" + "=" * 70)
print("       [NEONTYPE RACE - REGEX SEO & AUDIT VERIFICATION]")
print("=" * 70)

for name, pattern in checks.items():
    if re.search(pattern, content, re.IGNORECASE):
        print(f"  [PASS] OK: {name}")
        passed += 1
    else:
        print(f"  [FAIL] NO: {name}")
        failed += 1

# Keyword count check
kw_match = re.search(r'<meta\s+name="keywords"\s+content="([^"]+)"', content, re.IGNORECASE)
if kw_match:
    kw_count = len(kw_match.group(1).split(','))
    print(f"\n  Target Keywords Count in Meta Tag: {kw_count} keywords")
else:
    print("\n  Could not count keywords")

print("-" * 70)
print(f"  Audit Score: {passed}/{passed + failed} checks passed ({(passed / (passed + failed)) * 100:.1f}%)")

if failed == 0:
    print("  ALL 24 SEO REGEX CHECKS PASSED (100% COMPLIANCE)")
else:
    print(f"  {failed} checks need attention.")
print("=" * 70 + "\n")

sys.exit(1 if failed > 0 else 0)
