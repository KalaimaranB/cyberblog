---
title: "Welcome to My Cybersecurity Blog"
draft: false
---

## Hey there! 👋

I’m Kalaimaran, and this is where I share all my CTF walkthroughs, tool deep‑dives, and tips.

![Cybersecurity illustration](/images/hero.png)

### Latest Posts
{{ range first 5 ( .Pages.ByDate ) }}
- [{{ .Title }}]({{ .RelPermalink }}) — {{ .Date.Format "Jan 2, 2006" }}
{{ end }}

*More posts → [All Posts](/posts/)*
