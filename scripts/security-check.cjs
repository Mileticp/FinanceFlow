// Static guardrails for FinanceFlow's public repository. Run: node scripts/security-check.cjs
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ignored = new Set(['.git','node_modules','shell','test-results']);
const allowed = new Set(['.js','.cjs','.mjs','.html','.json','.yml','.yaml','.md','.sql','.css']);
const problems = [];
function walk(dir) {
 for (const ent of fs.readdirSync(dir,{withFileTypes:true})) {
  if (ignored.has(ent.name)) continue;
  const file = path.join(dir,ent.name);
  if (ent.isDirectory()) {walk(file);continue;}
  if (!ent.isFile() || !allowed.has(path.extname(file))) continue;
  const relative = path.relative(root,file);
  if (relative === 'scripts/security-check.cjs') continue;
  const body = fs.readFileSync(file,'utf8');
  const checks = [
   [/\bsb_secret_[A-Za-z0-9_-]{12,}\b/g,'Supabase secret key'],
   [/\b(?:SUPABASE_SERVICE_ROLE_KEY|service_role_key)\s*[:=]\s*['"`][^'"`\s]{12,}/gi,'Service-role key assignment'],
   [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,'Private key'],
   [/\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g,'GitHub token'],
   [/\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,'GitHub fine-grained token']
  ];
  for(const [pattern,label] of checks) if(pattern.test(body)) problems.push(relative+': '+label);
 }
}
walk(root);
if(problems.length){console.error('Security scan failed:\n'+problems.join('\n'));process.exitCode=1;}
else console.log('Security scan passed (heuristic only; does not replace secret scanning or history audit).');
