# LLM360 Website

[![Netlify Status](https://api.netlify.com/api/v1/badges/39f6e2df-b25c-4da5-9c44-759490483f1a/deploy-status)](https://app.netlify.com/projects/jovial-starlight-aef006/deploys)


This repository contains the source code for the LLM360 website, built with Jekyll and utilizing the `al-folio` theme for its blog section.

## ✍️ For Contributing a Blog Post

New blog posts are created as Markdown files within the `_posts` directory.

1.  **Create a New File:**
    Navigate to the `_posts` directory in your project. Create a new Markdown file with the following naming convention:
    `YYYY-MM-DD-your-post-title.md`

      * `YYYY-MM-DD`: The full date of the post. 

      * `your-post-title`: A descriptive title using hyphens instead of spaces.

    **Example:** `_posts/2025-07-15-my-new-research-update.md`

2.  **Add YAML Front Matter:**
    Every blog post **must** start with a YAML Front Matter block. This provides metadata for Jekyll and the `al-folio` theme.

    ````yaml
    ---
    layout: post
    title: "Your Awesome New Post Title Here"
    date: 2025-07-15 10:30:00 -0700
    description: "A short summary or excerpt for your post." 
    categories: [category1, category2] # List categories relevant to your post
    tags: [tag1, tag2, tag3] # List specific keywords/tags
    # Optional: Add an image for social media previews. These images should be placed in the 'assets/img/posts/' folder (al-folio's asset directory).
    # image: /assets/img/posts/your-post-image.jpg
    ---

    Note that the blog post will be published after the time specified in the YAML.

    ## Your Post Content Starts Here

    This is where you write the main content of your blog post using Markdown.

    You can include:
    * Text with **bold** and *italics*.
    * [Links](https://example.com).
    * Code blocks:
        ```python
        def hello_world():
            print("Hello, Blog!")
        ```
    * Images: `![Alt Text](/assets/img/your-image.png)` (ensure image path is correct relative to root, usually `assets/img/` for theme-managed images)
    * LaTeX for math (if enabled in `_config.yml`): `$$E=mc^2$$`

    ---
    # End of your post content
    ````

3.  **Submit via Pull Request (PR):**
    Once you've created and saved your new blog post file:

      * **Commit your changes:**

        ```bash
        git add _posts/YYYY-MM-DD-your-post-title.md
        git commit -m "feat: Add new blog post: Your Post Title"
        ```

      * **Push your changes to your branch:**

        ```bash
        git push origin your-feature-branch-name
        ```

      * **Open a Pull Request (PR)** on GitHub from your branch to the `main` (or `master`) branch of the repository. Describe your changes clearly.

    After the PR is merged, GitHub Pages will automatically rebuild the site, and your new blog post will appear on the live website.


# Website Deverlopers, Keep Reading. 
## 🚀 Website Layout

This website is designed with a hybrid approach, where Jekyll generates specific URL paths for different content sections:

* **Homepage (`/`):** This is the site's main landing page, maintaining its original static HTML design. It includes sections for Datasets, Models, Projects, and Papers. Its specific assets (CSS, JS, images) are located in the `static-assets/` folder to avoid conflicts with the Jekyll theme.

* **Blog (`/blog/`):** This section leverages the `al-folio` Jekyll theme for a clean, academic-style blog. The content for the blog is sourced from the `_posts` directory. Jekyll processes these files to generate the `/blog/` URL path. **Users will see and access the blog primarily through the "Blog" link in the website's main navigation bar, which directs them to `http://your-site.com/blog/`.** It features:

    * A main blog listing page (`/blog/`) displaying recent posts with pagination.

    * Individual blog post pages (e.g., `/blog/2025/hello-distill-setup/`).

    * Category and Tag archive pages (e.g., `/blog/category/test/`, `/blog/tag/setup/`) for easy navigation of related content.

* **Other Static Pages:** Additional static pages like `about.html` and `evaluation.html` are present, maintaining their original structure.

## 🛠️ How to Build and Run Locally

To run this website on your local machine, you'll need Ruby, Bundler, and Jekyll installed.

### Prerequisites: Setting up your Jekyll Environment

Jekyll is built with Ruby. It's highly recommended to use a Ruby version manager (like `rbenv` or `rvm`) to install Ruby and manage gem dependencies, especially on macOS. For Windows, using Windows Subsystem for Linux (WSL) is often the smoothest path.

**1. Install Ruby:**

* **macOS (Recommended via `rbenv` or `rvm`):**

    * **Using `rbenv`:**

        ```bash
        brew install rbenv ruby-build
        rbenv install 3.2.2 # Or your preferred Ruby version, matching Gemfile if possible
        rbenv global 3.2.2
        echo 'eval "$(rbenv init - zsh)"' >> ~/.zshrc # Or ~/.bashrc for Bash
        source ~/.zshrc # Or ~/.bashrc
        ```

    * **Using `rvm`:** Follow instructions at <https://rvm.io/rvm/install> to install `rvm`, then `rvm install 3.2.2` and `rvm use 3.2.2 --default`.

* **Windows (Recommended via WSL):**

    * Install [Windows Subsystem for Linux (WSL)](https://learn.microsoft.com/en-us/windows/wsl/install).

    * Once WSL is set up (e.g., with Ubuntu), follow the Linux instructions for installing Ruby (e.g., using `rbenv` or `rvm` within your WSL terminal).

* **Linux:**

    * Use `rbenv` or `rvm` as on macOS, or your distribution's package manager (e.g., `sudo apt install ruby-full`).

**2. Install Bundler:**
Bundler is a Ruby gem that manages your project's Ruby dependencies.

```bash
gem install bundler
````

**3. Install Jekyll:**
Jekyll itself is a Ruby gem.

```bash
gem install jekyll
```

### Building and Serving the Site:

1.  **Clone the Repository:**

    ```bash
    git clone [https://github.com/LLM360/llm360-website.git](https://github.com/LLM360/llm360-website.git) # Replace with your actual repo URL if different
    cd llm360-website
    ```

2.  **Install Project Dependencies:**
    This command reads your `Gemfile` and installs all the specific Jekyll plugins and gems required for this project.

    ```bash
    bundle install
    ```

3.  **Serve the Website:**
    This command builds the site and serves it locally.

    ```bash
    bundle exec jekyll serve
    ```

    Your site will typically be available at `http://127.0.0.1:4000/` or `http://localhost:4000/`.

    **How to Access Sections:**

      * **Homepage:** Navigate to `http://127.0.0.1:4000/`
      * **Blog:** Navigate to `http://127.0.0.1:4000/blog/`
      * **About Page:** Navigate to `http://127.0.0.1:4000/about.html`
      * **Evaluation Page:** Navigate to `http://127.0.0.1:4000/evaluation.html`
      * **Individual Blog Post:** For a post like `2025-07-15-my-new-research-update.md`, the URL will be `http://127.0.0.1:4000/blog/2025/my-new-research-update/`
      * **Category/Tag Archives:** For a category like 'test', the URL will be `http://127.0.0.1:4000/blog/category/test/`

    **Troubleshooting:** If you encounter `Expected expression` errors related to SCSS, ensure your `_config.yml` has the `max_width` and other `al-folio` specific settings correctly defined as per the theme's documentation.

## 📁 Jekyll Folder Structure (Underscore Prefixed Folders)

Jekyll uses specific folders, typically prefixed with an underscore (`_`), for different types of content and configuration. These folders are processed by Jekyll during the build and are not directly copied to the `_site` output in the same way as regular folders:

  * **`_posts/`**: Contains your blog posts. Each Markdown file here represents a blog post.

  * **`_pages/`**: Contains standalone Markdown or HTML pages that Jekyll processes (like your `blog.md` file that generates the `/blog/` index page).

  * **`_sass/`**: Holds Sass/SCSS files that Jekyll compiles into CSS. This is where `al-folio`'s core styles reside, and where you'd place `_custom.scss` for theme overrides.
