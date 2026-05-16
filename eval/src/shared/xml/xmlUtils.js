export function parseXml(text) {
  return new DOMParser().parseFromString(text, 'application/xml')
}

export function serializeXml(doc) {
  return new XMLSerializer().serializeToString(doc)
}

export function getXmlText(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() || ''
}

export function getFirstIdFromXml(doc, tagName) {
  const node = doc.querySelector(tagName)
  if (!node) return ''
  const attr = node.getAttribute('id')
  if (attr) return attr
  const idNode = node.querySelector('id')
  return idNode ? idNode.textContent.trim() : ''
}

export function extractApiErrorMessage(text) {
  if (!text) return ''
  try {
    const xml = parseXml(text)
    const node = xml.querySelector('error > message')
    return node ? node.textContent.trim() : ''
  } catch {
    return ''
  }
}
