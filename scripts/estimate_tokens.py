#!/usr/bin/env python3
import sys, re, math, pathlib

def estimate_tokens(text: str) -> int:
    # heuristic ~4 chars/token in English; fallback to word-based
    chars = len(text)
    words = len(re.findall(r"\w+", text))
    est_by_chars = math.ceil(chars / 4)
    est_by_words = math.ceil(words * 1.3)
    return min(est_by_chars, est_by_words)

def main(paths):
    total = 0
    for p in paths:
        path = pathlib.Path(p)
        for f in path.rglob("*"):
            if f.is_file() and f.suffix.lower() in {".md", ".txt", ""}:
                try:
                    text = f.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
                t = estimate_tokens(text)
                total += t
                print(f"{f}: ~{t} tokens")
    print(f"TOTAL (heuristic): ~{total} tokens")

if __name__ == "__main__":
    targets = sys.argv[1:] or [".roo/rules", ".roo/refs"]
    main(targets)
