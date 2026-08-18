import type {
  Root,
  Table,
  TableCell,
  TableRow,
} from "mdast";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { unified } from "unified";

export function parseMarkdown(
  markdown: string,
): Root {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(markdown) as Root;
}

export function nodeText(node: any): string {
  if (!node) {
    return "";
  }

  if (typeof node === "string") {
    return node;
  }

  if (typeof node.value === "string") {
    return node.value;
  }

  if (node.children) {
    return node.children
      .map(nodeText)
      .join("");
  }

  return "";
}

export function clean(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .trim();
}

export function tableRows(
  table: Table,
): string[][] {
  return (table.children as TableRow[]).map(
    (row) =>
      row.children.map(
        (cell: TableCell) =>
          clean(nodeText(cell)),
      ),
  );
}

export function parseNumber(
  value: string,
): number | null {
  const match = value
    .replace(/,/g, "")
    .match(/-?\d+(?:\.\d+)?/);

  if (!match) {
    return null;
  }

  const n = Number(match[0]);

  return Number.isFinite(n) ? n : null;
}

export async function fetchMarkdown(
  url: string,
): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "unified-llm-pricing/1.0",
      Accept:
        "text/plain,text/markdown,text/html;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ` +
      `${response.status} ${response.statusText}`,
    );
  }

  const content = await response.text();

  if (content.length < 500) {
    throw new Error(
      `${url} returned unexpectedly little content`,
    );
  }

  return content;
}