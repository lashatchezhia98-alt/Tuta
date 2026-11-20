import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { sourceModule } from './source-loader.mjs';

const appRoot = new URL("../.next/server/app/", import.meta.url);
const sourceRoot = new URL("../", import.meta.url);

test("article search matches either language's title or body and respects category", () => {
  const { filterLibrary } = sourceModule("lib/library-search.ts");
  const article = { category: "pregnancy", title_ka: "ორსულობა", title_en: "Pregnancy", body_ka: "კვირეული", body_en: "Clinician due date" };
  assert.deepEqual(filterLibrary([article], "pregnancy", "  CLINICIAN  "), [article]);
  assert.deepEqual(filterLibrary([article], "", "კვირეული"), [article]);
  assert.deepEqual(filterLibrary([article], "cycle", "Pregnancy"), []);
});

test("the period summary shows the same forecast ranges and symbols as the calendar, with one primary action", () => {
  const { periodCalendarModel, calendarRangeLabel } = sourceModule("mobile/src/cycle.mjs");
  const CycleOverview = sourceModule("components/cycle-overview.tsx", {
    "@/components/site-copy-provider": { SiteCopyText: ({ id }) => id },
  }).default;
  const periods = ["2026-01-10", "2026-02-07", "2026-03-07", "2026-04-04"].map(start => ({ start, duration: 5 }));
  const calendar = periodCalendarModel({ periods, cycleLength: 30 }, "2026-04-29");
  const opened = [];
  const props = { periods, cycleLength: 30, lang: "ka", calendar, onMark: () => opened.push("mark") };
  const html = renderToStaticMarkup(createElement(CycleOverview, props));
  assert.match(html, /ციკლის დღე: 26/);
  assert.match(html, /data-mark="predicted"[\s\S]*მოსალოდნელი პერიოდი[\s\S]*data-mark="fertile"[\s\S]*სავარაუდო ნაყოფიერი დღეები/);
  for (const window of [calendar.nextWindow, calendar.nextFertileWindow]) assert.ok(html.includes(calendarRangeLabel(window.start, window.end, true)));
  function buttons(node) {
    if (!node || typeof node !== "object") return [];
    return node.type === "button" ? [node] : [node.props?.children].flat(Infinity).flatMap(buttons);
  }
  for (const button of buttons(CycleOverview(props))) button.props.onClick();
  assert.deepEqual(opened, ["mark"]);
});

test("activity inbox is a separate member destination from announcements", async () => {
  const [activity, notices] = await Promise.all([
    readFile(new URL("app/activity.html", appRoot), "utf8"),
    readFile(new URL("app/notifications.html", appRoot), "utf8"),
  ]);
  assert.match(activity, /href="\/app\/notifications"/);
  assert.match(activity, /იტვირთება/);
  assert.notEqual(activity, notices);
});

test("every bilingual shared service has a real built web page", async () => {
  const { serviceGroups, serviceCopyKey } = sourceModule("lib/service-directory.ts");
  const { getCopyText, emptyCopy } = sourceModule("lib/site-copy.ts");
  const items = serviceGroups.flatMap(group => group.items);
  const paths = items.map(([href]) => href);
  assert.equal(paths.length, 24);
  assert.equal(new Set(paths).size, paths.length);
  const manifest = JSON.parse(await readFile(new URL("../.next/server/app-paths-manifest.json", import.meta.url), "utf8"));
  const prerender = JSON.parse(await readFile(new URL("../.next/prerender-manifest.json", import.meta.url), "utf8"));
  for (const path of paths) assert.ok(manifest[`${path}/page`] || prerender.routes[path], `Missing web destination: ${path}`);
  for (const path of paths) for (const lang of ["ka", "en"]) {
    assert.ok(getCopyText(emptyCopy(), serviceCopyKey(path), lang));
    assert.ok(getCopyText(emptyCopy(), serviceCopyKey(path) + ".detail", lang));
  }
  assert.ok(!serviceGroups.some(group => group.id === "planned"));
  assert.ok(serviceGroups.find(group => group.id === "track").items.some(([path]) => path === "/app/symptom-checker"));
  assert.ok(serviceGroups.find(group => group.id === "account").items.some(([path]) => path === "/app/account-deletion"));
  assert.equal(items.filter(item => item[5] === "premium").length, 5);
});

