// Sessions view TUI - displays imported ACP sessions from external agents
// Reads from .contextplus/external_memories/sessions.json

package ui

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

type acpSession struct {
	ID        string `json:"id"`
	Source    string `json:"source"`
	Timestamp int64  `json:"timestamp"`
	Title     string `json:"title"`
	Messages  []struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"messages"`
}

type sessionsModel struct {
	sessions []acpSession
	cursor   int
	scroll   int
	height   int
	err      error
	filter   string
}

func newSessionsModel() sessionsModel {
	sessions, err := loadACPSessions()
	return sessionsModel{sessions: sessions, height: 20, err: err}
}

func loadACPSessions() ([]acpSession, error) {
	path := filepath.Join(".contextplus", "external_memories", "sessions.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var sessions []acpSession
	if err := json.Unmarshal(data, &sessions); err != nil {
		return nil, err
	}
	return sessions, nil
}

func (m sessionsModel) Init() tea.Cmd { return nil }

func (m sessionsModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "esc", "backspace":
			return newDashboard(), nil
		case "up", "k":
			m.cursor = Clamp(m.cursor-1, 0, MaxInt(0, len(m.sessions)-1))
			if m.cursor < m.scroll {
				m.scroll = m.cursor
			}
		case "down", "j":
			m.cursor = Clamp(m.cursor+1, 0, MaxInt(0, len(m.sessions)-1))
			if m.cursor >= m.scroll+m.height {
				m.scroll = m.cursor - m.height + 1
			}
		case "1":
			m.filter = "opencode"
			m.cursor, m.scroll = 0, 0
		case "2":
			m.filter = "copilot"
			m.cursor, m.scroll = 0, 0
		case "3":
			m.filter = "claude"
			m.cursor, m.scroll = 0, 0
		case "4":
			m.filter = "codex"
			m.cursor, m.scroll = 0, 0
		case "0":
			m.filter = ""
			m.cursor, m.scroll = 0, 0
		}
	case tea.WindowSizeMsg:
		m.height = msg.Height - 8
	}
	return m, nil
}

func (m sessionsModel) filtered() []acpSession {
	if m.filter == "" {
		return m.sessions
	}
	var out []acpSession
	for _, s := range m.sessions {
		if s.Source == m.filter {
			out = append(out, s)
		}
	}
	return out
}

func (m sessionsModel) View() string {
	s := TitleStyle.Render("ACP Sessions") + "\n"
	if m.filter != "" {
		s += DimStyle.Render(fmt.Sprintf("Filter: %s", m.filter)) + "\n"
	}
	s += "\n"

	if m.err != nil {
		s += ErrorStyle.Render(fmt.Sprintf("Error: %v", m.err)) + "\n"
		s += DimStyle.Render("Use import_acp tool to import agent sessions.") + "\n"
	} else {
		filtered := m.filtered()
		if len(filtered) == 0 {
			s += DimStyle.Render("No sessions found.") + "\n"
		} else {
			end := MinInt(m.scroll+m.height, len(filtered))
			for i := m.scroll; i < end; i++ {
				sess := filtered[i]
				ts := time.Unix(sess.Timestamp/1000, 0).Format("2006-01-02")
				line := fmt.Sprintf("[%s] %s | %s (%d msgs)", sess.Source, sess.ID[:12], ts, len(sess.Messages))
				if sess.Title != "" {
					line += " | " + truncate(sess.Title, 25)
				}
				if i == m.cursor {
					s += SelectedStyle.Render("> "+line) + "\n"
				} else {
					s += DimStyle.Render("  "+line) + "\n"
				}
			}
		}
	}
	s += "\n" + HelpStyle.Render("1-4 filter source • 0 clear • ↑/k ↓/j nav • esc back • q quit")
	return s
}

func RunSessions() {
	p := tea.NewProgram(newSessionsModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}
