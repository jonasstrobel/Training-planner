# Coaching principles library

Drop documents you want the coach to follow into this directory.

Supported formats:

- `.pdf` — text-based PDFs only (scanned image-only PDFs won't
  produce useful text).
- `.txt` — plain text.
- `.md` — Markdown.

The server reads every file in this folder on each coach call,
concatenates their text with a `## <filename>` header, and prepends
the result to the coach's system prompt. Anthropic prompt caching is
used so repeated calls don't re-pay the tokens.

Examples of good content:

- Transcripts or distilled notes of Alan Couzens, Gordo Byrn,
  Steve Magness articles.
- Tweet compilations (paste them into a `.md` file).
- Your own rules ("Never more than one Z5 session per week", etc.).

When the coach applies a specific principle it is told to cite the
file name, e.g. "From `couzens-aerobic-base.pdf`: …".
