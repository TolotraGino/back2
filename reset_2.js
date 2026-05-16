const protected_ids = {
    "customers": [1],
    "products": [1, 2],
    "orders": [],
};

const API_KEY = process.env.PRESTASHOP_API_KEY; 

async function delete_all(modele_name = "customers") {
    const base_url = "/api/";
    const modele_url = base_url + modele_name;
    const auth_header = `Basic ${btoa(API_KEY + ":")}`;

    try {
        const response = await fetch(modele_url, {
            headers: { 'Authorization': auth_header }
        });

        if (!response.ok) {
            throw new Error("Erreur lors de la récupération : " + modele_name);
        }

        const xml_text = await response.text();
        const parser = new DOMParser();
        const xml_doc = parser.parseFromString(xml_text, "application/xml");

        // ✅ Sélecteur plus fiable
        const container = xml_doc.getElementsByTagName(modele_name)[0];
        console.log(`Conteneur trouvé pour "${modele_name}":`, !!container);
        const items = container ? Array.from(container.children) : [];
        const all_ids = items.map(item => parseInt(item.getAttribute("id"), 10)); // ✅ radix 10

        const ids_to_exclude = protected_ids[modele_name] || [];
        const ids_to_delete = all_ids.filter(id => !ids_to_exclude.includes(id));

        console.log(`IDs à supprimer pour "${modele_name}":`, ids_to_delete);

        let success_count = 0;
        for (const id of ids_to_delete) {
            const del_response = await fetch(`${modele_url}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': auth_header }
            });
            if (!del_response.ok) {
                console.warn(`Échec suppression ID ${id}`); // ✅ on continue
            } else {
                success_count++;
            }
        }

        console.log(`${success_count}/${ids_to_delete.length} supprimés`);

    } catch (error) {
        console.error("ERREUR :", error);
        return false;
    }

    return true;
}

export default delete_all;