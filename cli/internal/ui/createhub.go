// Create hub view TUI - interactive hub creation for humans
// Allows creating new feature hubs with wikilinks and descriptions

package ui

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type createHubModel struct {
	inputs   []textinput.Model
	focusIdx int
	err      error
	created  bool
	hubPath  string
}

func newCreateHubModel() createHubModel {
	inputs := make([]textinput.Model, 3)

	inputs[0] = textinput.New()
	inputs[0].Placeholder = "my-feature"
	inputs[0].Focus()
	inputs[0].CharLimit = 64
	inputs[0].Width = 40
	inputs[0].Prompt = "Hub name: "

	inputs[1] = textinput.New()
	inputs[1].Placeholder = "Description of the feature"
	inputs[1].CharLimit = 200
	inputs[1].Width = 60
	inputs[1].Prompt = "Feature: "

	inputs[2] = textinput.New()
	inputs[2].Placeholder = "src/file.ts, src/other.ts"
	inputs[2].CharLimit = 500
	inputs[2].Width = 60
	inputs[2].Prompt = "Links: "

	return createHubModel{inputs: inputs}
}

func (m createHubModel) Init() tea.Cmd {
	return textinput.Blink
}

func (m createHubModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "esc":
			if m.created {
				return newDashboard(), nil
			}
			return newDashboard(), nil
		case "tab", "down":
			m.focusIdx = (m.focusIdx + 1) % len(m.inputs)
			return m.updateFocus()
		case "shift+tab", "up":
			m.focusIdx = (m.focusIdx - 1 + len(m.inputs)) % len(m.inputs)
			return m.updateFocus()
		case "enter":
			if m.focusIdx == len(m.inputs)-1 {
				return m.createHub()
			}
			m.focusIdx = (m.focusIdx + 1) % len(m.inputs)
			return m.updateFocus()
		}
	}
	cmd := m.updateInputs(msg)
	return m, cmd
}

func (m *createHubModel) updateFocus() (tea.Model, tea.Cmd) {
	cmds := make([]tea.Cmd, len(m.inputs))
	for i := range m.inputs {
		if i == m.focusIdx {
			cmds[i] = m.inputs[i].Focus()
		} else {
			m.inputs[i].Blur()
		}
	}
	return m, tea.Batch(cmds...)
}

func (m *createHubModel) updateInputs(msg tea.Msg) tea.Cmd {
	cmds := make([]tea.Cmd, len(m.inputs))
	for i := range m.inputs {
		m.inputs[i], cmds[i] = m.inputs[i].Update(msg)
	}
	return tea.Batch(cmds...)
}

func (m createHubModel) createHub() (tea.Model, tea.Cmd) {
	name := strings.TrimSpace(m.inputs[0].Value())
	feature := strings.TrimSpace(m.inputs[1].Value())
	links := strings.TrimSpace(m.inputs[2].Value())

	if name == "" {
		m.err = fmt.Errorf("hub name is required")
		return m, nil
	}

	hubsDir := filepath.Join(".contextplus", "hubs")
	if err := os.MkdirAll(hubsDir, 0755); err != nil {
		m.err = err
		return m, nil
	}

	hubPath := filepath.Join(hubsDir, name+".md")
	var content strings.Builder
	content.WriteString(fmt.Sprintf("# %s\n\n", name))
	if feature != "" {
		content.WriteString(fmt.Sprintf("FEATURE: %s\n\n", feature))
	}
	if links != "" {
		content.WriteString("## Linked Files\n\n")
		for _, link := range strings.Split(links, ",") {
			link = strings.TrimSpace(link)
			if link != "" {
				content.WriteString(fmt.Sprintf("- [[%s]]\n", link))
			}
		}
	}

	if err := os.WriteFile(hubPath, []byte(content.String()), 0644); err != nil {
		m.err = err
		return m, nil
	}

	m.created = true
	m.hubPath = hubPath
	return m, nil
}

func (m createHubModel) View() string {
	s := TitleStyle.Render("Create Feature Hub") + "\n\n"

	if m.created {
		s += SuccessStyle.Render(fmt.Sprintf("Hub created: %s", m.hubPath)) + "\n\n"
		s += HelpStyle.Render("Press esc to return to dashboard")
		return s
	}

	if m.err != nil {
		s += ErrorStyle.Render(fmt.Sprintf("Error: %v", m.err)) + "\n\n"
	}

	for i, input := range m.inputs {
		s += input.View() + "\n"
		if i < len(m.inputs)-1 {
			s += "\n"
		}
	}

	s += "\n" + HelpStyle.Render("tab next • shift+tab prev • enter submit/next • esc cancel")
	return s
}

func RunCreateHub() {
	p := tea.NewProgram(newCreateHubModel())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}
