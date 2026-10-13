# Learn Erlang Step-by-Step

An interactive tutorial website for learning Erlang by building a WebSocket chat server from scratch. This project teaches Erlang through hands-on coding, progressing from basic syntax to building a production-ready distributed chat system.

## 🎯 What You'll Build

Through 40 progressive lessons, you'll build a complete WebSocket chat server while learning:

- Erlang fundamentals and functional programming
- OTP (Open Telecom Platform) patterns
- Concurrent and distributed systems
- Real-time communication with WebSockets
- Production deployment and operations

## ✨ Features

- **Interactive Koans**: Fill-in-the-blank exercises with immediate feedback
- **Progressive Learning**: Each lesson builds on the previous ones
- **Real Project**: Build an actual chat server, not just toy examples
- **Modern UI**: Dark/light mode, syntax highlighting, progress tracking
- **Responsive Design**: Works great on desktop and mobile
- **Fast Search**: Quick lesson search with keyboard shortcuts (Cmd/Ctrl+K)

## 🚀 Getting Started

### Prerequisites

- Node.js 22
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/eastbranchsoftware/learn-erlang.git
cd learn-erlang

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:4321
```

### Building for Production

```bash
# Type check and build
npm run build

# Preview production build
npm run preview
```

## 📝 Contributing

We welcome contributions! Here's how you can help:

### Reporting Issues

- Check existing issues first
- Use issue templates when available
- Include browser/OS information for UI issues
- Provide code examples for content issues

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run type checking: `npx astro check`
5. Commit with clear messages: `git commit -m "Add: your feature"`
6. Push to your fork: `git push origin feature/your-feature`
7. Open a pull request

### Content Guidelines

When contributing lessons or koans:

- Follow the existing lesson structure
- Keep examples practical and building toward the chat server
- Write clear, concise explanations
- Include 6-8 koans per lesson testing key concepts
- Test all code examples
- Follow the writing style in existing lessons

### Koan Guidelines

When creating or modifying koans:

1. **Single Blank Rule**: Every koan MUST have exactly one `___` blank
2. **Clear Questions**: Questions should be specific about what goes in the blank
3. **Simple Answers**: Answers should be single values, expressions, or identifiers (not comma-separated lists)
4. **Test Coverage**: All koan patterns MUST have corresponding tests in `js-erlang-interpreter/tests/`
5. **Validation Types**: Use appropriate validation hints:
   - `value_check`: For numeric or string values
   - `pattern_check`: For pattern matching scenarios
   - Default: Simple string comparison

Run the koan tests with `cd js-erlang-interpreter && npm test`. The `lesson-koans` suite reads every koan straight from the `.mdx` files, so new lessons are covered automatically. Use `LESSONS=12,13 node tests/lesson-koans.test.js` to check specific lessons. If `escript` is on your PATH, koans from lesson 8 on are also checked against a real Erlang VM:

- The koan code with the answer filled in must parse and compile, so end every expression with a full stop and do not add shell prompts.
- A `% => Term` comment after an expression is an assertion. The expression is evaluated and its result must equal `Term`.
- Every code block in a lesson that starts with `-module(` must compile on its own.

Example koan structure:

```javascript
{
  id: "unique_koan_id",
  question: "What value makes this base case work?",
  code: "Factorial = fun\n    (0) -> ___;\n    (N) -> N * Factorial(N - 1)\nend.",
  answer: "1",
  validation: "value_check", // optional
  hint: "Think about 0! = ?", // optional
  explanation: "The factorial of 0 is defined as 1" // optional
}
```

### Code Style

- Use TypeScript for new components
- Follow existing formatting (2 space indentation)
- Keep components small and focused
- Add comments for complex logic

### Adding New Lessons

1. Create a new file in `src/content/lessons/`
2. Use the required frontmatter:

```markdown
---
title: "Your Lesson Title"
description: "Brief description"
postNumber: 36
publishDate: 2025-01-17T00:00:00Z
tags: ["erlang", "your-topic"]
difficulty: "intermediate"
prerequisites: [1, 2, 3]
---
```

3. Write content following the established pattern
4. Add interactive koans at the end
5. Test the lesson thoroughly

## 🏗️ Project Structure

```
src/
├── components/       # UI components
├── content/
│   ├── config.ts    # Content schema
│   └── lessons/     # Tutorial lessons
├── layouts/         # Page layouts
├── pages/           # Routes
└── styles/          # Global styles
```

## 🛠️ Tech Stack

- **Framework**: Astro
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Syntax Highlighting**: Expressive Code
- **Interactive Koans**: Custom Erlang interpreter

## 🧮 JavaScript Erlang Interpreter

The interactive koans are powered by a custom JavaScript-based Erlang interpreter located in `/js-erlang-interpreter`. This interpreter:

- Supports basic Erlang syntax for educational exercises
- Handles pattern matching, lists, atoms, and function calls
- Provides immediate feedback for learning
- Runs entirely in the browser for a seamless experience

### Current Limitations

The interpreter is designed for teaching basic concepts and currently supports:

- Simple pattern matching
- List operations
- Basic arithmetic and comparisons
- Atoms and tuples
- Simple function definitions

### Contributing to the Interpreter

The interpreter needs enhancement to support more advanced koans. Areas for improvement include:

- Map syntax and operations
- Process spawning and message passing
- More complex pattern matching scenarios
- Binary syntax
- Guards and list comprehensions
- Module system basics

**Testing Requirements**: When adding new koan patterns or interpreter features:

1. All koan patterns MUST have corresponding test cases in `js-erlang-interpreter/tests/`
2. Test files should follow the naming convention: `lessonXX-koans.test.js`
3. Each test should validate that the koan's expected answer produces the correct result
4. Run tests with `npm test` in the `js-erlang-interpreter` directory
5. Ensure all tests pass before submitting a PR

If you're interested in extending the interpreter, see `/js-erlang-interpreter/README.md` for implementation details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- The Erlang/OTP team for creating an amazing platform
- The Astro team for their fantastic framework
- All contributors who help improve this tutorial

## 🔗 Links

- [Live Site](https://learnerlang.com)
- [Report Issues](https://github.com/eastbranchsoftware/learn-erlang/issues)
- [Discussions](https://github.com/eastbranchsoftware/learn-erlang/discussions)

---

Built with ❤️ by East Branch Software and the Erlang Community
