import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS'
};

export async function aiProfileChecks(browser, base, root, engine = 'chromium') {
  const results = [];
  const check = async (name, fn) => {
    try { await fn(); results.push(['ok', `ai-profiles: ${name}`]); }
    catch (e) { results.push(['FAIL', `ai-profiles: ${name}`, String(e && e.stack || e)]); }
  };

  await check('create, save-as-new, switch, reload, and keep unremembered keys out of localStorage', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    try {
      await p.goto(`${base}/index.html?lang=zh`, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => !!window.AIClient);
      await p.evaluate(() => { try { localStorage.setItem('gelfigure.tour.done.v1', '1'); } catch (_) {} });

      await p.locator('#btnSettings').click();
      await p.waitForFunction(() => !document.getElementById('aiSettingsPanel').classList.contains('hidden'));

      // Profile 1: Bailian (remembered)
      await p.locator('#aiProfileName').fill('百炼主力');
      await p.locator('#aiProvider').selectOption('bailian');
      await p.locator('#aiKey').fill('sk-bailian-secret-1111');
      await p.locator('#aiRemember').check();
      assert.equal(await p.evaluate(() => AIClient.profiles.length), 1);
      assert.equal(await p.evaluate(() => localStorage.getItem('gelfig.ai-marker.key')), 'sk-bailian-secret-1111');

      // Profile 2: OpenAI via "+ New profile" (remembered)
      await p.locator('#aiProfileNew').click();
      assert.equal(await p.locator('#aiEndpoint').inputValue(), '');
      assert.equal(await p.locator('#aiKey').inputValue(), '');
      await p.locator('#aiProfileName').fill('课题组 OpenAI');
      await p.locator('#aiProvider').selectOption('openai');
      await p.locator('#aiKey').fill('sk-openai-secret-2222');
      await p.locator('#aiRemember').check();
      assert.equal(await p.evaluate(() => AIClient.profiles.length), 2);
      assert.equal(await p.evaluate(() => localStorage.getItem('gelfig.ai-marker.key')), 'sk-openai-secret-2222');

      // Profile 3: Gemini via "Save as new" (session-only, NOT remembered)
      await p.locator('#aiProfileName').fill('临时 Gemini');
      await p.locator('#aiProvider').selectOption('gemini');
      await p.locator('#aiKey').fill('sk-gemini-temp-3333');
      await p.locator('#aiRemember').uncheck();
      // Note: unchecking aiRemember updated Profile 2 first, so restore Profile 2 remember and use Save as new properly:
      // Let's test Save as new cleanly from a fresh edit on Profile 2!
      const ids = await p.evaluate(() => AIClient.profiles.map(x => x.id));
      await p.locator(`[data-profile-select="${ids[1]}"]`).click();
      await p.locator('#aiProvider').selectOption('openai');
      await p.locator('#aiKey').fill('sk-openai-secret-2222');
      await p.locator('#aiProfileName').fill('课题组 OpenAI');
      await p.locator('#aiRemember').check();

      // Now edit fields (without checking/unchecking remember before Save as new? Uncheck remember triggers save, so start new for session-only profile)
      await p.locator('#aiProfileNew').click();
      await p.locator('#aiProfileName').fill('临时 Gemini');
      await p.locator('#aiProvider').selectOption('gemini');
      await p.locator('#aiKey').fill('sk-gemini-temp-3333');
      await p.locator('#aiSaveSettings').click();

      // Also test "Save as new" explicitly by cloning Profile 1 to a 4th profile
      const ids3 = await p.evaluate(() => AIClient.profiles.map(x => x.id));
      assert.equal(ids3.length, 3);
      await p.locator(`[data-profile-select="${ids3[0]}"]`).click();
      await p.locator('#aiProfileName').fill('百炼备用模型');
      await p.locator('#aiModel').fill('qwen4-max');
      await p.locator('#aiKey').fill('sk-bailian-alt-4444');
      await p.locator('#aiSaveAsNew').click();

      const snap = await p.evaluate(() => ({
        profiles: AIClient.profiles,
        metaRaw: localStorage.getItem('gelfig.ai-marker.profiles') || '',
        keysRaw: localStorage.getItem('gelfig.ai-marker.profile-keys') || '',
        legacyKey: localStorage.getItem('gelfig.ai-marker.key')
      }));
      assert.equal(snap.profiles.length, 4);
      assert(!snap.metaRaw.includes('sk-bailian-secret-1111'), 'metadata must never contain keys');
      assert(!snap.metaRaw.includes('sk-openai-secret-2222'), 'metadata must never contain keys');
      assert(!snap.metaRaw.includes('sk-gemini-temp-3333'), 'metadata must never contain keys');
      assert(!snap.metaRaw.includes('sk-bailian-alt-4444'), 'metadata must never contain keys');
      assert(snap.keysRaw.includes('sk-bailian-secret-1111'));
      assert(snap.keysRaw.includes('sk-openai-secret-2222'));
      assert(snap.keysRaw.includes('sk-bailian-alt-4444'));
      assert(!snap.keysRaw.includes('sk-gemini-temp-3333'), 'session-only key must not be persisted');

      // Show password on Profile 4, then switch to Profile 3 (session-only) -> password resets to hidden, session key still in memory, legacy KEY removed
      await p.locator('#aiKeyToggle').click();
      assert.equal(await p.locator('#aiKey').getAttribute('type'), 'text');
      await p.locator(`[data-profile-select="${snap.profiles[2].id}"]`).click();
      assert.equal(await p.locator('#aiKey').getAttribute('type'), 'password', 'switching profile must hide key');
      assert.equal(await p.locator('#aiKey').inputValue(), 'sk-gemini-temp-3333');
      assert.equal(await p.evaluate(() => localStorage.getItem('gelfig.ai-marker.key')), null);

      // Open a fresh page in the same browser context (guarantees zero in-memory state; tests real persistence)
      const p2 = await ctx.newPage();
      p2.on('pageerror', e => errs.push(String(e)));
      await p.close();
      await p2.goto(`${base}/index.html?lang=zh&fresh=1`, { waitUntil: 'domcontentloaded' });
      await p2.waitForFunction(() => !!window.AIClient);
      await p2.locator('#btnSettings').click();
      const afterReload = await p2.evaluate(() => AIClient.profiles);
      assert.equal(afterReload.length, 4);
      assert.equal(await p2.locator('#aiKey').inputValue(), '', 'session-only profile key must not survive reload');
      assert.equal(await p2.evaluate(() => AIClient.configured), false);

      // Switch to Profile 1 and Profile 2 after reload -> keys restored!
      await p2.locator(`[data-profile-select="${afterReload[0].id}"]`).click();
      assert.equal(await p2.locator('#aiKey').inputValue(), 'sk-bailian-secret-1111');
      assert.equal(await p2.evaluate(() => AIClient.configured), true);
      assert.equal(await p2.evaluate(() => localStorage.getItem('gelfig.ai-marker.key')), 'sk-bailian-secret-1111');

      await p2.locator(`[data-profile-select="${afterReload[1].id}"]`).click();
      assert.equal(await p2.locator('#aiKey').inputValue(), 'sk-openai-secret-2222');
      assert.equal(await p2.locator('#aiModel').inputValue(), 'gpt-6.2-sol');
      assert.equal(await p2.evaluate(() => AIClient.configured), true);

      assert.equal(errs.length, 0, errs.join(' | '));
    } finally { await ctx.close(); }
  });

  await check('network requests target the active profile endpoint, model, and Authorization header', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    const calls = [];
    await ctx.route('https://api-alpha.test/**', async route => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
      calls.push({ url: route.request().url(), auth: route.request().headers().authorization, body: JSON.parse(route.request().postData() || '{}') });
      await route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] }) });
    });
    await ctx.route('https://api-beta.test/**', async route => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
      calls.push({ url: route.request().url(), auth: route.request().headers().authorization, body: JSON.parse(route.request().postData() || '{}') });
      await route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] }) });
    });
    try {
      await p.goto(`${base}/index.html?lang=en`, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => !!window.AIClient);
      await p.locator('#btnSettings').click();

      await p.locator('#aiProfileName').fill('Alpha');
      await p.locator('#aiEndpoint').fill('https://api-alpha.test/v1');
      await p.locator('#aiModel').fill('alpha-vl');
      await p.locator('#aiKey').fill('sk-alpha-key');
      await p.locator('#aiSaveSettings').click();

      await p.locator('#aiProfileNew').click();
      await p.locator('#aiProfileName').fill('Beta');
      await p.locator('#aiEndpoint').fill('https://api-beta.test/v1');
      await p.locator('#aiModel').fill('beta-vl');
      await p.locator('#aiKey').fill('sk-beta-key');
      await p.locator('#aiSaveSettings').click();

      // Test Beta
      await p.locator('#aiTestSettings').click();
      await p.waitForFunction(() => document.getElementById('aiSettingsStatus').classList.contains('ok'));
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, 'https://api-beta.test/v1/chat/completions');
      assert.equal(calls[0].auth, 'Bearer sk-beta-key');
      assert.equal(calls[0].body.model, 'beta-vl');

      // Switch to Alpha and test
      const alphaId = await p.evaluate(() => AIClient.profiles.find(x => x.name === 'Alpha').id);
      await p.locator(`[data-profile-select="${alphaId}"]`).click();
      await p.locator('#aiTestSettings').click();
      await p.waitForFunction(() => !document.getElementById('aiTestSettings').disabled && document.getElementById('aiSettingsStatus').classList.contains('ok'));
      assert.equal(calls.length, 2);
      assert.equal(calls[1].url, 'https://api-alpha.test/v1/chat/completions');
      assert.equal(calls[1].auth, 'Bearer sk-alpha-key');
      assert.equal(calls[1].body.model, 'alpha-vl');
    } finally { await ctx.close(); }
  });

  await check('multi-host consent, Welcome/AI Hub quick switchers, and 4-step Wizard saving new profile', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await ctx.route('https://api.openai.com/**', async route => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
      await route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] }) });
    });
    try {
      await p.goto(`${base}/index.html?lang=zh`, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => !!window.AIClient && !!window.AIWizard && !!window.WelcomeAI);
      await p.evaluate(() => { try { localStorage.setItem('gelfigure.tour.done.v1', '1'); } catch (_) {} });

      // Save Profile 1 (Bailian) + consent
      await p.evaluate(() => {
        AIClient.saveProfile({
          name: '百炼配置',
          endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          model: 'qwen3-vl-plus',
          key: 'sk-bailian-1',
          remember: true
        });
        AIConsent.grant('https://dashscope.aliyuncs.com/compatible-mode/v1');
      });

      // Use 4-step Wizard to add OpenAI as a second profile (without overwriting Bailian!)
      await p.evaluate(() => AIWizard.open(1));
      await p.locator('[data-wprov="openai"]').click();
      await p.locator('#wizNext').click();
      await p.locator('#wizNext').click();
      assert.equal(await p.locator('#wizSaveAsNew').isChecked(), true, 'switching provider in wizard should default to save as new profile');
      assert.equal(await p.locator('#wizKey').inputValue(), '', 'switching provider should clear old key');
      await p.locator('#wizProfileName').fill('OpenAI 视觉');
      await p.locator('#wizKey').fill('sk-openai-wiz-9999');
      await p.locator('#wizRemember').check();
      await p.locator('#wizTestBtn').click();
      await p.waitForFunction(() => !!document.querySelector('.wizard-test-ok'));
      await p.locator('#wizNext').click();
      await p.locator('#wizConfirm').click();
      await p.waitForFunction(() => document.getElementById('aiWizardDlg').classList.contains('hidden'));

      // Verify exactly 2 profiles (no duplicate created between Test/Next/Confirm) and BOTH hosts consented
      const state = await p.evaluate(() => ({
        profiles: AIClient.profiles,
        cBailian: AIConsent.isConsented('https://dashscope.aliyuncs.com/compatible-mode/v1'),
        cOpenAI: AIConsent.isConsented('https://api.openai.com/v1'),
        cOther: AIConsent.isConsented('https://unconsented.example/v1')
      }));
      assert.equal(state.profiles.length, 2, 'Wizard Test->Next->Confirm must not duplicate profiles');
      assert.equal(state.profiles[0].name, '百炼配置');
      assert.equal(state.profiles[1].name, 'OpenAI 视觉');
      assert.equal(state.cBailian, true);
      assert.equal(state.cOpenAI, true);
      assert.equal(state.cOther, false);

      // Welcome page quick switcher switches active profile and updates pill
      await p.waitForSelector('#welcomeProfileSelect');
      await p.locator('#welcomeProfileSelect').selectOption(state.profiles[0].id);
      assert.equal(await p.evaluate(() => AIClient.activeProfile.name), '百炼配置');
      assert((await p.locator('#btnWelcomeAIStatus').textContent()).includes('百炼配置'));

      // AI Hub quick switcher switches active profile
      await p.locator('#btnAutoFlowTop').click();
      await p.waitForSelector('#aiHubProfileSelect');
      await p.locator('#aiHubProfileSelect').selectOption(state.profiles[1].id);
      assert.equal(await p.evaluate(() => AIClient.activeProfile.name), 'OpenAI 视觉');
      await p.locator('#aiHubClose').click();

      // Revoking consent on OpenAI leaves Bailian consented; revoking Bailian clears AIConsent.info to null
      await p.locator('#btnSettings').click();
      await p.locator('#btnToggleAIConsent').click();
      assert.equal(await p.evaluate(() => AIConsent.isConsented('https://api.openai.com/v1')), false);
      assert.equal(await p.evaluate(() => AIConsent.isConsented('https://dashscope.aliyuncs.com/compatible-mode/v1')), true);
      await p.locator(`[data-profile-select="${state.profiles[0].id}"]`).click();
      await p.locator('#btnToggleAIConsent').click();
      assert.equal(await p.evaluate(() => AIConsent.info), null);

      assert.equal(errs.length, 0, errs.join(' | '));
    } finally { await ctx.close(); }
  });

  await check('legacy v2.0.0 migration, cancel new, delete profiles, clear all keys, phone layout, and export privacy', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    try {
      // Seed legacy v2.0.0 single-config localStorage before app loads
      await p.addInitScript(() => {
        if (!window.__seededLegacy) {
          window.__seededLegacy = true;
          localStorage.setItem('gelfig.ai-marker.config', JSON.stringify({
            endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            model: 'qwen3-vl-plus'
          }));
          localStorage.setItem('gelfig.ai-marker.key', 'sk-legacy-v200-key');
        }
      });
      await p.goto(`${base}/index.html?demo=1&lang=zh`, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => document.title.startsWith('READY ') && !!window.AIClient);

      const migrated = await p.evaluate(() => ({
        configured: AIClient.configured,
        profiles: AIClient.profiles
      }));
      assert.equal(migrated.configured, true);
      assert.equal(migrated.profiles.length, 1);
      assert.equal(migrated.profiles[0].remember, true);
      assert.equal(migrated.profiles[0].hasKey, true);

      // Start new profile -> cancel -> restores original profile cleanly
      await p.locator('#btnSettings').click();
      await p.locator('#aiProfileNew').click();
      await p.locator('#aiProfileCancelNew').click();
      assert.equal(await p.evaluate(() => AIClient.activeProfileId), migrated.profiles[0].id);
      assert.equal(await p.evaluate(() => AIClient.configured), true);

      // Add second profile, verify phone viewport (390x844) has no horizontal overflow
      await p.locator('#aiProfileNew').click();
      await p.locator('#aiProfileName').fill('备用密钥');
      await p.locator('#aiEndpoint').fill('https://api.openai.com/v1');
      await p.locator('#aiModel').fill('gpt-6.2-sol');
      await p.locator('#aiKey').fill('sk-second-secret-7777');
      await p.locator('#aiRemember').check();

      await p.setViewportSize({ width: 390, height: 844 });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390, 'phone viewport must have no horizontal overflow');
      await p.setViewportSize({ width: 1366, height: 860 });

      // Ensure secrets & profile names never enter App.S, project JSON, processing log, or SVG
      const privacy = await p.evaluate(() => ({
        snap: App.snapshot(),
        proj: JSON.stringify(App.projectData()),
        log: JSON.stringify(Export.processingLog(App.S)),
        svg: App.buildFigure(false).svg
      }));
      for (const blob of [privacy.snap, privacy.proj, privacy.log, privacy.svg]) {
        assert(!blob.includes('sk-legacy-v200-key'));
        assert(!blob.includes('sk-second-secret-7777'));
        assert(!blob.includes('备用密钥'));
      }

      // Delete non-active profile -> active stays intact, deleted key purged
      const two = await p.evaluate(() => AIClient.profiles);
      assert.equal(two.length, 2);
      await p.locator(`[data-profile-delete="${two[0].id}"]`).click();
      const afterDel = await p.evaluate(() => ({
        profiles: AIClient.profiles,
        keysRaw: localStorage.getItem('gelfig.ai-marker.profile-keys') || ''
      }));
      assert.equal(afterDel.profiles.length, 1);
      assert.equal(afterDel.profiles[0].name, '备用密钥');
      assert(!afterDel.keysRaw.includes('sk-legacy-v200-key'));

      // Clear all local keys from Data tab -> purges both KEY and PROFILES_KEYS
      await p.locator('#aiSettingsPanel [data-stab="data"]').click();
      await p.locator('#btnClearAllAIKeys').click();
      const cleared = await p.evaluate(() => ({
        configured: AIClient.configured,
        key: localStorage.getItem('gelfig.ai-marker.key'),
        keys: localStorage.getItem('gelfig.ai-marker.profile-keys')
      }));
      assert.equal(cleared.configured, false);
      assert.equal(cleared.key, null);
      assert.equal(cleared.keys, null);

      // Deleting the last/active profile resets to 0 profiles and removes metadata from localStorage
      const lastId = await p.evaluate(() => AIClient.activeProfileId);
      await p.locator('#aiSettingsPanel [data-stab="ai"]').click();
      await p.locator(`[data-profile-delete="${lastId}"]`).click();
      assert.equal(await p.evaluate(() => AIClient.profiles.length), 0);
      assert.equal(await p.evaluate(() => localStorage.getItem('gelfig.ai-marker.profiles')), null);

      assert.equal(errs.length, 0, errs.join(' | '));
    } finally { await ctx.close(); }
  });

  await check('bilingual switch preserves draft name/fields, active-profile delete switches cleanly, and single-file HTML works offline', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    try {
      await p.goto(`${base}/index.html?lang=zh`, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => !!window.AIClient);
      await p.locator('#btnSettings').click();

      await p.locator('#aiProfileName').fill('未保存草稿名');
      await p.locator('#aiEndpoint').fill('https://draft.example.test/v1');
      await p.locator('#aiModel').fill('draft-vl');
      await p.locator('#aiKey').fill('sk-draft-keep');
      await p.locator('#btnLang').click();
      assert.equal(await p.locator('#aiProfileName').inputValue(), '未保存草稿名');
      assert.equal(await p.locator('#aiEndpoint').inputValue(), 'https://draft.example.test/v1');
      assert.equal(await p.locator('#aiKey').inputValue(), 'sk-draft-keep');
      await p.locator('#aiSaveSettings').click();

      await p.locator('#aiProfileNew').click();
      await p.locator('#aiProfileName').fill('Second Active');
      await p.locator('#aiEndpoint').fill('https://second.example.test/v1');
      await p.locator('#aiModel').fill('second-vl');
      await p.locator('#aiKey').fill('sk-second-keep');
      await p.locator('#aiRemember').check();

      // Delete active profile -> falls back to first profile cleanly
      const activeId = await p.evaluate(() => AIClient.activeProfileId);
      await p.locator(`[data-profile-delete="${activeId}"]`).click();
      assert.equal(await p.evaluate(() => AIClient.activeProfile.name), '未保存草稿名');
      assert.equal(await p.locator('#aiEndpoint').inputValue(), 'https://draft.example.test/v1');
      assert.equal(await p.evaluate(() => localStorage.getItem('gelfig.ai-marker.profile-keys')), null);

      assert.equal(errs.length, 0, errs.join(' | '));
    } finally { await ctx.close(); }

    const singleCtx = await browser.newContext({ viewport: { width: 1366, height: 860 }, offline: true });
    try {
      const q = await singleCtx.newPage();
      const sErrs = [];
      q.on('pageerror', e => sErrs.push(String(e)));
      await q.goto(pathToFileURL(path.join(root, 'dist/GelFigure.html')).href + '?lang=zh', { waitUntil: 'domcontentloaded' });
      await q.waitForFunction(() => !!window.AIClient);
      await q.locator('#btnSettings').click();
      await q.locator('#aiProfileName').fill('离线配置 A');
      await q.locator('#aiEndpoint').fill('https://a.offline.test/v1');
      await q.locator('#aiModel').fill('m-a');
      await q.locator('#aiKey').fill('sk-offline-a');
      await q.locator('#aiSaveSettings').click();
      await q.locator('#aiProfileNew').click();
      await q.locator('#aiProfileName').fill('离线配置 B');
      await q.locator('#aiEndpoint').fill('https://b.offline.test/v1');
      await q.locator('#aiModel').fill('m-b');
      await q.locator('#aiKey').fill('sk-offline-b');
      await q.locator('#aiSaveSettings').click();
      assert.equal(await q.evaluate(() => AIClient.profiles.length), 2);
      const idA = await q.evaluate(() => AIClient.profiles[0].id);
      await q.locator(`[data-profile-select="${idA}"]`).click();
      assert.equal(await q.locator('#aiEndpoint').inputValue(), 'https://a.offline.test/v1');
      assert.equal(sErrs.length, 0, sErrs.join(' | '));
    } finally { await singleCtx.close(); }
  });

  return results;
}
