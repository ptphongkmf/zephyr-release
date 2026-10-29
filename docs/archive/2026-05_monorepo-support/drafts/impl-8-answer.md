## Q2

actually, labels, reviewers, assignees all just a simple process? i dont think it complex enough for your "exssesive for v1" reason?

also, about group-proposals true, hmm. should we again, use valibot variant to ensure the tojsonschema can correct write the correct schema? of do you think variant too complex jsn schema wnt be able to translate?

## Q3

since this also benefit single repo, and not reuire monorepo to work, i guess it is better if we implement this before the monorepo? not during it?

should it be the first changes? or last in the imple list before monorepo implement?

## Q4 - 5

just to be clear, for per worskapce hooks, i still want to expose other workspace variables, like ZR__other-pkg__NEXT_VERSION, these are not exclusive to global hooks, this is to make it flexible for people who want monorepo aware.
even for per pkg hooks 

## FQ2

about commit msg, i forgot if we have agree upon this before or not, but, can each pkg commit individually like proposal? or we strictly forbidden it, thus commit msg is global setting?

about schema, 1 pros of directly differentiate in schema, instead of using post-process v.transofrm, is that the convert to json-schema will transalte it correctly? (unless json schema not support variant?) or do you think best practice, it is better to list this post-proces in the description, no need for complex json schema?
anyway, honestly, to make it less complicated, we can just make our custom transform to check, if the worskapce release have a boolean isWorkspace true, we format with name-version like normal? (even if there is just 1 item) vs when it is single repo, we only output version?
so now we can just remove this complex variant arguemnet and use 1 central msg default?

## FQ3

i agree

## fq4

are you sure "@" is the best symbol? i want my tool to be flexible and agnostic. So would "@" imply js package too much? is there more agnostic symbol? or "@" is perfectly for agnostic already?
cause i also target ther codebase like python, go, rust,... (hence why when gen json schema in `scripts\gen-json-schema.ts`, i have camel case, kebab and snake case version)

## fq5

"review.groupProposals" make no sense for a single repo though, so i think it should be added during monorepo implemntation, maybe before any heavy stuff

## fq6

ok, i agree. But you might be misunderstood by `source-mode: local` a bit. 
source mode is controlling how we get the file, not how we work. for git diff, it is used if our provider is local (which i not implement yet, i only work with github for now), it 
has nothign to do with souce mode

## Rq1

i dont think we need to restrict naming? by parsing on the value right side, we eliminate hte parsing problem no?

__ and -- wont break anything? we just do ZR__ + name + __*, whatever name in middle is decide by user, and they will know what to put there? 

also, this also lead to a problem, should we change case for name? or kept it as it is? for exmaple, if user have name "my-pkg", it would become ZR__my-pkg__NEXT_VERSION? so we do not transform user iven name, but give it as it is? i think this iss best because it least surprise?
so we wont acceidently transform kebab to snake, or vice versa? what do yo think ?
