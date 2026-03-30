// Dashboard TUI - main interactive menu for Context+ CLI
// Provides navigation to tree, hubs, restore, memory views

package ui

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
)

type dashboardModel struct {
	choices  []string
	cursor   int
	selected int
}

func newDashboard() dashboardModel {
	return dashboardModel{
		choices: []string{
			"Context Tree",
			"Feature Hubs",
			"Restore Points",
			"Memory Graph",
			"ACP Sessions",
			"Code Structure",
			"Create Hub",
			"Quit",
		},
	}
}

func (m dashboardModel) Init() tea.Cmd { return nil }

func (m dashboardModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "up", "k":
			m.cursor = Clamp(m.cursor-1, 0, len(m.choices)-1)
		case "down", "j":
			m.cursor = Clamp(m.cursor+1, 0, len(m.choices)-1)
		case "enter", " ":
			m.selected = m.cursor
			switch m.cursor {
			case 0:
				return newTreeModel(), nil
			case 1:
				return newHubsModel(), nil
			case 2:
				return newRestoreModel(), nil
			case 3:
				return newMemoryModel(), nil
			case 4:
				return newSessionsModel(), nil
			case 5:
				return newCodeStructureModel(), nil
			case 6:
				return newCreateHubModel(), nil
			case 7:
				return m, tea.Quit
			}
		}
	}
	return m, nil
}

func (m dashboardModel) View() string {
	s := TitleStyle.Render("Context+ Dashboard") + "\n\n"
	for i, choice := range m.choices {
		cursor := "  "
		style := DimStyle
		if m.cursor == i {
			cursor = "> "
			style = SelectedStyle
		}
		s += fmt.Sprintf("%s%s\n", cursor, style.Render(choice))
	}
	s += "\n" + HelpStyle.Render("↑/k up • ↓/j down • enter select • q quit")
	return s
}

func RunDashboard() {
	p := tea.NewProgram(newDashboard())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}
