import { inspect } from 'util';
import * as vscode from 'vscode';
import {
  TestInfo,
  TestSuiteInfo,
  TestEvent,
  TestLoadFinishedEvent,
  TestLoadStartedEvent,
  TestRunFinishedEvent,
  TestRunStartedEvent,
  TestSuiteEvent,
} from 'vscode-test-adapter-api';
import * as api from 'vscode-test-adapter-api';
import * as util from 'vscode-test-adapter-util';

import { RootTestSuiteInfo } from './RootTestSuiteInfo';
import { resolveVariables, generateUniqueId } from './Util';
import { TaskQueue } from './TaskQueue';
import { TestExecutableInfo } from './TestExecutableInfo';
import { SharedVariables } from './SharedVariables';
import { AbstractTestInfo } from './AbstractTestInfo';
import { Catch2Section, Catch2TestInfo } from './Catch2TestInfo';
import { AbstractTestSuiteInfo } from './AbstractTestSuiteInfo';
import { CodeLensProvider } from 'vscode';

class SymbolData {
  public constructor(
    public name: string,
    public owningName: string,
    public testPassed: Set<string>,
    public testTotal: Set<string>,
    public line: vscode.Range,
  ) {}
}
export class TestCodeLensProvider implements vscode.CodeLensProvider {
  public constructor(private readonly _shared: SharedVariables) {}

  public async showTests(succeed: boolean, test: string): Promise<void> {
    if (succeed) vscode.window.showInformationMessage('Passed all tests!');
    else vscode.window.showErrorMessage('Failed: ' + test);
  }

  public async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    let symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);
    if (this._shared.isCodeLens) {
      var results = this._shared.testResults.queryFile(document.fileName);
      var ret: vscode.CodeLens[] = [];
      var info: SymbolData[] = [];
      for (var i in symbols) {
        var symbol = symbols[i];
        var testPassed: Set<string> = new Set<string>();
        var testTotal: Set<string> = new Set<string>();
        var range = symbol['range'] as vscode.Range;
        for (let t of results) {
          for (let line of t.lines) {
            if (range.start.line <= line - 2 && range.end.line >= line - 2) {
              if (t.succeed) testPassed.add(t.name);
              testTotal.add(t.name);
            }
          }
        }
        info.push(new SymbolData(symbol['name'], symbol['containerName'], testPassed, testTotal, range));
      }
      for (var iter: number = info.length - 1; iter >= 0; iter--) {
        if (info[iter].owningName != undefined) {
          for (var item in info) {
            if (info[item].name == info[iter].owningName) {
              for (let t of info[iter].testPassed) info[item].testPassed.add(t);
              for (let t of info[iter].testTotal) info[item].testTotal.add(t);
            }
          }
        }
      }
      for (var item in info) {
        var failed = '';
        for (let t of info[item].testTotal) {
          if (!info[item].testPassed.has(t)) failed += ' ✘ ' + t;
        }
        if (failed == '') failed = '✔ All passed!';
        if (info[item].testTotal.size == 0) failed = '(Not tested)';
        let c: vscode.Command = {
          command: 'extension.showTests',
          arguments: [info[item].testPassed.size == info[item].testTotal.size, failed],
          title:
            info[item].testPassed.size < info[item].testTotal.size
              ? '✘ Failed ' +
                (info[item].testTotal.size - info[item].testPassed.size) +
                ' / ' +
                info[item].testTotal.size +
                ' tests'
              : info[item].testTotal.size > 0
              ? '✔ Passed all tests (' + info[item].testTotal.size + ')'
              : '(Not tested)',
        };

        let codeLens = new vscode.CodeLens(info[item].line, c);
        ret.push(codeLens);
      }
      return ret;
    }
  }
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public get onDidChangeCodeLenses(): vscode.Event<void> {
    return this._onDidChangeCodeLenses.event;
  }
  public async reload(): Promise<void> {
    this._onDidChangeCodeLenses.fire();
  }
}
