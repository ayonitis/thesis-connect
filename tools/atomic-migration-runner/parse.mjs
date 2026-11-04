import { splitSqlTokens, splitAndTrim } from './vendor/sql-split.ts';
import { pathToFileURL } from 'node:url';
export async function decodeUtf8Chunks(source) {
  const chunks = [];
  for await (const chunk of source) chunks.push(chunk);
  return new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = await decodeUtf8Chunks(process.stdin);
  const tokens = splitSqlTokens(input);
  process.stdout.write(JSON.stringify({statements: splitAndTrim(input), tokens}));
}
