import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {sourceModule} from './source-loader.mjs';

function nodes(tree,type){
 if(!tree||typeof tree!=='object')return [];
 return [...(tree.type===type?[tree]:[]),...[tree.props?.children].flat(Infinity).flatMap(child=>nodes(child,type))];
}
function interactiveModule(path,mocks={}){
 const state=[];let cursor=0;
 const react={useId:()=>':test-password:',useState(initial){const slot=cursor++;if(!(slot in state))state[slot]=typeof initial==='function'?initial():initial;return [state[slot],value=>{state[slot]=typeof value==='function'?value(state[slot]):value}];}};
 const Component=sourceModule(path,{...mocks,react}).default;
 return props=>{cursor=0;return Component(props)};
}

test('both web password fields have identical controls and distinct linked labels',()=>{
 const PasswordField=sourceModule('components/password-field.tsx').default;
 const html=renderToStaticMarkup(createElement('form',null,
  createElement(PasswordField,{label:'პაროლი',lang:'ka',value:'',onChange:()=>{}}),
  createElement(PasswordField,{label:'გაიმეორე პაროლი',lang:'ka',value:'',onChange:()=>{}}),
 ));
 assert.equal([...html.matchAll(/class="password-field"/g)].length,2);
 assert.equal([...html.matchAll(/class="password-toggle"/g)].length,2);
 assert.equal([...html.matchAll(/placeholder="••••••••"/g)].length,2);
 assert.equal([...html.matchAll(/type="password"/g)].length,2);
 assert.equal([...html.matchAll(/autoComplete="new-password"/g)].length,2);
 assert.equal([...html.matchAll(/minLength="8"/g)].length,2);
 const ids=[...html.matchAll(/<input id="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(new Set(ids).size,2);
 for(const id of ids){assert.ok(html.includes(`for="${id}"`));assert.ok(html.includes(`aria-controls="${id}"`));}
});

test('web visibility toggle preserves the exact password and never submits or edits it',()=>{
 for(const lang of ['ka','en']){
  const render=interactiveModule('components/password-field.tsx');let edits=0;
  const props={label:lang==='ka'?'პაროლი':'Password',lang,value:' exact password ',onChange:()=>{edits++}};
  let tree=render(props),input=nodes(tree,'input')[0],toggle=nodes(tree,'button')[0];
  assert.equal(input.props.type,'password');assert.equal(toggle.props.type,'button');assert.equal(toggle.props['aria-pressed'],false);
  toggle.props.onClick();tree=render(props);input=nodes(tree,'input')[0];toggle=nodes(tree,'button')[0];
  assert.equal(input.props.type,'text');assert.equal(input.props.value,props.value);assert.equal(toggle.props['aria-pressed'],true);assert.ok(toggle.props['aria-label'].includes(lang==='ka'?'დამალვა':'Hide password'));
  toggle.props.onClick();tree=render(props);assert.equal(nodes(tree,'input')[0].props.type,'password');assert.equal(edits,0);
 }
});

test('visibility is independent for the first and confirmation field',()=>{
 const first=interactiveModule('components/password-field.tsx'),confirmation=interactiveModule('components/password-field.tsx');
 const props={label:'Password',lang:'en',value:'',onChange:()=>{}};
 nodes(first(props),'button')[0].props.onClick();
 assert.equal(nodes(first(props),'input')[0].props.type,'text');
 assert.equal(nodes(confirmation(props),'input')[0].props.type,'password');
});

test('native password controls toggle secure entry without changing content or layout',()=>{
 const styles={};const render=interactiveModule('mobile/src/PasswordInput.tsx',{
  'react-native':{View:'View',TextInput:'TextInput',Pressable:'Pressable',StyleSheet:{create:input=>Object.assign(styles,input)}},
  'react-native-svg':{__esModule:true,default:'svg',Path:'path',Circle:'circle'},
  './ui':{C:{ink:'#1E1B2E',muted:'#6F687D',lav:'#E3D8F1'},s:{input:{minHeight:54}}},
 });
 let edits=0;const props={label:'გაიმეორე პაროლი',ka:true,value:' native password ',onChange:()=>{edits++}};
 let tree=render(props),input=nodes(tree,'TextInput')[0];assert.equal(input.props.secureTextEntry,true);assert.equal(input.props.autoComplete,'new-password');
 const originalStyle=input.props.style;
 nodes(tree,'Pressable')[0].props.onPress();tree=render(props);input=nodes(tree,'TextInput')[0];
 assert.equal(input.props.secureTextEntry,false);assert.equal(input.props.value,props.value);assert.deepEqual(input.props.style,originalStyle);assert.equal(edits,0);
 assert.equal(styles.toggle.width,44);assert.equal(styles.toggle.height,44);
});
