// Memory view TUI - displays memory graph nodes and relations
// Reads from .contextplus/memories/graph.json for visualization

package ui

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	tea "github.com/charmbracelet/bubbletea"
)

type memoryNode struct {
	ID       string            `json:"id"`
	Type     string            `json:"type"`
	Label    string            `json:"label"`
	Metadata map[string]string `json:"metadata"`
}

type memoryEdge struct {
	ID       string  `json:"id"`
	Source   string  `json:"source"`
	Target   string  `json:"target"`
	Relation string  `json:"relation"`
	Weight   float64 `json:"weight"`
}

type memoryGraph struct {
	Nodes []memoryNode `json:"nodes"`
	Edges []memoryEdge `json:"edges"`
}

type memoryModel struct {
	graph  memoryGraph
	cursor int
	scroll int
	height int
	err    error
	mode   string
}

func newMemoryModel() memoryModel {
	graph, err := loadMemoryGraph()
	return memoryModel{graph: graph, height: 20, err: err, mode: "nodes"}
}

func loadMemoryGraph() (memoryGraph, error) {
	graphPath := filepath.Join(".contextplus", "memories", "graph.json")
	data, err := os.ReadFile(graphPath)
	if err != nil {
		return memoryGraph{}, err
	}
	var graph memoryGraph
	if err := json.Unmarshal(data, &graph); err != nil {
		return memoryGraph{}, err
	}
	return graph, nil
}

func (m memoryModel) Init() tea.Cmd { return nil }

func (m memoryModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	maxIdx := m.maxIndex()
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "esc", "backspace":
			return newDashboard(), nil
		case "tab":
			if m.mode == "nodes" {
				m.mode = "edges"
			} else {
				m.mode = "nodes"
			}
			m.cursor, m.scroll = 0, 0
		case "up", "k":
			m.cursor = Clamp(m.cursor-1, 0, maxIdx)
			if m.cursor < m.scroll {
				m.scroll = m.cursor
			}
		case "down", "j":
			m.cursor = Clamp(m.cursor+1, 0, maxIdx)
			if m.cursor >= m.scroll+m.height {
				m.scroll = m.cursor - m.height + 1
			}
		}
	case tea.WindowSizeMsg:
		m.height = msg.Height - 8
	}
	return m, nil
}

func (m memoryModel) maxIndex() int {
	if m.mode == "nodes" {
		return MaxInt(0, len(m.graph.Nodes)-1)
	}
	return MaxInt(0, len(m.graph.Edges)-1)
}

func (m memoryModel) View() string {
	title := "Memory Graph - Nodes"
	if m.mode == "edges" {
		title = "Memory Graph - Edges"
	}
	s := TitleStyle.Render(title) + "\n"
	s += DimStyle.Render(fmt.Sprintf("(%d nodes, %d edges)", len(m.graph.Nodes), len(m.graph.Edges))) + "\n\n"

	if m.err != nil {
		s += ErrorStyle.Render(fmt.Sprintf("Error: %v", m.err)) + "\n"
		s += DimStyle.Render("Use create_memory tool to add memory nodes.") + "\n"
	} else if m.mode == "nodes" {
		s += m.renderNodes()
	} else {
		s += m.renderEdges()
	}
	s += "\n" + HelpStyle.Render("tab switch • ↑/k up • ↓/j down • esc back • q quit")
	return s
}

func (m memoryModel) renderNodes() string {
	if len(m.graph.Nodes) == 0 {
		return DimStyle.Render("No memory nodes found.") + "\n"
	}
	var s string
	end := MinInt(m.scroll+m.height, len(m.graph.Nodes))
	for i := m.scroll; i < end; i++ {
		n := m.graph.Nodes[i]
		line := fmt.Sprintf("[%s] %s (%s)", n.Type, n.Label, n.ID[:8])
		if i == m.cursor {
			s += SelectedStyle.Render("> "+line) + "\n"
		} else {
			s += DimStyle.Render("  "+line) + "\n"
		}
	}
	return s
}

func (m memoryModel) renderEdges() string {
	if len(m.graph.Edges) == 0 {
		return DimStyle.Render("No memory edges found.") + "\n"
	}
	nodeMap := make(map[string]string)
	for _, n := range m.graph.Nodes {
		nodeMap[n.ID] = n.Label
	}
	var s string
	end := MinInt(m.scroll+m.height, len(m.graph.Edges))
	for i := m.scroll; i < end; i++ {
		e := m.graph.Edges[i]
		srcLabel := nodeMap[e.Source]
		tgtLabel := nodeMap[e.Target]
		if srcLabel == "" {
			srcLabel = e.Source[:8]
		}
		if tgtLabel == "" {
			tgtLabel = e.Target[:8]
		}
		line := fmt.Sprintf("%s --%s--> %s (%.2f)", srcLabel, e.Relation, tgtLabel, e.Weight)
		if i == m.cursor {
			s += SelectedStyle.Render("> "+line) + "\n"
		} else {
			s += DimStyle.Render("  "+line) + "\n"
		}
	}
	return s
}

func RunMemory() {
	p := tea.NewProgram(newMemoryModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}
