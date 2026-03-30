// Tool error handling with actionable suggestions for recovery
// Maps common error patterns to user-friendly suggestions

export interface ToolError {
  tool: string;
  error: string;
  suggestion: string;
  alternatives?: string[];
}

const ERROR_PATTERNS: Array<{ pattern: RegExp; suggestion: (tool: string, match: RegExpMatchArray) => string; alternatives?: string[] }> = [
  {
    pattern: /ENOENT|no such file|file not found/i,
    suggestion: (tool) => `File or directory not found. Try 'tree' to see available files, or 'init' to create .contextplus structure.`,
    alternatives: ["tree", "init"],
  },
  {
    pattern: /EACCES|permission denied/i,
    suggestion: () => `Permission denied. Check file permissions or run with elevated privileges.`,
  },
  {
    pattern: /embedding|ollama|connection refused|ECONNREFUSED/i,
    suggestion: () => `Embedding service unavailable. Ensure Ollama is running ('ollama serve') or use CONTEXTPLUS_EMBED_PROVIDER=openai with API key.`,
    alternatives: ["search with mode='keyword'"],
  },
  {
    pattern: /timeout|ETIMEDOUT/i,
    suggestion: (tool) => `Operation timed out. Try again or use a smaller scope. For search, try mode='keyword' to skip embeddings.`,
    alternatives: ["search with mode='keyword'"],
  },
  {
    pattern: /no memory|graph.*empty|no nodes/i,
    suggestion: () => `Memory graph is empty. Use 'create_memory' to add nodes or 'bulk_memory' to add multiple at once.`,
    alternatives: ["create_memory", "bulk_memory"],
  },
  {
    pattern: /no.*hub|hub.*not found/i,
    suggestion: () => `No hubs found. Create hubs in .contextplus/hubs/ or use 'init' to set up the project structure.`,
    alternatives: ["init", "create hub via CLI"],
  },
  {
    pattern: /no restore point|checkpoint.*not found/i,
    suggestion: () => `No restore points found. Use 'checkpoint' to create restore points before making changes.`,
    alternatives: ["checkpoint"],
  },
  {
    pattern: /tree-sitter|unsupported.*language|grammar/i,
    suggestion: () => `Language not supported by tree-sitter. File will be treated as plain text. Supported: ts, js, py, rs, go, java, c, cpp, etc.`,
  },
  {
    pattern: /json.*parse|invalid json|syntax error/i,
    suggestion: () => `Invalid JSON format. Check the file contents for syntax errors.`,
  },
  {
    pattern: /sqlite|database|db error/i,
    suggestion: () => `Database error. Try deleting .contextplus/embeddings/vectors.db and running 'init' again.`,
    alternatives: ["init"],
  },
];

export function formatToolError(tool: string, error: unknown): ToolError {
  const message = error instanceof Error ? error.message : String(error);
  
  for (const { pattern, suggestion, alternatives } of ERROR_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return { tool, error: message, suggestion: suggestion(tool, match), alternatives };
    }
  }

  return {
    tool,
    error: message,
    suggestion: `Unexpected error in '${tool}'. Check inputs and try again. Use 'tree' to verify project structure.`,
    alternatives: ["tree"],
  };
}

export function formatErrorResponse(toolError: ToolError): string {
  let response = `Error in ${toolError.tool}: ${toolError.error}\n\nSuggestion: ${toolError.suggestion}`;
  if (toolError.alternatives?.length) {
    response += `\n\nAlternatives: ${toolError.alternatives.join(", ")}`;
  }
  return response;
}

export async function withErrorHandling<T>(tool: string, fn: () => Promise<T>): Promise<T | string> {
  try {
    return await fn();
  } catch (error) {
    return formatErrorResponse(formatToolError(tool, error));
  }
}
