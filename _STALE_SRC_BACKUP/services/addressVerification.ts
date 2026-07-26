import { PersonMetadata } from '@/types';

const USPS_API_URL = 'https://secure.shippingapis.com/ShippingAPI.dll';

/**
 * Verifies and standardizes a US Address using the USPS Web Tools API.
 * Requires a valid USPS User ID (WebTools ID).
 */
export const verifyUSPSAddress = async (
    address: PersonMetadata['address'],
    userId: string
): Promise<{ isValid: boolean; standardized?: PersonMetadata['address']; error?: string }> => {
    
    if (!userId) {
        return { isValid: false, error: 'USPS User ID is missing in Settings.' };
    }

    if (!address?.streetAddress || !address.addressLocality || !address.addressRegion) {
        return { isValid: false, error: 'Incomplete address. Street, City, and State are required.' };
    }

    // Construct XML Request for USPS AddressValidateRequest
    const xml = `
        <AddressValidateRequest USERID="${userId}">
            <Revision>1</Revision>
            <Address ID="0">
                <Address1></Address1>
                <Address2>${address.streetAddress}</Address2>
                <City>${address.addressLocality}</City>
                <State>${address.addressRegion}</State>
                <Zip5>${address.postalCode || ''}</Zip5>
                <Zip4></Zip4>
            </Address>
        </AddressValidateRequest>
    `;

    try {
        const url = `${USPS_API_URL}?API=Verify&XML=${encodeURIComponent(xml)}`;
        const response = await fetch(url);
        const str = await response.text();
        
        // Parse XML Response
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(str, "text/xml");
        
        // Check for Error Tag
        const errorNode = xmlDoc.querySelector("Error");
        if (errorNode) {
            const desc = errorNode.querySelector("Description")?.textContent;
            return { isValid: false, error: desc || 'USPS Validation Error' };
        }

        const addressNode = xmlDoc.querySelector("Address");
        if (!addressNode) {
            return { isValid: false, error: 'No address returned.' };
        }

        // Extract Standardized Data
        const stdAddress2 = addressNode.querySelector("Address2")?.textContent || '';
        const stdCity = addressNode.querySelector("City")?.textContent || '';
        const stdState = addressNode.querySelector("State")?.textContent || '';
        const stdZip5 = addressNode.querySelector("Zip5")?.textContent || '';
        const stdZip4 = addressNode.querySelector("Zip4")?.textContent || '';

        return {
            isValid: true,
            standardized: {
                streetAddress: stdAddress2, // USPS puts the street line in Address2 for this API
                addressLocality: stdCity, // City is fully capitalized by USPS
                addressRegion: stdState,
                postalCode: stdZip4 ? `${stdZip5}-${stdZip4}` : stdZip5,
                addressCountry: 'USA'
            }
        };

    } catch (e) {
        console.error("USPS API Error", e);
        return { isValid: false, error: 'Network error or invalid response.' };
    }
};