import { readConfigFile } from '../src/configfile';

const PATH = './config/config.yaml';
const fromString = (content: string) => () => content;

describe('readConfigFile', () => {
  it('returns the parsed settings for a valid file', () => {
    const result = readConfigFile(PATH, fromString("bot_token: 'abc'\nstaffchat_id: '-100'\n"));
    expect(result.problem).toBeUndefined();
    expect(result.config).toEqual({ bot_token: 'abc', staffchat_id: '-100' });
  });

  it('treats an empty or comments-only file as an empty config without a problem', () => {
    expect(readConfigFile(PATH, fromString(''))).toEqual({ config: {} });
    expect(readConfigFile(PATH, fromString('# nothing here\n'))).toEqual({ config: {} });
  });

  it('explains how to create the file when it is missing', () => {
    const result = readConfigFile(PATH, () => {
      throw Object.assign(new Error('nope'), { code: 'ENOENT' });
    });
    expect(result.config).toEqual({});
    expect(result.problem).toContain(`${PATH} not found`);
    expect(result.problem).toContain('config/config-sample.yaml');
  });

  it('reports other read errors by their code', () => {
    const result = readConfigFile(PATH, () => {
      throw Object.assign(new Error('denied'), { code: 'EACCES' });
    });
    expect(result.problem).toBe(`Config file ${PATH} could not be read (EACCES).`);
  });

  it('reports the line and column of a YAML syntax error', () => {
    const broken = "bot_token: '123:SECRET\nstaffchat_id: '-100'\nowner_id: x: y\n";
    const result = readConfigFile(PATH, fromString(broken));
    expect(result.config).toEqual({});
    expect(result.problem).toMatch(/not valid YAML: .*line \d+, column \d+\./);
  });

  it('never echoes file content such as the bot token in the problem message', () => {
    const broken = "bot_token: '123:SECRET'\nstaffchat_id: '-100'\n  owner_id: SECRET2\n";
    const result = readConfigFile(PATH, fromString(broken));
    expect(result.problem).toBeDefined();
    expect(result.problem).not.toContain('SECRET');
  });

  it('rejects a file whose top level is not a mapping', () => {
    expect(readConfigFile(PATH, fromString('- a\n- b\n')).problem)
      .toContain('found a list');
    expect(readConfigFile(PATH, fromString('just text\n')).problem)
      .toContain('found a single value');
  });
});
