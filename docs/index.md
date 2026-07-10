---
layout: default
title: Home
---

## &gt; whoami

I'm Josh. Fifty-ish. Software engineer, girl-dad to two boys, Hurricanes
addict, bourbon enthusiast with an increasingly complicated relationship to
bourbon. I live in Raleigh, write code, yell at hockey games, and somehow became
the guy people call when life catches on fire.

This is where I think out loud. It wanders on purpose — software and AI one day,
markets and retirement math the next, then hockey, grief, my kids, dumb jokes,
and probably too much profanity. Actually, definitely too much profanity.

No brand. No hustle. No productivity gospel. Just one tired engineer trying to
make a little sense of the world between pull requests, playoff overtimes, and
the occasional existential crisis.

Pour something. Stay a while.

Let's fuckin' go.

## &gt; latest posts

<ul class="posts">
{% assign ordered_posts = site.posts | sort: "date" %}
{% for post in ordered_posts %}
  <li>
    <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
    <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
  </li>
{% else %}
  <li>No posts yet &mdash; drop a <code>YYYY-MM-DD-title.md</code> file into <code>docs/_posts/</code>.</li>
{% endfor %}
</ul>
