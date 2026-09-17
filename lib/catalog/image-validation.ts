import sharp from 'sharp';

export const maxImageBytes = 4_000_000;
const maxPixels = 40_000_000;

export async function prepareCatalogImage(bytes: Buffer) {
  if (!bytes.length || bytes.length > maxImageBytes) throw new Error('IMAGE_SIZE');
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (!jpeg && !png && !webp) throw new Error('IMAGE_FORMAT');
  try {
    const input = sharp(bytes,{ limitInputPixels: maxPixels, failOn: 'warning' });
    const metadata = await input.metadata();
    if (!['jpeg','png','webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1) throw new Error('IMAGE_FORMAT');
    // Re-encode pixels only. EXIF, GPS, comments and user filenames never enter storage.
    const full = await input.rotate().resize({ width:2560,height:2560,fit:'inside',withoutEnlargement:true })
      .webp({ quality:85 }).toBuffer({ resolveWithObject:true });
    const thumbnail = await sharp(full.data).resize({width:480,height:480,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
    if (full.data.length > maxImageBytes) throw new Error('IMAGE_SIZE');
    return { full:full.data, thumbnail, width:full.info.width, height:full.info.height, bytes:full.data.length };
  } catch { throw new Error('IMAGE_INVALID'); }
}
