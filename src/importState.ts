import * as fs from "node:fs";
import * as path from "node:path";
import type * as vscode from "vscode";

/**
 * One-time import of the state saved by the extension this one was forked from
 * (pins, names, groups, colors...). VS Code keeps each extension's globalState
 * under its own ID, so a renamed extension starts empty. If `import.json` (an
 * object of globalState keys) sits in this extension's global storage folder,
 * its keys are copied into globalState and the file is renamed to `imported.json`.
 * Returns true when something was imported.
 */
export async function importLegacyState(context: vscode.ExtensionContext): Promise<boolean> {
  const dir = context.globalStorageUri.fsPath;
  const file = path.join(dir, "import.json");
  if (!fs.existsSync(file)) return false;
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  for (const [key, value] of Object.entries(data)) {
    if (context.globalState.get(key) === undefined) await context.globalState.update(key, value);
  }
  fs.renameSync(file, path.join(dir, "imported.json"));
  return true;
}
