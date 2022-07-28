import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Spinner } from "react-bootstrap";
import { Legislator } from "../types/Legislator";

import "./LegCard.css";

type Props = { legData: Legislator; title: string };

export const LegCard = ({ legData, title }: Props) => {
  const [image, setImage] = useState("");
  const mounted = useRef(false);

  function titleVariant(type: number) {
    if (title === "Representative") return title;
    if (!type) return "Senate";
    else return "Senator";
  }

  const getImage = useCallback(
    async function () {
      const res = await fetch(
        `https://npd-server.herokuapp.com/api/scrapeImage?url=${legData.url}`
      );
      const data = await res.text();
      setImage(data);
    },
    [setImage, legData.url]
  );

  useEffect(() => {
    if (!mounted.current) {
      getImage();
    }
    return () => {
      mounted.current = true;
    };
  }, [mounted, getImage]);

  return (
    <Card body className="LegViewer-Card">
      {!image && (
        <div className="overlay">
          <Spinner className="overlay-spinner" animation="border" />
        </div>
      )}
      <div style={{ maxWidth: "275px" }}>
        <Card.Title>
          {titleVariant(0)} District {legData.district}
        </Card.Title>
        <Card.Subtitle className="LegCard-Subtitle">
          {titleVariant(1)}{" "}
          <a href={legData.url} rel="noreferrer" target="_blank">
            {legData.name}
          </a>
        </Card.Subtitle>
        <Card.Text>
          {legData.party === "R" && "Republican"}
          {legData.party === "D" && "Democratic"}
        </Card.Text>
        <Card.Text>
          <a href={`mailto:${legData.email}`} target="_blank" rel="noreferrer">
            {legData.email}
          </a>
        </Card.Text>
      </div>
      {image && (
        <img className="avatar" src={image} alt={`${legData.name}-avatar`} />
      )}
    </Card>
  );
};
