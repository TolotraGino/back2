import { useState, useRef } from 'react';
import JSZip from 'jszip';
import { apiRequestRaw, getApiConfig } from '../../services/apiService.js';
import { ORDER_STATES } from '../constants/orderStates.js';
import { extractApiErrorMessage, getFirstIdFromXml, getXmlText, parseXml, serializeXml } from '../../shared/xml/xmlUtils.js';

export default function CSVImportPage() {
  const CSV_ORDER_DATE_MAP_KEY = 'bo_csv_order_date_map_v1';
  const [products, setProducts] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [variants, setVariants] = useState([]);
  const [variantHeaders, setVariantHeaders] = useState([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [verifyResults, setVerifyResults] = useState(null);
  const [ordersRows, setOrdersRows] = useState([]);
  const [orderHeaders, setOrderHeaders] = useState([]);
  const [orderImportResults, setOrderImportResults] = useState(null);
  const [imagesZipName, setImagesZipName] = useState('');
  const [imagesByReference, setImagesByReference] = useState({});
  const [imagesImportResults, setImagesImportResults] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });

  // useRef : persiste entre les renders sans déclencher de re-render
  // taxRateCache : taux CSV (toFixed(4)) → id groupe TVA PS
  const taxRateCacheRef = useRef(new Map());
  // id PS de Madagascar, récupéré une seule fois
  const mgCountryIdRef = useRef(null);

  const DEFAULT_LANG_ID = '1';
  const DEFAULT_SHOP_ID = '1';
  const DEFAULT_CATEGORY_ID = '10';
  const DEFAULT_CATEGORY_PARENT_ID = '2';
  const DEFAULT_ACTIVE = '1';
  const DEFAULT_STATE = '1';
  const DEFAULT_AVAILABLE_FOR_ORDER = '1';
  const DEFAULT_SHOW_PRICE = '1';
  const DEFAULT_VISIBILITY = 'both';
  const DEFAULT_MINIMAL_QUANTITY = '1';
  const DEFAULT_ATTR_GROUP_TYPE = 'select';
  const DEFAULT_SHOP_GROUP_ID = '1';
  const DEFAULT_CURRENCY_ID = '1';
  const DEFAULT_COUNTRY_ID = '8';
  const DEFAULT_CARRIER_ID = '1';
  const ORDER_STATE_PAID_ID = String(ORDER_STATES.PAID);
  const ORDER_STATE_ERROR_ID = String(ORDER_STATES.ERROR);
  const ORDER_STATE_CANCELLED_ID = String(ORDER_STATES.CANCELLED);
  const ORDER_STATE_IN_CART_ID = String(ORDER_STATES.CART_ONLY);
  const ORDER_STATE_DEFAULT_ID = String(ORDER_STATES.DEFAULT_CREATE);
  const ORDER_PAYMENT_LABEL = 'Paiement a la livraison';
  const ORDER_PAYMENT_MODULE = 'ps_cashondelivery';

  const PRODUCT_HEADER_ALIASES = {
    date_availability_produit: 'date_availability_produit',
    available_date: 'date_availability_produit',
    nom: 'nom',
    name: 'nom',
    reference: 'reference',
    prix_ttc: 'prix_ttc',
    price: 'prix_ttc',
    taxe: 'Taxe',
    tax: 'Taxe',
    tax_rate: 'Taxe',
    categorie: 'categorie',
    category: 'categorie',
    id_category_default: 'categorie',
    prix_achat: 'prix_achat',
    wholesale_price: 'prix_achat',
  };

  const VARIANT_HEADER_ALIASES = {
    reference: 'reference',
    specificite: 'specificite',
    karazany: 'karazany',
    stock_initial: 'stock_initial',
    prix_vente_ttc: 'prix_vente_ttc',
  };

  const ORDER_HEADER_ALIASES = {
    date: 'date',
    nom: 'nom',
    name: 'nom',
    email: 'email',
    mail: 'email',
    pwd: 'pwd',
    password: 'pwd',
    adresse: 'adresse',
    address: 'adresse',
    achat: 'achat',
    achats: 'achat',
    etat: 'etat',
    status: 'etat',
  };

  const normalizeHeader = (header) =>
    String(header).replace(/^\uFEFF/, '').trim();

  const normalizeNumber = (value) => {
    if (value === null || value === undefined) return NaN;
    return parseFloat(String(value).trim().replace('%', '').replace(',', '.'));
  };

  const normalizeTaxRate = (taxRate) => {
    const parsed = normalizeNumber(taxRate);
    return Number.isNaN(parsed) ? NaN : parsed;
  };

  const normalizeInt = (value, fallback) => {
    const parsed = parseInt(String(value).trim(), 10);
    return Number.isNaN(parsed) ? fallback : String(parsed);
  };

  const sanitizeTaxGroupId = (value) => normalizeInt(value, '1');

  const normalizeDate = (value) => {
    if (!value) return '';
    const trimmed = String(value).trim();
    const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return trimmed;
  };
  const isStrictDdMmYyyy = (value) => {
    const trimmed = String(value || '').trim();
    const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return false;
    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const year = Number.parseInt(match[3], 10);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };
  const canonicalizeHeader = (header, aliases) => {
    const key = String(header || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return aliases[key] || aliases[String(header || '').toLowerCase()] || '';
  };

  const normalizeCategoryId = (value) => {
    const trimmed = String(value || '').trim();
    return /^\d+$/.test(trimmed) ? trimmed : '';
  };

  const slugify = (value) => {
    if (!value) return 'produit';
    return String(value).normalize('NFD').replace(/[^\w\s-]/g, '').trim()
      .toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-');
  };

  const escapeXml = (str) => {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  };

  // ── API ───────────────────────────────────────────────────────────────────

  const getTextFromXml = (doc, selector) => getXmlText(doc, selector);

  const apiGetXml = async (path) => {
    const r = await apiRequestRaw(path, { method: 'GET' });
    if (!r.ok) throw new Error(`HTTP ${r.status}${extractApiErrorMessage(r.text) ? ' - ' + extractApiErrorMessage(r.text) : ''}`);
    return r.text;
  };

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  const apiPostXml = async (path, xml, tagName, retries = 3) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      const r = await apiRequestRaw(path, { method: 'POST', headers: { 'Content-Type': 'application/xml' }, body: xml });
      if ((r.status === 502 || r.status === 503) && attempt < retries - 1) {
        await sleep(1500);
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}${extractApiErrorMessage(r.text) ? ' - ' + extractApiErrorMessage(r.text) : ''}`);
      return getFirstIdFromXml(parseXml(r.text), tagName);
    }
    throw new Error('HTTP 502 (échec après 3 tentatives)');
  };

  const apiPutXml = async (path, xml, retries = 3) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      const r = await apiRequestRaw(path, { method: 'PUT', headers: { 'Content-Type': 'application/xml' }, body: xml });
      if ((r.status === 502 || r.status === 503) && attempt < retries - 1) {
        await sleep(1500);
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}${extractApiErrorMessage(r.text) ? ' - ' + extractApiErrorMessage(r.text) : ''}`);
      return;
    }
    throw new Error('HTTP 502 (échec après 3 tentatives)');
  };

  // Supprime tous les champs read-only PS8 d'un nœud produit avant PUT
  const stripReadOnlyFields = (productNode) => {
    ['manufacturer_name', 'quantity', 'id_default_image', 'id_default_combination', 'position_in_category']
      .forEach((f) => productNode.querySelectorAll(f).forEach((n) => n.parentNode.removeChild(n)));
    const assoc = productNode.querySelector('associations');
    if (assoc) assoc.parentNode.removeChild(assoc);
  };

  // ── TAXE ──────────────────────────────────────────────────────────────────

  const getMadagascarCountryId = async () => {
    if (mgCountryIdRef.current) return mgCountryIdRef.current;
    try {
      const xml = await apiGetXml('/countries/?filter[iso_code]=[MG]&display=full');
      const id = getFirstIdFromXml(parseXml(xml), 'country');
      if (id) { mgCountryIdRef.current = id; return id; }
    } catch (_) {}
    mgCountryIdRef.current = '109';
    return '109';
  };

  const getTaxRateFromGroupId = (taxGroupId) => {
    for (const [rate, gid] of taxRateCacheRef.current.entries()) {
      if (String(gid) === String(taxGroupId)) return parseFloat(rate);
    }
    return 0;
  };

  // Cherche ou crée le groupe TVA correspondant au taux CSV dans PS.
  // Résultat mis en cache dans taxRateCacheRef (useRef, persistant entre renders).
  const ensureTaxGroupId = async (csvTaxRate) => {
    const normalized = normalizeTaxRate(csvTaxRate);
    if (Number.isNaN(normalized)) return '1';

    const cacheKey = normalized.toFixed(4);
    if (taxRateCacheRef.current.has(cacheKey)) return taxRateCacheRef.current.get(cacheKey);

    // 1. Chercher dans /taxes/ une taxe avec ce taux exact (PS stocke "11.6500")
    try {
      const taxesXml = await apiGetXml('/taxes/?display=full');
      const taxes = Array.from(parseXml(taxesXml).querySelectorAll('tax'));
      for (const t of taxes) {
        const tId = t.getAttribute('id') || t.querySelector('id')?.textContent?.trim();
        const rateNode = t.querySelector('rate');
        if (!tId || !rateNode) continue;
        const existingRate = parseFloat(rateNode.textContent.trim().replace(',', '.'));
        if (Math.abs(existingRate - normalized) < 0.001) {
          try {
            const rulesXml = await apiGetXml(`/tax_rules/?filter[id_tax]=[${tId}]&display=full`);
            const gIdNode = parseXml(rulesXml).querySelector('tax_rule > id_tax_rules_group');
            if (gIdNode) {
              const gId = sanitizeTaxGroupId(gIdNode.textContent.trim());
              taxRateCacheRef.current.set(cacheKey, gId);
              return gId;
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 2. Pas trouvé → créer taxe + groupe + règle pour Madagascar
    const label = `MG TVA ${normalized}%`;
    const esc = escapeXml(label);

    // 2a. Créer la taxe
    const taxId = await apiPostXml('/taxes/', [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
      '  <tax>',
      `    <rate>${normalized.toFixed(4)}</rate>`,
      '    <active>1</active>',
      '    <name>',
      `      <language id="${DEFAULT_LANG_ID}">${esc}</language>`,
      '    </name>',
      '  </tax>',
      '</prestashop>',
    ].join('\n'), 'tax');
    if (!taxId) throw new Error(`Echec création taxe ${normalized}%`);

    // 2b. Créer le groupe de taxe
    const groupId = sanitizeTaxGroupId(await apiPostXml('/tax_rule_groups/', [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
      '  <tax_rule_group>',
      `    <name>${esc}</name>`,
      '    <active>1</active>',
      '  </tax_rule_group>',
      '</prestashop>',
    ].join('\n'), 'tax_rule_group'));
    if (!groupId) throw new Error(`Echec création groupe TVA ${normalized}%`);

    // 2c. Créer la règle de taxe pour Madagascar
    const mgId = await getMadagascarCountryId();
    await apiPostXml('/tax_rules/', [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
      '  <tax_rule>',
      `    <id_tax_rules_group>${groupId}</id_tax_rules_group>`,
      `    <id_tax>${taxId}</id_tax>`,
      `    <id_country>${mgId}</id_country>`,
      '    <id_state>0</id_state>',
      '    <zipcode_from>0</zipcode_from>',
      '    <zipcode_to>0</zipcode_to>',
      '    <behavior>0</behavior>',
      '    <description></description>',
      '  </tax_rule>',
      '</prestashop>',
    ].join('\n'), 'tax_rule');

    const finalGroupId = sanitizeTaxGroupId(groupId);
    taxRateCacheRef.current.set(cacheKey, finalGroupId);
    return finalGroupId;
  };

  // getTaxGroupId sync — appeler APRÈS ensureTaxGroupId
  const getTaxGroupId = (csvTaxRate) => {
    const normalized = normalizeTaxRate(csvTaxRate);
    if (Number.isNaN(normalized)) return '1';
    return sanitizeTaxGroupId(taxRateCacheRef.current.get(normalized.toFixed(4)) || '1');
  };

  // HT calculé avec le taux PS réel pour que PS réaffiche le TTC exact du CSV
  const convertPriceToHTMapped = (priceTTC, csvTaxRate) => {
    const groupId = getTaxGroupId(csvTaxRate);
    const rate = getTaxRateFromGroupId(groupId);
    const ttc = normalizeNumber(priceTTC) || 0;
    if (ttc === 0) return '0';
    const effectiveRate = rate > 0 ? rate : (normalizeTaxRate(csvTaxRate) || 0);
    return (ttc / (1 + effectiveRate / 100)).toFixed(6);
  };

  // ── CSV PARSING ───────────────────────────────────────────────────────────

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let insideQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(current.trim()); current = '';
      } else { current += char; }
    }
    result.push(current.trim());
    return result;
  };

  const parseCsvText = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV doit avoir en-tete + données');

    const parsedHeaders = parseCSVLine(lines[0]).map(normalizeHeader);
    const canonicalHeaders = parsedHeaders.map((h) => canonicalizeHeader(h, PRODUCT_HEADER_ALIASES));
    const invalidHeaders = parsedHeaders.filter((h, idx) => !canonicalHeaders[idx]);
    if (invalidHeaders.length > 0) throw new Error(`Nom de colonne non conforme (produits): ${invalidHeaders.join(', ')}`);
    const canonicalHeaderSet = new Set(canonicalHeaders);

    const required = ['date_availability_produit', 'nom', 'reference', 'prix_ttc', 'Taxe', 'categorie', 'prix_achat'];
    const missing = required.filter(f => !canonicalHeaderSet.has(f));
    if (missing.length > 0) throw new Error(`Colonnes manquantes: ${missing.join(', ')}`);
    if (canonicalHeaderSet.size !== required.length) throw new Error('Nom de colonne non conforme (produits): colonnes en trop detectees');

    const data = [], validationErrors = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (!row.length) continue;
      const obj = {};
      parsedHeaders.forEach((h, idx) => {
        const v = row[idx] ?? '';
        obj[h] = v;
        const alias = canonicalizeHeader(h, PRODUCT_HEADER_ALIASES);
        if (alias) obj[alias] = v;
      });
      if (!obj.nom?.trim())                                                 { validationErrors.push(`Ligne ${i+1}: nom vide`); continue; }
      if (!obj.reference?.trim())                                           { validationErrors.push(`Ligne ${i+1}: reference vide`); continue; }
      if (!obj.prix_ttc || Number.isNaN(normalizeNumber(obj.prix_ttc)) || normalizeNumber(obj.prix_ttc) <= 0) { validationErrors.push(`Ligne ${i+1}: prix_ttc invalide (montant positif requis)`); continue; }
      if (!obj.Taxe || Number.isNaN(normalizeTaxRate(obj.Taxe)))           { validationErrors.push(`Ligne ${i+1}: Taxe invalide`); continue; }
      if (!obj.categorie?.trim())                                           { validationErrors.push(`Ligne ${i+1}: categorie vide`); continue; }
      if (!obj.prix_achat || Number.isNaN(normalizeNumber(obj.prix_achat)) || normalizeNumber(obj.prix_achat) <= 0){ validationErrors.push(`Ligne ${i+1}: prix_achat invalide (montant positif requis)`); continue; }
      data.push(obj);
    }
    return { headers: parsedHeaders, data, validationErrors };
  };

  const parseVariantsText = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV doit avoir en-tete + données');

    const parsedHeaders = parseCSVLine(lines[0]).map(normalizeHeader);
    const canonicalHeaders = parsedHeaders.map((h) => canonicalizeHeader(h, VARIANT_HEADER_ALIASES));
    const invalidHeaders = parsedHeaders.filter((h, idx) => !canonicalHeaders[idx]);
    if (invalidHeaders.length > 0) throw new Error(`Nom de colonne non conforme (declinaisons): ${invalidHeaders.join(', ')}`);
    const data = [], validationErrors = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (!row.length) continue;
      const obj = {};
      parsedHeaders.forEach((h, idx) => {
        const v = row[idx] ?? '';
        obj[h] = v;
        // Gestion accent specificité → specificite
        const alias = canonicalizeHeader(h, VARIANT_HEADER_ALIASES);
        if (alias && alias !== h) obj[alias] = v;
      });
      if (!obj.reference?.trim()) { validationErrors.push(`Ligne ${i+1}: reference vide`); continue; }
      data.push(obj);
    }
    return { headers: parsedHeaders, data, validationErrors };
  };

  const parseOrdersText = (text) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error('CSV commandes doit avoir en-tete + donnees');

    const parsedHeaders = parseCSVLine(lines[0]).map(normalizeHeader);
    const canonicalHeaders = parsedHeaders.map((h) => canonicalizeHeader(h, ORDER_HEADER_ALIASES));
    const invalidHeaders = parsedHeaders.filter((h, idx) => !canonicalHeaders[idx]);
    if (invalidHeaders.length > 0) throw new Error(`Nom de colonne non conforme (commandes): ${invalidHeaders.join(', ')}`);
    const canonicalHeaderSet = new Set(canonicalHeaders);
    const required = ['date', 'nom', 'email', 'pwd', 'adresse', 'achat', 'etat'];
    const missing = required.filter((f) => !canonicalHeaderSet.has(f));
    if (missing.length > 0) throw new Error(`Colonnes manquantes (commandes): ${missing.join(', ')}`);
    if (canonicalHeaderSet.size !== required.length) throw new Error('Nom de colonne non conforme (commandes): colonnes en trop detectees');

    const data = [];
    const validationErrors = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (!row.length) continue;
      const obj = {};
      parsedHeaders.forEach((h, idx) => {
        const v = row[idx] ?? '';
        obj[h] = v;
        const alias = canonicalizeHeader(h, ORDER_HEADER_ALIASES);
        if (alias) obj[alias] = v;
      });
      if (!isStrictDdMmYyyy(obj.date)) { validationErrors.push(`Ligne ${i + 1}: format de date invalide (attendu DD/MM/YYYY)`); continue; }
      if (!String(obj.nom || '').trim()) { validationErrors.push(`Ligne ${i + 1}: nom vide`); continue; }
      if (!String(obj.email || '').trim()) { validationErrors.push(`Ligne ${i + 1}: email vide`); continue; }
      if (!String(obj.achat || '').trim()) { validationErrors.push(`Ligne ${i + 1}: achat vide`); continue; }
      data.push(obj);
    }

    return { headers: parsedHeaders, data, validationErrors };
  };

  const normalizeOrderStateId = (value) => {
    const raw = String(value || '').trim()
    if (!raw) return ORDER_STATE_IN_CART_ID
    const v = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (v.includes('panier') || v.includes('cart')) return ORDER_STATE_IN_CART_ID;
    if (v.includes('annul')) return ORDER_STATE_CANCELLED_ID;
    if (v.includes('echec') || v.includes('erreur') || v.includes('failed')) return ORDER_STATE_ERROR_ID;
    if (v.includes('accept')) return ORDER_STATE_PAID_ID;
    return ORDER_STATE_IN_CART_ID;
  };

  const isMd5 = (value) => /^[a-f0-9]{32}$/i.test(String(value || '').trim());
  const buildFallbackSecureKey = (seed) => {
    const raw = String(seed || 'import-csv-secure-key');
    let h = 0;
    for (let i = 0; i < raw.length; i += 1) {
      h = ((h << 5) - h) + raw.charCodeAt(i);
      h |= 0;
    }
    const hex = Math.abs(h).toString(16);
    return (hex.repeat(8)).slice(0, 32).padEnd(32, '0');
  };

  const splitCustomerName = (fullName) => {
    const clean = String(fullName || '').trim().replace(/\s+/g, ' ');
    if (!clean) return { firstname: 'Client', lastname: 'CSV' };
    const parts = clean.split(' ');
    if (parts.length === 1) return { firstname: parts[0], lastname: parts[0] };
    return { firstname: parts[0], lastname: parts.slice(1).join(' ') };
  };

  const normalizeCustomerPassword = (pwd) => {
    const base = String(pwd || '').trim() || 'CsvAchat#2026';
    const padded = base.length < 8 ? `${base}Csv#2026` : base;
    return padded.slice(0, 64);
  };

  const asNumberOrZero = (value) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  };

  const normalizeReferenceKey = (value) => String(value || '').trim().toUpperCase();

  const loadCsvOrderDateMap = () => {
    try {
      const raw = localStorage.getItem(CSV_ORDER_DATE_MAP_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  };

  const saveCsvOrderDateMap = (map) => {
    try {
      localStorage.setItem(CSV_ORDER_DATE_MAP_KEY, JSON.stringify(map));
    } catch (_) {}
  };

  const upsertCsvOrderDate = (orderId, csvDate) => {
    const normalized = normalizeDate(csvDate || '');
    if (!orderId || !normalized) return;
    const map = loadCsvOrderDateMap();
    map[String(orderId)] = normalized;
    saveCsvOrderDateMap(map);
  };

  const parsePurchaseItems = (rawValue) => {
    const raw = String(rawValue || '').trim();
    if (!raw) return [];

    const normalized = raw
      .replace(/'/g, '"')
      .replace(/;/g, ',')
      .replace(/\(/g, '[')
      .replace(/\)/g, ']');

    try {
      const parsed = JSON.parse(normalized);
      const tuples = Array.isArray(parsed) ? parsed : [];
      return tuples
        .map((entry) => Array.isArray(entry) ? entry : [])
        .filter((entry) => entry.length >= 2)
        .map((entry) => ({
          reference: String(entry[0] || '').trim(),
          quantity: Math.max(1, Number.parseInt(entry[1], 10) || 1),
          variant: String(entry[2] || '').trim(),
        }))
        .filter((entry) => entry.reference);
    } catch (_) {
      const matches = [];
      const regex = /["']([^"']+)["']\s*[;,]\s*["']?(\d+)["']?\s*[;,]\s*["']([^"']*)["']/g;
      let m = regex.exec(raw);
      while (m) {
        matches.push({
          reference: String(m[1] || '').trim(),
          quantity: Math.max(1, Number.parseInt(m[2], 10) || 1),
          variant: String(m[3] || '').trim(),
        });
        m = regex.exec(raw);
      }
      return matches.filter((entry) => entry.reference);
    }
  };

  // ── FILE HANDLERS ─────────────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setError(''); setResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { headers: h, data, validationErrors } = parseCsvText(ev.target.result);
        if (!data.length) { setError('Aucune ligne valide. ' + validationErrors.join('; ')); return; }
        if (validationErrors.length) setError(`${validationErrors.length} ligne(s) ignoree(s): ${validationErrors.slice(0,3).join('; ')}...`);
        setHeaders(h); setProducts(data);
      } catch (err) { setError(`Erreur CSV: ${err.message}`); }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleVariantsFileChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setError(''); setResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { headers: h, data, validationErrors } = parseVariantsText(ev.target.result);
        if (!data.length) { setError('Aucune ligne valide. ' + validationErrors.join('; ')); return; }
        if (validationErrors.length) setError(`${validationErrors.length} ligne(s) ignoree(s): ${validationErrors.slice(0,3).join('; ')}...`);
        setVariantHeaders(h); setVariants(data);
      } catch (err) { setError(`Erreur CSV: ${err.message}`); }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleOrdersFileChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setError(''); setOrderImportResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { headers: h, data, validationErrors } = parseOrdersText(ev.target.result);
        if (!data.length) { setError('Aucune ligne commande valide. ' + validationErrors.join('; ')); return; }
        if (validationErrors.length) setError(`${validationErrors.length} ligne(s) commande ignoree(s): ${validationErrors.slice(0, 3).join('; ')}...`);
        setOrderHeaders(h); setOrdersRows(data);
      } catch (err) { setError(`Erreur CSV commandes: ${err.message}`); }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImagesZipChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const zip = await JSZip.loadAsync(file);
      const map = {};
      const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp']);
      const entries = Object.values(zip.files).filter((entry) => !entry.dir);

      for (const entry of entries) {
        const fullPath = entry.name || '';
        const lowerPath = fullPath.toLowerCase();
        // Ignore macOS metadata and hidden files.
        if (lowerPath.startsWith('__macosx/')) continue;
        if (lowerPath.endsWith('/.ds_store') || lowerPath.endsWith('.ds_store')) continue;

        const name = fullPath.split('/').pop() || '';
        if (!name || name.startsWith('._') || name.startsWith('.')) continue;
        const dotIndex = name.lastIndexOf('.');
        if (dotIndex <= 0) continue;
        const ext = name.slice(dotIndex).toLowerCase();
        if (!allowed.has(ext)) continue;
        const stem = name.slice(0, dotIndex);
        const refKey = normalizeReferenceKey(stem);
        if (!refKey) continue;
        const blob = await entry.async('blob');
        // Keep the first valid image per reference to avoid duplicate counts.
        if (!map[refKey]) {
          map[refKey] = { blob, filename: name, contentType: blob.type || `image/${ext.replace('.', '')}` };
        }
      }

      setImagesByReference(map);
      setImagesZipName(file.name);
      if (Object.keys(map).length === 0) {
        setError('ZIP charge mais aucune image exploitable trouvée (jpg, jpeg, png, webp).');
      }
    } catch (err) {
      setError(`Erreur ZIP images: ${err.message}`);
      setImagesByReference({});
      setImagesZipName('');
    }
  };

  // ── PRODUIT ───────────────────────────────────────────────────────────────

  const findProductByReference = async (reference) => {
    const xml = await apiGetXml(`/products/?filter[reference]=[${encodeURIComponent(reference)}]&display=full`);
    const doc = parseXml(xml);
    const id = getFirstIdFromXml(doc, 'product');
    if (!id) return null;
    return { id, price: getTextFromXml(doc, 'product > price') || '0', taxGroupId: getTextFromXml(doc, 'product > id_tax_rules_group') || '1' };
  };

  const uploadProductImage = async (productId, imageEntry) => {
    if (!productId || !imageEntry?.blob) return false;
    const formData = new FormData();
    formData.append('image', imageEntry.blob, imageEntry.filename || `product-${productId}.jpg`);
    const response = await apiRequestRaw(`/images/products/${productId}`, {
      method: 'POST',
      body: formData,
    });
    return response.ok;
  };

  const handleImportImagesOnly = async () => {
    const refs = Object.keys(imagesByReference)
    if (refs.length === 0) {
      setError('Charge d abord un ZIP images.')
      return
    }

    setImporting(true)
    setError('')
    setImagesImportResults(null)

    const summary = { total: refs.length, success: 0, failed: 0, errors: [] }

    for (let i = 0; i < refs.length; i += 1) {
      const ref = refs[i]
      const imageEntry = imagesByReference[ref]
      try {
        const product = await findProductByReference(ref)
        if (!product?.id) throw new Error(`Produit introuvable pour reference ${ref}`)
        const ok = await uploadProductImage(product.id, imageEntry)
        if (!ok) throw new Error('Upload image echoue')
        summary.success += 1
      } catch (err) {
        summary.failed += 1
        summary.errors.push({ reference: ref, error: err.message })
      }
    }

    setImagesImportResults(summary)
    setImporting(false)
  }

  const buildProductXML = (csvRow, categoryId, taxGroupId, priceHT, hasVariants) => {
    const safeTaxGroupId = sanitizeTaxGroupId(taxGroupId);
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
      '  <product>',
      `    <name><language id="${DEFAULT_LANG_ID}">${escapeXml(csvRow.nom || '')}</language></name>`,
      `    <link_rewrite><language id="${DEFAULT_LANG_ID}">${escapeXml(slugify(csvRow.nom || 'produit'))}</language></link_rewrite>`,
      `    <price>${priceHT}</price>`,
      `    <id_tax_rules_group>${safeTaxGroupId}</id_tax_rules_group>`,
      `    <id_shop_default>${DEFAULT_SHOP_ID}</id_shop_default>`,
      `    <id_category_default>${categoryId}</id_category_default>`,
      ...(hasVariants ? ['    <type>combinations</type>'] : []),
      `    <state>${DEFAULT_STATE}</state>`,
      `    <active>${DEFAULT_ACTIVE}</active>`,
      `    <available_for_order>${DEFAULT_AVAILABLE_FOR_ORDER}</available_for_order>`,
      `    <show_price>${DEFAULT_SHOW_PRICE}</show_price>`,
      `    <visibility>${DEFAULT_VISIBILITY}</visibility>`,
      `    <minimal_quantity>${DEFAULT_MINIMAL_QUANTITY}</minimal_quantity>`,
    ];
    if (csvRow.reference?.trim()) lines.push(`    <reference>${escapeXml(csvRow.reference)}</reference>`);
    if (csvRow.date_availability_produit?.trim()) lines.push(`    <available_date>${escapeXml(normalizeDate(csvRow.date_availability_produit))}</available_date>`);
    if (csvRow.prix_achat?.trim()) {
      const w = normalizeNumber(csvRow.prix_achat);
      if (!Number.isNaN(w)) lines.push(`    <wholesale_price>${w.toFixed(2)}</wholesale_price>`);
    }
    lines.push(`    <associations><categories><category><id>${categoryId}</id></category></categories></associations>`);
    lines.push('  </product>', '</prestashop>');
    return lines.join('\n');
  };

  const ensureProductTypeCombinations = async (productId) => {
    const xml = await apiGetXml(`/products/${productId}`);
    const doc = parseXml(xml);
    const node = doc.querySelector('product');
    if (!node) return;
    stripReadOnlyFields(node);
    const typeNode = node.querySelector('type') || (() => { const n = doc.createElement('type'); node.appendChild(n); return n; })();
    typeNode.textContent = 'combinations';
    const stateNode = node.querySelector('state') || (() => { const n = doc.createElement('state'); node.appendChild(n); return n; })();
    stateNode.textContent = DEFAULT_STATE;
    await apiPutXml(`/products/${productId}`, serializeXml(doc));
  };

  const refreshProductCombinationsCache = async (productId, firstComboId) => {
    try {
      const xml = await apiGetXml(`/products/${productId}`);
      const doc = parseXml(xml);
      const node = doc.querySelector('product');
      if (!node) return;
      stripReadOnlyFields(node);
      const cacheNode = node.querySelector('cache_default_attribute') || (() => { const n = doc.createElement('cache_default_attribute'); node.appendChild(n); return n; })();
      cacheNode.textContent = String(firstComboId);
      await apiPutXml(`/products/${productId}`, serializeXml(doc));
    } catch (_) {}
  };

  // ── CATÉGORIE ─────────────────────────────────────────────────────────────

  const ensureCategoryId = async (name, cache) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return DEFAULT_CATEGORY_ID;
    if (cache.has(trimmed)) return cache.get(trimmed);

    const lookupPath = `/categories/?filter[name]=[${encodeURIComponent(trimmed)}]&display=full`;
    const existingId = getFirstIdFromXml(parseXml(await apiGetXml(lookupPath)), 'category');
    if (existingId) { cache.set(trimmed, existingId); return existingId; }

    const newId = await apiPostXml('/categories/', [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
      '  <category>',
      `    <id_parent>${DEFAULT_CATEGORY_PARENT_ID}</id_parent>`,
      '    <active>1</active>',
      `    <name><language id="${DEFAULT_LANG_ID}">${escapeXml(trimmed)}</language></name>`,
      `    <link_rewrite><language id="${DEFAULT_LANG_ID}">${escapeXml(slugify(trimmed))}</language></link_rewrite>`,
      '  </category>',
      '</prestashop>',
    ].join('\n'), 'category');
    const finalId = newId || DEFAULT_CATEGORY_ID;
    cache.set(trimmed, finalId);
    return finalId;
  };

  // ── ATTRIBUTS ─────────────────────────────────────────────────────────────

  const ensureAttributeGroupId = async (name, cache) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return '';
    if (cache.has(trimmed)) return cache.get(trimmed);
    const lookupPath = `/product_options/?filter[name]=[${encodeURIComponent(trimmed)}]&display=full`;
    let doc = parseXml(await apiGetXml(lookupPath));
    let id = getFirstIdFromXml(doc, 'product_option');
    if (!id) {
      await apiPostXml('/product_options/', [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
        '  <product_option>',
        `    <name><language id="${DEFAULT_LANG_ID}">${escapeXml(trimmed)}</language></name>`,
        `    <public_name><language id="${DEFAULT_LANG_ID}">${escapeXml(trimmed)}</language></public_name>`,
        `    <group_type>${DEFAULT_ATTR_GROUP_TYPE}</group_type>`,
        '  </product_option>',
        '</prestashop>',
      ].join('\n'), 'product_option');
      doc = parseXml(await apiGetXml(lookupPath));
      id = getFirstIdFromXml(doc, 'product_option');
    }
    if (id) cache.set(trimmed, id);
    return id;
  };

  const ensureAttributeValueId = async (groupId, value, cache) => {
    const trimmed = String(value || '').trim();
    if (!trimmed || !groupId) return '';
    const cacheKey = `${groupId}::${trimmed}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const lookupPath = `/product_option_values/?filter[id_attribute_group]=[${groupId}]&filter[name]=[${encodeURIComponent(trimmed)}]&display=full`;
    let doc = parseXml(await apiGetXml(lookupPath));
    let id = getFirstIdFromXml(doc, 'product_option_value');
    if (!id) {
      await apiPostXml('/product_option_values/', [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
        '  <product_option_value>',
        `    <id_attribute_group>${groupId}</id_attribute_group>`,
        `    <name><language id="${DEFAULT_LANG_ID}">${escapeXml(trimmed)}</language></name>`,
        '  </product_option_value>',
        '</prestashop>',
      ].join('\n'), 'product_option_value');
      doc = parseXml(await apiGetXml(lookupPath));
      id = getFirstIdFromXml(doc, 'product_option_value');
    }
    if (id) cache.set(cacheKey, id);
    return id;
  };

  // ── STOCK ─────────────────────────────────────────────────────────────────

  // GET le stock existant → modifier uniquement quantity → PUT
  // Évite les erreurs de champs manquants lors d'une construction XML from scratch
  const setStockQuantity = async (productId, combinationId, quantity) => {
    const listXml = await apiGetXml(
      `/stock_availables/?filter[id_product]=[${productId}]&filter[id_product_attribute]=[${combinationId}]&display=full`
    );
    const stockId = getFirstIdFromXml(parseXml(listXml), 'stock_available');

    if (stockId) {
      const stockDoc = parseXml(await apiGetXml(`/stock_availables/${stockId}`));
      const qtyNode = stockDoc.querySelector('quantity');
      if (qtyNode) qtyNode.textContent = String(quantity);
      await apiPutXml(`/stock_availables/${stockId}`, serializeXml(stockDoc));
    } else {
      // Dernier recours : créer
      await apiPostXml('/stock_availables/', [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
        '  <stock_available>',
        `    <id_product>${productId}</id_product>`,
        `    <id_product_attribute>${combinationId}</id_product_attribute>`,
        `    <id_shop>${DEFAULT_SHOP_ID}</id_shop>`,
        `    <id_shop_group>${DEFAULT_SHOP_GROUP_ID}</id_shop_group>`,
        `    <quantity>${quantity}</quantity>`,
        '    <depends_on_stock>0</depends_on_stock>',
        '    <out_of_stock>2</out_of_stock>',
        '  </stock_available>',
        '</prestashop>',
      ].join('\n'), 'stock_available');
    }
  };

  const findCustomerByEmail = async (email) => {
    const xml = await apiGetXml(`/customers/?filter[email]=[${encodeURIComponent(email)}]&display=full`);
    const doc = parseXml(xml);
    const node = doc.querySelector('customer');
    if (!node) return null;
    const id = getTextFromXml(node, 'id') || node.getAttribute('id');
    if (!id) return null;
    return {
      id: String(id),
      firstname: getTextFromXml(node, 'firstname'),
      lastname: getTextFromXml(node, 'lastname'),
      secureKey: getTextFromXml(node, 'secure_key'),
    };
  };

  const createCustomerFromRow = async (row) => {
    const { firstname, lastname } = splitCustomerName(row.nom);
    const email = String(row.email || '').trim();
    const password = normalizeCustomerPassword(row.pwd);
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
      '  <customer>',
      `    <id_default_group>3</id_default_group>`,
      `    <id_lang>${DEFAULT_LANG_ID}</id_lang>`,
      '    <active>1</active>',
      `    <firstname>${escapeXml(firstname)}</firstname>`,
      `    <lastname>${escapeXml(lastname)}</lastname>`,
      `    <email>${escapeXml(email)}</email>`,
      `    <passwd>${escapeXml(password)}</passwd>`,
      '    <associations>',
      '      <groups>',
      '        <group>',
      '          <id>3</id>',
      '        </group>',
      '      </groups>',
      '    </associations>',
      '  </customer>',
      '</prestashop>',
    ].join('\n');
    const customerId = await apiPostXml('/customers/', xml, 'customer');
    // Recharger le customer pour récupérer secure_key généré par PrestaShop.
    const createdXml = await apiGetXml(`/customers/${customerId}`);
    const createdDoc = parseXml(createdXml);
    return {
      id: String(customerId),
      firstname: getTextFromXml(createdDoc, 'customer > firstname') || firstname,
      lastname: getTextFromXml(createdDoc, 'customer > lastname') || lastname,
      secureKey: getTextFromXml(createdDoc, 'customer > secure_key') || '',
    };
  };

  const createAddressForCustomer = async (customer, row) => {
    const alias = `Import ${normalizeDate(row.date) || 'CSV'}`.slice(0, 32);
    const address1 = String(row.adresse || '').trim() || 'Adresse importee CSV';
    const city = address1.slice(0, 64) || 'Antananarivo';
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
      '  <address>',
      `    <id_customer>${customer.id}</id_customer>`,
      `    <id_country>${DEFAULT_COUNTRY_ID}</id_country>`,
      `    <alias>${escapeXml(alias)}</alias>`,
      `    <lastname>${escapeXml(customer.lastname || 'Client')}</lastname>`,
      `    <firstname>${escapeXml(customer.firstname || 'CSV')}</firstname>`,
      `    <address1>${escapeXml(address1)}</address1>`,
      '    <postcode>101</postcode>',
      `    <city>${escapeXml(city)}</city>`,
      '  </address>',
      '</prestashop>',
    ].join('\n');
    return apiPostXml('/addresses/', xml, 'address');
  };

  const resolveCarrierId = async () => {
    try {
      const xml = await apiGetXml('/carriers/?display=full');
      const doc = parseXml(xml);
      const carriers = Array.from(doc.querySelectorAll('carrier'));
      const isActive = (carrier) => getTextFromXml(carrier, 'active') !== '0' && getTextFromXml(carrier, 'deleted') !== '1';
      const isFree = (carrier) => getTextFromXml(carrier, 'is_free') === '1';

      const activeFree = carriers.find((carrier) => isActive(carrier) && isFree(carrier));
      if (activeFree) {
        const id = getTextFromXml(activeFree, 'id') || activeFree.getAttribute('id');
        if (id) return String(id);
      }

      const active = carriers.find((carrier) => isActive(carrier));
      if (active) {
        const id = getTextFromXml(active, 'id') || active.getAttribute('id');
        if (id) return String(id);
      }

      const anyNotDeleted = carriers.find((carrier) => getTextFromXml(carrier, 'deleted') !== '1');
      if (anyNotDeleted) {
        const id = getTextFromXml(anyNotDeleted, 'id') || anyNotDeleted.getAttribute('id');
        if (id) return String(id);
      }
      return DEFAULT_CARRIER_ID;
    } catch (_) {
      return DEFAULT_CARRIER_ID;
    }
  };

  const hydrateCustomerSecureKey = async (customer) => {
    if (!customer?.id) return customer
    if (customer.secureKey) return customer
    try {
      const xml = await apiGetXml(`/customers/${customer.id}`)
      const doc = parseXml(xml)
      return {
        ...customer,
        secureKey: getTextFromXml(doc, 'customer > secure_key') || customer.secureKey || '',
      }
    } catch (_) {
      return customer
    }
  }

  const resolveCombinationByVariant = async (productId, variantLabel) => {
    const label = String(variantLabel || '').trim().toLowerCase();
    if (!label) return '0';
    const comboXml = await apiGetXml(`/combinations/?filter[id_product]=[${productId}]&display=full`);
    const comboDoc = parseXml(comboXml);
    const combos = Array.from(comboDoc.querySelectorAll('combination'));
    for (const combo of combos) {
      const comboId = getTextFromXml(combo, 'id') || combo.getAttribute('id');
      const valueIds = Array.from(combo.querySelectorAll('associations > product_option_values > product_option_value > id'))
        .map((n) => n.textContent?.trim())
        .filter(Boolean);
      for (const valueId of valueIds) {
        const valXml = await apiGetXml(`/product_option_values/${valueId}`);
        const valDoc = parseXml(valXml);
        const valueName = getTextFromXml(valDoc, 'product_option_value > name > language').toLowerCase();
        if (valueName === label && comboId) return String(comboId);
      }
    }
    return '0';
  };

  const buildCartXml = ({ customerId, addressId, carrierId, items, secureKey }) => {
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
      '  <cart>',
      `    <id_address_delivery>${addressId}</id_address_delivery>`,
      `    <id_address_invoice>${addressId}</id_address_invoice>`,
      `    <id_currency>${DEFAULT_CURRENCY_ID}</id_currency>`,
      `    <id_lang>${DEFAULT_LANG_ID}</id_lang>`,
      `    <id_customer>${customerId}</id_customer>`,
      `    <id_carrier>${carrierId}</id_carrier>`,
      `    <id_shop>${DEFAULT_SHOP_ID}</id_shop>`,
      `    <id_shop_group>${DEFAULT_SHOP_GROUP_ID}</id_shop_group>`,
      ...(secureKey ? [`    <secure_key>${escapeXml(secureKey)}</secure_key>`] : []),
      '    <recyclable>0</recyclable>',
      '    <gift>0</gift>',
      '    <mobile_theme>0</mobile_theme>',
      '    <associations>',
      '      <cart_rows>',
    ];
    items.forEach((item) => {
      lines.push('        <cart_row>');
      lines.push(`          <id_product>${item.id}</id_product>`);
      lines.push(`          <id_product_attribute>${item.attributeId || 0}</id_product_attribute>`);
      lines.push(`          <id_address_delivery>${addressId}</id_address_delivery>`);
      lines.push('          <id_customization>0</id_customization>');
      lines.push(`          <quantity>${item.quantity}</quantity>`);
      lines.push('        </cart_row>');
    });
    lines.push('      </cart_rows>');
    lines.push('    </associations>');
    lines.push('  </cart>');
    lines.push('</prestashop>');
    return lines.join('\n');
  };

  const buildOrderXml = ({ customerId, addressId, carrierId, cartId, secureKey, orderStateId, items, totalHt, totalTtc }) => {
    const money = (v) => asNumberOrZero(v).toFixed(2);
    const isPaid = String(orderStateId) === String(ORDER_STATE_PAID_ID);
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
      '  <order>',
      `    <id_cart>${cartId}</id_cart>`,
      `    <id_currency>${DEFAULT_CURRENCY_ID}</id_currency>`,
      `    <id_lang>${DEFAULT_LANG_ID}</id_lang>`,
      `    <id_customer>${customerId}</id_customer>`,
      `    <id_address_delivery>${addressId}</id_address_delivery>`,
      `    <id_address_invoice>${addressId}</id_address_invoice>`,
      `    <id_carrier>${carrierId}</id_carrier>`,
      `    <id_shop>${DEFAULT_SHOP_ID}</id_shop>`,
      `    <id_shop_group>${DEFAULT_SHOP_GROUP_ID}</id_shop_group>`,
      `    <current_state>${orderStateId}</current_state>`,
      `    <valid>${isPaid ? '1' : '0'}</valid>`,
      `    <module>${ORDER_PAYMENT_MODULE}</module>`,
      `    <payment>${ORDER_PAYMENT_LABEL}</payment>`,
      ...(secureKey ? [`    <secure_key>${escapeXml(secureKey)}</secure_key>`] : []),
      `    <total_paid>${money(totalTtc)}</total_paid>`,
      `    <total_paid_tax_incl>${money(totalTtc)}</total_paid_tax_incl>`,
      `    <total_paid_tax_excl>${money(totalHt)}</total_paid_tax_excl>`,
      `    <total_paid_real>${money(isPaid ? totalTtc : 0)}</total_paid_real>`,
      `    <total_products>${money(totalHt)}</total_products>`,
      `    <total_products_wt>${money(totalTtc)}</total_products_wt>`,
      '    <total_discounts>0</total_discounts>',
      '    <total_discounts_tax_incl>0</total_discounts_tax_incl>',
      '    <total_discounts_tax_excl>0</total_discounts_tax_excl>',
      '    <total_shipping>0</total_shipping>',
      '    <total_shipping_tax_incl>0</total_shipping_tax_incl>',
      '    <total_shipping_tax_excl>0</total_shipping_tax_excl>',
      '    <total_wrapping>0</total_wrapping>',
      '    <total_wrapping_tax_incl>0</total_wrapping_tax_incl>',
      '    <total_wrapping_tax_excl>0</total_wrapping_tax_excl>',
      '    <conversion_rate>1</conversion_rate>',
      '    <associations>',
      '      <order_rows>',
    ];
    items.forEach((item) => {
      lines.push('        <order_row>');
      lines.push(`          <product_id>${item.id}</product_id>`);
      lines.push(`          <product_attribute_id>${item.attributeId || 0}</product_attribute_id>`);
      lines.push(`          <product_quantity>${item.quantity}</product_quantity>`);
      lines.push(`          <product_name>${escapeXml(item.name || '')}</product_name>`);
      lines.push(`          <product_reference>${escapeXml(item.reference || '')}</product_reference>`);
      lines.push(`          <product_price>${money(item.priceHt || item.priceTtc || 0)}</product_price>`);
      lines.push(`          <id_tax_rules_group>${item.taxGroupId || '1'}</id_tax_rules_group>`);
      lines.push(`          <unit_price_tax_incl>${money(item.priceTtc || item.priceHt || 0)}</unit_price_tax_incl>`);
      lines.push(`          <unit_price_tax_excl>${money(item.priceHt || item.priceTtc || 0)}</unit_price_tax_excl>`);
      lines.push('        </order_row>');
    });
    lines.push('      </order_rows>');
    lines.push('    </associations>');
    lines.push('  </order>');
    lines.push('</prestashop>');
    return lines.join('\n');
  };

  const createOrderHistory = async (orderId, orderStateId) => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">',
      '  <order_history>',
      `    <id_order>${orderId}</id_order>`,
      `    <id_order_state>${orderStateId}</id_order_state>`,
      '  </order_history>',
      '</prestashop>',
    ].join('\n');
    await apiPostXml('/order_histories/', xml, 'order_history');
  };

  // ── IMPORT ────────────────────────────────────────────────────────────────

  const importCatalogCsv = async (onProgress = () => {}) => {
    const importResults = {
      products: { total: products.length, success: 0, failed: 0, errors: [] },
      variants:  { total: variants.length,  success: 0, failed: 0, errors: [] },
      images: { total: 0, success: 0, failed: 0, errors: [] },
    };

    const categoryCache = new Map();
    const productCache  = new Map();
    const groupCache    = new Map();
    const valueCache    = new Map();
    const combinationsUpdated  = new Set();
    const firstComboByProduct  = new Map();

    const variantReferences = new Set(
      variants.filter(v => String(v.specificite||'').trim() && String(v.karazany||'').trim()).map(v => v.reference)
    );

    // ── Pré-chargement ───────────────────────────────────────────────────
    // Une seule passe pour remplir tous les caches avant les boucles
    onProgress('Pre-chargement produits existants...');
    try {
      const xml = await apiGetXml('/products/?display=full');
      parseXml(xml).querySelectorAll('product').forEach(p => {
        const ref = (p.querySelector('reference')?.textContent || '').trim();
        const id  = p.getAttribute('id') || p.querySelector(':scope > id')?.textContent?.trim();
        if (ref && id) productCache.set(ref, { id, price: p.querySelector('price')?.textContent || '0', taxGroupId: p.querySelector('id_tax_rules_group')?.textContent || '1' });
      });
    } catch (_) {}

    onProgress('Pre-chargement categories...');
    try {
      const xml = await apiGetXml('/categories/?display=full');
      parseXml(xml).querySelectorAll('category').forEach(c => {
        const name = (c.querySelector('name > language') || c.querySelector('name'))?.textContent?.trim();
        const id   = c.getAttribute('id') || c.querySelector(':scope > id')?.textContent?.trim();
        if (name && id) categoryCache.set(name, id);
      });
    } catch (_) {}

    onProgress('Pre-chargement taxes...');
    try {
      const [taxesXml, rulesXml] = await Promise.all([
        apiGetXml('/taxes/?display=full'),
        apiGetXml('/tax_rules/?display=full'),
      ]);
      const taxToGroup = new Map();
      parseXml(rulesXml).querySelectorAll('tax_rule').forEach(r => {
        const taxId   = r.querySelector('id_tax')?.textContent?.trim();
        const groupId = r.querySelector('id_tax_rules_group')?.textContent?.trim();
        if (taxId && groupId) taxToGroup.set(taxId, groupId);
      });
      parseXml(taxesXml).querySelectorAll('tax').forEach(t => {
        const id   = t.getAttribute('id') || t.querySelector(':scope > id')?.textContent?.trim();
        const rate = parseFloat((t.querySelector('rate')?.textContent || '').replace(',', '.'));
        if (id && !Number.isNaN(rate)) {
          const groupId = taxToGroup.get(id);
          if (groupId) taxRateCacheRef.current.set(rate.toFixed(4), sanitizeTaxGroupId(groupId));
        }
      });
    } catch (_) {}

    onProgress('Pre-chargement attributs...');
    try {
      const [groupsXml, valuesXml] = await Promise.all([
        apiGetXml('/product_options/?display=full'),
        apiGetXml('/product_option_values/?display=full'),
      ]);
      parseXml(groupsXml).querySelectorAll('product_option').forEach(o => {
        const name = (o.querySelector('name > language') || o.querySelector('name'))?.textContent?.trim();
        const id   = o.getAttribute('id') || o.querySelector(':scope > id')?.textContent?.trim();
        if (name && id) groupCache.set(name, id);
      });
      parseXml(valuesXml).querySelectorAll('product_option_value').forEach(v => {
        const name    = (v.querySelector('name > language') || v.querySelector('name'))?.textContent?.trim();
        const id      = v.getAttribute('id') || v.querySelector(':scope > id')?.textContent?.trim();
        const groupId = v.querySelector('id_attribute_group')?.textContent?.trim();
        if (name && id && groupId) valueCache.set(`${groupId}::${name}`, id);
      });
    } catch (_) {}

    // Map pour dédupliquer les créations concurrentes de catégories
    const pendingCategoryCreations = new Map();
    const ensureCategoryIdSafe = async (name, cache) => {
      const trimmed = String(name || '').trim();
      if (!trimmed) return DEFAULT_CATEGORY_ID;
      if (cache.has(trimmed)) return cache.get(trimmed);
      if (pendingCategoryCreations.has(trimmed)) return pendingCategoryCreations.get(trimmed);
      const p = ensureCategoryId(trimmed, cache);
      pendingCategoryCreations.set(trimmed, p);
      return p;
    };

    // ── Phase 2 : Construction du payload produits ───────────────────────────
    const productPayload = []
    const imageEntries   = [] // { reference, imageEntry }

    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      onProgress(`Préparation produit ${i + 1}/${products.length}`)
      try {
        const categoryId = normalizeCategoryId(product.categorie) || await ensureCategoryIdSafe(product.categorie, categoryCache)
        const taxGroupId = sanitizeTaxGroupId(await ensureTaxGroupId(product.Taxe))
        const priceHt    = convertPriceToHTMapped(product.prix_ttc, product.Taxe)
        const wholesale  = normalizeNumber(String(product.prix_achat || '0').replace(',', '.')) || 0

        const refKey     = normalizeReferenceKey(product.reference)
        const imageEntry = imagesByReference[refKey]
        if (imageEntry) { importResults.images.total++; imageEntries.push({ reference: product.reference, imageEntry }) }

        productPayload.push({
          reference:            product.reference,
          nom:                  product.nom || '',
          price_ht:             priceHt,
          wholesale_price:      wholesale,
          id_tax_rules_group:   taxGroupId,
          id_category_default:  categoryId,
          has_variants:         variantReferences.has(product.reference),
          available_date:       normalizeDate(product.date_availability_produit || '') || '',
        })
      } catch (err) {
        importResults.products.failed++
        importResults.products.errors.push({ row: `Ligne ${i + 2}`, name: product.nom, error: err.message })
      }
    }

    // ── Phase 3 : Construction du payload variants ────────────────────────────
    const variantPayload = []

    for (let i = 0; i < variants.length; i++) {
      const variant    = variants[i]
      const specificite = String(variant.specificite || '').trim()
      const karazany    = String(variant.karazany    || '').trim()
      const quantity    = normalizeInt(variant.stock_initial, 0)
      onProgress(`Préparation déclinaison ${i + 1}/${variants.length}`)

      if (!specificite || !karazany) {
        variantPayload.push({ reference: variant.reference, specificite: '', karazany: '', stock_initial: quantity, price_impact_ht: 0, id_attribute_group: 0, id_attribute_value: 0, combo_reference: '' })
        continue
      }

      try {
        const groupId = await ensureAttributeGroupId(specificite, groupCache)
        const valueId = await ensureAttributeValueId(groupId, karazany, valueCache)
        if (!valueId) throw new Error('Valeur attribut non créée')

        const prodEntry    = productPayload.find(p => p.reference === variant.reference)
        const taxRate      = prodEntry ? (getTaxRateFromGroupId(prodEntry.id_tax_rules_group) || 0) : 0
        const pttc         = normalizeNumber(String(variant.prix_vente_ttc || '0').replace(',', '.'))
        const comboPriceHt = (!Number.isNaN(pttc) && pttc > 0) ? pttc / (1 + taxRate / 100) : (parseFloat(prodEntry?.price_ht || 0))
        const priceImpact  = parseFloat((comboPriceHt - parseFloat(prodEntry?.price_ht || 0)).toFixed(6))

        variantPayload.push({
          reference:          variant.reference,
          specificite,
          karazany,
          stock_initial:      quantity,
          price_impact_ht:    priceImpact,
          id_attribute_group: groupId,
          id_attribute_value: valueId,
          combo_reference:    `${variant.reference}-${slugify(karazany)}`,
        })
      } catch (err) {
        importResults.variants.failed++
        importResults.variants.errors.push({ row: `Ligne ${i + 2}`, name: variant.reference, error: err.message })
      }
    }

    // ── Phase 4 : Un seul appel PHP bulk ─────────────────────────────────────
    onProgress('Import en cours (traitement serveur)...')
    try {
      const { baseUrl, token } = getApiConfig()
      const psBase = baseUrl.replace(/\/api\/?$/, '')
      const params = new URLSearchParams({ fc: 'module', module: 'stockapi', controller: 'import' })
      if (token) params.set('ws_key', token)

      const res = await fetch(`${psBase}/index.php?${params}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ products: productPayload, variants: variantPayload }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      if (data.ok && data.results) {
        importResults.products.success += data.results.products.success
        importResults.products.failed  += data.results.products.failed
        importResults.products.errors.push(...data.results.products.errors)
        importResults.variants.success += data.results.variants.success
        importResults.variants.failed  += data.results.variants.failed
        importResults.variants.errors.push(...data.results.variants.errors)
      }

      // ── Phase 5 : Upload images ─────────────────────────────────────────────
      const productIds = data.product_ids || {}
      for (const { reference, imageEntry } of imageEntries) {
        const pid = productIds[reference]
        if (!pid) continue
        onProgress(`Image: ${reference}`)
        const ok = await uploadProductImage(pid, imageEntry)
        if (ok) importResults.images.success++
        else { importResults.images.failed++; importResults.images.errors.push({ row: reference, name: reference, error: 'Upload image échoué' }) }
      }
    } catch (err) {
      importResults.products.errors.push({ row: 'Import', name: 'Endpoint PHP', error: err.message })
    }

    return importResults;
  };

  const importOrdersCsv = async (onProgress = () => {}) => {
    const summary = { total: ordersRows.length, success: 0, failed: 0, cartsOnly: 0, errors: [] };
    const customerCache = new Map();
    const carrierId = await resolveCarrierId();

    for (let i = 0; i < ordersRows.length; i++) {
      const row = ordersRows[i];
      const rowLabel = `Ligne ${i + 2}`;
      let stage = 'initialisation';
      try {
        stage = 'validation email';
        const email = String(row.email || '').trim().toLowerCase();
        if (!email) throw new Error('email manquant');

        stage = 'recherche/creation client';
        let customer = customerCache.get(email) || await findCustomerByEmail(email);
        if (!customer) customer = await createCustomerFromRow(row);
        if (!customer?.id) throw new Error('client introuvable/non cree');
        customer = await hydrateCustomerSecureKey(customer);
        const effectiveSecureKey = isMd5(customer.secureKey) ? customer.secureKey : buildFallbackSecureKey(email);
        customer = { ...customer, secureKey: effectiveSecureKey };
        customerCache.set(email, customer);

        stage = 'parsing achats';
        const orderItemsRaw = parsePurchaseItems(row.achat);
        if (!orderItemsRaw.length) throw new Error('achat invalide: aucun article detecte');

        stage = 'resolution articles';
        const detailedItems = [];
        for (const item of orderItemsRaw) {
          const product = await findProductByReference(item.reference);
          if (!product?.id) throw new Error(`produit introuvable: ${item.reference}`);

          const productXml = await apiGetXml(`/products/${product.id}`);
          const productDoc = parseXml(productXml);
          const name = getTextFromXml(productDoc, 'product > name > language');
          const basePriceHt = asNumberOrZero(normalizeNumber(getTextFromXml(productDoc, 'product > price')));

          const attributeId = await resolveCombinationByVariant(product.id, item.variant);
          let priceHt = basePriceHt;
          if (attributeId !== '0') {
            try {
              const comboXml = await apiGetXml(`/combinations/${attributeId}`);
              const comboDoc = parseXml(comboXml);
              const impact = asNumberOrZero(normalizeNumber(getTextFromXml(comboDoc, 'combination > price')));
              priceHt = basePriceHt + impact;
            } catch (_) {}
          }

          let taxRate = 0;
          const taxGroupId = getTextFromXml(productDoc, 'product > id_tax_rules_group') || '1';
          try {
            const groupXml = await apiGetXml(`/tax_rule_groups/${taxGroupId}`);
            const groupDoc = parseXml(groupXml);
            const taxRuleId = getTextFromXml(groupDoc, 'tax_rule_group > tax_rule > id');
            if (taxRuleId) {
              const ruleXml = await apiGetXml(`/tax_rules/${taxRuleId}`);
              const ruleDoc = parseXml(ruleXml);
              const taxId = getTextFromXml(ruleDoc, 'tax_rule > id_tax');
              if (taxId) {
                const taxXml = await apiGetXml(`/taxes/${taxId}`);
                const taxDoc = parseXml(taxXml);
              taxRate = asNumberOrZero(normalizeNumber(getTextFromXml(taxDoc, 'tax > rate')));
              }
            }
          } catch (_) {}
          const safePriceHt = asNumberOrZero(priceHt);
          const safeTaxRate = asNumberOrZero(taxRate);
          const priceTtc = safePriceHt * (1 + safeTaxRate / 100);

          detailedItems.push({
            id: product.id,
            reference: item.reference,
            attributeId,
            quantity: item.quantity,
            name,
            priceHt: safePriceHt,
            priceTtc,
            taxGroupId,
          });
        }

        const totalHt = detailedItems.reduce((s, item) => s + asNumberOrZero(item.priceHt) * asNumberOrZero(item.quantity), 0);
        const totalTtc = detailedItems.reduce((s, item) => s + asNumberOrZero(item.priceTtc) * asNumberOrZero(item.quantity), 0);

        stage = 'creation adresse';
        const addressId = await createAddressForCustomer(customer, row);
        stage = 'creation panier';
        const cartXml = buildCartXml({
          customerId: customer.id,
          addressId,
          carrierId,
          items: detailedItems,
          secureKey: customer.secureKey || '',
        });
        const cartId = await apiPostXml('/carts', cartXml, 'cart');

        const targetOrderStateId = normalizeOrderStateId(row.etat);
        if (String(targetOrderStateId) === String(ORDER_STATE_IN_CART_ID)) {
          summary.cartsOnly++;
          summary.success++;
          continue;
        }

        stage = 'creation commande';
        // On crée d'abord la commande dans un état stable (13) puis on applique l'état CSV via history.
        const createOrderStateId = ORDER_STATE_DEFAULT_ID;
        const orderXml = buildOrderXml({
          customerId: customer.id,
          addressId,
          carrierId,
          cartId,
          secureKey: customer.secureKey || '',
          orderStateId: createOrderStateId,
          items: detailedItems,
          totalHt,
          totalTtc,
        });
        const orderId = await apiPostXml('/orders', orderXml, 'order');
        upsertCsvOrderDate(orderId, row.date);
        stage = 'historique etat';
        await createOrderHistory(orderId, targetOrderStateId);

        summary.success++;
      } catch (err) {
        summary.failed++;
        summary.errors.push({ row: rowLabel, email: row.email, error: `${err.message} (etape: ${stage})` });
      }
      onProgress(`Commande ${i + 1}/${ordersRows.length}`);
    }

    return summary;
  };

  const handleImport = async () => {
    const hasCatalogCsv = products.length > 0 || variants.length > 0;
    const hasOrdersCsv = ordersRows.length > 0;
    if (!hasCatalogCsv && !hasOrdersCsv) {
      setError('Charge au moins un CSV (produits/declinaisons/commandes).');
      return;
    }

    setImporting(true);
    setError('');
    setResults(null);
    setOrderImportResults(null);

    const prefetchSteps = hasCatalogCsv ? 4 : 0;
    const total = prefetchSteps + (hasCatalogCsv ? products.length + variants.length : 0) + (hasOrdersCsv ? ordersRows.length : 0);
    let done = 0;
    setProgress({ done: 0, total, label: 'Demarrage...' });
    const onProgress = (label) => { done += 1; setProgress({ done, total, label }); };

    const importErrors = [];

    if (hasCatalogCsv) {
      try {
        const catalogResults = await importCatalogCsv(onProgress);
        setResults(catalogResults);
      } catch (err) {
        importErrors.push(`Import produits/declinaisons: ${err.message}`);
      }
    }

    if (hasOrdersCsv) {
      try {
        const ordersResults = await importOrdersCsv(onProgress);
        setOrderImportResults(ordersResults);
      } catch (err) {
        importErrors.push(`Import commandes: ${err.message}`);
      }
    }

    if (importErrors.length > 0) {
      setError(importErrors.join(' | '));
    }

    setImporting(false);
  };

  // ── VERIFY ────────────────────────────────────────────────────────────────

  const handleVerify = async () => {
    if (!products.length && !variants.length) { setError('Charge au moins un CSV.'); return; }
    setImporting(true); setError(''); setVerifyResults(null);

    const found = [], missing = [];
    for (const p of products) {
      const ex = await findProductByReference(p.reference);
      (ex ? found : missing).push(p.reference);
    }
    let vFound = 0, vMissing = 0;
    for (const v of variants) {
      (await findProductByReference(v.reference)) ? vFound++ : vMissing++;
    }
    setVerifyResults({ products: { total: products.length, found: found.length, missing: missing.length, missingRefs: missing }, variants: { total: variants.length, found: vFound, missing: vMissing } });
    setImporting(false);
  };

  const handleReset = () => {
    setProducts([]); setHeaders([]); setVariants([]); setVariantHeaders([]);
    setOrdersRows([]); setOrderHeaders([]);
    setImagesByReference({}); setImagesZipName('');
    setError(''); setResults(null); setVerifyResults(null);
    setOrderImportResults(null);
    setImagesImportResults(null);
    taxRateCacheRef.current = new Map();
    mgCountryIdRef.current  = null;
  };

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="bo-page">
      <h1>Import CSV - Produits</h1>

      <div className="bo-card" style={{ marginBottom: '2rem' }}>
        <h2>1) Charger le CSV produits</h2>
        <input type="file" accept=".csv" onChange={handleFileChange} disabled={importing} />
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
          Colonnes: date_availability_produit, nom, reference, prix_ttc, Taxe, categorie, prix_achat
        </p>
        {products.length > 0 && <p style={{ margin: 0, color: 'var(--muted)' }}>{products.length} lignes chargees</p>}
      </div>

      <div className="bo-card" style={{ marginBottom: '2rem' }}>
        <h2>2) Charger le CSV declinaisons</h2>
        <input type="file" accept=".csv" onChange={handleVariantsFileChange} disabled={importing} />
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
          Colonnes: reference, specificite (ou specificité), karazany, stock_initial, prix_vente_ttc
        </p>
        {variants.length > 0 && <p style={{ margin: 0, color: 'var(--muted)' }}>{variants.length} lignes chargees</p>}
      </div>

      <div className="bo-card" style={{ marginBottom: '2rem' }}>
        <h2>3) Charger ZIP images produits (optionnel)</h2>
        <input type="file" accept=".zip" onChange={handleImagesZipChange} disabled={importing} />
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
          Nomme chaque image avec la reference produit (ex: T_01.jpg, C_03.png)
        </p>
        {imagesZipName && <p style={{ margin: 0, color: 'var(--muted)' }}>{imagesZipName} - {Object.keys(imagesByReference).length} image(s) detectee(s)</p>}
        <div style={{ marginTop: '0.75rem' }}>
          <button className="bo-button" onClick={handleImportImagesOnly} disabled={importing || Object.keys(imagesByReference).length === 0}>
            {importing ? 'Import en cours...' : 'Importer les images ZIP'}
          </button>
        </div>
      </div>

      <div className="bo-card" style={{ marginBottom: '2rem' }}>
        <h2>4) Charger le CSV commandes</h2>
        <input type="file" accept=".csv" onChange={handleOrdersFileChange} disabled={importing} />
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
          Colonnes: date, nom, email, pwd, adresse, achat, etat
        </p>
        {ordersRows.length > 0 && <p style={{ margin: 0, color: 'var(--muted)' }}>{ordersRows.length} lignes chargees</p>}
      </div>

      {error && (
        <div className="bo-card" style={{ backgroundColor: '#fee', borderColor: '#f88', marginBottom: '2rem' }}>
          <p style={{ color: '#c33', margin: 0 }}>⚠️ {error}</p>
        </div>
      )}

      {products.length > 0 && (
        <div className="bo-card" style={{ marginBottom: '2rem' }}>
          <h2>5) Apercu produits (10 lignes)</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="bo-table">
              <thead><tr><th>#</th>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{products.slice(0,10).map((row,idx) => (
                <tr key={idx}><td style={{fontWeight:'bold'}}>{idx+1}</td>{headers.map(h => <td key={`${idx}-${h}`}>{row[h]}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {variants.length > 0 && (
        <div className="bo-card" style={{ marginBottom: '2rem' }}>
          <h2>6) Apercu declinaisons (10 lignes)</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="bo-table">
              <thead><tr><th>#</th>{variantHeaders.map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{variants.slice(0,10).map((row,idx) => (
                <tr key={idx}><td style={{fontWeight:'bold'}}>{idx+1}</td>{variantHeaders.map(h => <td key={`${idx}-${h}`}>{row[h]}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {ordersRows.length > 0 && (
        <div className="bo-card" style={{ marginBottom: '2rem' }}>
          <h2>7) Apercu commandes (10 lignes)</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="bo-table">
              <thead><tr><th>#</th>{orderHeaders.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{ordersRows.slice(0, 10).map((row, idx) => (
                <tr key={idx}><td style={{ fontWeight: 'bold' }}>{idx + 1}</td>{orderHeaders.map((h) => <td key={`${idx}-${h}`}>{row[h]}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bo-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: importing ? '1rem' : 0 }}>
          <button className="bo-button" onClick={handleImport} disabled={importing}>
            {importing ? 'Import en cours...' : 'Importer tous les CSV'}
          </button>
          <button className="bo-button" onClick={handleVerify} disabled={importing}>
            Verifier import
          </button>
          <button className="bo-button" onClick={handleReset} disabled={importing} style={{ backgroundColor: '#999' }}>
            Reinitialiser
          </button>
        </div>

        {importing && (
          <div>
            <div style={{ background: '#e2e8f0', borderRadius: '8px', height: '10px', overflow: 'hidden' }}>
              <div style={{
                width: `${progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0}%`,
                background: 'var(--primary)',
                height: '100%',
                borderRadius: '8px',
                transition: 'width 0.25s ease',
              }} />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '6px 0 0' }}>
              {progress.label} — {progress.done}/{progress.total}
              {progress.total > 0 ? ` (${Math.min(100, Math.round((progress.done / progress.total) * 100))}%)` : ''}
            </p>
          </div>
        )}
      </div>

      {results && (
        <div className="bo-card" style={{ marginBottom: '2rem', backgroundColor: '#efe', borderColor: '#8c8' }}>
          <h2>Import termine</h2>
          <p style={{ margin: 0 }}>Produits: {results.products.success}/{results.products.total}</p>
          <p style={{ margin: 0 }}>Declinaisons: {results.variants.success}/{results.variants.total}</p>
          <p style={{ margin: 0 }}>Images: {results.images.success}/{results.images.total}</p>
          {results.products.errors.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Erreurs produits</h3>
              <ul>{results.products.errors.map((e,i) => <li key={i}>{e.row} ({e.name}): {e.error}</li>)}</ul>
            </div>
          )}
          {results.variants.errors.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Erreurs declinaisons</h3>
              <ul>{results.variants.errors.map((e,i) => <li key={i}>{e.row} ({e.name}): {e.error}</li>)}</ul>
            </div>
          )}
          {results.images.errors.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Erreurs images</h3>
              <ul>{results.images.errors.map((e,i) => <li key={i}>{e.row} ({e.name}): {e.error}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {verifyResults && (
        <div className="bo-card" style={{ marginBottom: '2rem', backgroundColor: '#f5f5ff', borderColor: '#99f' }}>
          <h2>Verification import</h2>
          <p style={{ margin: 0 }}>Produits trouves: {verifyResults.products.found}/{verifyResults.products.total}</p>
          <p style={{ margin: 0 }}>Declinaisons verifiees: {verifyResults.variants.found}/{verifyResults.variants.total}</p>
          {verifyResults.products.missing > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3>References manquantes</h3>
              <ul>{verifyResults.products.missingRefs.map(r => <li key={r}>{r}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {orderImportResults && (
        <div className="bo-card" style={{ marginBottom: '2rem', backgroundColor: '#eef8ff', borderColor: '#88b6ff' }}>
          <h2>Import commandes termine</h2>
          <p style={{ margin: 0 }}>Commandes: {orderImportResults.success}/{orderImportResults.total}</p>
          <p style={{ margin: 0 }}>Paniers uniquement: {orderImportResults.cartsOnly || 0}</p>
          {orderImportResults.errors.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Erreurs commandes</h3>
              <ul>{orderImportResults.errors.map((e, i) => <li key={i}>{e.row} ({e.email}): {e.error}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {imagesImportResults && (
        <div className="bo-card" style={{ marginBottom: '2rem', backgroundColor: '#eef8ff', borderColor: '#88b6ff' }}>
          <h2>Import images termine</h2>
          <p style={{ margin: 0 }}>Images: {imagesImportResults.success}/{imagesImportResults.total}</p>
          {imagesImportResults.errors.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Erreurs images</h3>
              <ul>{imagesImportResults.errors.map((e, i) => <li key={i}>{e.reference}: {e.error}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
