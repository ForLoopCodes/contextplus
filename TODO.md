# TODO List

## instructions

ai agents are not allowed to change this file's content without human approval, ai agents can only complete the given tasks and update the task with [x]

## v1

- [ ] rename tools for better meaning
  - [ ] rename semantic_navigate to cluster
  - [ ] rename get_context_tree to tree
  - [ ] rename semantic_identifier_search and semantic_code_search (merged) to search
  - [ ] rename get_feature_hub to find_hub and change its functionality to return rankings or relevant hubs based on a search query with options for semantic or keyword search or both
    - [ ] add parameter to search for data in hubs by semantic meaning or keyword match or both
    - [ ] add parameter optionality so if no parameters are provided, it returns context of all hubs in the project
  - [ ] rename get_file_skeleton to skeleton
  - [ ] rename get_blast_radius to blast_radius
  - [ ] rename run_static_analysis to lint
    - [ ] add skill checking - every file has no comments than top 2 lines, and other checks in the instructions file and return a skill score for each file and the project overall with files and lines that need fixing
  - [ ] rename propose_commit to checkpoint and change its functionality to create a local undoable commit that agent can create during long worksessions mid work - uses shadow checkpoints or git whichever is better
  - [ ] rename list_restore_points to restore_points
  - [ ] rename undo_change to restore and change its functionality to restore to a specific commit point
  - [ ] rename upsert_memory_node to create_memory
  - [ ] rename search_memory_graph to search_memory
  - [ ] rename retrieve_with_traversal to explore_memory
  - [ ] create delete_memory tool that deletes nodes or relationships in the memory graph
  - [ ] prune_stale_links tool should be removed as i want it to be done automatically by the system when any memory tools are called and before graph is accessed
  - [ ] add_interlinked_context to bulk_memory
- [ ] merge semantic_identifier_search and semantic_code_search into one tool called search with a parameter for search type (e.g. "identifier" vs "file" or "hybrid" - which uses both regex and semantic search and returns 2 separate lists of results)
  - [ ] add options for filtering by semantic meaning or normal search or both
  - [ ] use a vector database for storing embeddings and searching instead of doing it in memory for better performance and scalability
- [ ] create a new memory system that uses a graph database and md files and vector database for storing memories
  - [ ] add tool for updating memories with new information that updates the embeddings depending on the changes made to the content and the agent should use this instead of directly updating the content in the file
  - [ ] update other tools to use the new memory system too, alongside with tools that save nodes and edges automatically and creates embeddings automatically when a new node or edge is created or deleted
- [ ] create a new tool called init that initializes the project by creating a context tree and .contextplus folder
  - [ ] use .contextplus/hubs for feature hubs
  - [ ] use .contextplus/embeddings for storing file and symbol embeddings
  - [ ] use .contextplus/config for configuration files
  - [ ] use .contextplus/memories for memory graph data

---

## v2

code update:

- [ ] list overengineered tools and parameters that could be removed for better context
- [ ] remove overengineered tools and parameters
- [ ] remove vibeslop code (if any)
- [ ] remove ollama bugs and spam for embeddings with a smarter embedding generation system that continuously watches for file changes and updates embeddings in the background, only init one time in the project and then its automatically watched

new features:

- [ ] ctx+ cli in cli/ folder
  - [ ] visualize memory graphs, unto commits, hubs in the cli
  - [ ] use charm's tui library - bubble or tea
  - [ ] features like `contextplus init`
  - [ ] visualize context tree, undo commits, hubs list, and more in the cli
  - [ ] create hubs option from the cli for humans
- [ ] acp features (maybe that we can list all sessions and memories from all agents, like opencode, copilot, claude, codex into one generalized list)
  - [ ] improved memory search from acp
  - [ ] load session memoies from acp into the memory graph
  - [ ] cli: see all sessions of all agents in list and add semantic search in cli
  - [ ] cli: see all memories of all agents in list and add semantic search in cli
  - [ ] use .contextplus/external_memories for storing acp imported memories and sessions
- [ ] faster and cleaner agent protocol access
- [ ] faster tool execution and cleaner outputs and better error handling and reporting with suggestions like "this tool failed, you can do this instead, it will work the same"
- [ ] better treesitter support and tools for using it to understand code structure and semantics better
- [ ] add these features to be visualized in the cli
- [ ] add researchplus tools and features
