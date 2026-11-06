// Static guardrails for FinanceFlow's public repository. Run: node scripts/security-check.cjs
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');

const problems = [];
const PATTERNS = [
   [/\bsb_secret_[A-Za-z0-9_-]{12,}\b/g,'Supabase secret key'],
   [/\b(?:SUPABASE_SERVICE_ROLE_KEY|service_role_key)\s*[:=]\s*['"`][^'"`\s]{12,}/gi,'Service-role key assignment'],
   [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,'Private key'],
   [/\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g,'GitHub token'],
   [/\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,'GitHub fine-grained token']
  ];;
// Inspect all tracked files, including dotfiles and deployed shell assets.
// Git's index avoids ignored dependencies and untracked local files.
const tracked = execFileSync('git',['ls-files','-z'],{cwd:root,maxBuffer:16*1024*1024}).toString('utf8').split('\0').filter(Boolean);
for(const relative of tracked){
 if(relative==='scripts/security-check.cjs')continue; // scanner's own pattern examples
 const filename=path.join(root,relative),stat=fs.lstatSync(filename);
 if(!stat.isFile()||stat.size>5*1024*1024)continue;
 const bytes=fs.readFileSync(filename);
 if(bytes.includes(0))continue; // binary files are not text
 const body=bytes.toString('utf8');
 const checks = PATTERNS;
 for(const [pattern,label] of checks){pattern.lastIndex=0;if(pattern.test(body))problems.push(relative+': '+label);}
}
if(problems.length){console.error('Security scan failed:\n'+problems.join('\n'));process.exitCode=1;}
else console.log('Security scan passed (heuristic only; does not replace secret scanning or history audit).');
