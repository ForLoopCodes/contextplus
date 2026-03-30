// Code Structure TUI - displays AST analysis for selected file
// Shows imports, exports, and call graph using tree-sitter parsing

package ui

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

type codeStructureModel struct {
	files    []string
	cursor   int
	selected string
	content  string
	scroll   int
}

func newCodeStructureModel() codeStructureModel {
	files := discoverSourceFiles(".")
	return codeStructureModel{files: files}
}

func discoverSourceFiles(root string) []string {
	exts := []string{".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".c", ".cpp"}
	var files []string
	filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			if info != nil && info.IsDir() && (info.Name() == "node_modules" || info.Name() == ".git" || info.Name() == ".contextplus") {
				return filepath.SkipDir
			}
			return nil
		}
		for _, ext := range exts {
			if strings.HasSuffix(path, ext) {
				files = append(files, path)
				break
			}
		}
		return nil
	})
	if len(files) > 100 {
		files = files[:100]
	}
	return files
}

func analyzeFile(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Sprintf("Error reading file: %v", err)
	}
	content := string(data)
	lines := strings.Split(content, "\n")
	ext := filepath.Ext(path)

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# %s\n", path))
	sb.WriteString(fmt.Sprintf("Lines: %d | Extension: %s\n\n", len(lines), ext))

	imports := extractImportsSimple(content, ext)
	if len(imports) > 0 {
		sb.WriteString(fmt.Sprintf("## Imports (%d)\n", len(imports)))
		for _, imp := range imports {
			sb.WriteString(fmt.Sprintf("  %s\n", imp))
		}
		sb.WriteString("\n")
	}

	exports := extractExportsSimple(content, ext)
	if len(exports) > 0 {
		sb.WriteString(fmt.Sprintf("## Exports (%d)\n", len(exports)))
		for _, exp := range exports {
			sb.WriteString(fmt.Sprintf("  %s\n", exp))
		}
		sb.WriteString("\n")
	}

	funcs := extractFunctionsSimple(content, ext)
	if len(funcs) > 0 {
		sb.WriteString(fmt.Sprintf("## Functions (%d)\n", len(funcs)))
		for _, fn := range funcs {
			sb.WriteString(fmt.Sprintf("  %s\n", fn))
		}
	}

	return sb.String()
}

func extractImportsSimple(content, ext string) []string {
	var imports []string
	var re *regexp.Regexp
	switch ext {
	case ".ts", ".tsx", ".js", ".jsx":
		re = regexp.MustCompile(`(?m)^import\s+.*from\s+['"]([^'"]+)['"]`)
	case ".py":
		re = regexp.MustCompile(`(?m)^(?:from\s+(\S+)\s+import|import\s+(\S+))`)
	case ".go":
		re = regexp.MustCompile(`(?m)"([^"]+)"`)
	case ".rs":
		re = regexp.MustCompile(`(?m)^use\s+([^;]+);`)
	default:
		return imports
	}
	matches := re.FindAllStringSubmatch(content, -1)
	for _, m := range matches {
		for i := 1; i < len(m); i++ {
			if m[i] != "" {
				imports = append(imports, m[i])
				break
			}
		}
	}
	return imports
}

func extractExportsSimple(content, ext string) []string {
	var exports []string
	var re *regexp.Regexp
	switch ext {
	case ".ts", ".tsx", ".js", ".jsx":
		re = regexp.MustCompile(`(?m)^export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)`)
	case ".py":
		re = regexp.MustCompile(`(?m)^(?:def|class)\s+(\w+)`)
	case ".go":
		re = regexp.MustCompile(`(?m)^(?:func|type)\s+([A-Z]\w*)`)
	case ".rs":
		re = regexp.MustCompile(`(?m)^pub\s+(?:fn|struct|enum|trait)\s+(\w+)`)
	default:
		return exports
	}
	matches := re.FindAllStringSubmatch(content, -1)
	for _, m := range matches {
		if len(m) > 1 {
			exports = append(exports, m[1])
		}
	}
	return exports
}

func extractFunctionsSimple(content, ext string) []string {
	var funcs []string
	var re *regexp.Regexp
	switch ext {
	case ".ts", ".tsx", ".js", ".jsx":
		re = regexp.MustCompile(`(?m)(?:function|async\s+function)\s+(\w+)|(\w+)\s*[:=]\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)`)
	case ".py":
		re = regexp.MustCompile(`(?m)^(?:def|async\s+def)\s+(\w+)`)
	case ".go":
		re = regexp.MustCompile(`(?m)^func\s+(?:\([^)]+\)\s+)?(\w+)`)
	case ".rs":
		re = regexp.MustCompile(`(?m)fn\s+(\w+)`)
	case ".java":
		re = regexp.MustCompile(`(?m)(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(`)
	default:
		return funcs
	}
	matches := re.FindAllStringSubmatch(content, -1)
	for _, m := range matches {
		for i := 1; i < len(m); i++ {
			if m[i] != "" {
				funcs = append(funcs, m[i])
				break
			}
		}
	}
	return funcs
}

func (m codeStructureModel) Init() tea.Cmd { return nil }

func (m codeStructureModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "esc", "b":
			if m.selected != "" {
				m.selected = ""
				m.content = ""
				m.scroll = 0
				return m, nil
			}
			return newDashboard(), nil
		case "up", "k":
			if m.selected != "" {
				m.scroll = Clamp(m.scroll-1, 0, 100)
			} else {
				m.cursor = Clamp(m.cursor-1, 0, len(m.files)-1)
			}
		case "down", "j":
			if m.selected != "" {
				m.scroll++
			} else {
				m.cursor = Clamp(m.cursor+1, 0, len(m.files)-1)
			}
		case "enter", " ":
			if m.selected == "" && len(m.files) > 0 {
				m.selected = m.files[m.cursor]
				m.content = analyzeFile(m.selected)
			}
		}
	}
	return m, nil
}

func (m codeStructureModel) View() string {
	if m.selected != "" {
		lines := strings.Split(m.content, "\n")
		start := Clamp(m.scroll, 0, len(lines)-1)
		end := Clamp(start+20, 0, len(lines))
		visible := strings.Join(lines[start:end], "\n")
		return TitleStyle.Render("Code Structure: "+m.selected) + "\n\n" + visible + "\n\n" + HelpStyle.Render("↑/k ↓/j scroll • b/esc back • q quit")
	}

	s := TitleStyle.Render("Code Structure Analysis") + "\n\n"
	if len(m.files) == 0 {
		s += DimStyle.Render("No source files found")
	} else {
		start := Clamp(m.cursor-5, 0, len(m.files)-1)
		end := Clamp(start+12, 0, len(m.files))
		for i := start; i < end; i++ {
			cursor := "  "
			style := DimStyle
			if m.cursor == i {
				cursor = "> "
				style = SelectedStyle
			}
			s += fmt.Sprintf("%s%s\n", cursor, style.Render(m.files[i]))
		}
	}
	s += "\n" + HelpStyle.Render("↑/k ↓/j nav • enter select • b back • q quit")
	return s
}

func RunCodeStructure() {
	p := tea.NewProgram(newCodeStructureModel())
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}
