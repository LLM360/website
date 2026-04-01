---
layout: post
title: Why Legacy Bucket Unionization Breaks LSH-MinHash Dedup
author: Cody Wu
date: 2026-03-27 10:30:00 -0700
description: A long-form technical note on why transitive bucket unionization is the wrong stage-3 objective in multi-band LSH-MinHash deduplication, and how the same framework extends to query-side min/max gates.
categories: [deduplication, lsh-minhash]
tags: [llm-data, hypergraph, minhash, lsh, data-curation, multi-seed]
math: true
image: /assets/img/posts/lsh-minhash-dedup/case_study_retention_fraction.png
---

<script>
  (function () {
    function typesetNow() {
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise();
      }
    }

    if (!window.MathJax) {
      window.MathJax = {
        tex: {
          inlineMath: [['$', '$'], ['\\(', '\\)']],
          displayMath: [['$$', '$$'], ['\\[', '\\]']],
          processEscapes: true
        },
        options: {
          skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
        }
      };

      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
      script.async = true;
      script.onload = typesetNow;
      document.head.appendChild(script);
    } else {
      typesetNow();
    }
  })();
</script>

<style>
  .post h2 { margin-top: 2.2rem; padding-bottom: 0.35rem; border-bottom: 2px solid #e5e7eb; font-size: 1.7rem; }
  .post h3 { margin-top: 1.45rem; font-size: 1.26rem; color: #111827; }
  .post p, .post li { line-height: 1.78; }
  .post table { display: block; overflow-x: auto; white-space: nowrap; }
  .lsh-side-refs {
    float: right;
    width: 290px;
    margin: 0 0 1rem 1.35rem;
    padding: 0.8rem 0.9rem;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #f9fafb;
    position: sticky;
    top: 82px;
  }
  .lsh-side-refs h4 { margin: 0 0 0.55rem 0; font-size: 1rem; }
  .lsh-side-refs ul { margin: 0; padding-left: 1.1rem; font-size: 0.93rem; line-height: 1.5; }
  .left-chapter-toc {
    position: fixed;
    top: 82px;
    left: max(12px, calc((100vw - 1180px) / 2 - 255px));
    width: 235px;
    max-height: calc(100vh - 110px);
    overflow: auto;
    padding: 0.8rem 0.9rem;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #f9fafb;
    font-size: 0.93rem;
    line-height: 1.5;
  }
  .left-chapter-toc h4 { margin: 0 0 0.55rem 0; font-size: 1rem; }
  .left-chapter-toc ul { margin: 0; padding-left: 1.1rem; }
  .table2-wrap { overflow-x: auto; margin: 0.2rem 0 1rem 0; }
  .table2-spacious {
    min-width: 780px;
    border-collapse: separate;
    border-spacing: 14px 0;
  }
  .table2-spacious th, .table2-spacious td {
    padding: 0.25rem 0.6rem;
    white-space: nowrap;
    vertical-align: middle;
  }
  .table2-spacious th:nth-child(3), .table2-spacious td:nth-child(3),
  .table2-spacious th:nth-child(4), .table2-spacious td:nth-child(4),
  .table2-spacious th:nth-child(5), .table2-spacious td:nth-child(5) {
    text-align: right;
  }
  @media (max-width: 1100px) {
    .lsh-side-refs { float: none; width: auto; margin: 0.65rem 0 1.1rem 0; position: static; }
    .left-chapter-toc { position: static; width: auto; max-height: none; margin: 0 0 1rem 0; }
  }
</style>

<p><em>A practical hypergraph fix for web-scale LSH-MinHash deduplication and query.</em></p>
<p><strong>This post summarizes our paper:</strong> <em>LSH-MinHash Deduplication and Query: Hypergraph Formulation, Multi-Seed Extensions, and Min/Max Gates.</em></p>

Most LSH-MinHash dedup pipelines still do this in stage 3:

1. Build duplicate buckets from band collisions.
2. Merge overlapping buckets transitively (bucket unionization).
3. Keep one representative per merged component.

That is simple and often fast. In multi-band dedup, it is also the wrong objective.

This post explains why, shows the correct formulation, sketches the algorithm, and summarizes the empirical impact on billion-scale corpora.

<aside class="lsh-side-refs">
  <h4>Quick References</h4>
  <ul>
    <li><a href="https://github.com/huggingface/datatrove" target="_blank" rel="noopener">DataTrove pipeline</a></li>
    <li><a href="https://aclanthology.org/2022.acl-long.577/" target="_blank" rel="noopener">Dedup improves LLMs (Lee et al.)</a></li>
    <li><a href="https://doi.org/10.1109/SEQUEN.1997.666900" target="_blank" rel="noopener">MinHash foundations (Broder)</a></li>
    <li><a href="https://doi.org/10.1145/509907.509965" target="_blank" rel="noopener">LSH foundations (Charikar)</a></li>
    <li><a href="https://doi.org/10.1016/j.dam.2008.11.013" target="_blank" rel="noopener">Hypergraph independence</a></li>
  </ul>
</aside>

---

<aside class="left-chapter-toc">
  <h4>Chapter Table</h4>
  <ul>
    <li><a href="#formal-thesis-what-legacy-unionization-adds-and-why-invalid">Formal thesis</a></li>
    <li><a href="#why-this-matters-for-ml-teams">Why this matters</a></li>
    <li><a href="#pipeline-context-what-changes-and-what-does-not">Pipeline context</a></li>
    <li><a href="#pipeline-diagram-where-assumptions-hold-vs-break">Pipeline diagram</a></li>
    <li><a href="#where-transitive-bucket-unionization-fails-in-multi-band">Failure mode</a></li>
    <li><a href="#correct-formulation-bucket-hypergraph--strong-independence">Correct formulation</a></li>
    <li><a href="#two-key-theorems-the-practical-ones">Key theorems</a></li>
    <li><a href="#algorithm-sketch-greedy-minimum-bucket-weight-clustering">Algorithm sketch</a></li>
    <li><a href="#complexity-and-memory-behavior">Complexity and memory</a></li>
    <li><a href="#multi-seed-dedup-as-a-first-class-extension">Multi-seed extension</a></li>
    <li><a href="#query-side-extension-different-task-same-design-philosophy">Query-side extension</a></li>
    <li><a href="#case-studies-at-billion-scale">Case studies</a></li>
    <li><a href="#interactive-exploration">Interactive exploration</a></li>
    <li><a href="#practical-migration-checklist">Migration checklist</a></li>
    <li><a href="#limitations-and-open-directions">Limitations</a></li>
    <li><a href="#closing">Closing</a></li>
    <li><a href="#references">References</a></li>
  </ul>
</aside>

---

## TL;DR

- In multi-band LSH-MinHash, bucket overlap is **not** a transitive duplicate relation.
- The right stage-3 objective is: keep a maximum set of documents such that every bucket contributes at most one retained document.
- This is a strong-independent-set problem on a bucket hypergraph.
- A bucket-native greedy algorithm plus weight-1 preprocessing yields strong practical behavior at scale.
- Multi-seed dedup sharpens acceptance and lowers low-similarity false positives while reusing the same pipeline workflow.

---

## Formal thesis: what legacy unionization adds (and why invalid)

Let bucket evidence be represented by a deduplicated hyperedge family $\mathcal{B}$. The native LSH feasibility region is:



$$
\mathcal{F}_{\mathrm{LSH}} := \{R \subseteq V : |R \cap B| \le 1,\ \forall B \in \mathcal{B}\}.
$$



Legacy bucket unionization first forms transitive overlap components and then enforces one representative per component; call that region $\mathcal{F}_{\mathrm{union}}$.

By construction,



$$
\mathcal{F}_{\mathrm{union}} \subseteq \mathcal{F}_{\mathrm{LSH}},
$$



and the inclusion can be strict.

The key violated invariant is: **LSH emits bucket-local collision evidence, not transitive global equivalence classes**. Legacy unionization adds constraints not entailed by emitted buckets.

---

## Why this matters for ML teams

Large language model training quality depends heavily on data curation quality. If clustering over-merges, we lose useful diversity and discard too many documents. If clustering under-merges, we leak near-duplicates and waste token budget. The importance of strong dedup signals for LLM training quality has been demonstrated repeatedly in practice and ablations.[^lee2022][^penedo2023][^redpajama2024]

Many production pipelines have excellent stage-1/2 engineering (signatures + bucketing), but a stage-3 semantic mismatch: transitive bucket unionization in a setting where duplicate evidence is local-by-bucket, not globally transitive. In dense overlap regions, this can collapse many mutually incompatible candidates into an overly sparse retained representation (often near one representative per large unionized component).

This is why we focus on stage 3 as a targeted, high-leverage change.

---

## Pipeline context: what changes and what does not

We keep the standard 4-stage structure:

1. Signature generation
2. Bucketing
3. Clustering
4. Filtering

Only stage 3 changes.[^datatrove]

This is important operationally: no need to replace your hash family, bucketing framework, or filtering pipeline.

We keep the same LSH-MinHash candidate-generation foundations and only change clustering semantics.[^broder1997][^charikar2002]

---

## Pipeline diagram: where assumptions hold vs break

<figure style="margin: 1rem 0 1.5rem 0; text-align: center;">
  <img src="/assets/img/posts/lsh-minhash-dedup/pipeline-assumptions.svg" alt="Pipeline assumptions diagram" style="max-width: 1000px; width: 100%; height: auto;" />
  <figcaption style="font-size: 0.95em;">Figure 0: Signature generation and bucketing preserve local evidence assumptions; legacy transitive unionization in Stage 3 is where extra, non-LSH constraints are introduced.</figcaption>
</figure>

---

## Where transitive bucket unionization fails in multi-band

### 3.1 Local clique vs global transitivity

Each bucket is a local duplicate clique by construction. But overlap between buckets does not imply transitive pairwise similarity.

You can have:

- $x, y$ together in one bucket
- $y, z$ together in another bucket
- $x, z$ sharing no bucket at all

Legacy transitive bucket unionization still merges $x, y, z$ and keeps one representative, which is stronger than the true feasibility requirement.

### 3.2 Worst-case gap can be unbounded

Build a chain of pair buckets:



$$
B_i=\{x_i,y_i\},\quad E_i=\{y_i,x_{i+1}\},\quad i=1,\dots,k-1.
$$



Bucket-overlap graph is connected, so transitive-union retention is 1.  
But $\{x_1,\dots,x_k\}$ is feasible under per-bucket uniqueness, so feasible retention is $k$.

So transitive-union retention can be $1/k$ of feasible optimum, tending to 0 as $k\to\infty$.

---

## Correct formulation: bucket hypergraph + strong independence

Let:

- $V$: document set
- $\mathcal{B}$: deduplicated bucket family (identical buckets merged)
- $H=(V,\mathcal{B})$: hypergraph (bucket = hyperedge)

A retained set $R\subseteq V$ is feasible iff:



$$
|R\cap B|\le 1\quad\forall B\in\mathcal{B}.
$$



The objective is:



$$
\alpha(\mathcal{B})=\max\{|R|: R\subseteq V,\ |R\cap B|\le 1,\ \forall B\in\mathcal{B}\}.
$$



That is exactly maximum strong independent set in this hypergraph.[^halldorsson2009] In general, this optimization family is NP-hard, so the goal is not a universal exact solver at billion scale, but a formulation and algorithm that are both faithful and operationally tractable.[^karp1972]

---

## Two key theorems (the practical ones)

### Theorem A: Explicit upper bound from bucket incidences

Define:

- document degree: $d(v)=\lvert\\{B\in\mathcal{B}:v\in B\\}\rvert$
- minimum bucket weight: $w(B)=\min_{v\in B}d(v)$

Then every feasible retained set satisfies:



$$
|R|\le \sum_{B\in\mathcal{B}}\frac{1}{w(B)}.
$$



**Intuition:** each retained doc has one unit of budget spread across its incident buckets.  
Low-$w(B)$ buckets are most constraining, hence good candidates to process first.

### Theorem B: Weight-1 refinement

Buckets with $w(B)=1$ are structurally special: an optimal solution can be chosen to include a degree-1 representative from each such bucket. Removing those forced assignments and recomputing residual buckets gives a tighter practical upper bound than the raw sum above.

This refinement is key for meaningful empirical "closeness to bound" diagnostics. In other words: the tighter the bound, the more informative your "greedy vs bound" percentage becomes.

---

## Algorithm sketch: Greedy minimum-bucket-weight clustering

Below is the implementation-oriented sketch (matching the paper logic):

```text
Input: deduplicated bucket family B
Output: root set R, cluster map phi

1. Compute document degrees d(v), bucket weights w(B).
2. Weight-1 pre-elimination:
   - For each bucket with w(B)=1:
     pick a degree-1 root z_B, cluster current unassigned members to z_B.
3. Remove already-clustered docs from remaining buckets;
   keep non-empty residual buckets B_res.
4. Recompute residual degrees d_res(v), initialize key degree d~(v)=d_res(v).
5. Build min-heap over residual buckets with key:
   ( min_{v in bucket} d~(v), bucket_id ).
6. While heap non-empty:
   a) Pop lightest bucket.
   b) Partition members into unresolved docs U and active roots A.
   c) If A empty and U non-empty:
      - if tightened weight now exceeds current level, requeue;
      - else create root u* = argmin_{v in U}(d~(v), id(v)),
        attach U to u*.
   d) If |A|=1: attach U to that root.
   e) If |A|>1: keep best root by (d~(v), id(v)),
      merge others into it, attach U.
   f) Update d~ and release processed bucket.
7. Return R and phi.
```

### Invariant and guarantee

- **Invariant:** no bucket contains more than one active root at any step.
- **Consequence:** output root set is always feasible.
- **Also:** output is maximal feasible (no extra document can be added without violating a bucket constraint).

---

## Complexity and memory behavior

Let:



$$
I=\sum_{v\in V}d(v)=\sum_{B\in\mathcal{B}}|B|
$$



be total bucket-document incidence.

- Preprocessing + weight-1 elimination + residual degree recomputation: $O(I)$.
- Residual greedy stage:



$$
O\!\left(J_{\text{res}} + K_{\text{res}}\log M_{\text{res}} + T_{\text{merge}}\right),
$$



where $J_{\text{res}}$ is residual incidence scanned over requeues, $K_{\text{res}}$ residual heap visits, and $M_{\text{res}}$ residual bucket count.

Practical memory profile is output-state dominated: beyond transient bucket/heap workspace, resident state is mainly root set $R$ and cluster map $\phi$. In contrast, generic hypergraph routines typically require global overlap structures (for example, explicit overlap graphs or adjacency-style induced-subhypergraph state) for search and updates, which becomes infeasible at billion-document scale. This output-state profile is one reason the method remains practical for very large corpora.

---

## Multi-seed dedup as a first-class extension

Run the same dedup pipeline for $T$ independent seeds and aggregate constraints.

If $p_{\text{sb}}(s)$ is per-band match probability at similarity $s$, then no-match over $Tb$ merged bands factorizes:



$$
\Pr[\text{no match on all }Tb\text{ bands}] = (1-p_{\text{sb}}(s))^{Tb}.
$$



So merged-signature view and multi-round independent-seed view are probabilistically equivalent at candidate-generation level.

**Why this is useful in practice:** sharper transition near useful similarity region and much lower low-similarity tail false positives, without inventing a new clustering primitive. This is one of the highest-ROI changes because it reuses the same workflow with different seeds.

### Figure: multi-seed acceptance curves (linear)

<figure style="margin: 1rem 0 1.5rem 0; text-align: center;">
  <img src="/assets/img/posts/lsh-minhash-dedup/lsh_minhash_curves.png" alt="Multi-seed match probability (linear)" style="max-width: 900px; width: 100%; height: auto;" />
  <figcaption style="font-size: 0.95em;">Figure 1: Multi-seed single-band match probability (linear scale).</figcaption>
</figure>

### Figure: multi-seed acceptance curves (log scale)

<figure style="margin: 1rem 0 1.5rem 0; text-align: center;">
  <img src="/assets/img/posts/lsh-minhash-dedup/lsh_minhash_curves_logy.png" alt="Multi-seed match probability (log scale)" style="max-width: 900px; width: 100%; height: auto;" />
  <figcaption style="font-size: 0.95em;">Figure 2: Multi-seed single-band match probability (log scale), highlighting low-similarity tail suppression.</figcaption>
</figure>

---

## Query-side extension (different task, same design philosophy)

For query-time LSH, there is no global clustering. We only decide whether to accept a candidate.

We evaluate stricter acceptance gates based on:

- single-band + (min OR max) with at-least-two-band fallback
- single-band + (min AND max) with at-least-two-band fallback

These are defined for MinHash-style multi-value signatures. They are not directly applicable to 1-bit SimHash, where each hash contributes only one sign bit and does not expose within-band min/max structure.[^charikar2002]

### Figure: query probability (linear)

<figure style="margin: 1rem 0 1.5rem 0; text-align: center;">
  <img src="/assets/img/posts/lsh-minhash-dedup/lsh_matched_linear.png" alt="Query probability linear" style="max-width: 900px; width: 100%; height: auto;" />
  <figcaption style="font-size: 0.95em;">Figure 3: Query acceptance probability (linear scale).</figcaption>
</figure>

### Figure: query probability (log scale)

<figure style="margin: 1rem 0 1.5rem 0; text-align: center;">
  <img src="/assets/img/posts/lsh-minhash-dedup/lsh_matched_logy.png" alt="Query probability log" style="max-width: 900px; width: 100%; height: auto;" />
  <figcaption style="font-size: 0.95em;">Figure 4: Query acceptance probability (log scale) for low-similarity false-positive analysis.</figcaption>
</figure>

---

## Case studies at billion scale

Datasets:

- **ClueWeb22 subset** used in this study: 1.62B docs (from original ~10B after cleaning and non-English filtering).[^clueweb22]
- **HPLT v2 subset** used in this study: 3.98B docs.[^hpltv2]

### Table 1: headline outcomes

| Corpus | Baseline | Best reported multi-seed setting | Retained docs gain | Max cluster reduction |
|---|---:|---:|---:|---:|
| ClueWeb (1.62B) | 1255M retained, max cluster 28,812,792 | 1319M retained, max cluster 1,859,458 (or 1,681,157 in 3-seed setting) | +64M | ~15.5x to ~17.1x smaller |
| HPLT (3.98B) | 2574M retained, max cluster 574,714 | 2639M retained, max cluster 3,783 | +65M | ~151.9x smaller |

### Table 2: near-bound behavior in deeper rounds (tightened bound)

<div class="table2-wrap">
  <table class="table2-spacious">
    <thead>
      <tr>
        <th>Corpus</th>
        <th>Setting</th>
        <th>Round</th>
        <th>Greedy / Tight Bound (M)</th>
        <th>Ratio</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>ClueWeb</td><td>(10,12,20) x 3</td><td>3</td><td>14.18 / 14.23</td><td>99.65%</td></tr>
      <tr><td>ClueWeb</td><td>(12,14,20) x 4</td><td>4</td><td>9.250 / 9.263</td><td>99.86%</td></tr>
      <tr><td>HPLT</td><td>(10,12,20) x 3</td><td>3</td><td>26.55 / 26.57</td><td>99.92%</td></tr>
      <tr><td>HPLT</td><td>(12,14,20) x 4</td><td>4</td><td>16.209 / 16.214</td><td>99.97%</td></tr>
    </tbody>
  </table>
</div>

These deeper-round percentages are the practical signal we care about: the greedy output is frequently extremely close to the tightened incidence bound.

### Figure: retained-document fraction

<figure style="margin: 1rem 0 1.5rem 0; text-align: center;">
  <img src="/assets/img/posts/lsh-minhash-dedup/case_study_retention_fraction.png" alt="Retained-document fraction" style="max-width: 900px; width: 100%; height: auto;" />
  <figcaption style="font-size: 0.95em;">Figure 5: Retained-document fraction across dedup variants.</figcaption>
</figure>

### Figure: maximum cluster size (log scale)

<figure style="margin: 1rem 0 1.5rem 0; text-align: center;">
  <img src="/assets/img/posts/lsh-minhash-dedup/case_study_max_cluster.png" alt="Maximum cluster size (log)" style="max-width: 900px; width: 100%; height: auto;" />
  <figcaption style="font-size: 0.95em;">Figure 6: Maximum cluster size (log scale); legacy unionization induces giant clusters.</figcaption>
</figure>

---

## Interactive exploration

The interactive panel below lets readers vary $(b,r,T)$ and a min+max proxy coefficient $\kappa$ to inspect curve shape, cutoff steepness, and low-similarity tails.

<iframe src="/assets/img/posts/lsh-minhash-dedup/interactive-curves.html" title="Interactive LSH curves" style="width: 100%; height: 760px; border: 1px solid #e5e7eb; border-radius: 10px;"></iframe>

---

## Why this is deployable, not just theoretical

From an engineering perspective, this proposal is attractive because:

- it changes only stage 3 semantics
- it works directly on emitted bucket files
- it supports rank-aware retention with source-ordered indexing
- multi-seed mode reuses existing process orchestration
- query-time LSH can adopt the same min/max-gate idea without changing index construction

In short: **same pipeline skeleton, better objective**.

---

## Practical migration checklist

If your current dedup stage uses transitive bucket unionization, migration can be done incrementally:

1. Keep current signature and bucket generation untouched.
2. Deduplicate identical buckets across bands.
3. Add weight-1 pre-elimination pass.
4. Replace CC merge with bucket-feasible greedy routine.
5. Report both loose and tightened bounds for diagnostics.
6. Add multi-seed reruns for sharper evidence.
7. Track three KPIs each run:
   - retained document count
   - max cluster size
   - greedy/tight-bound percentage by round

---

## Limitations and open directions

Important caveats:

- Hypergraph strong-independent-set remains NP-hard in general.
- Tightened bound is informative but still an upper bound, not exact optimum.
- Query-side min/max gates depend on signature families that expose within-band statistics.

High-value next steps:

- theory under data-realistic heavy-tailed bucket regimes
- end-to-end downstream LLM quality impact under fixed compute
- extension of query gate ideas to additional hash/signature families

---

## Closing

Legacy bucket unionization is a transitive convenience, not the right semantics for multi-band MinHash dedup.

When we replace transitive merging with bucket-feasible strong independence, we get:

- a principled objective,
- explicit structural bounds,
- a scalable stage-3 algorithm,
- and strong empirical gains on billion-document corpora.

If you already run LSH-MinHash dedup at scale, this is a high-leverage place to improve both data efficiency and retained diversity.

---

## Appendix A: notation quick reference

- $V$: document set
- $\mathcal{B}$: deduplicated bucket family (hyperedges)
- $d(v)$: number of incident buckets for document $v$
- $w(B)$: minimum degree among docs in bucket $B$
- $R$: retained root set
- $\phi$: cluster map (doc $\rightarrow$ root)

## References

[^datatrove]: Hugging Face DataTrove repository (pipeline context): https://github.com/huggingface/datatrove
[^lee2022]: Lee et al., "Deduplicating Training Data Makes Language Models Better" (ACL 2022): https://aclanthology.org/2022.acl-long.577/
[^penedo2023]: Penedo et al., "The RefinedWeb Dataset for Falcon LLM" (NeurIPS Datasets and Benchmarks 2023): https://papers.neurips.cc/paper_files/paper/2023/file/fa3ed726cc5073b9c31e3e49a807789c-Paper-Datasets_and_Benchmarks.pdf
[^redpajama2024]: Together Computer, "RedPajama: an open dataset for training large language models" (NeurIPS Datasets and Benchmarks 2024): https://proceedings.neurips.cc/paper_files/paper/2024/file/d34497330b1fd6530f7afd86d0df9f76-Paper-Datasets_and_Benchmarks_Track.pdf
[^broder1997]: Broder, "On the resemblance and containment of documents" (1997): https://doi.org/10.1109/SEQUEN.1997.666900
[^charikar2002]: Charikar, "Similarity estimation techniques from rounding algorithms" (STOC 2002): https://doi.org/10.1145/509907.509965
[^halldorsson2009]: Halldorsson and Losievskaja, "Independent sets in bounded-degree hypergraphs" (2009): https://doi.org/10.1016/j.dam.2008.11.013
[^karp1972]: Karp, "Reducibility among combinatorial problems" (1972): https://doi.org/10.1007/978-1-4684-2001-2_9
[^clueweb22]: Eickhoff et al., "ClueWeb22" (SIGIR Forum 2022): https://lemurproject.org/clueweb22.php
[^hpltv2]: Burchell et al., "An expanded massive multilingual dataset for high-performance language technologies (HPLT)" (2025): https://arxiv.org/abs/2503.10267

