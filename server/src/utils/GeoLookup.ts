import { load } from 'cheerio';
import { Text } from 'domhandler';
import { HTTPSRequest } from './HTTPSRequest';

const GEO_URL = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&SingleLine=`;
const DIS_URL = `https://enterprise.firstmap.delaware.gov/arcgis/rest/services/Boundaries/DE_Political_Boundaries/MapServer/XX/`+
  `query?f=json&geometryType=esriGeometryPoint&outFields=*&geometry=`;

export type AddressResponse = { candidates: AddressCandidate[] };
export type AddressCandidate = {
  address: string,
  location: {
    x: number,
    y: number
  },
  score: number,
  spatialReference: {
    wkid: number
  }
};
export type County = "New Castle" | "Kent" | "Sussex";
export type Legislator = {
  district: string,
  name: string,
  party: string,
  session: string,
  url: string,
  email?: string
};
export type GeoLocation = {
  address: string;
  RD: Legislator;
  SD: Legislator;
  ED: string;
  CD: { district: string, title: string, commissioner: string, county: County, atLarge?: string, atLargeTitle?: string };
  county: County;
};

export class GeoLookup {
  static async findAddress(address: string): Promise<AddressCandidate | Error> {
    const addressResponse = JSON.parse((await HTTPSRequest.httpsGetRequest(GEO_URL+address)).toString()) as AddressResponse;
    const candidates = addressResponse.candidates;
    if (!candidates.length || candidates[0].score < 100)
      return new Error(`Address not found.  Closest match:\n${candidates[0].address} (${candidates[0].score}%)`);
    
    return candidates[0];
  }

  static async findDistricts(address: string): Promise<GeoLocation | Error> {
    const response = await this.findAddress(address);
    if ((response as Error).message) return response as Error;

    const candidate = response as AddressCandidate;
    const geometry = {
      x: candidate.location.x,
      y: candidate.location.y,
      spatialReference: { wkid: candidate.spatialReference.wkid }
    };
    const queryString = JSON.stringify(geometry);
    const districtRequests = [0, 1, 2, 3].map(i => HTTPSRequest.httpsGetRequest(DIS_URL.replace(/XX/g, i.toString())+queryString));
    const districtData = (await Promise.all(districtRequests)).map(response => JSON.parse(response.toString())).map(data => data.features[0].attributes);

    const electionDistrict = districtData[0].RDED_2012;

    const legDistricts = [1, 2].map(i => ({
      district: districtData[i].DISTRICT,
      name: districtData[i].NAME,
      party: districtData[i].PARTY,
      session: districtData[i].LEGSESSION,
      url: districtData[i].URL.replace(/http/, 'https')
    }));
    
    const countyDistrict = {
      district: districtData[3].DISTRICT,
      title: districtData[3].TITLE,
      commissioner: districtData[3].COMMISSION,
      county: districtData[3].COUNTY
    }

    if (districtData[3].ATLARGE) Object.assign(countyDistrict, { atLarge: districtData[3].ATLARGE, atLargeTitle: districtData[3].TITLE_AL });

    return {
      address: candidate.address,
      ED: electionDistrict,
      RD: legDistricts[1],
      SD: legDistricts[0],
      county: countyDistrict.county,
      CD: countyDistrict
    }
  }

  static async findLegislators(address: string): Promise<GeoLocation | Error> {
    const districtResponse = await this.findDistricts(address);

    if ((districtResponse as Error).message) return districtResponse;
    const districts = districtResponse as GeoLocation;
    const hostUrls = [districts.RD.url, districts.SD.url].map(url => /http.+\.gov/.exec(url)![0]);

    const redirectRequests = [districts.RD.url, districts.SD.url].map(url => HTTPSRequest.httpsGetRequest(url));
    const redirectHtmlData = (await Promise.all(redirectRequests).catch(console.error))?.map(html => html.toString());
    const redirectPaths = redirectHtmlData?.map((data, idx) => hostUrls[idx] + /href="(.+)"/.exec(data)![1]);

    const redirectAgainRequests = redirectPaths!.map(url => HTTPSRequest.httpsGetRequest(url));
    const redirectAgainHtmlData = (await Promise.all(redirectAgainRequests).catch(console.error))?.map(html => html.toString());
    const redirectAgainPaths = redirectAgainHtmlData?.map((data, idx) => hostUrls[idx] + /href="(.+)"/.exec(data)![1]);

    const legRequests = redirectAgainPaths!.map(url => HTTPSRequest.httpsGetRequest(url));
    const htmlData = (await Promise.all(legRequests).catch(console.error))?.map(html => html.toString());
    const html = htmlData?.map(data => (load(data)('.info-value > a')[0].children[0] as Text).data);

    if (redirectAgainPaths?.length === 2) {
      (districtResponse as GeoLocation).RD.url = redirectAgainPaths[0];
      (districtResponse as GeoLocation).SD.url = redirectAgainPaths[1];
    }

    if (html?.length === 2) {
      (districtResponse as GeoLocation).RD.email = html[0];
      (districtResponse as GeoLocation).SD.email = html[1];
    }
    
    return districtResponse;
  }
}