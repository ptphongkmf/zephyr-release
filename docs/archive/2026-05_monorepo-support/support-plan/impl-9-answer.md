## fq2

i debate between the trandormation naming `format_workspace_releases`
and how we work with it.

first, the naming should fit with both single and monorepo, would `format_workspace_releases` already good enough? it have the word "workspace" so im not sure, or do you personally think it is fine? agree upon a concreate name help with avoiding breaking change down the lines

second, formatting problem. for single repo, i want it to only output the semver (without `v`), but for monorepo, we would need to output the full name + versoin, and would this version have the "v"?
honestly, this kinda make the 1 unified default template less ideal, and a variant, or runtime default changes kinda justify? though, feel free to push back if it is not best practice

also, do not check array length to decide it is single or monorepo, that is dangrous and error prone, what if we in monorepo and only 1 pkg affected? it will be treated as single so it is wrong!
either include a isWorkspace boolean in the obj, or we can make the fn acceppt params, like `{{ workspaceReleases | format_workspace_releases: isWorkspace }}`, maybe also inclde a params for separator, incae some dont prefer ",".
still, the problem is, we are foceing <name>-v<version> pattern, should we even include a commit label template? or we should just reuse tagname instead? instead of our own format? 
so much to ocnsider
