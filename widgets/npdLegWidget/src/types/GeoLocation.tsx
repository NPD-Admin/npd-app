import { Legislator } from './Legislator';
import { County } from './County';

export type GeoLocation = {
  address: string;
  RD: Legislator;
  SD: Legislator;
  ED: string;
  CD: {
    district: string;
    title: string;
    commissioner: string;
    county: County;
    atLarge?: string;
    atLargeTitle?: string;
  };
  county: County;
};
