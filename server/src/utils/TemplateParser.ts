import { existsSync, statSync, readFileSync } from 'fs';

const templateVarsRegEx = /\{\{'([A-Za-z0-9]+?)'\}\}/g;

type ParseCallback = (e: Error | null, res?: string) => void;
type TemplateData = { [key: string]: string };

type LoadProps = {
  path?: string;
  data?: TemplateData;
  cb?: ParseCallback;
};

type ParseProps = {
  key?: string;
  template: string;
  data?: TemplateData;
  cb?: ParseCallback;
};

type CompiledProps = {
  cb?: ParseCallback;
  data?: TemplateData;
};

export class TemplateParser {
  static cache: Map<string, TemplateParser> = new Map();

  static async load(opts: LoadProps): Promise<string | TemplateParser> {
    const { path, data, cb } = opts;
    return new Promise(async (resolve, reject) => {
      if (!path && !data?.path) reject(new Error('No path provided.'));
      if (!existsSync(path || data!.path)) reject(new Error(`File ${path} does not exist.`));
      if (statSync(path || data!.path).isDirectory()) reject(new Error(`Path ${path || data!.path} is a folder.`));

      const template = readFileSync(path || data!.path).toString();
      const parser = new TemplateParser(template, path, data);

      if (!data || data.compile) resolve(TemplateParser.cache.set(path || data!.path, parser).get(path || data!.path)!);
      else if (!cb) resolve(parser.parse());
      else await parser.parse().then(r => cb(null, r)).catch(cb);
    });
  }

  static async parse(opts: ParseProps): Promise<string | TemplateParser> {
    const { key, template, data, cb } = opts;
    return new Promise(async (resolve, reject) => { {
      const parser = new TemplateParser(template, key, data);
      
      if ((!data || data.compile) && key) resolve(TemplateParser.cache.set(key, parser).get(key)!);
      else if (!cb) resolve(parser.parse());
      else await parser.parse().then(r => cb(null, r)).catch(cb);
    }})
  }

  constructor(private template: string, private path?: string, private data?: TemplateData) {}

  async parse(opts?: CompiledProps): Promise<string> {
    const { cb, data } = opts as CompiledProps;
    return this.template;
  }
}