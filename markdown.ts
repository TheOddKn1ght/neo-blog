import { decodeHTML } from "entities";
import { bundledLanguages, bundledLanguagesAlias, createHighlighter } from "shiki";
import type { BundledLanguage } from "shiki";

const options = {
  tables: true,
  strikethrough: true,
  tasklists: true,
  autolinks: true,
  hardSoftBreaks: false,
};

let highlighter: ReturnType<typeof createHighlighter> | undefined;
const languages = new Map<string, Promise<void>>();

async function highlight(code: string, language: string): Promise<string | undefined> {
  if (!Object.hasOwn(bundledLanguages, language) && !Object.hasOwn(bundledLanguagesAlias, language)) return;
  const engine = await (highlighter ??= createHighlighter({
    themes: ["github-light", "github-dark"], langs: [],
  }));
  let loading = languages.get(language);
  if (!loading) {
    loading = engine.loadLanguage(language as BundledLanguage);
    languages.set(language, loading);
  }
  await loading;
  return engine.codeToHtml(code, {
    lang: language,
    themes: { light: "github-light", dark: "github-dark" },
  });
}

/** Render Markdown first, then highlight block code without changing other markup. */
export async function renderMarkdown(markdown: string): Promise<string> {
  const html = Bun.markdown.html(markdown, options);
  const blocks: { code: string; language: string; eligible: boolean }[] = [];
  let current: (typeof blocks)[number] | undefined;
  await new HTMLRewriter()
    .on("pre", {
      element(element) {
        current = { code: "", language: "", eligible: false };
        blocks.push(current);
        element.onEndTag(() => { current = undefined; });
      },
    })
    .on("pre > code", {
      element(element) {
        if (!current) return;
        current.eligible = true;
        const classes = element.getAttribute("class") ?? "";
        current.language = /(?:^|\s)language-([^\s]+)/.exec(classes)?.[1]?.toLowerCase() ?? "";
      },
      text(chunk) { if (current) current.code += chunk.text; },
    })
    .transform(new Response(html)).text();

  const highlighted = await Promise.all(blocks.map((block) => block.eligible
    ? highlight(decodeHTML(block.code), block.language)
    : undefined));
  let index = 0;
  return new HTMLRewriter().on("pre", {
    element(element) {
      const block = blocks[index];
      const replacement = highlighted[index++];
      if (replacement) element.replace(replacement, { html: true });
      else if (block?.eligible) element.setAttribute("tabindex", "0");
    },
  }).transform(new Response(html)).text();
}
