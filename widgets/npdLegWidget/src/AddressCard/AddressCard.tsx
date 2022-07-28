import { Card } from "react-bootstrap";
import { GeoLocation } from "../types/GeoLocation";

import "./AddressCard.css";

type Props = {
  address: GeoLocation["address"];
  ed: GeoLocation["ED"];
};

export const AddressCard = ({ address, ed }: Props) => {
  function formatAddress() {
    const parts = address.split(", ");
    const cityIdx = parts.length - 3;
    const addr = parts.slice(0, cityIdx).join(", ");
    const city = parts.slice(cityIdx);
    return [addr, `${city[0]}, ${city[1]} ${city[2]}`].join("\n");
  }

  function getRD() {
    return ed.split("-")[0];
  }

  function getED() {
    return ed.split("-")[1];
  }

  return (
    <Card body className="LegViewer-Card">
      <Card.Title>Representative District {getRD()}</Card.Title>
      <Card.Subtitle className="AddressCard-Subtitle">
        Election District {getED()}
      </Card.Subtitle>
      <Card.Text style={{ whiteSpace: "pre-wrap" }}>
        {formatAddress()}
      </Card.Text>
    </Card>
  );
};
