import { createApiClient } from '../../services/apiService.js'
import { getXmlText, parseXml } from '../../shared/xml/xmlUtils.js'
import { FrontCustomer } from '../models/FrontCustomer.js'

export class CustomerDirectoryService {
  constructor(apiClient = createApiClient()) {
    this.apiClient = apiClient
  }

  async listCustomers() {
    const response = await this.apiClient.requestRaw('/customers/?display=full')
    if (!response.ok) {
      return { ok: false, status: response.status, data: [] }
    }

    const doc = parseXml(response.text)
    const nodes = Array.from(doc.querySelectorAll('customer'))
    const customers = nodes.map((node) => new FrontCustomer({
      id: getXmlText(node, 'id'),
      email: getXmlText(node, 'email'),
      firstname: getXmlText(node, 'firstname'),
      lastname: getXmlText(node, 'lastname'),
      secure_key: getXmlText(node, 'secure_key'),
      anonymous: false,
    }))

    return { ok: true, status: 200, data: customers }
  }
}
