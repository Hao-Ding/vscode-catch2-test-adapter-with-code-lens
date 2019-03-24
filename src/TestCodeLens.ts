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
      for (var i in symbols) {
        var symbol = symbols[i];
        var testPassed = 0;
        var testTotal = 0;
        var range = symbol['range'] as vscode.Range;
        var tooltip = '';
        var messageBox = '';
        for (let t of results) {
          for (let line of t.lines) {
            if (range.start.line <= line - 2 && range.end.line >= line - 2) {
              if (t.succeed) {
                tooltip += '✔ ' + t.name + '\n';
                testPassed++;
              } else {
                messageBox += '✘ ' + t.name + ' ';
                tooltip += '✘ ' + t.name + '\n';
              }
              testTotal++;
            }
          }
        }
        let c: vscode.Command = {
          command: 'extension.showTests',
          arguments: [testPassed == testTotal, messageBox],
          title:
            testPassed < testTotal
              ? '✘ Failed ' + (testTotal - testPassed) + ' / ' + testTotal
              : testTotal > 0
              ? '✔ Passed all (' + testTotal + ')'
              : '(Not tested)',
          tooltip: 'Tests:\n______________\n' + tooltip,
        };

        let codeLens = new vscode.CodeLens(range, c);
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
