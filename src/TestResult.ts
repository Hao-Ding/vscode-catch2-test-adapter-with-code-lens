import { SharedVariables } from './SharedVariables';
import { readFileSync } from 'fs';
import { Section, parseContent as parseContentCobertura } from 'cobertura-parse';
import { TestInfo } from 'vscode-test-adapter-api';
import { AbstractTestInfo } from './AbstractTestInfo';

export class TestResult {
  public constructor(
    private readonly _shared: SharedVariables,
    public readonly succeed: boolean,
    test: string | TestInfo,
  ) {
    if (typeof test == 'string') this.name = test as string;
    else this.name = (test as AbstractTestInfo).testNameFull;
  }

  public sections: Map<string, Set<number>>;
  public readonly name: string;
  private _data: Buffer;

  public resolve(): void {
    this._data = readFileSync(this._shared.context.storagePath + '/test-result/' + this.name + '.xml');
    this.parse(this._data.toString());
  }

  private parse(data: string): void {
    parseContentCobertura(data, async (err, result: Section[]) => {
      var ret: Map<string, Set<number>> = new Map<string, Set<number>>();
      const addPromises = result.map(async section => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let lines = section['lines']['details'] as any[];
        let data = new Set<number>();
        for (let i in lines) {
          if (lines[i]['hit'] != '0') data.add(parseInt(lines[i]['line'].toString()));
        }
        ret.set(section.file, data);
      });
      this.sections = ret;
    });
  }
}
