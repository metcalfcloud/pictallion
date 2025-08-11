# Pictallion Tauri Backend

This directory contains the Rust-based Tauri backend for the Pictallion application. It provides desktop integration, secure APIs, and bridges the frontend (located in `frontend/`) with system-level capabilities.

## Architecture

- **Language:** Rust
- **Framework:** [Tauri](https://tauri.app/)
- **Configuration:** [`src-tauri/src-tauri/tauri.conf.json`](src-tauri/src-tauri/tauri.conf.json:1), [`src-tauri/src-tauri/Cargo.toml`](src-tauri/src-tauri/Cargo.toml:1)
- **Logging:** Uses [`tauri-plugin-log`](https://docs.rs/tauri-plugin-log/) for runtime logging (see [`Cargo.toml`](src-tauri/src-tauri/Cargo.toml:1)).
- **Frontend Integration:** The backend launches and communicates with the frontend, built separately in the `frontend/` directory.

## Setup

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (version specified in Cargo.toml)
- [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/)
- [Tauri CLI](https://tauri.app/v2/guides/getting-started/setup/)
- Recommended IDE: [VS Code](https://code.visualstudio.com/) with [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) and [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

### Install Dependencies

```sh
# Install Rust toolchain
rustup update

# Install Tauri CLI globally
npm install tauri

# Install frontend dependencies
cd ../frontend
npm install
```

## Development

### Run in Development Mode

This will start both the frontend and backend for local development:

```sh
# From the project root
mise run dev
```

Or manually:

```sh
cd frontend
npm run dev

cd ../src-tauri
cargo tauri dev
```

### Build for Production

```sh
cd frontend
npm run build

cd ../src-tauri
cargo tauri build
```

## Maintenance

- **Configuration:** Update settings in [`tauri.conf.json`](src-tauri/src-tauri/tauri.conf.json:1).
- **Dependencies:** Manage Rust dependencies in [`Cargo.toml`](src-tauri/src-tauri/Cargo.toml:1) and frontend dependencies in `frontend/package.json`.
- **Logging:** Adjust log levels in [`src-tauri/src-tauri/src/lib.rs`](src-tauri/src-tauri/src/lib.rs:1) if needed.
- **Testing:** Rust unit tests are located in [`src-tauri/src-tauri/src/lib.rs`](src-tauri/src-tauri/src/lib.rs:18).

## File Structure

- [`src-tauri/src-tauri/`](src-tauri/src-tauri/): Rust backend configuration
- [`src-tauri/src-tauri/src/`](src-tauri/src-tauri/src/): Rust backend source code
- [`src-tauri/src/`](src-tauri/src/): Static assets and HTML entrypoint
- [`frontend/`](frontend/): Frontend application

## Additional Resources

- [Tauri Documentation](https://tauri.app/v2/)
- [Rust Documentation](https://doc.rust-lang.org/book/)
