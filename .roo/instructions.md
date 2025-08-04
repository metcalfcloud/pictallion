# RooCode Python Environment Instructions

**Always follow these steps for Python development and automation:**

1. **Activate the virtual environment before running any Python commands:**
   - On Windows (use separate commands, do NOT use &&):
     ```
     cd server_py
     .venv\Scripts\activate
     ```
   - On Unix/macOS:
     ```
     cd server_py
     source .venv/bin/activate
     ```

2. **Run all Python commands from the correct working directory:**
   - Make sure you are in the `server_py` directory when running scripts, tests, or installing packages.

3. **Package installation:**
   - Always use the activated virtual environment for `pip install` and other package management commands.

4. **Testing and linting:**
   - Run `pytest` and `mypy` only after activating the virtual environment and setting the working directory to `server_py`.

5. **General rule:**
   - If you encounter errors related to missing packages or Python path issues, verify your working directory and virtual environment activation.

**Note:** On Windows, do NOT chain commands with `&&`. Run each command separately in the terminal.
