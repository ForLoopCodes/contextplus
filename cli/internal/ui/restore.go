// Restore view TUI - displays and manages checkpoint restore points
// Reads from .contextplus/checkpoints and allows undo operations

package ui

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

type restorePoint struct {
	ID        string   `json:"id"`
	Timestamp int64    `json:"timestamp"`
	Files     []string `json:"files"`
	Message   string   `json:"message"`
}

type restoreModel struct {
	points   []restorePoint
	cursor   int
	scroll   int
	height   int
	err      error
	restored string
}

func newRestoreModel() restoreModel {
	points, err := loadRestorePoints()
	return restoreModel{points: points, height: 20, err: err}
}

func loadRestorePoints() ([]restorePoint, error) {
	indexPath := filepath.Join(".contextplus", "checkpoints", "index.json")
	data, err := os.ReadFile(indexPath)
	if err != nil {
		return nil, err
	}
	var points []restorePoint
	if err := json.Unmarshal(data, &points); err != nil {
		return nil, err
	}
	sort.Slice(points, func(i, j int) bool {
		return points[i].Timestamp > points[j].Timestamp
	})
	return points, nil
}

func (m restoreModel) Init() tea.Cmd { return nil }

func (m restoreModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "esc", "backspace":
			return newDashboard(), nil
		case "up", "k":
			m.cursor = Clamp(m.cursor-1, 0, MaxInt(0, len(m.points)-1))
			if m.cursor < m.scroll {
				m.scroll = m.cursor
			}
		case "down", "j":
			m.cursor = Clamp(m.cursor+1, 0, MaxInt(0, len(m.points)-1))
			if m.cursor >= m.scroll+m.height {
				m.scroll = m.cursor - m.height + 1
			}
		case "enter", "r":
			if len(m.points) > 0 && m.cursor < len(m.points) {
				m.restored = m.points[m.cursor].ID
			}
		}
	case tea.WindowSizeMsg:
		m.height = msg.Height - 8
	}
	return m, nil
}

func (m restoreModel) View() string {
	s := TitleStyle.Render("Restore Points") + "\n\n"
	if m.restored != "" {
		s += SuccessStyle.Render(fmt.Sprintf("Selected: %s (use MCP to restore)", m.restored)) + "\n\n"
	}
	if m.err != nil {
		s += ErrorStyle.Render(fmt.Sprintf("Error: %v", m.err)) + "\n"
		s += DimStyle.Render("No checkpoints found. Use checkpoint tool to create restore points.") + "\n"
	} else if len(m.points) == 0 {
		s += DimStyle.Render("No restore points found.") + "\n"
	} else {
		end := MinInt(m.scroll+m.height, len(m.points))
		for i := m.scroll; i < end; i++ {
			p := m.points[i]
			ts := time.Unix(p.Timestamp/1000, 0).Format("2006-01-02 15:04:05")
			line := fmt.Sprintf("%s | %s | %d file(s)", p.ID[:8], ts, len(p.Files))
			if p.Message != "" {
				line += " | " + truncate(p.Message, 30)
			}
			if i == m.cursor {
				s += SelectedStyle.Render("> "+line) + "\n"
			} else {
				s += DimStyle.Render("  "+line) + "\n"
			}
		}
	}
	s += "\n" + HelpStyle.Render("↑/k up • ↓/j down • enter/r select • esc back • q quit")
	return s
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-3] + "..."
}

func RunRestore() {
	p := tea.NewProgram(newRestoreModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}
