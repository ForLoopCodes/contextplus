// Core TUI types and shared styling for Context+ CLI views
// Provides common lipgloss styles and model interfaces

package ui

import "github.com/charmbracelet/lipgloss"

var (
	TitleStyle    = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("205"))
	HeaderStyle   = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("39"))
	SelectedStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("170"))
	DimStyle      = lipgloss.NewStyle().Foreground(lipgloss.Color("241"))
	HelpStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("241"))
	ErrorStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("196"))
	SuccessStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("82"))
)

func MaxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func MinInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func Clamp(val, minVal, maxVal int) int {
	return MinInt(MaxInt(val, minVal), maxVal)
}