test("Premium compares both tiers and mobile navigation keeps services in the burger menu", async () => {
  const { getCopyText, emptyCopy } = sourceModule("lib/site-copy.ts");
  const sharedComparison = sourceModule("lib/premium-comparison.ts");
  let disabledDoctor = false;
  const Comparison = await loadComponent("components/premium-comparison.tsx", {
    "@/lib/premium-comparison": sharedComparison,
    "@/lib/site-features": { useSiteFeatures: () => ({ doctorConsultation: !disabledDoctor }), useSiteFeaturesStatus: () => "ready" },
    "@/components/site-copy-provider": {
      SiteCopyText: ({ id, lang }) => createElement("span", { "data-site-copy": id }, getCopyText(emptyCopy(), id, lang)),
    },
    "./premium-comparison.module.css": { __esModule: true, default: {} },
  });
  for (const [lang, free, premium, unavailable] of [
    ["ka", "უფასო", "პრემიუმი", "არ შედის გეგმაში"],
    ["en", "Free", "Premium", "Not included"],
  ]) {
    const table = renderToStaticMarkup(createElement(Comparison, { lang }));
    assert.match(table, /<table[^>]+aria-labelledby="premium-comparison-title"/);
    assert.ok(table.includes(`data-site-copy="premium.compare.free">${free}`));
    assert.ok(table.includes(`data-site-copy="premium.compare.paid">${premium}`));
    assert.ok(table.includes(unavailable));
    assert.equal([...table.matchAll(/scope="row"/g)].length, 11);
    assert.doesNotMatch(table, /premium\.compare\.report|ანგარიში ექიმისთვის|Report for your doctor/);
  }
  assert.equal(sharedComparison.premiumComparisonFeatures.filter(row => row.free).length, 6);
  disabledDoctor = true;
  const paused = renderToStaticMarkup(createElement(Comparison, { lang: "en" }));
  assert.equal([...paused.matchAll(/colSpan="2"[^>]*><span[^>]*>Currently unavailable/g)].length, 2);
  const native = await readFile(new URL("mobile/src/ServiceScreens.tsx", sourceRoot), "utf8");
  assert.match(native, /premiumComparisonFeatures\.map/);
  assert.match(native, /<PremiumComparison lang=\{lang\} \/>/);
  const html = await readFile(new URL("premium.html", appRoot), "utf8");
  const nav = html.match(/<nav class="mobile-app-tabbar".*?<\/nav>/)?.[0];
  assert.ok(nav);
  assert.equal([...nav.matchAll(/class="mobile-app-tab(?: |")/g)].length, 4);
  assert.doesNotMatch(nav, /href="\/app\/features"/);
  assert.match(nav, /href="\/app\/dashboard"[^]*href="\/community"[^]*href="\/market"[^]*href="\/app\/settings"/);
  assert.equal([...nav.matchAll(/class="mobile-app-tab-label"/g)].length, 3);
});

test("Tuta brand points to the start on web and in the native header", async () => {
  const [home, inner, community, mobile] = await Promise.all(
    ["app/page.tsx", "app/inner-page.tsx", "app/community/community-page.tsx", "mobile/App.tsx"]
      .map(path => readFile(new URL(path, sourceRoot), "utf8")),
  );
  assert.match(home, /<Link href="\/" onNavigate=/);
  assert.match(home, /router\.replace\("\/app\/dashboard"\)/);
  assert.match(inner, /function InnerLogo[^\n]*href="\/"/);
  assert.match(community, /<Link href="\/" className="inner-logo">\s*<BrandMark/);
  assert.match(mobile, /"Tuta home"\)[^]*?else nav\(initialTab\)/);
});

test("doctor onboarding has a return route and scopes both workspaces to their own patient work", async () => {
  const [html, workspace, mobile, auth] = await Promise.all([
    readFile(new URL("consultation/doctor.html", appRoot), "utf8"),
    readFile(new URL("components/care-workspace.tsx", sourceRoot), "utf8"),
    readFile(new URL("mobile/src/ServiceScreens.tsx", sourceRoot), "utf8"),
    readFile(new URL("app/inner-page.tsx", sourceRoot), "utf8"),
  ]);
  const { authDestination } = sourceModule("lib/auth-destination.ts");
  assert.match(html, /ექიმის კაბინეტი/);
  assert.equal(authDestination("?next=%2Fconsultation%2Fdoctor"), "/consultation/doctor");
  assert.match(auth, /doctorInvitation&&!onAuthenticated\)/);
  assert.match(auth, /"\/consultation\/doctor\/setup"/);
  assert.match(workspace, /data && \(!doctorWorkspace \|\| data\.isDoctor\)/);
  assert.match(workspace, /t\.doctor_id === data\.userId/);
  assert.match(workspace, /b\.consultation_slots\?\.doctor_id === data\.userId/);
  assert.match(mobile, /t\.doctor_id === session\.user\.id/);
  assert.match(mobile, /b\.consultation_slots\?\.doctor_id === session\.user\.id/);
});

