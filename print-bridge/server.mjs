/** Local-only print bridge for TYPE SELFIE + Canon SELPHY CP1500 (macOS). */
import http from 'node:http';
import { mkdtemp, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const port = Number(process.env.PORT || 18765);
const printer = process.env.SELPHY_PRINTER || 'Canon SELPHY CP1500';
// 인쇄 요청을 받을 웹 주소(이 Mac의 로컬 서버 + GitHub Pages). 추가는 ALLOWED_ORIGINS="https://a,https://b"
const origins = new Set(['null','http://localhost:5500','http://127.0.0.1:5500','https://implict.github.io',...(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean)]);
const cors=req=>{const o=req.headers.origin||'null';return origins.has(o)?{'Access-Control-Allow-Origin':o,'Vary':'Origin'}:null};
function reply(res,status,body,h={}){res.writeHead(status,{'Content-Type':'application/json',...h});res.end(JSON.stringify(body))}
const server=http.createServer(async(req,res)=>{
  const h=cors(req);if(!h)return reply(res,403,{error:'Origin not allowed'});
  // Access-Control-Allow-Private-Network: https 웹페이지가 이 Mac(127.0.0.1)에 접속하도록 Chrome에 허용 신호를 보냅니다.
  if(req.method==='OPTIONS'){res.writeHead(204,{...h,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Private-Network':'true'});return res.end()}
  if(req.method!=='POST'||req.url!=='/print')return reply(res,404,{error:'Not found'},h);
  const type=req.headers['content-type']||'';const match=type.match(/boundary=(.+)$/);if(!match)return reply(res,400,{error:'Expected multipart upload'},h);
  const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks), boundary=Buffer.from('--'+match[1]);let start=body.indexOf(Buffer.from('\r\n\r\n'));if(start<0)return reply(res,400,{error:'No image'},h);start+=4;let end=body.indexOf(boundary,start)-2;if(end<=start)return reply(res,400,{error:'Invalid image'},h);const jpg=body.subarray(start,end);if(jpg.length>12*1024*1024)return reply(res,413,{error:'Image too large'},h);
  let folder,file;try{folder=await mkdtemp(join(tmpdir(),'type-selfie-'));file=join(folder,'print.jpg');await writeFile(file,jpg);const {stdout}=await exec('lp',['-d',printer,'-t','TYPE SELFIE','-o','media=na_index-4x6_4x6in','-o','fit-to-page',file]);setTimeout(()=>unlink(file).catch(()=>{}),60000);reply(res,200,{ok:true,job:stdout.trim()},h)}catch(error){reply(res,500,{error:`Could not send to ${printer}: ${error.message}`},h)}
});
server.listen(port,'127.0.0.1',()=>console.log(`TYPE SELFIE print bridge ready at http://127.0.0.1:${port}\nPrinter: ${printer}`));
