import { GoogleApis, people_v1 } from "googleapis"
import { GaxiosResponse } from "googleapis-common";
import { ErrorGenerator } from "../ErrorGenerator";

type Person = {
  emailAddress: string
  displayName: string
};

export const idUser = async (google: GoogleApis): Promise<Person | Error> => {
  const profile = await google.people('v1').people.get({
    resourceName: 'people/me',
    personFields: 'emailAddresses,names'
  }).catch(e => ErrorGenerator.generate({ e, message: 'Failed to identify logged in Google User:' }));
  if (profile instanceof Error) return profile;

  if (
       !profile.data.emailAddresses
    || !profile.data.emailAddresses.length
    || !profile.data.emailAddresses[0]
    || !profile.data.emailAddresses[0].value

    || !profile.data.names
    || !profile.data.names.length
    || !profile.data.names[0]
    || !profile.data.names[0].displayName
  ) return ErrorGenerator.generate({ e: profile, message: 'Unable to find required data on Google<people_v1.Schema$Person> object:' });

  return {
    emailAddress: profile.data.emailAddresses![0].value!,
    displayName: profile.data.names![0].displayName!
  }
};