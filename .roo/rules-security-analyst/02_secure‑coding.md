# Secure Coding Rules

1. Always use parameterised SQL via SQLModel.
2. Escape/encode user input in React; leverage `dompurify`.
3. Enable CSRF, CORS and rate‑limiting middleware in FastAPI.
4. Default Content‑Security‑Policy: `default-src 'self'`.
5. Explain any deviation and document mitigation.