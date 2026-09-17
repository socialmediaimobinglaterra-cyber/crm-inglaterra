import { SaxesParser } from "saxes";
import { CatalogImportError } from "./types";

export type XmlProperty = {
  fields: Record<string, string>;
  photos: Array<Record<string, string>>;
};

// Strict SAX parsing: hold only one property, ignore broker subtrees, reject DTDs.
export async function readPropertyXml(chunks: AsyncIterable<string>, receive: (item: XmlProperty) => void) {
  const parser = new SaxesParser();
  const stack: string[] = [];
  let item: XmlProperty | null = null;
  let photo: Record<string, string> | null = null;
  let text = "";
  let count = 0;
  let bytes = 0;
  let sawCollection = false;
  parser.on("doctype", () => { throw new CatalogImportError("XML_DTD_FORBIDDEN"); });
  parser.on("error", () => { throw new CatalogImportError("XML_INVALID"); });
  parser.on("opentag", (tag) => {
    stack.push(tag.name);
    text = "";
    if (stack.length > 16) throw new CatalogImportError("XML_DEPTH_LIMIT");
    if (stack.length === 1 && tag.name !== "Carga") throw new CatalogImportError("XML_FORMAT_UNSUPPORTED");
    const path = stack.join("/");
    if (path === "Carga/Imoveis") sawCollection = true;
    if (path === "Carga/Imoveis/Imovel") {
      item = { fields: Object.create(null) as Record<string, string>, photos: [] };
    }
    if (path === "Carga/Imoveis/Imovel/Fotos/Foto") photo = Object.create(null) as Record<string, string>;
  });
  const append = (value: string) => {
    text += value;
    if (text.length > 100_000) throw new CatalogImportError("XML_FIELD_LIMIT");
  };
  parser.on("text", append);
  parser.on("cdata", append);
  parser.on("closetag", () => {
    const path = stack.join("/");
    const name = stack.at(-1)!;
    if (["__proto__", "prototype", "constructor"].includes(name)) throw new CatalogImportError("XML_INVALID_KEY");
    if (item && stack.length === 4 && stack[2] === "Imovel" && !["Fotos", "corretor", "GarantiaLocacao"].includes(name)) {
      if (Object.hasOwn(item.fields, name)) throw new CatalogImportError("XML_DUPLICATE_FIELD");
      item.fields[name] = text.trim();
    }
    if (photo && stack.length === 6 && stack[3] === "Fotos" && stack[4] === "Foto") photo[name] = text.trim();
    if (path === "Carga/Imoveis/Imovel/Fotos/Foto" && item && photo) {
      item.photos.push(photo);
      photo = null;
      if (item.photos.length > 1000) throw new CatalogImportError("XML_MEDIA_LIMIT");
    }
    if (path === "Carga/Imoveis/Imovel" && item) {
      receive(item);
      item = null;
      if (++count > 20_000) throw new CatalogImportError("XML_ITEM_LIMIT");
    }
    stack.pop();
    text = "";
  });
  for await (const chunk of chunks) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 64 * 1024 * 1024) throw new CatalogImportError("XML_SIZE_LIMIT");
    parser.write(chunk);
  }
  parser.close();
  if (!sawCollection || count === 0) throw new CatalogImportError("XML_EMPTY");
}
