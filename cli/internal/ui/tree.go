// Tree view TUI - displays project context tree structure
// Reads from .contextplus and displays files with headers/symbols

package ui

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

type treeNode struct {
	path     string
	name     string
	isDir    bool
	depth    int
	children []*treeNode
}

type treeModel struct {
	root   *treeNode
	flat   []*treeNode
	cursor int
	scroll int
	height int
	err    error
}

func newTreeModel() treeModel {
	root, err := buildTree(".")
	flat := flattenTree(root, nil)
	return treeModel{root: root, flat: flat, height: 20, err: err}
}

func buildTree(root string) (*treeNode, error) {
	node := &treeNode{path: root, name: filepath.Base(root), isDir: true, depth: 0}
	err := walkDir(root, node, 0, 4)
	return node, err
}

func walkDir(path string, parent *treeNode, depth, maxDepth int) error {
	if depth > maxDepth {
		return nil
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		name := entry.Name()
		if shouldSkip(name) {
			continue
		}
		fullPath := filepath.Join(path, name)
		child := &treeNode{path: fullPath, name: name, isDir: entry.IsDir(), depth: depth + 1}
		parent.children = append(parent.children, child)
		if entry.IsDir() {
			walkDir(fullPath, child, depth+1, maxDepth)
		}
	}
	return nil
}

func shouldSkip(name string) bool {
	skip := []string{".git", "node_modules", ".mcp_data", "build", "dist", ".next", "__pycache__", ".venv", "vendor"}
	for _, s := range skip {
		if name == s {
			return true
		}
	}
	return strings.HasPrefix(name, ".")
}

func flattenTree(node *treeNode, flat []*treeNode) []*treeNode {
	if node == nil {
		return flat
	}
	flat = append(flat, node)
	for _, child := range node.children {
		flat = flattenTree(child, flat)
	}
	return flat
}

func (m treeModel) Init() tea.Cmd { return nil }

func (m treeModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "esc", "backspace":
			return newDashboard(), nil
		case "up", "k":
			m.cursor = Clamp(m.cursor-1, 0, len(m.flat)-1)
			if m.cursor < m.scroll {
				m.scroll = m.cursor
			}
		case "down", "j":
			m.cursor = Clamp(m.cursor+1, 0, len(m.flat)-1)
			if m.cursor >= m.scroll+m.height {
				m.scroll = m.cursor - m.height + 1
			}
		}
	case tea.WindowSizeMsg:
		m.height = msg.Height - 6
	}
	return m, nil
}

func (m treeModel) View() string {
	s := TitleStyle.Render("Context Tree") + "\n\n"
	if m.err != nil {
		s += ErrorStyle.Render(fmt.Sprintf("Error: %v", m.err)) + "\n"
	}
	end := MinInt(m.scroll+m.height, len(m.flat))
	for i := m.scroll; i < end; i++ {
		node := m.flat[i]
		prefix := strings.Repeat("  ", node.depth)
		icon := "📄"
		if node.isDir {
			icon = "📁"
		}
		line := fmt.Sprintf("%s%s %s", prefix, icon, node.name)
		if i == m.cursor {
			s += SelectedStyle.Render("> "+line) + "\n"
		} else {
			s += DimStyle.Render("  "+line) + "\n"
		}
	}
	s += "\n" + HelpStyle.Render("↑/k up • ↓/j down • esc back • q quit")
	return s
}

func RunTree() {
	p := tea.NewProgram(newTreeModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}
