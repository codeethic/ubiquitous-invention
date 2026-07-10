---
layout: default
title: Home
---

## &gt; welcome

You've reached the blog. Everything here lives in the `docs/` directory and is
served straight from GitHub Pages using the **Hacker** theme. Grab a coffee, pop
open a shell, and read on.

## &gt; latest posts

<ul class="posts">
{% for post in site.posts %}
  <li>
    <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
    <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
  </li>
{% else %}
  <li>No posts yet &mdash; drop a <code>YYYY-MM-DD-title.md</code> file into <code>docs/_posts/</code>.</li>
{% endfor %}
</ul>
