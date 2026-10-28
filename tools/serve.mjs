import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname, extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicEntries} from './public-files.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.webm':'audio/webm','.m4a':'audio/mp4'};
export function startServer(port=Number(process.env.PORT || 4173)) {
  const server=createServer(async (request,response)=>{
    if (!['GET','HEAD'].includes(request.method)) {response.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
    try {
      const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
      const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
      const target=resolve(root,relative);
      const allowed=publicEntries.includes(relative) || /^(css|js|assets)\//.test(relative);
      if (!allowed || !target.startsWith(root+sep) || relative.split(/[\\/]/).some(part=>part.startsWith('.'))) {response.writeHead(404).end('Not found');return;}
      const file=await readFile(target);
      response.writeHead(200,{'Content-Type':`${mime[extname(target)] || 'application/octet-stream'}${/\.(html|css|js|svg)$/.test(target)?'; charset=utf-8':''}`,'Content-Length':file.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end(request.method==='HEAD'?undefined:file);
    } catch {response.writeHead(404).end('Not found');}
  });
  return new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,'127.0.0.1',()=>resolve(server));
  });
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const server=await startServer();
  console.log(`Mines site: http://127.0.0.1:${server.address().port}/`);
  console.log('Landing preview: /?preview=1 · Registration: /registration.html · Creator Studio: /creator-studio.html');
}
