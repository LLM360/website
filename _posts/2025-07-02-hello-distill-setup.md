---
layout: post
title: Hello, Distill-style Setup!
date: 2025-07-02 14:00:00 -0700 # Use current date/time
categories: [test, setup]
tags: [jekyll, al-folio, distill, setup-test]
math: true # Keep this to test math rendering
---

## Welcome to My Distill-Inspired Blog!

[Test pull request preview function]

This is a test post to verify that the basic setup for a Distill-style blog on your GitHub Pages site is working correctly with the `al-folio` theme. If you're reading this, it means Jekyll has successfully processed your `_config.yml`, loaded the `al-folio` theme, and rendered this Markdown file into a beautiful HTML page.

<div class="margin-note">
This is a marginal note! It should appear to the side (on wider screens) or as an inline block (on smaller screens), separate from the main text flow. It's a key visual element inspired by Distill.pub.
</div>

### Testing Basic Elements

Let's check a few things:

1.  **Mathematical Notation:**
    We can write inline math like Euler's identity: $e^{i\pi} + 1 = 0$.

    Or display math, which appears on its own line:
    $$
    E = mc^2
    $$
    If these equations render nicely, your math engine (MathJax or KaTeX) is working as expected!

2.  **Code Block:**
    Here's a small Python snippet:

    ```python
    def greet(name):
        print(f"Hello, {name}! Your setup looks great.")

    greet("Distill Fan")
    ```
    The code should be syntax-highlighted.

<div class="margin-note">
Remember to verify the syntax highlighting for your code blocks. `al-folio` typically uses Rouge for this.
</div>

### What to Check

After you push this post and your `_config.yml` (and `Gemfile`/`Gemfile.lock`), visit your live website at your custom domain and look for:

* **Overall `al-folio` theme:** Does your site's header, navigation, and general typography look like the `al-folio` demo?
* **Post layout:** Does this post use a clean, readable layout?
* **Marginal note:** Does the "This is a marginal note!" box appear correctly styled, to the side on desktop, and inline on mobile?
* **Math equations:** Are $e^{i\pi} + 1 = 0$ and $E = mc^2$ rendered beautifully, not as plain text?
* **Code block:** Is the Python code highlighted?

If all these elements are in place, you've successfully set up the foundation for your Distill-style blog posts!

---
