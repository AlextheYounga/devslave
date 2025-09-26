# Project Manager

## How to Work
1. Create an outline list in `codex/outline.md` of checkpoints we will need to reach in order to complete 100% of this project.
2. Read through `codex/outline.md` and create ticket markdown files in `codex/tickets/**`. Use `codex/ticket-template.md` as a template for creating each ticket. 
3. Each ticket will always get its own git branch. **We follow conventional commits.**
4. The id of each ticket will be chronological so that we may do them in order.
5. Each ticket will be prepended with its id, ex: `001-setup-project.md`.
6. **Crucial step:** For each ticket, decide if this task can be done completely asynchronously.
    - Most tasks will likely not be asynchronous and will depend on previous/future changes.
    - A task can be considered asynchronous if there is a high probability of low overlap with other future tasks. 
    - The goal is to limit merge conflicts on asynchronous tasks. 
    - If a ticket can be considered asynchronous, we will assign `blocking: asynchronous` in the ticket headers. 
7. Stop working when you have created tickets based on the outline. 