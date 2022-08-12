import { load } from 'cheerio';
import { HTTPSRequest } from './HTTPSRequest';

const GEO_URL = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&SingleLine=`;
const DIS_URL = `https://enterprise.firstmap.delaware.gov/arcgis/rest/services/Boundaries/DE_Political_Boundaries/MapServer/XX/`+
  `query?f=json&geometryType=esriGeometryPoint&outFields=*&geometry=`;

export type AddressResponse = {
  candidates: AddressCandidate[],
  spatialReference: {
    wkid: number
  }
};
export type AddressCandidate = {
  address: string,
  location: {
    x: number,
    y: number
  },
  score: number,
  spatialReference?: {
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

let startTime: number;

export class GeoLookup {
  static async findAddress(address: string): Promise<AddressCandidate | Error> {
    const addressResponse = JSON.parse((await HTTPSRequest.httpsGetRequest(GEO_URL+address)).toString()) as AddressResponse;
    if (!addressResponse) return new Error('Failed to load address response.');
    if (!addressResponse.candidates) return new Error(`No address candidates found:\n${JSON.stringify(addressResponse, null, 2)}`);
    const candidates = addressResponse.candidates;
    if (!candidates.length || candidates[0].score < 100)
      return new Error(`Address not found.  Closest match:\n${candidates[0].address} (${candidates[0].score}%)`);
    
    console.log(candidates[0], Date.now()-startTime);
    return { ...candidates[0], spatialReference: addressResponse.spatialReference };
  }

  static async findDistricts(address: string): Promise<GeoLocation | Error> {
    const response = await this.findAddress(address);
    if ((response as Error).message) return response as Error;
    console.log(response, Date.now()-startTime)

    const candidate = response as AddressCandidate;
    if (!candidate.spatialReference || !candidate.spatialReference.wkid)
      return new Error(`Missing spatial references:\n${JSON.stringify(candidate, null, 2)}`);
    
    if (!candidate.location || !candidate.location.x || !candidate.location.y)
      return new Error(`Missing location data:\n${JSON.stringify(candidate, null, 2)}`);

    if (!candidate.address.includes('Delaware'))
      return new Error(`Address is not in Delaware:\n${candidate.address}`);
    
    const geometry = {
      x: candidate.location.x,
      y: candidate.location.y,
      spatialReference: { wkid: candidate.spatialReference!.wkid }
    };
    const queryString = JSON.stringify(geometry);
    console.log(queryString, Date.now()-startTime)
    const districtRequests = [0, 1, 2, 3].map(i => HTTPSRequest.httpsGetRequest(DIS_URL.replace(/XX/g, i.toString())+queryString));
    console.log(districtRequests, Date.now()-startTime)
    const districtData = (await Promise.all(districtRequests)).map(response => JSON.parse(response.toString()))
      .map((data, idx) => {
        if (!data || !data.features || !data.features.length || !data.features[0].attributes)
          return new Error(`Missing response data from district query (${idx}):\n${JSON.stringify(geometry, null, 2)}`);
        return data.features[0].attributes;
      });
    console.log(districtData, Date.now()-startTime)
    
    if (!districtData) return new Error(`No district data found for queries:\n${JSON.stringify(geometry, null, 2)}`);
    const error = districtData.find(d => d instanceof Error);
    if (error) return error;

    if (!districtData.length || !districtData[0].RDED_2012)
      return new Error(`Unable to load ED data:\n${JSON.stringify(districtData, null, 2)}`);
    const electionDistrict = districtData[0].RDED_2012;

    const legDistricts = [1, 2].map(i => {
      if (!districtData[i]) return new Error(`Unable to load ${(i === 1 && 'SD') || 'RD'} data for queries:\n${JSON.stringify(geometry, null, 2)}`);
      if (!districtData[i].URL) return new Error(`Missing URL for ${(i === 1 && 'SD') || 'RD'} data:\n${JSON.stringify(districtData[i], null, 2)}`);

      return {
        district: districtData[i].DISTRICT,
        name: districtData[i].NAME,
        party: districtData[i].PARTY,
        session: districtData[i].LEGSESSION,
        url: districtData[i].URL.replace(/http/, 'https')
      };
    });
    console.log(legDistricts, Date.now()-startTime)
    const districtError = legDistricts.find(d => d instanceof Error) as Error;
    if (districtError) return districtError;
    
    if (!districtData[3]) return new Error(`Missing CD data for queries:\n${JSON.stringify(geometry, null, 2)}`);
    const countyDistrict = {
      district: districtData[3].DISTRICT,
      title: districtData[3].TITLE,
      commissioner: districtData[3].COMMISSION,
      county: districtData[3].COUNTY
    }

    if (districtData[3].ATLARGE) Object.assign(countyDistrict, { atLarge: districtData[3].ATLARGE, atLargeTitle: districtData[3].TITLE_AL });

    console.log(electionDistrict, Date.now()-startTime);
    return {
      address: candidate.address,
      ED: electionDistrict,
      RD: legDistricts[1] as Legislator,
      SD: legDistricts[0] as Legislator,
      county: countyDistrict.county,
      CD: countyDistrict
    }
  }

  static async findLegislators(address: string): Promise<GeoLocation | Error> {
    startTime = Date.now();
    const districtResponse = await this.findDistricts(address);
    console.log(districtResponse, Date.now()-startTime);

    if ((districtResponse as Error).message) return districtResponse;
    const districts = districtResponse as GeoLocation;
    const hostUrls = [districts.RD.url, districts.SD.url].map(url => /http.+\.gov/.exec(url)![0]);
    console.log(hostUrls, Date.now()-startTime);

    const redirectRequests = [districts.RD.url, districts.SD.url].map(url => HTTPSRequest.httpsGetRequest(url));
    const redirectHtmlData = (await Promise.all(redirectRequests).catch(console.error))?.map(html => html.toString());
    if (!redirectHtmlData) return districtResponse;
    console.log(redirectHtmlData, Date.now()-startTime);

    const redirectPaths = redirectHtmlData.map((data, idx) => hostUrls[idx] + /href="(.+)"/.exec(data)![1]);
    const redirectAgainRequests = redirectPaths.map(url => HTTPSRequest.httpsGetRequest(url));
    const redirectAgainHtmlData = (await Promise.all(redirectAgainRequests).catch(console.error))?.map(html => html.toString());
    if (!redirectAgainHtmlData) return districtResponse;
    console.log(redirectAgainHtmlData, Date.now()-startTime);

    const redirectAgainPaths = redirectAgainHtmlData.map((data, idx) => hostUrls[idx] + /href="(.+)"/.exec(data)![1]);
    const legRequests = redirectAgainPaths.map(url => HTTPSRequest.httpsGetRequest(url));
    const htmlData = (await Promise.all(legRequests).catch(console.error))?.map(html => html.toString());
    if (!htmlData) return districtResponse;
    console.log(`htmlData recovered`, Date.now()-startTime);

    const html = htmlData.map(data => (load(data)('.info-value > a').eq(0).text()));

    if (redirectAgainPaths?.length === 2) {
      (districtResponse as GeoLocation).RD.url = redirectAgainPaths[0];
      (districtResponse as GeoLocation).SD.url = redirectAgainPaths[1];
    }

    if (html?.length === 2) {
      (districtResponse as GeoLocation).RD.email = html[0];
      (districtResponse as GeoLocation).SD.email = html[1];
    }
    console.log(districtResponse, Date.now()-startTime);
    
    return districtResponse;
  }
}