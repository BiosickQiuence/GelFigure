import {webkit} from 'playwright';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),b=await webkit.launch(),p=await b.newPage();
await p.goto(pathToFileURL(path.join(root,'dist/GelFigure.html')).href+'?lang=en');await p.waitForFunction(()=>window.App);
await p.locator('#btnSettings').click();await p.locator('#aiEndpoint').fill('https://synthetic.invalid/v1');await p.locator('#aiModel').fill('synthetic');await p.locator('#aiKey').fill('synthetic');await p.locator('#aiSaveSettings').click();
const state=()=>p.evaluate(()=>({active:document.activeElement.id,hidden:document.getElementById('aiSettingsPanel').className,button:document.getElementById('btnSettings').getAttribute('aria-expanded')}));
console.log('before',await state());await p.keyboard.press('Escape');console.log('after',await state());await p.waitForTimeout(100);console.log('later',await state());await b.close();
