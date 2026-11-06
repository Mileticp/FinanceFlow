/* No build dependencies: commit immutable public assets for GitHub Pages. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SOURCES=['vendor/supabase.min.js','js/shift-time.js','css/v2.css','js/core.js','js/importer.js','js/app.js','js/sw-client.js'];
const STATIC=['food.html','manifest.webmanifest','icon-192.png','icon-512.png'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function generate(root){
 const read=file=>fs.readFileSync(path.join(root,file)),outputs={};
 let html=read('index.html').toString(),worker=read('sw.js').toString();
 const assets=SOURCES.map(source=>{
  const bytes=read(source),hash=sha(bytes),file='shell/'+path.basename(source).replace(/\.(js|css)$/,'.'+hash.slice(0,16)+'.$1');
  outputs[file]=bytes;return {source,file,hash,integrity:'sha256-'+crypto.createHash('sha256').update(bytes).digest('base64')};
 });
 const found=new Set();
 for(const tag of html.match(/<(?:script|link)\b[^>]*>/g)||[])if(/(?:src|href)="\.\/[^"]+\.(?:js|css)"/.test(tag)&&!tag.includes('data-shell-source='))throw Error('Unversioned local shell dependency: '+tag);
 html=html.replace(/<(?:script|link)\b[^>]*\bdata-shell-source="([^"]+)"[^>]*>/g,(tag,source)=>{
  const asset=assets.find(a=>a.source===source);if(!asset)throw Error('Unknown shell source '+source);found.add(source);
  const attr=tag.startsWith('<script')?'src':'href';
  return tag.replace(/\s(?:src|href|integrity|crossorigin)="[^"]*"/g,'').replace(/>$/,` ${attr}="./${asset.file}" integrity="${asset.integrity}" crossorigin="anonymous">`);
 });
 if(found.size!==SOURCES.length)throw Error('Every shell script/style must have a data-shell-source marker.');
 // GitHub Pages supports CSP meta tags. Hash the inline finance script verbatim.
 const inlineScripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
 if(inlineScripts.length!==1)throw Error('Expected exactly one inline application script to hash.');
 const scriptHashes=inlineScripts.map(code=>"'sha256-"+crypto.createHash('sha256').update(code).digest('base64')+"'");
 const policy=[
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "script-src 'self' "+scriptHashes.join(' '),
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "worker-src 'self'",
  "manifest-src 'self'"
 ].join('; ');
 html=html.replace(/<meta name="financeflow-csp"[^>]*>/g,'')
   .replace('<head>','<head>\n<meta name="financeflow-csp" http-equiv="Content-Security-Policy" content="'+policy+'">');
 const neutralHTML=html.replace(/(<meta name="financeflow-release" content=")[^"]*(">)/,'$1__RELEASE__$2');
 if(neutralHTML===html&&!html.includes('content="__RELEASE__"'))throw Error('Missing release meta tag.');
 const neutralWorker=worker.replace(/\/\/ BEGIN GENERATED SHELL[\s\S]*?\/\/ END GENERATED SHELL/,'// GENERATED SHELL');
 const fingerprint={html:sha(neutralHTML),worker:sha(neutralWorker),sources:assets.map(a=>({file:a.source,sha256:a.hash})),static:STATIC.map(file=>({file,sha256:sha(read(file))}))};
 const version='v'+JSON.parse(read('package.json')).version+'-'+sha(JSON.stringify(fingerprint)).slice(0,16);
 html=neutralHTML.replace('content="__RELEASE__"',`content="${version}"`);
 const release={version,assets:[{url:'./index.html',sha256:sha(html)},...assets.map(a=>({url:'./'+a.file,sha256:a.hash})),...STATIC.map(file=>({url:'./'+file,sha256:sha(read(file))}))]};
 worker=worker.replace(/\/\/ BEGIN GENERATED SHELL[\s\S]*?\/\/ END GENERATED SHELL/,'// BEGIN GENERATED SHELL\nconst RELEASE = '+JSON.stringify(release,null,2)+';\n// END GENERATED SHELL');
 outputs['index.html']=Buffer.from(html);outputs['sw.js']=Buffer.from(worker);outputs['shell-release.json']=Buffer.from(JSON.stringify(release,null,2)+'\n');
 return outputs;
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),check=process.argv.includes('--check'),outputs=generate(root),different=[];
 for(const [file,bytes] of Object.entries(outputs)){
  const target=path.join(root,file);if(fs.existsSync(target)&&fs.readFileSync(target).equals(bytes))continue;
  different.push(file);if(!check){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
 }
 if(check&&different.length){console.error('Stale app shell: run npm run build:shell\n'+different.join('\n'));process.exitCode=1;}
 else console.log(check?'App shell manifest and immutable assets are current.':'Generated compatible app shell.');
}
module.exports={generate};
