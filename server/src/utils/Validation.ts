import { AddressCandidate, GeoLookup } from "./GeoLookup";

export const PhoneNumberValidator = /^(\d{3})[\.\-]?(\d{3})[\.\-]?(\d{4})$/;
export const EmailValidator = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
export const AddressValidator = {
  parse: async (text: string): Promise<[string | Error, AddressCandidate | null]> => {
    const parts = text.split('\n');
    if (parts.length !== 3) return [new Error(`Expected (3) lines, Received (${parts.length})`), null];
    if (parts[1].split(' ').length < 3) return [new Error('Street Address Expecting minimum: "{#} {Street} {Type}"'), null];

    const codedAddress = await GeoLookup.findAddress(parts.slice(1).join(', '));
    if (codedAddress instanceof Error) return [codedAddress, null];

    const validatedParts = codedAddress.address.split(',');
    if (validatedParts.length < 4) return [new Error(`Validated Address Expected (4) parts, Received (${validatedParts.length}`), null];
    if (validatedParts[0].split(' ').length < 3) return [new Error('Validated Street Address Expecting minimum: "{#} {Street} {Type}'), null];

    return [parts[0], codedAddress];
  }
}