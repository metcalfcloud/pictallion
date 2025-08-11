# Pictallion – AI-Powered Photo Management

---

## Overview

Pictallion is a modern, AI-powered photo management platform featuring intelligent tiered photo processing, face recognition, advanced search, collections management, and batch operations. It runs as a desktop app via Tauri (Rust backend) and a browser-based React frontend.

---

## Features

- **Tiered Processing:** Bronze (raw), Silver (AI-enriched), Gold (curated)
- **AI Integration:** Local (Ollama) and cloud (OpenAI) support for metadata and tagging
- **Face Recognition:** Organize and search photos by detected people
- **Advanced Search:** Filter by date, camera, tags, AI confidence, and more
- **Collections & Albums:** Custom organization for your media
- **Batch Operations:** Bulk tagging, organizing, exporting, and AI processing
- **Modern UI:** Responsive, drag-and-drop uploads, real-time updates

---

## Quick Start

### Prerequisites

- mise task runner (manages Node 22 and Rust stable)
- Optional: Ollama (local AI), OpenAI API key

### Installation & Development

All common development tasks are automated using `mise` tasks defined in `.mise.toml` at the project root.

```bash
git clone https://github.com/yourusername/pictallion.git
cd pictallion
mise install
mise run setup
mise run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Project Structure

```
pictallion/
├── frontend/                 # React app (TypeScript, Tailwind CSS)
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── hooks/            # Custom React hooks
│   │   └── lib/              # Utilities and API client
├── src-tauri/                # Rust backend (Tauri)
│   ├── src-tauri/            # Rust source and config
│   ├── src/                  # Static assets and HTML entrypoint
├── shared/                   # Shared TypeScript types
├── data/                     # Photo storage (bronze/silver/gold)
├── scripts/                  # Build and CI scripts
├── docs/                     # Documentation
```

---

## Development & Testing

- **Setup:** `mise run setup`
- **Dev server:** `mise run dev`
- **Build:** `mise run build`
- **Lint:** `mise run lint`
- **Unit tests:** `mise run test`
- **E2E tests:** See [`frontend/tests/README.md`](frontend/tests/README.md:1)
- **Playwright/Puppeteer:** See [`frontend/tests/README.md`](frontend/tests/README.md:1)

All workflows are automated via the project `.mise.toml` tasks.

---

## Configuration

Environment variables are managed via `.env` files. See `.env.example` for required settings.

- **AI Providers:** Configure Ollama and/or OpenAI API keys as needed.
- **Photo Storage:** Images are organized in `data/media/bronze`, `data/media/silver`, and `data/media/gold`.

---

## Documentation

- [API Documentation](API_DOCUMENTATION.md:1)
- [Architecture](ARCHITECTURE.md:1)
- [Deployment](DEPLOYMENT.md:1)
- [Development](DEVELOPMENT.md:1)
- [Contributing](CONTRIBUTING.md:1)
- [Security](SECURITY.md:1)

---

## License

MIT – see [`LICENSE`](LICENSE:1)

---

## Support

- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/pictallion/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/pictallion/discussions)

---

## Acknowledgments

- [Ollama](https://ollama.ai) for local AI
- [OpenAI](https://openai.com) for cloud AI
- [Shadcn/ui](https://ui.shadcn.com) for UI components
- [Lucide](https://lucide.dev) for icons

---

Made with ❤️ for photographers and photo enthusiasts
