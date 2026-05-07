# brewide

A browser-based Java IDE. Write, compile, and run Java code without installing anything — just open the page and start coding.
 
Live at **[brewide.onrender.com](https://brewide.onrender.com)**
 
---
 
## What it does
 
- Runs Java code in the browser via a Node.js + JDK 17 backend
- Custom canvas-based code editor with Java syntax highlighting
- Multi-tab support — open multiple files at once
- Built-in terminal that shows stdout, stderr, and compile errors
- Stdin input so you can test programs that read user input
- Debug panel that surfaces compile errors with line numbers
- Minimap for navigating longer files
- Dark and light theme
- New file dialog with a starter template
## Stack
 
- **Frontend** — vanilla HTML/CSS/JS, no frameworks, editor built on `<canvas>`
- **Backend** — Node.js HTTP server
- **Java** — OpenJDK 17 (installed in the Docker image)
- **Deployment** — Docker on Render
## Just want to use it?
 
No setup needed — the deployed version is live at **[brewide.onrender.com](https://brewide.onrender.com)**. Open it and start writing Java straight away.
 
## Running locally
 
You'll need Node.js and Java (JDK 11+) installed.
 
```bash
git clone https://github.com/your-username/BrewIDE.git
cd BrewIDE
npm start
```
 
Then open `http://localhost:5454`.
 
## Running with Docker
 
```bash
docker compose up --build
```
 
The app will be available at `http://localhost:3000`.
 
## How execution works
 
When you hit Run, the frontend sends your code to `POST /execute`. The server writes it to a temp directory, compiles it with `javac`, runs it with `java`, and streams back stdout/stderr/exit code as JSON. The temp directory is cleaned up after each run.
 
## Project structure
 
```
BrewIDE/
├── index.html          # Entire frontend (editor, UI, themes)
├── server.js           # Node HTTP server + Java execution
├── DockerFile
├── docker-compose.yml
└── package.json
```
 
## Keyboard shortcuts
 
| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New file |
| `Ctrl+A` | Select all |
| `Ctrl+X` | Cut selection |
| `Ctrl+C` | Copy |
| `Ctrl+V` | Paste |
 
---
