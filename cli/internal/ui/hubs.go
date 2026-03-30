// Hubs view TUI - displays feature hubs from .contextplus/hubs
// Lists hub markdown files with wikilinks and descriptions

package ui

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

type hub struct {
	name    string
	path    string
	links   []string
	feature string
}

type hubsModel struct {
	hubs   []hub
	cursor int
	scroll int
	height int
	err    error
}

func newHubsModel() hubsModel {
	hubs, err := loadHubs()
	return hubsModel{hubs: hubs, height: 20, err: err}
}

func loadHubs() ([]hub, error) {
	hubsDir := filepath.Join(".contextplus", "hubs")
	entries, err := os.ReadDir(hubsDir)
	if err != nil {
		return nil, err
	}
	var hubs []hub
	linkRe := regexp.MustCompile(`\[\[([^\]|]+)(?:\|[^\]]+)?\]\]`)
	featureRe := regexp.MustCompile(`(?i)FEATURE:\s*(.+)`)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}
		path := filepath.Join(hubsDir, entry.Name())
		content, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		text := string(content)
		matches := linkRe.FindAllStringSubmatch(text, -1)
		var links []string
		for _, m := range matches {
			links = append(links, m[1])
		}
		feature := ""
		if fm := featureRe.FindStringSubmatch(text); len(fm) > 1 {
			feature = strings.TrimSpace(fm[1])
		}
		hubs = append(hubs, hub{
			name:    strings.TrimSuffix(entry.Name(), ".md"),
			path:    path,
			links:   links,
			feature: feature,
		})
	}
	return hubs, nil
}

func (m hubsModel) Init() tea.Cmd { return nil }

func (m hubsModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "esc", "backspace":
			return newDashboard(), nil
		case "up", "k":
			m.cursor = Clamp(m.cursor-1, 0, MaxInt(0, len(m.hubs)-1))
			if m.cursor < m.scroll {
				m.scroll = m.cursor
			}
		case "down", "j":
			m.cursor = Clamp(m.cursor+1, 0, MaxInt(0, len(m.hubs)-1))
			if m.cursor >= m.scroll+m.height {
				m.scroll = m.cursor - m.height + 1
			}
		}
	case tea.WindowSizeMsg:
		m.height = msg.Height - 6
	}
	return m, nil
}

func (m hubsModel) View() string {
	s := TitleStyle.Render("Feature Hubs") + "\n\n"
	if m.err != nil {
		s += ErrorStyle.Render(fmt.Sprintf("Error: %v", m.err)) + "\n"
		s += DimStyle.Render("Run 'contextplus init' to create .contextplus/hubs/") + "\n"
	} else if len(m.hubs) == 0 {
		s += DimStyle.Render("No hubs found in .contextplus/hubs/") + "\n"
		s += DimStyle.Render("Create a hub with 'contextplus create-hub'") + "\n"
	} else {
		end := MinInt(m.scroll+m.height, len(m.hubs))
		for i := m.scroll; i < end; i++ {
			h := m.hubs[i]
			line := fmt.Sprintf("%s (%d links)", h.name, len(h.links))
			if h.feature != "" {
				line += " - " + h.feature
			}
			if i == m.cursor {
				s += SelectedStyle.Render("> "+line) + "\n"
			} else {
				s += DimStyle.Render("  "+line) + "\n"
			}
		}
	}
	s += "\n" + HelpStyle.Render("↑/k up • ↓/j down • esc back • q quit")
	return s
}

func RunHubs() {
	p := tea.NewProgram(newHubsModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}
