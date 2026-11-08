import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const root=new URL('../',import.meta.url).pathname;
// Transpile the real source; replace external boundaries explicitly per test.
export function sourceModule(path,mocks={},cache=new Map()){
  const file=resolve(root,path);
  if(cache.has(file))return cache.get(file).exports;
  const target={exports:{}};cache.set(file,target);
  const output=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
  const realRequire=createRequire(file);
  new Function('require','module','exports',output)(id=>{
    if(id in mocks)return mocks[id];
    if(id.startsWith('.')||id.startsWith('@/')){
      const base=id.startsWith('@/')?resolve(root,id.slice(2)):resolve(dirname(file),id);
      const found=[base,base+'.ts',base+'.tsx'].find(p=>existsSync(p));
      if(found&&/\.tsx?$/.test(found))return sourceModule(found,mocks,cache);
      if(found)return realRequire(found);
    }
    return realRequire(id);
  },target,target.exports);
  return target.exports;
}
