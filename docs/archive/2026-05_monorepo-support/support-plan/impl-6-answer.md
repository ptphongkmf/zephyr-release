## Q1

hmm, i think the idea is, yes, based on `nameTemplate`, we somehow create a regex? or maybe will liquidjs have some utilss that help us make this easier?

also, i think we should also add a new props, that is a previous name template. This is useful when user transtion to a new template, they can defiend their old one time just to match the latest tag.
if you think this is a good idea, i think we should implement this before adding the actual monorepo, since this is useful for single repo as well. so implement it as a single feat before monorepo adding is a good idea.

also im dbate about the naming as well, one of hardest problem in programmaing i guess. should we call it "latestNameTemplate"? "previousNameTemplate"? "oldNameTemplate", "beforeNameTemplate"? 
or "fallback-name-template", "fallback-match-patterns"? and make this array? also should this value also be template like name so it basically copy-paste for user, and we re-use the fn that transform template to regex? and we would have to transform it? or should we enorece for pattern, we use wildcard or glob? lke "v*", "core-*"?
or if you have better sugeestion, dont hestiate to recommend, since changing props is a breaking changes, i want to decide on a good name, so be harsh on this!

this also mean, when implement this, we can remove all the `parseLooseSemVer` logic in `src\providers\github\commit.ts`? the `githubListCommitsFromGivenToLastRelease`? or do you think it still useful to keep it? based on best practice, no need to try satisfy me.
on second hought, should we enforece this tag pattern for both scenerio? so we also remove the latest release api call? and now we either find by tag pattern, of failed? or should we create 2 version, the version for single repo still have fallback, while the mono more strict?
and lasty, should i refactor and move the "find latst" as it owns method? so our "githubListCommitsFromGivenToLastRelease" become simpler and it just accept the start and end hash?

also, how can we optmize this? since if we loop this procees per pkg, we get duplcaite array? should we smehow find that "furthest" latest tag and find once, then slice that array to approaite lengt per pkg?

## Q2

in practical, and ready for future 3.x or 4.x changeset implement, would different trigger like this even make sense? or do you think changeset use differen trigger system anyway so it doesnt matter?
if it make sense, yes, i want iit to have different trigger startegy. althought the relase flow must still be global

## Before procced to Q3 - Q5

first, we must evaluate which props should go to workspce member specific, which should be omit. if a whoole object like commit should be incldue, you just need to list commit object, we only list inner props if a obj might have different omit/include inner props

second ,i will say the how the logic should flow in my head, then you judege it.

now, on boosrap, we will crate a release context array that hold all pkg affected? even for single rpeo, we still create a 1 item array, so normalize the context shape?
the in workflow, now, instead of log and call task instantly, we keep the log, but wrap the task around jobs - a new folder in `src\jobs`, jobs main logic is geting the releasecontext and config, input, etc.. and it loop through array to call fn. it help make the main workflower cleaner, no loop in the main orchestrator

although we normalize the shape to be array, i think i will still want something to know that this single item array is single repo, or monorepo that only have 1 repo affected. Because in jobs, if it single repo, we wont have inner log. But if it monorepo, i might want inner log to log "start of pkg ....", "end of pkg ...", etc. <- these wouldnt make sense for isngle repo. so, a global boolean? a bollean inside context obj? yoru choice, which ever more best practice.

also, should we support multiple path for 1 pkg? current with our {path: {...config} }, each path only corresponsding with 1 pkg. Should we ever allow one pkg can match multiplpath? to handle various
cases that users might have? or do you think this scenerio is wrong fom the root anyway, so dont support it? or is it a brilliant idea?
if we agree on this, we might swicth the monorepo obj from <path>: {..} to <name>: {path: [], ...} ? this also jinda ensure a name must always be set? though i guess we can still keep a name prop inside if user want to explicitly set name in it for whatever reason?

### and lastly, i also have a huge problem about perf, it is about short curcuit.

look at `validateCurrentOperationTriggerCtx` in `src\tasks\operation.ts`. it avoid bot commit, nad filter if the trigger commit have valid commit type.
then short circuit later on. do you think i should kept it? will it create problem for monorepo setup?

also, honestly, im debate on how to even determine the release array that hold affect pkg anyway.
do we jugde based on trigger commit? but then what if the old commit failed, then when apply the new commit, it might change any path in that past pkg, which mean we now missed it?
should we all try to fetch from trigger commit to last release FOR all pkg tag pattern, and determine?
but then, this will cause multiple fetch call? which is redundant? should we just based on which ever pkg latest reelease is the furthest, and fetch once only? how would this work most logical?
choose the best practice approach, not "it just work"

## Q3

it will be per workspace.

so, we will have a huge string pattern context obj that hold a map of 
pkg: {...thie own context} and inject/provide it per pkg.
that being said

and when provide the current context to export var, do the same, we oly provide the pattern of current pkg

## Q4 + Q5

Some hooks run per workspace, some globally is best, thought that should be document clearly in command hook docs

and yes, this will lead to changes in the export var.

now, we will still inject varaible per pkg just like string context.
However, we also export a "global" version, for example
ZR_NEXT_VERSION have a `ZR_GLOBAL_NEXT_VERSION` ariant, that is a stringify obj of {<name>: <value>, <name>: <value>, ....}
so that in case you want monorepo-aware, they can parse this object.
in single repo case, this obj must still exist, but for the name, we use the root name if exist, if empty or undefined, we use the default name "root"

however, i also ant to refactor how we handle output. Currently, for export varaible, i export env and output at the same time, with same key/shape, this need to changes.
for env, it is the above, simple all caps snake case `ZR_NEXT_VERSION`
but for output, we have to create a different shape/have a flatten transform fn in middle before set output.
so, when set output, the naming should be `zr--<name>--next-version` for mono repo, for single repo, it is still the same `zr-next-version` (in monorepo, this wont eixst = undefined)
essentially, env and output will have different shape now.

## Q6

since the default value for working branch teplate is 
```
export const DEFAULT_WORKING_BRANCH_NAME_TEMPLATE =
  "zephyr-release/{{ triggerBranchName }}";
```
at `src\constants\defaults\string-templates.ts`

in workspace ocnfig, we will omit this, and then re-add it, but now with new default, which is `zephyr-release/{{ name }}/{{ triggerBranchName }}`
we still allow user to defined hteir own (if they didnt make it unique, it is user error, we wont stop it)

## last

now lastly, about our `docs\config-options.md`, when adding a workspace props, we wont show full detail their, instead we just give i workspace config type,
then under `Type Definitions` section, we put worksapce config their with a short desc, then put a hyperlink lead to our separate docs, which we name `workspace-config-options.md`,
the structure alsmo identical to `config-options.md`, just with different props value of course. And in the summry, make sure to eplxicitly guide user that this apply to worskapce / monorepo mode, for simple config, look at normal config with a right hyperlink

