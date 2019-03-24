import { SharedVariables } from './SharedVariables';
import { readFile } from 'fs';
import { Section, parseContent as parseContentCobertura } from 'cobertura-parse';
import * as path from 'path';
import { TestResult } from './TestResult';
import { stringify } from 'querystring';

export class TestInfo {
  public constructor(
    public readonly succeed: boolean,
    public readonly name: string,
    public readonly lines: Set<number>,
  ) {}
}

export class TestResults {
  public constructor(private readonly _shared: SharedVariables) {}

  private _results: Map<string, TestResult> = new Map<string, TestResult>();
  private _filemap: Map<string, Set<TestInfo>>;

  public queryFile(filename: string): Set<TestInfo> {
    let ret = this._filemap.get(filename);
    while (ret == undefined && filename.indexOf('\\') >= 0) {
      filename = filename.substring(filename.indexOf('\\') + 1);
      ret = this._filemap.get(filename);
    }
    return ret;
  }

  public removeResultsForFile(filename: string): void {
    let ret = this._filemap.get(filename);
    while (ret == undefined && filename.indexOf('\\') >= 0) {
      filename = filename.substring(filename.indexOf('\\') + 1);
      ret = this._filemap.get(filename);
    }
    this._filemap.delete(filename);
  }

  public clearResults(): void {
    this._results = new Map<string, TestResult>();
    this._filemap = new Map<string, Set<TestInfo>>();
  }

  public async addTestResult(testResult: TestResult): Promise<void> {
    testResult.resolve();
    this._results.set(testResult.name, testResult);
    await this.refreshFileMap();
    this._shared.testCodeLens.reload();
  }
  private async refreshFileMap(): Promise<void> {
    var _tmpMap: Map<string, Set<TestInfo>> = new Map<string, Set<TestInfo>>();
    for (let entry of this._results.entries()) {
      for (let section of entry[1].sections.entries()) {
        var testInfo: Set<TestInfo> = _tmpMap.get(section[0]);
        if (!testInfo) testInfo = new Set<TestInfo>();
        testInfo.add(new TestInfo(entry[1].succeed, entry[0], entry[1].sections.get(section[0])));
        _tmpMap.set(section[0], testInfo);
      }
    }
    this._filemap = _tmpMap;
  }
}
