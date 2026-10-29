# Monorepo Support — Execution Modes and Naming Strategy (Draft 5)

> **Status:** Draft / Technical Design  
> **Date:** 2026-05-25  
> **Scope:** Analysis of `auto` vs `review` mode validity in monorepos, evaluating the practicality of `auto` trigger strategies (batching, footers, flags), and an honest critique of `releaseExecution` vs `releaseFlow`.

---

## 1. Do both `auto` and `review` modes make sense in a Monorepo?

**Yes, absolutely.** You are forced to choose either "full auto" or "full review" for the repository, but *both* workflows are perfectly valid and widely used in the industry.

*   **Why `review` mode makes sense:** This is the **Release-Please** model. Teams want human oversight. When someone pushes a feature, Zephyr Release opens a proposal (PR/MR). The team can read the aggregated changelog for all affected packages, edit the release notes, and approve the bump. Once merged, it publishes. This is the safest and most popular way to manage complex monorepos.
*   **Why `auto` mode makes sense:** This is the **Semantic-Release** model (Continuous Delivery). For fast-moving microservices or internal packages, teams do not want the friction of a review PR. Zephyr Release calculates bumps, commits the changelogs, tags the packages, and pushes everything directly to `main` without human intervention. 

### Are your `auto` trigger strategies actually practical?

Looking at your `auto-release-strategy.ts` (which defines `commit-types`, `commit-footer`, and `flag` strategies): **Yes, these are highly practical and solve a real-world problem.**

In a continuous delivery (auto) environment, releasing on *every single push* causes **Release Spam**. If a developer merges 5 typo fixes in a row, you don't want to trigger 5 Docker builds, 5 NPM publishes, and 5 Slack notifications. 

Your strategies handle this perfectly:
1. **`commit-types` (with `minCommitCount` / `requireBreaking`)**: This acts as a **Release Buffer/Batcher**. A team can say: *"Only trigger an auto-release for `packages/core` if there is at least 1 Feature, OR 5 Bug Fixes, OR a Breaking Change."* This saves massive amounts of CI/CD compute time.
2. **`commit-footer`**: Allows a developer to explicitly force an immediate release bypassing the buffer by adding a footer like `Autorelease: true`.
3. **`flag`**: When combined with your command hooks (`runtimeConfigOverride`), this allows users to run an arbitrary bash script (e.g., checking if the staging server is healthy) to dynamically flip the release flag on or off during CI.

**Monorepo Fit:** If you allow these strategies to be overridden per-workspace, it becomes extremely powerful. You could configure a stable `packages/core` library to buffer releases (wait for 5 fixes), while a fast-moving `packages/api` microservice deploys instantly on every single commit.

---

## 2. Naming Strategy: Replacing `"mode"`

You asked whether `"releaseExecution"` makes sense as a combined name, and for an honest judgment between the options.

### Honest critique of `"releaseExecution"`
To be blunt: **`releaseExecution` is a bad name.** 
It suffers from "Enterprise Java Naming Syndrome". Both "release" and "execution" are heavy, process-oriented nouns. Combining them creates a clunky tautology (the execution of the release). It doesn't read smoothly in configuration: `"releaseExecution": "review"` feels robotic and verbose.

### The Definitive Recommendation: `"releaseFlow"`
Between all options (`executionMode`, `executionMethod`, `executionApproach`, `executionFlow`, `releaseExecution`), **`releaseFlow` is the absolute best choice.**

1. **Domain-Specific & Human-Readable:** `releaseFlow: "review"` reads perfectly in plain English: *"The flow of my releases goes through review."* It sounds modern, conversational, and fits right in alongside tools like GitHub Workflows.
2. **Standard Convention:** In CI/CD, pushing directly vs opening a PR is universally referred to as a "workflow" or "flow" (e.g., GitFlow, Trunk-Based Flow).
3. **Perfect Future-Proofing:** If you later add Changeset support (intent-driven parsing), that feature dictates **change detection**, not the flow. 
   ```json
   {
     "releaseFlow": "review",     // "review" | "auto"
     "changeDetection": "intent"  // "commits" | "intent"
   }
   ```
   These become perfectly orthogonal concepts with zero ambiguity.

### Runner-Up: `"executionMode"`
If you feel that `releaseFlow` is too "soft" and you want a name that directly maps to your internal TypeScript abstract classes (where the code splits into different execution paths), then **`executionMode`** is the only acceptable alternative. It is snappy and avoids the verbosity of "Method" or "Approach".

**Final Verdict:** Do not use `releaseExecution`. Use **`releaseFlow`**.
