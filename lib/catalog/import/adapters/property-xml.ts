import { normalizeCatalogItem, normalizedCatalogItemSchema, isoDateTimeSchema, type NormalizationAlert, type NormalizedCatalogItem } from "../../schemas";
import { readPropertyXml, type XmlProperty } from "../xml";
import { CatalogImportError, type CatalogFeedAdapter, type ImportSummary } from "../types";

const featureNames = new Set(("Piscina Churrasqueira QuadraPoliEsportiva Quintal Sacada Varanda VarandaGourmet Sauna CampoFutebol Solarium Terraco JardimInverno FrenteMar BeiraMar AreaServico ServicoCozinha Copa Despensa Escritorio Lavabo Deposito Mezanino DormitorioEmpregada DormitorioReversivel WCEmpregada Vestiario Doca AreaEscritorio Agua EnergiaEletrica Esgoto RuaAsfaltada PortaoEletronico Interfone TVCabo EntradaCaminhoes PlacaNoLocal Zelador Caseiro ArmarioCozinha ArmarioDormitorio ArmarioBanheiro ArmarioAreaServico ArmarioSala ArmarioCloset ArmarioCorredor ArmarioEscritorio ArmarioHomeTheater Mobiliado ArCondicionado Hidromassagem Lareira Adega PisoCeramica PisoLaminado PisoPorcelanato PisoTacoMadeira PisoMarmore PisoGranito PisoAquecido PisoBloquete CarpeteMadeira CarpeteNylon CimentoQueimado ContraPiso AnoConstrucao AnoReforma PeDireitoDuplo AlturaPeDireito AreaComum QtdVagasCobertas QtdVagasDescobertas").split(" "));

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function mapProperty(record: XmlProperty, sourceKey: string, importedAt: string) {
  const f = record.fields;
  const alerts: NormalizationAlert[] = [];
  const warn = (code: string, path: string) => alerts.push({ code, path, severity: "warning", message: "Revisao da origem necessaria." });
  const nullable = (key: string) => f[key] || null;
  const decimal = (key: string) => {
    const value = f[key];
    if (!value || /^0(?:\.0+)?$/.test(value)) return null;
    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new CatalogImportError("INVALID_DECIMAL");
    return value;
  };
  const integer = (key: string) => {
    const value = f[key];
    if (!value) return null;
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new CatalogImportError("INVALID_COUNT");
    return Number(value);
  };
  const date = (key: string) => {
    if (!f[key]) return null;
    if (isoDateTimeSchema.safeParse(f[key]).success) return f[key];
    warn("SOURCE_DATE_NEEDS_TIMEZONE", "source." + key);
    return null;
  };
  const safeText = (value: string | undefined, path: string, short = false) => {
    if (!value) return null;
    const schema = short ? normalizedCatalogItemSchema.shape.title : normalizedCatalogItemSchema.shape.description;
    const parsed = schema.safeParse(value);
    if (parsed.success && !/<[^>]*>/.test(value)) return parsed.data;
    warn("TEXT_REQUIRES_REVIEW", path);
    return null;
  };
  const sale = decimal("PrecoVenda");
  const rent = decimal("PrecoLocacao");
  if (!sale && !rent) throw new CatalogImportError("MISSING_NEGOTIATION_PRICE");
  const media: NormalizedCatalogItem["media"] = [];
  let primary = false;
  for (const photo of record.photos) {
    const isPrimary: boolean = photo.Principal === "1" && !primary;
    const candidate = {
      kind: "photo", order: media.length, isPrimary,
      externalUrl: photo.URLArquivo, originalKind: photo.FotoTipo || null,
      title: safeText(photo.FotoTitulo, "media.title", true),
      description: safeText(photo.FotoDescricao, "media.description"),
      migration: { status: "pending_blob", blobKey: null, publicUrl: null, requiresProxy: true },
    };
    const parsed = normalizedCatalogItemSchema.shape.media.element.safeParse(candidate);
    if (!parsed.success) { warn("INVALID_MEDIA_URL", "media"); continue; }
    if (primary && photo.Principal === "1") warn("MULTIPLE_PRIMARY_PHOTOS", "media");
    primary ||= isPrimary;
    media.push(parsed.data);
  }
  for (const key of ["LinkVideo", "TourVirtual"]) {
    if (!f[key]) continue;
    const parsed = normalizedCatalogItemSchema.shape.media.element.safeParse({
      kind: "video", order: media.length, isPrimary: false, externalUrl: f[key], originalKind: key,
      title: null, description: null,
      migration: { status: "external_only", blobKey: null, publicUrl: null, requiresProxy: true },
    });
    if (parsed.success) media.push(parsed.data);
    else warn("INVALID_VIDEO_URL", "media");
  }
  const use = slug(f.Finalidade ?? "");
  const usageCategory = ["residencial", "comercial", "rural", "industrial", "corporativa"].includes(use) ? use : "unknown";
  if (usageCategory === "unknown") warn("UNKNOWN_USAGE_CATEGORY", "usageCategory");
  warn("PUBLICATION_REQUIRES_REVIEW", "publication");
  const title = safeText(f.TituloImovel, "title", true);
  const item = normalizeCatalogItem({
    source: { sourceKey, externalId: f.CodigoImovel, importedAt, sourceCreatedAt: date("DataCadastro"), sourceUpdatedAt: date("DataAtualizacaoImovel") },
    publicCode: f.CodigoImovel, origin: "external", publicationUnits: [],
    publication: { status: "pending_review", available: false },
    negotiation: sale && rent ? "venda_locacao" : sale ? "venda" : "locacao",
    prices: { sale, rent, condominium: decimal("PrecoCondominio"), iptu: decimal("PrecoIptu") },
    usageCategory,
    taxonomy: { normalizedType: slug(f.TipoImovel ?? ""), normalizedSubtype: f.SubTipoImovel ? slug(f.SubTipoImovel) : null, originalType: f.TipoImovel, originalSubtype: nullable("SubTipoImovel") },
    publicLocation: { officialNeighborhood: f.BairroOficial, neighborhoodAlias: nullable("Bairro"), city: f.Cidade, state: f.Estado },
    privateLocation: { street: nullable("Endereco"), number: nullable("Numero"), complement: nullable("ComplementoEndereco"), postalCode: nullable("CEP"), coordinates: f.latitude && f.longitude ? { latitude: f.latitude, longitude: f.longitude } : null },
    areas: { unit: f.UnidadeMetrica?.toUpperCase() === "M2" ? "m2" : f.UnidadeMetrica?.toLowerCase() === "ha" ? "ha" : null, total: decimal("AreaTotal"), usable: decimal("AreaUtil"), private: decimal("AreaPrivativa") },
    rooms: { bedrooms: integer("QtdDormitorios"), suites: integer("QtdSuites"), bathrooms: integer("QtdBanheiros"), livingRooms: integer("QtdSalas"), parkingSpaces: integer("QtdVagas") },
    title, description: safeText(f.Observacao, "description"), media,
    features: Object.entries(f).filter(([key, value]) => featureNames.has(key) && value !== "").map(([key, value]) => ({ key: slug(key), label: null, value, originalKey: key, originalValue: value, visibility: "pending_review" })),
    rawMetadata: { tipoOferta: nullable("TipoOferta"), publicaValores: nullable("PublicaValores"), tipoLocacao: nullable("TipoLocacao"), publicarOrigem: nullable("Publicar"), finalidadeOrigem: nullable("Finalidade"), statusComercial: nullable("StatusComercial"), nomeCondominio: nullable("NomeCondominio"), nomeEdificio: nullable("NomeEdificio"), filialOrigem: nullable("Filial"), dataCadastroOrigem: nullable("DataCadastro"), dataAtualizacaoOrigem: nullable("DataAtualizacaoImovel") },
    alerts,
  });
  return item;
}

export const propertyXmlAdapter: CatalogFeedAdapter = {
  key: "property-xml-v1",
  async read(chunks, sourceKey) {
    const items: NormalizedCatalogItem[] = [];
    const summary: ImportSummary = { total: 0, photos: 0, rejected: 0, warnings: {}, errors: {} };
    const identifiers = new Set<string>();
    const importedAt = new Date().toISOString();
    await readPropertyXml(chunks, (record) => {
      summary.total++;
      summary.photos += record.photos.length;
      try {
        const item = mapProperty(record, sourceKey, importedAt);
        if (identifiers.has(item.source.externalId)) throw new CatalogImportError("DUPLICATE_EXTERNAL_ID");
        identifiers.add(item.source.externalId);
        items.push(item);
        for (const alert of item.alerts) summary.warnings[alert.code] = (summary.warnings[alert.code] ?? 0) + 1;
      } catch (error) {
        summary.rejected++;
        const code = error instanceof CatalogImportError ? error.code : "CONTRACT_INVALID";
        summary.errors[code] = (summary.errors[code] ?? 0) + 1;
      }
    });
    return { items, summary };
  },
};
