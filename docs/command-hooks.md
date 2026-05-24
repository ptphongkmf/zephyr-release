# Command Hooks

Command Hooks provide a way to execute custom shell scripts or commands at specific points during the Zephyr Release operation. This allows you to integrate your own logic - such as running tests, building artifacts, or sending notifications - seamlessly into the release process.

You can configure these hooks in your configuration file using the [`command-hooks`](./config-options.md#command-hooks-optional) option. During their execution, command hooks have access to a rich set of environment variables. You can learn more about these variables in the [Export Variables](./export-variables.md) and [String Templates and Patterns](./string-templates-and-patterns.md) documentation to understand what resources are available to your commands as environment variables.

## Execution Flow

The execution flow illustrates exactly when your scripts will run and how they fit into the broader Zephyr Release process. This helps you understand the operational context when each hook is triggered.

### Review Mode

In review mode, the operation is split into two distinct phases depending on the state of the release proposal. Below is the flow for each phase:

#### Prepare Phase

This phase runs when creating or updating a release proposal.

1. Bootstrap operation and export base operation variables.

2. **Run [`command-hooks.pre-run`](./config-options.md#command-hooks--pre-run-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

3. Calculate the next version and resolve commits.

4. Export pre-prepare operation variables.

5. **Run [`command-hooks.pre-prepare`](./config-options.md#command-hooks--pre-prepare-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

6. Generate changelog release content and prepare changes.

7. Commit changes to the working branch and create/update the proposal.

8. Export post-prepare operation variables.

9. **Run [`command-hooks.post-prepare`](./config-options.md#command-hooks--post-prepare-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

10. Export final operation variables.

11. **Run [`command-hooks.post-run`](./config-options.md#command-hooks--post-run-optional) commands.**

#### Publish Phase

This phase runs when merging a release proposal, triggering the actual release. Note that this phase will only execute if [`tag.create-tag`](./config-options.md#tag--create-tag-optional) is enabled.

1. Bootstrap operation and export base operation variables.

2. **Run [`command-hooks.pre-run`](./config-options.md#command-hooks--pre-run-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

3. Generate changelog release content and extract the next version.

4. Export pre-publish operation variables.

5. **Run [`command-hooks.pre-publish`](./config-options.md#command-hooks--pre-publish-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

6. Create the Git tag.

7. *(If [`release.create-release`](./config-options.md#release--create-release-optional) is enabled)* Create the platform release.

8. *(If [`release.create-release`](./config-options.md#release--create-release-optional) is enabled)* Attach release assets.

9. Export post-publish operation variables.

10. **Run [`command-hooks.post-publish`](./config-options.md#command-hooks--post-publish-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

11. Export final operation variables.

12. **Run [`command-hooks.post-run`](./config-options.md#command-hooks--post-run-optional) commands.**

### Auto Mode

In auto mode, the operation executes both the prepare and publish steps sequentially in a single run.

1. Bootstrap operation and export base operation variables.

2. **Run [`command-hooks.pre-run`](./config-options.md#command-hooks--pre-run-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

3. Calculate the next version and resolve commits.

4. Export pre-prepare operation variables.

5. **Run [`command-hooks.pre-prepare`](./config-options.md#command-hooks--pre-prepare-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

6. Generate changelog release content, prepare changes, and commit directly to the target branch.

7. Export post-prepare operation variables.

8. **Run [`command-hooks.post-prepare`](./config-options.md#command-hooks--post-prepare-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

9. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) is enabled)* Export pre-publish operation variables.

10. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) is enabled)* **Run [`command-hooks.pre-publish`](./config-options.md#command-hooks--pre-publish-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

11. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) is enabled)* Create the Git tag.

12. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) and [`release.create-release`](./config-options.md#release--create-release-optional) are enabled)* Create the platform release.

13. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) and [`release.create-release`](./config-options.md#release--create-release-optional) are enabled)* Attach release assets.

14. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) is enabled)* Export post-publish operation variables.

15. *(If [`tag.create-tag`](./config-options.md#tag--create-tag-optional) is enabled)* **Run [`command-hooks.post-publish`](./config-options.md#command-hooks--post-publish-optional) commands.** *(If overridden runtime config is returned, it applies moving forward).*

16. Export final operation variables.

17. **Run [`command-hooks.post-run`](./config-options.md#command-hooks--post-run-optional) commands.**
