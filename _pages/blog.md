---
layout: page
title: ""
permalink: /blog/ # <--- ADD THIS LINE! This is for the first page: /blog/

pagination:
  enabled: true
  collection: posts
  permalink: /blog/page/:num/
  per_page: 5
  sort_field: date
  sort_reverse: true
  trail:
    before: 1 # The number of links before the current page
    after: 3  # The number of links after the current page
---

<div class="llm360-blog-index">
  <section class="llm360-blog-hero">
    <p class="llm360-blog-eyebrow">Open notes from the LLM360 team</p>
    <h1 class="llm360-blog-title">{{ site.blog_name }}</h1>
    <p class="llm360-blog-subtitle">{{ site.blog_description }}</p>
    <p class="llm360-blog-intro">
      Research updates, release notes, evaluations, and behind-the-scenes lessons from building open and transparent language models.
    </p>
  </section>

  {% if site.display_tags %}
  <div class="tag-list llm360-blog-topics">
    <p class="llm360-blog-topics-label">Browse topics</p>
    <ul class="p-0 m-0">
      {% for tag in site.display_tags %}
        <li>
          <a class="llm360-blog-topic-chip" href="{{ tag | slugify | prepend: '/blog/tag/' | relative_url }}">
            <i class="fas fa-hashtag fa-sm"></i>
            <span>{{ tag }}</span>
          </a>
        </li>
      {% endfor %}
    </ul>
  </div>
  {% endif %}

  {% if paginator.posts and paginator.posts != empty %}
  <ul class="post-list llm360-blog-post-list">
    {% for post in paginator.posts %}

    {% if post.external_source == blank %}
      {% assign read_time = post.content | number_of_words | divided_by: 180 | plus: 1 %}
    {% else %}
      {% assign read_time = post.feed_content | strip_html | number_of_words | divided_by: 180 | plus: 1 %}
    {% endif %}
    {% assign year = post.date | date: "%Y" %}
    {% assign tags = post.tags | join: "" %}
    {% assign categories = post.categories | join: "" %}

    <li class="llm360-blog-post-item">
      <article class="llm360-blog-card">
        <p class="llm360-blog-meta post-meta">
          <span class="llm360-blog-meta-item">{{ post.date | date: '%B %-d, %Y' }}</span>
          <span class="llm360-blog-meta-divider">&middot;</span>
          <span class="llm360-blog-meta-item">{{ read_time }} min read</span>
          {%- if post.external_source %}
          <span class="llm360-blog-meta-divider">&middot;</span>
          <span class="llm360-blog-meta-item">{{ post.external_source }}</span>
          {%- endif %}
        </p>

        <h2 class="llm360-blog-post-title">
          {% if post.redirect == blank %}
            <a class="post-title" href="{{ post.url | relative_url }}">{{ post.title }}</a>
          {% else %}
            {% if post.redirect contains '://' %}
              <a class="post-title" href="{{ post.redirect }}" target="_blank" rel="noopener noreferrer">
                {{ post.title }}
              </a>
              <svg class="llm360-blog-external-icon" width="1.1rem" height="1.1rem" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M17 13.5v6H5v-12h6m3-3h6v6m0-6-9 9" class="icon_svg-stroke" stroke="currentColor" stroke-width="1.5" fill="none" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            {% else %}
              <a class="post-title" href="{{ post.redirect | relative_url }}">{{ post.title }}</a>
            {% endif %}
          {% endif %}
        </h2>

        {% if post.description != blank %}
        <p class="llm360-blog-excerpt">{{ post.description }}</p>
        {% endif %}

        <div class="llm360-blog-taxonomy post-tags">
          <a class="llm360-blog-chip llm360-blog-chip-year" href="{{ year | prepend: '/blog/' | relative_url }}">
            <i class="fas fa-calendar fa-sm"></i>
            <span>{{ year }}</span>
          </a>

          {% if tags != "" %}
            {% for tag in post.tags %}
            <a class="llm360-blog-chip" href="{{ tag | slugify | prepend: '/blog/tag/' | relative_url }}">
              <i class="fas fa-hashtag fa-sm"></i>
              <span>{{ tag }}</span>
            </a>
            {% endfor %}
          {% endif %}

          {% if categories != "" %}
            {% for category in post.categories %}
            <a class="llm360-blog-chip" href="{{ category | slugify | prepend: '/blog/category/' | relative_url }}">
              <i class="fas fa-tag fa-sm"></i>
              <span>{{ category }}</span>
            </a>
            {% endfor %}
          {% endif %}
        </div>
      </article>
    </li>

    {% endfor %}
  </ul>
  {% else %}
  <div class="llm360-blog-empty-state">
    <p class="llm360-blog-empty-kicker">Nothing published yet</p>
    <h2>The first posts are on the way.</h2>
    <p>
      This space is where we will share technical notes, model updates, evaluation write-ups, and small findings from the team.
    </p>
  </div>
  {% endif %}

  {% include pagination.html %}

</div>
