## Selection highlighter

Automatically highlight all occurrences of current selection on current page.

Supported options (open option page to change):

```
{
  "excludeSelf": true,
  "highlightStyle": "background-color: yellow;",
  "excludeParents": [],
  "noHighlightWithin": [
    "input",
    "textarea",
    "[contentEditable]"
  ],
  "excludeUrlPatterns": []
}
```

- `excludeSelf`: do not highlight the selection itself
- `highlightStyle`: css styles applied to the highlights
- `excludeParents`: exclude highlights within given selectors
- `noHighlightWithin`: no highlight if selection in given selectors
- `excludeUrlPatterns`: disable for given url patterns, e.g: `"^(?!.*googlesource).*"` will only enable for `googlesource` urls, like gerrit-review.googlesource.com etc
