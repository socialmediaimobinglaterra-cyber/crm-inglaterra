import https from 'node:https';
import { lookup } from 'node:dns';
import { BlockList } from 'node:net';
import { maxImageBytes } from './image-validation';

const blocked = new BlockList();
for (const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const) blocked.addSubnet(address,prefix);

// Exact host observed in the current feed. No user-supplied host or redirect is allowed.
export function externalImageUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('EXTERNAL_IMAGE_URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'lh3.googleusercontent.com' ||
      url.username || url.password || url.port || url.hash || value.length > 4096) throw new Error('EXTERNAL_IMAGE_URL');
  url.protocol = 'https:';
  return url;
}

export function downloadExternalImage(value: string): Promise<Buffer> {
  const url = externalImageUrl(value);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => request.destroy(new Error('EXTERNAL_IMAGE_TIMEOUT')), 15000);
    const request = https.get(url, { agent: false, family:4,
      lookup(hostname,options,callback) {
        lookup(hostname,{family:4,all:true},(error,addresses)=>{
          if(error||!addresses.length||addresses.some(item=>blocked.check(item.address))) {
            callback(new Error('EXTERNAL_IMAGE_DNS'),[],4); return;
          }
          // Return only the checked addresses to the actual TLS connection.
          if(options.all) callback(null,addresses);
          else callback(null,addresses[0].address,4);
        });
      },
      headers: { Accept: 'image/jpeg,image/png,image/webp' } }, response => {
      if (response.statusCode !== 200 || Number(response.headers['content-length'] ?? 0) > maxImageBytes) {
        response.destroy(); request.destroy(new Error('EXTERNAL_IMAGE_RESPONSE')); return;
      }
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxImageBytes) { request.destroy(new Error('EXTERNAL_IMAGE_SIZE')); return; }
        chunks.push(chunk);
      });
      response.on('error', () => { clearTimeout(timer); reject(new Error('EXTERNAL_IMAGE_FAILED')); });
      response.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
    });
    request.on('error', () => { clearTimeout(timer); reject(new Error('EXTERNAL_IMAGE_FAILED')); });
  });
}
