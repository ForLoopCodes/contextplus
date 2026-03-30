// Context+ CLI with Bubble Tea TUI for visualizing project context
// Commands: tree, hubs, restore, memory, sessions, create-hub, init

package main

import (
	"fmt"
	"os"

	"github.com/contextplus/cli/internal/ui"
)

func main() {
	if len(os.Args) < 2 {
		ui.RunDashboard()
		return
	}

	cmd := os.Args[1]
	switch cmd {
	case "init":
		runInit()
	case "tree":
		ui.RunTree()
	case "hubs":
		ui.RunHubs()
	case "restore", "undo":
		ui.RunRestore()
	case "memory", "mem":
		ui.RunMemory()
	case "sessions", "acp":
		ui.RunSessions()
	case "structure", "ast":
		ui.RunCodeStructure()
	case "create-hub", "hub":
		ui.RunCreateHub()
	case "help", "-h", "--help":
		printHelp()
	case "version", "-v", "--version":
		fmt.Println("contextplus-cli v1.0.0")
	default:
		fmt.Printf("Unknown command: %s\n", cmd)
		printHelp()
		os.Exit(1)
	}
}

func runInit() {
	cwd, _ := os.Getwd()
	dirs := []string{".contextplus", ".contextplus/hubs", ".contextplus/embeddings", ".contextplus/config", ".contextplus/memories", ".contextplus/memories/nodes", ".contextplus/external_memories"}
	for _, d := range dirs {
		os.MkdirAll(d, 0755)
	}

	files := map[string]string{
		".contextplus/memories/graph.json":             `{"nodes":{},"edges":{}}`,
		".contextplus/external_memories/sessions.json": `[]`,
		".contextplus/external_memories/memories.json": `[]`,
		".contextplus/hubs/README.md":                  "# Context+ Hubs\n\nUse markdown files with [[path/to/file]] links to group features.\n",
	}
	for path, content := range files {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			os.WriteFile(path, []byte(content), 0644)
		}
	}

	fmt.Printf("Initialized contextplus in %s\n", cwd)
	fmt.Println("Created directories and default files")
	fmt.Println("")
	fmt.Println("To generate embeddings for semantic search, use the MCP init tool:")
	fmt.Println("  - Use the 'init' MCP tool via your agent (Claude, Cursor, etc.)")
	fmt.Println("  - Or run: npx contextplus init")
}

func printHelp() {
	fmt.Println(`contextplus-cli - Context+ TUI

Usage: contextplus [command]

Commands:
  (none)      Open interactive dashboard
  tree        View context tree
  hubs        View feature hubs
  restore     View/restore checkpoints
  memory      View memory graph
  sessions    View ACP agent sessions
  structure   Code structure analysis
  create-hub  Create a new hub
  init        Initialize .contextplus folder
  help        Show this help
  version     Show version`)
}
