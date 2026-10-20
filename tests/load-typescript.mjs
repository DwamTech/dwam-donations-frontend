import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const require = createRequire(import.meta.url);
const modules = new Map();
async function moduleUrl(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  let source;
  try { source = await readFile(url, "utf8"); }
  catch (error) {
    if (error.code !== "ENOENT" || !url.pathname.endsWith(".ts")) throw error;
    source = await readFile(new URL(url.href.replace(/\.ts$/, ".tsx")), "utf8");
  }
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } });
  for (const [, specifier] of outputText.matchAll(/from\s+["']([^"']+)["']/g)) {
    const target = specifier.startsWith("@/") ? new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url)
      : specifier.startsWith(".") ? new URL(`${specifier}.ts`, url) : null;
    const replacement = target ? await moduleUrl(target) : pathToFileURL(require.resolve(specifier)).href;
    outputText = outputText.replaceAll(`"${specifier}"`, JSON.stringify(replacement)).replaceAll(`'${specifier}'`, JSON.stringify(replacement));
  }
  const result = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
  modules.set(url.href, result);
  return result;
}
export async function loadTypescript(relative) {
  return import(await moduleUrl(new URL(relative, import.meta.url)));
}
