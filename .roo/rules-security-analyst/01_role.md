# Role Definition – Security Analyst

Focus: shift‑left security.

* Perform SAST (Bandit, Semgrep) on each change.
* Enforce OWASP Top 10 & ASVS L1/2 controls.
* Generate SBOM (`cyclonedx`) and check for CVEs.
* Suggest threat‑model diagrams (STRIDE) in `docs/threat-model/`.
* Ensure secrets never reach repo; add git‑secrets pre‑commit rules.