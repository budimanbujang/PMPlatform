// Compact markdown renderer — handles the subset Claude actually produces
// in insight/report body text. Intentionally small and dependency-free;
// good enough for one-paragraph-to-a-few-sections Claude output.
//
// Supported syntax:
//   # / ## / ### headings
//   - or * unordered lists
//   1. / 2. / … ordered lists
//   **bold** / __bold__
//   *italic* / _italic_
//   `inline code`
//   > blockquote
//   [link text](https://...)
//   blank line paragraph breaks
//   line-break within a paragraph (two trailing spaces or single newline)
//
// For anything more elaborate, reach for `react-markdown` — not worth the
// dependency until we hit the limits of this parser.

import React from "react";
import { cn } from "@/lib/utils";

export function Markdown({ children, className }: { children: string; className?: string }) {
  if (!children) return null;
  return (
    <div className={cn("prose-pmo text-[13px] leading-[1.55] space-y-2", className)}>
      {renderBlocks(children)}
    </div>
  );
}

// ─── blocks ───────────────────────────────────────────────────────────────
function renderBlocks(md: string): React.ReactNode[] {
  // Normalise line endings and trim whole-string whitespace.
  const src = md.replace(/\r\n/g, "\n").trim();
  const lines = src.split("\n");

  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // blank line → skip
    if (line.trim() === "") { i++; continue; }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      const cls = {
        1: "text-[18px] font-extrabold font-display tracking-tight",
        2: "text-[16px] font-bold font-display tracking-tight mt-3",
        3: "text-[14px] font-semibold mt-2",
        4: "text-[13px] font-semibold mt-2",
        5: "text-[12px] font-semibold mt-1",
        6: "text-[11px] font-semibold uppercase tracking-wider",
      }[level as 1 | 2 | 3 | 4 | 5 | 6];
      out.push(
        React.createElement(
          `h${level}`,
          { key: key++, className: cls },
          renderInline(text),
        ),
      );
      i++; continue;
    }

    // blockquote
    if (line.startsWith("> ")) {
      const lines2: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        lines2.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <blockquote key={key++} className="border-l-2 border-brand-500 pl-3 italic text-fg2">
          {renderInline(lines2.join(" "))}
        </blockquote>,
      );
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={key++} className="list-disc pl-5 space-y-1">
          {items.map((t, j) => (
            <li key={j}>{renderInline(t)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push(
        <ol key={key++} className="list-decimal pl-5 space-y-1">
          {items.map((t, j) => (
            <li key={j}>{renderInline(t)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // paragraph — consume until blank line
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !lines[i].startsWith("> ") &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    // Preserve single-line breaks within a paragraph as <br />.
    out.push(
      <p key={key++}>
        {paraLines.map((ln, j) => (
          <React.Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(ln)}
          </React.Fragment>
        ))}
      </p>,
    );
  }

  return out;
}

// ─── inline ───────────────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  // Pattern precedence matters — longest tokens first so ** isn't confused
  // with *.  Codes are handled first because their contents must be raw.
  const tokenRe =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)]+\))/;

  const out: React.ReactNode[] = [];
  let rest = text;
  let k = 0;

  while (rest.length > 0) {
    const m = rest.match(tokenRe);
    if (!m) {
      out.push(rest);
      break;
    }
    const idx = m.index ?? 0;
    if (idx > 0) out.push(rest.slice(0, idx));
    const tok = m[0];

    if (tok.startsWith("`")) {
      out.push(
        <code
          key={k++}
          className="rounded bg-bg-muted px-1 py-0.5 font-mono text-[0.92em]"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("__")) {
      out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("*")) {
      out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("_")) {
      out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("[")) {
      const [, label, href] = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/) ?? [];
      out.push(
        <a
          key={k++}
          href={href ?? "#"}
          className="underline underline-offset-2 hover:text-brand-600"
          target="_blank"
          rel="noopener noreferrer"
        >
          {label}
        </a>,
      );
    }

    rest = rest.slice(idx + tok.length);
  }

  return out;
}