test("privacy offers password changes with current-password verification and a safe sign-in return", async () => {
  const [privacy, terms, source] = await Promise.all([
    readFile(new URL("privacy.html", appRoot), "utf8"),
    readFile(new URL("terms.html", appRoot), "utf8"),
    readFile(new URL("components/change-password.tsx", sourceRoot), "utf8"),
  ]);
  const { authDestination } = sourceModule("lib/auth-destination.ts");
  assert.match(privacy, /id="change-password"/);
  assert.doesNotMatch(terms, /id="change-password"/);
  assert.match(source, /auth\.updateUser\(\{ password, current_password: current \}\)/);
  assert.match(source, /password !== confirmation/);
  assert.equal(authDestination("?next=%2Fprivacy"), "/privacy");
  assert.equal(authDestination("?next=https%3A%2F%2Fexample.com%2Fprivacy"), "/app/dashboard");
});

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
  const Component=sourceModule('components/guided-journey.tsx',{
    '@/app/use-health-state':{useHealthState:()=>health},
    'next/link':{__esModule:true,default:({children,...props})=>createElement('a',props,children)},
  }).default;
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
  assert.match(register, /ელფოსტა|Email/);
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
  assert.match(login, /class="auth-register-link" href="\/register"[^>]*>[\s\S]*?(რეგისტრაცია|Register|Sign up)[\s\S]*?<\/a>[\s\S]*?<form/);
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
  assert.match(page, /id="auth\.verifyTitle"/);
  assert.match(page, /<EmailCodeForm /);
  assert.match(client, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
});

test("all expected primary platform routes are present in the production build", async () => {
  const routes = [
    "index.html",
    "admin/login.html",
    "admin/invite.html",
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
  assert.match(source, /id="feed\.edit"/);
  assert.match(source, /id="feed\.delete"/);
  assert.match(admin, /საზოგადოების საჩივრები/);
  assert.match(admin, /Reporter identity is not shown to admins/);
  assert.match(moderationApi, /getAdminIdentity/);
  assert.match(moderationApi, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(moderationApi, /reporter_id/);
});

test("community topics are collapsible and filtered server-side; reported posts include their photo", async () => {
  const [web, mobile, admin, moderationApi, editPolicy] = await Promise.all([
    readFile(new URL("app/community/community-page.tsx", sourceRoot), "utf8"),
    readFile(new URL("mobile/src/CommunityFeed.tsx", sourceRoot), "utf8"),
    readFile(new URL("components/admin-feature-panel.tsx", sourceRoot), "utf8"),
    readFile(new URL("app/api/admin/community-reports/route.ts", sourceRoot), "utf8"),
    readFile(new URL("supabase/migrations/20261112120000_limit_community_post_edits.sql", sourceRoot), "utf8"),
  ]);
  assert.match(web, /aria-expanded=\{showTopicFilter\}/);
  assert.match(web, /hidden=\{!showTopicFilter\}/);
  assert.match(web, /else if \(topicFilter\) query = query\.eq\("topic", topicFilter\)/);
  assert.match(mobile, /accessibilityState=\{\{ expanded: showTopicFilter \}\}/);
  assert.match(mobile, /target \? query\.eq\("id", target\.postId\) : \(topicFilter \? query\.eq\("topic", topicFilter\)/);
  assert.match(web, /canEditCommunityPost\(post\.created_at, true, now\)/);
  assert.match(mobile, /canEditCommunityPost\(post\.created_at, true, now\)/);
  assert.match(editPolicy, /created_at > statement_timestamp\(\) - interval '30 minutes'/);
  assert.match(moderationApi, /image_public_id/);
  assert.match(admin, /\/api\/admin\/community-reports\/photo\?report=/);
});

test("community topic filtering is sent to the data API with pagination", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const requests = [];
  const client = createClient("https://example.test", "test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url) => {
      requests.push(new URL(url));
      return Response.json([]);
    } },
  });
  await client.from("community_posts").select("id,topic").eq("topic", "nutrition").range(0, 19).throwOnError();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].pathname, "/rest/v1/community_posts");
  assert.equal(requests[0].searchParams.get("topic"), "eq.nutrition");
  assert.equal(requests[0].searchParams.get("offset"), "0");
  assert.equal(requests[0].searchParams.get("limit"), "20");
});

test("the public homepage has no admin entry; the direct admin login renders its own form", async () => {
  const [home, login] = await Promise.all([
    readFile(new URL("index.html", appRoot), "utf8"),
    readFile(new URL("admin/login.html", appRoot), "utf8"),
  ]);
  assert.doesNotMatch(home, /href="\/admin(?:\/|")/);
  assert.match(login, /name="email"/);
  assert.match(login, /name="password"/);
});
