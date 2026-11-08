import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const appRoot = new URL("../.next/server/app/", import.meta.url);
const sourceRoot = new URL("../", import.meta.url);

async function loadComponent(path, mocks = {}) {
  const url = new URL(path,sourceRoot);
  const source = await readFile(url,'utf8');
  const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const realRequire=createRequire(url);
  const target={exports:{}};
  new Function('require','module','exports',compiled)(id=>id in mocks?mocks[id]:realRequire(id),target,target.exports);
  return target.exports.default;
}

test('cycle education renders age-specific context and preserves unusual observed intervals',async()=>{
  const Component=await loadComponent('components/cycle-education.tsx');
  const periods=['2026-01-01','2026-01-19','2026-04-04'].map(start=>({start,duration:5}));
  const html=renderToStaticMarkup(createElement(Component,{periods,birthDate:'2000-01-01',lang:'en'}));
  assert.match(html,/shortest 18 days; longest 75 days/);
  assert.match(html,/not a definition of normal/);
  assert.match(html,/FIGO uses a reference interval of 24–38 days/);
  assert.match(html,/4 start dates/);
  assert.match(html,/not a diagnosis/);
});

test('journey enforces sign-in, shows load errors and routes actionable steps',async()=>{
  let health={loaded:true,session:null,error:'',data:{periods:[],logs:[]}};
  const Component=await loadComponent('components/guided-journey.tsx',{
    '@/app/use-health-state':{useHealthState:()=>health},
    'next/link':{default:({children,...props})=>createElement('a',props,children)},
  });
  const render=()=>renderToStaticMarkup(createElement(Component,{lang:'en'}));
  assert.match(render(),/Sign in to see your journey/);
  health={...health,session:{user:{id:'test'}}};
  assert.match(render(),/href="\/app\/dashboard"/);
  assert.match(render(),/0\/3 completed cycles/);
  assert.doesNotMatch(render(),/✓ Completed/);
  health={...health,error:'unavailable'};
  assert.match(render(),/Could not load your entries/);
  assert.doesNotMatch(render(),/0\/3/);
});

test("registration, login and recovery routes render usable auth forms", async () => {
  const [register, login, forgot, reset] = await Promise.all([
    readFile(new URL("register.html", appRoot), "utf8"),
    readFile(new URL("login.html", appRoot), "utf8"),
    readFile(new URL("forgot-password.html", appRoot), "utf8"),
    readFile(new URL("reset-password.html", appRoot), "utf8"),
  ]);

  assert.match(register, /შექმენი ანგარიში|Create your account/);
  assert.match(register, /name@example\.com/);
  assert.match(register, /ანგარიშის შექმნა|Create account/);
  assert.match(register, /ელფოსტა \(მომხმარებლის სახელი\)|Email \(username\)/);
  assert.match(register, /სახელი|First name/);
  assert.match(register, /გვარი|Last name/);
  assert.doesNotMatch(register, /ნიკნეიმი|Nickname/);
  assert.match(register, /დაბადების თარიღი|Date of birth/);
  assert.match(register, /გაიმეორე პაროლი|Confirm password/);
  assert.match(register,/href="\/privacy"/);assert.match(register,/href="\/terms"/);
  assert.equal([...register.matchAll(/class="password-toggle"/g)].length,2);
  assert.equal([...login.matchAll(/class="password-toggle"/g)].length,1);
  assert.equal([...reset.matchAll(/class="password-toggle"/g)].length,2);
  assert.equal([...forgot.matchAll(/class="password-toggle"/g)].length,0);
  assert.match(login, /კეთილი იყოს შენი დაბრუნება|Welcome back/);
  assert.match(login, /ელფოსტა|Email/);
  assert.match(login, /შესვლა|Sign in/);
  assert.match(login, /forgot-password/);
  assert.match(forgot, /პაროლის აღდგენა|Reset your password/);
  assert.match(forgot, /name@example\.com/);
  assert.match(reset, /ახალი პაროლი|Choose a new password/);
  assert.match(reset, /გაიმეორე ახალი პაროლი|Confirm new password/);
});

test("auth forms call Supabase sign-up, password sign-in and recovery", async () => {
  const page = await readFile(new URL("app/inner-page.tsx", sourceRoot), "utf8");
  const mobile = await readFile(new URL("mobile/App.tsx", sourceRoot), "utf8");
  const client = await readFile(new URL("lib/supabase-browser.ts", sourceRoot), "utf8");

  assert.match(page, /onSubmit=\{submit\}/);
  assert.match(page, /signUp\(\{email:email\.trim\(\)\.toLowerCase\(\),password/);
  for (const source of [page, mobile]) {
    assert.match(source, /first_name:\s*firstName\.trim\(\)/);
    assert.match(source, /last_name:\s*lastName\.trim\(\)/);
    assert.doesNotMatch(source, /nickname:nickname\.trim\(\)/);
    assert.match(source, /date_of_birth:\s*birthDate/);
    assert.match(source, /პაროლები არ ემთხვევა ერთმანეთს|Passwords do not match/);
    assert.match(source, /validBirthDate\(birthDate\)/);
  }
  assert.match(page, /signInWithPassword\(\{email:email\.trim\(\)\.toLowerCase\(\),password\}\)/);
  assert.match(page, /resetPasswordForEmail\(/);
  assert.match(page, /updateUser\(\{password\}\)/);
  assert.match(page, /type="submit"/);
  assert.match(page, /Confirm your email|გამოგზავნილი ბმული/);
  assert.match(client, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
});

test("all expected primary platform routes are present in the production build", async () => {
  const routes = [
    "index.html",
    "register.html",
    "login.html",
    "forgot-password.html",
    "reset-password.html",
    "app/dashboard.html",
    "app/log.html",
    "app/insights.html",
    "app/report.html",
    "app/settings.html",
    "premium.html",
    "blog.html",
    "community.html",
    "market/orders.html",
    "tools/period-calculator.html",
    "tools/ovulation-calculator.html",
  ];

  await Promise.all(routes.map((route) => readFile(new URL(route, appRoot))));
});

test("community page exposes topics and the post composer", async () => {
  const html = await readFile(new URL("community.html", appRoot), "utf8");
  const source = await readFile(new URL("app/community/community-page.tsx", sourceRoot), "utf8");
  const admin = await readFile(new URL("components/admin-feature-panel.tsx", sourceRoot), "utf8");
  const moderationApi = await readFile(new URL("app/api/admin/community-reports/route.ts", sourceRoot), "utf8");
  assert.match(html, /TUTA COMMUNITY/);
  assert.match(source, /community_posts/);
  assert.match(source, /community_comments/);
  assert.match(source, /community_reports/);
  assert.match(source, /საჩივარი/);
  assert.match(source, /verified_doctors/);
  assert.match(source, /რედაქტირება/);
  assert.match(source, /წაშლა/);
  assert.match(admin, /საზოგადოების საჩივრები/);
  assert.match(admin, /Reporter identity is not shown to admins/);
  assert.match(moderationApi, /verifyAdminSession/);
  assert.match(moderationApi, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(moderationApi, /reporter_id/);
});
