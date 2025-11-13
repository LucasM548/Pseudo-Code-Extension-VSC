import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { transpiler } from './transpiler';

export function executeCode(document: vscode.TextDocument) {
    const pscCode = document.getText();
    const luaCode = transpiler.transpile(pscCode);

    console.log("--- Code Lua généré ---\n", luaCode, "\n--------------------------");

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `psc_temp_${Date.now()}.lua`);
    fs.writeFileSync(tempFilePath, luaCode);

    const terminalName = "Pseudo-Code Execution";
    let terminal = vscode.window.terminals.find(t => t.name === terminalName);
    if (!terminal) {
        terminal = vscode.window.createTerminal(terminalName);
    }
    terminal.show(true);

    const command = `lua "${tempFilePath}"`;
    terminal.sendText(command, true);
}
