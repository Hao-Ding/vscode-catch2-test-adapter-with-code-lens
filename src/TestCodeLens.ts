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
    public testPassed: number = 0,
    public testTotal: number = 0,
    public line: vscode.Range,
    public failedList: string,
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
        var testPassed = 0;
        var testTotal = 0;
        var range = symbol['range'] as vscode.Range;
        var failedList = '';
        for (let t of results) {
          for (let line of t.lines) {
            if (range.start.line <= line - 2 && range.end.line >= line - 2) {
              if (t.succeed) testPassed++;
              else failedList += '✘ ' + t.name + ' ';
              testTotal++;
            }
          }
        }
        info.push(new SymbolData(symbol['name'], symbol['containerName'], testPassed, testTotal, range, failedList));
      }
      for (var iter: number = info.length - 1; iter >= 0; iter--) {
        if (info[iter].owningName != undefined) {
          for (var item in info) {
            if (info[item].name == info[iter].owningName) {
              info[item].testPassed += info[iter].testPassed;
              info[item].testTotal += info[iter].testTotal;
              info[item].failedList += info[iter].failedList;
            }
          }
        }
      }
      for (var item in info) {
        let c: vscode.Command = {
          command: 'extension.showTests',
          arguments: [info[item].testPassed == info[item].testTotal, info[item].failedList],
          title:
            info[item].testPassed < info[item].testTotal
              ? '✘ Failed ' + (info[item].testTotal - info[item].testPassed) + ' / ' + info[item].testTotal
              : info[item].testTotal > 0
              ? '✔ Passed all (' + info[item].testTotal + ')'
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
